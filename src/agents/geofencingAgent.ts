/**
 * Geofencing Agent — maritime boundary and restricted-water surveillance.
 *
 * Handles both question shapes with one spatial kernel:
 *   - "which zones should I avoid?"        → zones near the *corridor*
 *   - "am I near a protected area?"        → zones near the *position*
 *
 * Zones are compared with their statutory buffer folded in, because entering
 * the buffer of an MPA is already reportable in most Indian port rules even
 * though the boundary itself has not been crossed.
 */

import { GeofenceViolation, GeofenceZone, GeofenceSeverity, RiskLevel } from '../types';
import { AgentContext, AgentDefinition, defineAgent, ev, finding, ok, publish, worst } from './base';
import { GEOFENCES } from '../core/dataAccess';
import {
  distanceToPolygonKm,
  haversineKm,
  initialBearingDeg,
  pointInPolygon,
  polygonCentroid,
  roundTo,
} from '../core/geo';

const SEVERITY_RISK: Record<GeofenceSeverity, RiskLevel> = {
  INFO: 'LOW',
  MODERATE: 'MODERATE',
  HIGH: 'HIGH',
  CRITICAL: 'SEVERE',
};

/** Distance from a point to a zone, ignoring the statutory buffer. */
export function distanceToZoneKm(
  zone: GeofenceZone,
  point: { latitude: number; longitude: number },
): number {
  if (zone.shape === 'circle' && zone.center && zone.radiusKm !== undefined) {
    return roundTo(Math.max(0, haversineKm(point, zone.center) - zone.radiusKm), 1);
  }
  if (zone.shape === 'line' || zone.shape === 'polygon') {
    return roundTo(distanceToPolygonKm(point, zone.coordinates), 1);
  }
  return Number.POSITIVE_INFINITY;
}

function evaluateZone(
  zone: GeofenceZone,
  point: { latitude: number; longitude: number },
): GeofenceViolation {
  const anchor =
    zone.shape === 'circle' && zone.center ? zone.center : polygonCentroid(zone.coordinates);
  const bearingDeg = initialBearingDeg(point, anchor);
  const raw = distanceToZoneKm(zone, point);
  const inside =
    zone.shape === 'circle' && zone.center
      ? haversineKm(point, zone.center) <= (zone.radiusKm ?? 0)
      : zone.shape === 'polygon'
        ? pointInPolygon(point, zone.coordinates)
        : raw === 0;

  return {
    boundaryId: zone.id,
    boundaryName: zone.name,
    boundaryType: zone.type,
    // Distance to the zone boundary itself, not to the buffer edge: a vessel
    // inside the statutory buffer must read "within 5 km statutory buffer",
    // never a clamped "0 km".
    distanceKm: roundTo(raw, 1),
    bearing: `${compass16(bearingDeg)} (${Math.round(bearingDeg)}°)`,
    severity: zone.severity,
    inside,
    withinBuffer: !inside && raw <= zone.bufferKm,
    bufferKm: zone.bufferKm,
    regulation: zone.regulation,
    description: zone.description,
  };
}

export const geofencingAgent: AgentDefinition = defineAgent(
  'GEOFENCING_AGENT',
  (context: AgentContext) => {
    const { book } = context;
    const position = context.position;
    const zone = context.artifacts.activeZone;

    // A "which zones should I avoid" question is about the journey, not the
    // dock, so the corridor (harbour → fishing ground) is scanned as well.
    const route = context.artifacts.routeData;
    const corridorPoints: Array<{ latitude: number; longitude: number }> = route?.track
      ? route.track.map(([latitude, longitude]) => ({ latitude, longitude }))
      : [];

    const evaluated = GEOFENCES.map((fence) => {
      const fromPosition = evaluateZone(fence, position);
      // "Off the plotted track" has no meaning without a track: no route was
      // requested, so no fence can be a corridor threat. Starting at 0 made
      // every boundary in the gazetteer look like a 0-km violation whenever a
      // generic situation report had no plotted track.
      const alongCorridor =
        corridorPoints.length > 0
          ? Math.min(...corridorPoints.map((p) => distanceToZoneKm(fence, p)))
          : Number.POSITIVE_INFINITY;
      return { fence, fromPosition, alongCorridor };
    }).sort((a, b) => a.fromPosition.distanceKm - b.fromPosition.distanceKm);

    const nearby = evaluated
      .filter(
        (e) =>
          e.fromPosition.inside ||
          e.fromPosition.withinBuffer ||
          e.fromPosition.distanceKm - e.fromPosition.bufferKm <= 120,
      )
      .slice(0, 6);

    const corridorThreats = evaluated
      .filter((e) => e.alongCorridor < 25)
      .sort((a, b) => a.alongCorridor - b.alongCorridor);

    // "Avoid" questions want the wide list; "am I near" wants the tight one.
    // Even the wide list stays regional: a CRITICAL boundary 700 km away is
    // trivia, not a reason to stay ashore.
    const avoidQuestion =
      context.parsed.intent === 'AVOID_ZONES' ||
      context.parsed.intent === 'GEOFENCE_PROXIMITY' ||
      context.parsed.intent === 'SAFE_ROUTE';

    const avoidRelevant = (e: (typeof evaluated)[number]): boolean =>
      e.fromPosition.inside ||
      e.fromPosition.withinBuffer ||
      e.fromPosition.distanceKm - e.fromPosition.bufferKm <= 350;

    const candidates = avoidQuestion
      ? evaluated.filter((e) => e.fence.severity !== 'INFO' && avoidRelevant(e)).slice(0, 7)
      : nearby;

    const violations = candidates.map((e) => e.fromPosition);
    const warnings: string[] = [];

    for (const entry of corridorThreats) {
      warnings.push(
        `${entry.fence.name} lies ${roundTo(entry.alongCorridor, 1)} km off the plotted track — keep ${entry.fence.bufferKm} km clear.`,
      );
    }

    const geofencingData = {
      violations: violations.filter(
        (v) => v.inside || v.withinBuffer || v.distanceKm - v.bufferKm <= 15,
      ),
      nearbyBoundaries: violations,
      warnings,
      source: 'ORCA maritime boundary database (derived from publicly notified limits)',
    };
    context.artifacts.geofencingData = geofencingData;

    const worstLevel = violations.length
      ? worst(...violations.map((v) => SEVERITY_RISK[v.severity]))
      : 'LOW';

    const findings = [];

    if (violations.length === 0) {
      findings.push(
        finding(
          `No maritime boundary, marine protected area or restricted water lies within 120 km of ${context.anchor.label}${zone ? ` on the corridor to ${zone.name}` : ''}.`,
          {
            confidence: 0.75,
            evidence: [ev('Zones evaluated', String(GEOFENCES.length), 'ORCA maritime boundary database')],
          },
        ),
      );
    } else {
      for (const violation of violations.slice(0, 4)) {
        findings.push(
          finding(
            violation.inside
              ? `You are INSIDE ${violation.boundaryName} (${violation.boundaryType.replace(/_/g, ' ').toLowerCase()}). ${violation.regulation}`
              : `${violation.boundaryName} is ${violation.distanceKm} km ${violation.bearing} — ${violation.regulation}`,
            {
              confidence: 0.9,
              riskLevel: SEVERITY_RISK[violation.severity],
              evidence: [
                ev('Zone', violation.boundaryType.replace(/_/g, ' ').toLowerCase(), 'ORCA maritime boundary database'),
                ev('Statutory buffer', `${GEOFENCES.find((f) => f.id === violation.boundaryId)?.bufferKm ?? 0} km`, 'Notified limit'),
                ev('Distance', `${violation.distanceKm} km`, 'ORCA geodesic engine'),
              ],
            },
          ),
        );
      }
    }

    if (corridorThreats.length > 0) {
      findings.push(
        finding(
          `The planned track passes within 25 km of ${corridorThreats.length} regulated zone${corridorThreats.length === 1 ? '' : 's'}: ${corridorThreats
            .slice(0, 3)
            .map((c) => c.fence.name)
            .join(', ')}.`,
          {
            confidence: 0.85,
            riskLevel: worst(...corridorThreats.map((c) => SEVERITY_RISK[c.fence.severity])),
            evidence: corridorThreats
              .slice(0, 3)
              .map((c) => ev(c.fence.name, `${roundTo(c.alongCorridor, 1)} km off track`, 'ORCA route scan')),
          },
        ),
      );
    }

    context.artifacts.riskNotes = [
      ...(context.artifacts.riskNotes ?? []),
      {
        agent: 'GEOFENCING_AGENT',
        level: worstLevel,
        reason:
          violations[0]?.inside
            ? `Position is inside ${violations[0].boundaryName}.`
            : violations[0]
              ? `Nearest regulated zone ${violations[0].boundaryName} ${book.ui.atWord} ${violations[0].distanceKm} km.`
              : 'No regulated zone in range.',
      },
    ];

    publish(context, {
      id: 'viz-geofences',
      type: 'map',
      title: book.labels.avoid,
      subtitle: 'Maritime boundaries, MPAs and restricted waters',
      geo: {
        points: [],
        circles: GEOFENCES.filter((f) => f.shape === 'circle').map((f) => ({
          id: f.id,
          label: f.name,
          latitude: f.center?.latitude ?? 0,
          longitude: f.center?.longitude ?? 0,
          radiusKm: f.radiusKm ?? 20,
          color: severityColor(f.severity),
          level: 'restricted' as const,
        })),
        polygons: GEOFENCES.filter((f) => f.shape === 'polygon').map((f) => ({
          id: f.id,
          label: f.name,
          ring: f.coordinates,
          color: severityColor(f.severity),
        })),
      },
    });

    return ok(
      findings,
      violations.length > 0
        ? book.ui.zonesTrackedWord
            .replace('{n}', String(violations.length))
            .replace('{name}', violations[0].boundaryName)
            .replace('{distance}', String(violations[0].distanceKm))
        : book.ui.noZonesWord,
      ['ORCA maritime boundary database', 'MBZ registry'],
      worstLevel === 'SEVERE' || worstLevel === 'HIGH' ? ['RISK_VALIDATION_AGENT'] : [],
    );
  },
);

const severityColor = (severity: GeofenceSeverity): string =>
  severity === 'CRITICAL'
    ? '#dc2626'
    : severity === 'HIGH'
      ? '#f97316'
      : severity === 'MODERATE'
        ? '#eab308'
        : '#38bdf8';

const COMPASS_16 = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
];

const compass16 = (deg: number): string =>
  COMPASS_16[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];

export { SEVERITY_RISK };
