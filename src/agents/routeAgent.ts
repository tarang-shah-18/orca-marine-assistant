/**
 * Route Optimization Agent — safest-corridor planner.
 *
 * Not a shortest-path solver: a straight line through a 3 m swell sector is the
 * most dangerous thing ORCA could hand a small craft. The planner therefore
 * evaluates three candidate corridors and scores them on a safety index:
 *
 *   1. the great circle (baseline),
 *   2. a lateral offset corridor that steers clear of any hazard cell,
 *   3. an inshore corridor that trades distance for shelter.
 *
 * Every candidate is walked at 1/24th of the leg length so hazard cells, reef
 * and protected areas are tested along the whole track, not just the midpoint.
 */

import {
  GeofenceViolation,
  RiskLevel,
  RouteData,
  RouteSegment,
  RouteWaypoint,
} from '../types';
import {
  AgentContext,
  AgentDefinition,
  RISK_RANK,
  defineAgent,
  ev,
  finding,
  ok,
  publish,
  riskFromWaveHeight,
  riskFromWind,
  worst,
} from './base';
import { GEOFENCES, HAZARD_CELLS, HazardCell, VESSEL_BY_ID } from '../core/dataAccess';
import { liveDataCycle } from '../core/live';
import {
  distanceToPolygonKm,
  greatCirclePath,
  haversineKm,
  initialBearingDeg,
  offsetPerpendicular,
  pathLengthKm,
  roundTo,
  compassPoint,
} from '../core/geo';
import type { LatLon } from '../core/geo';
import type { Phrasebook } from '../core/i18n';
import { vesselName } from '../core/localize';

const RANK_TO_RISK: RiskLevel[] = ['LOW', 'MODERATE', 'HIGH', 'SEVERE'];
const WALK_STEPS = 24;
/**
 * Distance from a hazard cell at which ambient sea state starts to be penalised.
 * A track that passes inside a cell is scored at the cell's own severity
 * (`clearance <= 0`); a track that passes just outside is scored by the ramp in
 * `worstExposure`, which fades in below this radius. There is deliberately no
 * hard "within 12 km of a cell" buffer on top of that: a near miss is not a
 * crossing, and labelling it one would send a fisher looking for a hazard they
 * did not enter.
 */
const NEAR_MISS_KM = 6;

export const routeAgent: AgentDefinition = defineAgent(
  'ROUTE_OPTIMIZATION_AGENT',
  (context: AgentContext) => {
    const { book } = context;
    const vessel = context.vessel;
    const originHarbor = context.harbor;
    const destination = context.artifacts.activeZone;

    if (!destination) {
      return ok(
        [
          finding(
            'No destination fishing ground is in context, so ORCA cannot plot a corridor. Ask where the nearest fishing ground is first, or name a destination harbour.',
            { confidence: 0.4 },
          ),
        ],
        'Route planning skipped: no destination resolved.',
        ['ORCA routing engine'],
      );
    }

    const requested = VESSEL_BY_ID[context.parsed.vesselId] ?? vessel;
    const vesselProfile = VESSEL_BY_ID[requested.id] ?? VESSEL_BY_ID.motorized_dinghy;

    const candidates: RouteData[] = [
      buildRoute('great-circle', originHarbor, destination, vesselProfile, 0, book),
      buildOffsetCorridor(originHarbor, destination, vesselProfile, 'starboard', +1, book),
      buildOffsetCorridor(originHarbor, destination, vesselProfile, 'inshore', -1, book),
    ].filter(Boolean) as RouteData[];

    const oceanSource = liveDataCycle().label.includes('Live')
      ? 'Open-Meteo marine (live sea-state field)'
      : 'Reference ocean snapshot';

    candidates.sort((a, b) => b.safetyScore - a.safetyScore);

    const best = candidates[0];
    const alternatives = candidates.slice(1, 3).map((r) => ({ ...r, alternatives: [] }));
    const route: RouteData = { ...best, alternatives };

    context.artifacts.routeData = route;
    context.artifacts.safetyScore = route.safetyScore;

    const findings = [
      finding(
        book.ui.corridorSummaryWord
          .replace('{from}', originHarbor.shortName)
          .replace('{to}', destination.name)
          .replace('{km}', String(roundTo(route.totalDistanceKm, 1)))
          .replace('{eta}', route.estimatedTimeHours)
          .replace('{speed}', String(vesselProfile.speedKnots))
          .replace('{score}', String(route.safetyScore))
          .replace('{risk}', riskWord(book, route.riskLevel)),
        {
          confidence: 0.82,
          evidence: [
            ev(book.evidenceKeys.safetyScore, `${route.safetyScore}/100`, 'ORCA routing engine'),
            ev(book.evidenceKeys.eta, route.estimatedTimeHours, 'ORCA routing engine'),
            ev(book.evidenceKeys.vessel, vesselProfile.label, 'ORCA vessel profile'),
              ev(book.evidenceKeys.distanceFromPort, `${roundTo(route.totalDistanceKm, 1)} km`, 'ORCA geodesic engine'),
            ev('Distance', `${roundTo(route.totalDistanceKm, 1)} km`, 'ORCA geodesic engine'),
          ],
          riskLevel: route.riskLevel,
        },
      ),
    ];

    const exposed = route.segments.filter((s) => s.riskLevel === 'HIGH' || s.riskLevel === 'SEVERE');
    if (exposed.length > 0) {
      findings.push(
        finding(
          `${exposed.length} leg${exposed.length === 1 ? '' : 's'} of the route ${exposed.length === 1 ? 'is' : 'are'} above the ${vesselProfile.maxWaveHeightMeters} m / ${vesselProfile.maxWindKnots} kt limit for this vessel. ${exposed[0].reasons.join('; ')}.`,
          {
            confidence: 0.85,
            riskLevel: worst(...exposed.map((s) => s.riskLevel)),
            evidence: exposed.map((s) =>
              ev(`${s.from} → ${s.to}`, `${s.maxWaveHeightMeters} m / ${s.maxWindKnots} kt`, oceanSource),
            ),
          },
        ),
      );
    }

    if (alternatives.length > 0) {
      findings.push(
        finding(
          `Alternatives considered: ${alternatives
            .map((a) => `${a.recommendation.split('.')[0]} (${a.safetyScore}/100, ${roundTo(a.totalDistanceKm, 0)} km)`)
            .join('; ')}.`,
          {
            confidence: 0.7,
            evidence: alternatives.map((a) => ev('Alternative', `${a.safetyScore}/100`, 'ORCA routing engine')),
          },
        ),
      );
    }

    context.artifacts.riskNotes = [
      ...(context.artifacts.riskNotes ?? []),
      {
        agent: 'ROUTE_OPTIMIZATION_AGENT',
        level: route.riskLevel,
        reason: `Corridor safety score ${route.safetyScore}/100 across ${route.segments.length} legs.`,
      },
    ];

    publish(context, {
      id: 'viz-route',
      type: 'route',
      title: book.labels.route,
      subtitle: `${originHarbor.shortName} → ${destination.name}`,
      geo: {
        points: route.track,
        circles: [
          {
            id: 'origin',
            label: originHarbor.shortName,
            latitude: originHarbor.latitude,
            longitude: originHarbor.longitude,
            radiusKm: 6,
            color: '#22c55e',
            level: 'favorable' as const,
          },
          {
            id: 'destination',
            label: destination.name,
            latitude: destination.latitude,
            longitude: destination.longitude,
            radiusKm: destination.radiusKm,
            color: '#38bdf8',
            level: 'favorable' as const,
          },
          ...HAZARD_CELLS.filter((h) =>
            route.waypoints.some((w) => haversineKm({ latitude: w.latitude, longitude: w.longitude }, { latitude: h.center[0], longitude: h.center[1] }) < h.radiusKm + 90),
          ).map((h) => ({
            id: h.id,
            label: h.name,
            latitude: h.center[0],
            longitude: h.center[1],
            radiusKm: h.radiusKm,
            color: '#ef4444',
            level: 'hazard' as const,
          })),
        ],
        polygons: [],
      },
    });

    return ok(
      findings,
      `${route.recommendation}`,
      ['ORCA routing engine', oceanSource],
      ['GEOFENCING_AGENT'],
    );
  },
);

/* ------------------------------------------------------------------ *
 * Corridor construction
 * ------------------------------------------------------------------ */

type Endpoint = { latitude: number; longitude: number; name: string };

function buildRoute(
  label: string,
  origin: Endpoint,
  destination: Endpoint,
  vessel: { maxWaveHeightMeters: number; maxWindKnots: number; speedKnots: number; label: string; id: string },
  offsetKm: number,
  book: Phrasebook,
): RouteData | null {
  const directBearing = initialBearingDeg(origin, destination);
  const directDistance = haversineKm(origin, destination);

  // The anchors are pure geometry — they are derived from the endpoints and
  // carry no name, so they are LatLon rather than Endpoint.
  let anchorA: LatLon = origin;
  let anchorB: LatLon = destination;

  if (offsetKm !== 0) {
    const shift = Math.min(offsetKm, directDistance * 0.28);
    anchorA = offsetPerpendicular(origin, directBearing, shift);
    anchorB = offsetPerpendicular(destination, directBearing + 180, shift);
  }

  const raw = greatCirclePath(anchorA, anchorB, WALK_STEPS);
  const points = offsetKm === 0 ? raw : [origin, ...raw, destination];

  const totalDistanceKm = roundTo(pathLengthKm(points), 1);
  const speedKnots = vessel.speedKnots;
  const totalHours = totalDistanceKm / speedKnots;

  const segments: RouteSegment[] = [];
  const waypoints: RouteWaypoint[] = [];
  const riskSegments: RouteData['riskSegments'] = [];
  const perSegment = Math.max(2, Math.floor(points.length / 3) - 1);
  let worstExposureOnRoute: Exposure = { wave: 0, wind: 0, minHazardClearanceKm: Number.POSITIVE_INFINITY };

  for (let i = 0; i + perSegment < points.length; i += perSegment) {
    const slice = points.slice(i, i + perSegment + 1);
    if (slice.length < 2) break;

    const exposure = worstExposure(slice, vessel);
    if (exposure.wave > worstExposureOnRoute.wave) worstExposureOnRoute = exposure;
    const distanceKm = roundTo(pathLengthKm(slice), 1);
    const bearingDeg = initialBearingDeg(slice[0], slice[slice.length - 1]);
    const hours = roundTo(distanceKm / speedKnots, 1);

    const reasons: string[] = [];
    if (exposure.hazard) reasons.push(`crosses ${exposure.hazard.name} — ${exposure.hazard.reason}`);
    if (exposure.wave > vessel.maxWaveHeightMeters) {
      reasons.push(`seas to ${exposure.wave} m exceed the ${vessel.maxWaveHeightMeters} m limit`);
    }
    if (exposure.wind > vessel.maxWindKnots) {
      reasons.push(`winds to ${exposure.wind} kt exceed the ${vessel.maxWindKnots} kt limit`);
    }
    if (reasons.length === 0) reasons.push('clear of hazard cells and within vessel limits');

    const riskLevel = worst(
      riskFromWaveHeight(exposure.wave),
      riskFromWind(exposure.wind),
      exposure.hazard ? advisoryRisk(exposure.hazard.advisoryLevel) : 'LOW',
    );

    const segment: RouteSegment = {
      index: segments.length,
      from: waypointLabel(points, i, origin, destination),
      to: waypointLabel(points, i + perSegment, origin, destination),
      distanceKm,
      bearing: `${compassPoint(bearingDeg)} (${Math.round(bearingDeg)}°)`,
      estimatedHours: hours,
      maxWaveHeightMeters: exposure.wave,
      maxWindKnots: exposure.wind,
      riskLevel,
      weatherWindow:
        riskLevel === 'LOW' ? 'FAVORABLE' : riskLevel === 'MODERATE' ? 'MARGINAL' : 'UNFAVORABLE',
      reasons,
    };
    segments.push(segment);

    if (riskLevel === 'HIGH' || riskLevel === 'SEVERE') {
      riskSegments.push({ segment: `${segment.from} → ${segment.to}`, riskLevel, reason: reasons[0] });
    }

    waypoints.push({
      latitude: slice[slice.length - 1].latitude,
      longitude: slice[slice.length - 1].longitude,
      name: segment.to,
      etaHours: roundTo(totalHours * ((i + perSegment) / Math.max(1, points.length - 1)), 1),
      riskLevel,
      notes: reasons[0],
    });
  }

  const safetyScore = scoreRoute(segments, totalDistanceKm, vessel);
  const riskLevel = RANK_TO_RISK[Math.min(3, Math.round((100 - safetyScore) / 26))];
  const geofenceConflicts = scanGeofences(points);

  return {
    id: `route-${label}-${origin.name.toLowerCase().replace(/\s+/g, '-')}`,
    vesselType: vessel.id,
    vesselLabel: vesselName(vessel, book).label,
    speedKnots,
    origin: { latitude: origin.latitude, longitude: origin.longitude, name: origin.name },
    destination: { latitude: destination.latitude, longitude: destination.longitude, name: destination.name },
    track: points.map((p) => [roundTo(p.latitude, 4), roundTo(p.longitude, 4)] as [number, number]),
    waypoints,
    segments,
    totalDistanceKm,
    estimatedTimeHours: formatHours(totalHours),
    safetyScore,
    riskLevel,
    riskSegments,
    alternatives: [],
    geofenceConflicts,
    recommendation: describeRoute(label, safetyScore, totalDistanceKm, riskLevel, worstExposureOnRoute, book),
  };
}

function buildOffsetCorridor(
  origin: Endpoint,
  destination: Endpoint,
  vessel: { maxWaveHeightMeters: number; maxWindKnots: number; speedKnots: number; label: string; id: string },
  side: 'starboard' | 'inshore',
  sign: number,
  book: Phrasebook,
): RouteData | null {
  // Two-pass search: start with a generous offset and shrink it until the
  // corridor is actually clear. Crude, but deterministic and explainable.
  const directDistance = haversineKm(origin, destination);
  let best: RouteData | null = null;

  for (const fraction of [0.18, 0.12, 0.08, 0.05, 0.03]) {
    const candidate = buildRoute(side, origin, destination, vessel, roundTo(directDistance * fraction * sign, 1), book);
    if (!candidate) continue;
    if (!best || candidate.safetyScore > best.safetyScore) best = candidate;
    if (candidate.riskLevel === 'LOW' && candidate.geofenceConflicts.length === 0) break;
  }

  return best;
}

interface Exposure {
  wave: number;
  wind: number;
  hazard?: HazardCell;
  minHazardClearanceKm: number;
}

function worstExposure(
  points: Array<{ latitude: number; longitude: number }>,
  _vessel: { maxWaveHeightMeters: number },
): Exposure {
  let wave = 0;
  let wind = 0;
  let hazard: HazardCell | undefined;
  let bestClearance = Number.POSITIVE_INFINITY;

  for (const point of points) {
    for (const cell of HAZARD_CELLS) {
      const clearance = roundTo(haversineKm(point, { latitude: cell.center[0], longitude: cell.center[1] }) - cell.radiusKm, 1);
      if (clearance < bestClearance) bestClearance = clearance;
      if (clearance <= 0 && (!hazard || cell.maxWaveHeightMeters > hazard.maxWaveHeightMeters)) {
        hazard = cell;
      }
    }
  }

  if (hazard) {
    wave = Math.max(wave, hazard.maxWaveHeightMeters);
    wind = Math.max(wind, hazard.maxWindKnots);
  } else {
    // Ambient sea state away from any cell: a fraction of the worst cell in the
    // region, which keeps the baseline corridor non-trivially scored. A track
    // that clears a cell by less than NEAR_MISS_KM is not "safe" — it is
    // exposed, and this ramp is what says so.
    const ambientWave = roundTo(1.2 + Math.max(0, NEAR_MISS_KM - bestClearance) * 0.12, 1);
    const ambientWind = Math.round(10 + Math.max(0, NEAR_MISS_KM - bestClearance) * 1.6);
    wave = Math.max(wave, ambientWave);
    wind = Math.max(wind, ambientWind);
  }

  return { wave, wind, hazard, minHazardClearanceKm: bestClearance };
}

const advisoryRisk = (level: HazardCell['advisoryLevel']): RiskLevel =>
  level === 'RED' ? 'SEVERE' : level === 'ORANGE' ? 'HIGH' : level === 'YELLOW' ? 'MODERATE' : 'LOW';

function scoreRoute(
  segments: RouteSegment[],
  totalDistanceKm: number,
  vessel: { maxWaveHeightMeters: number; maxWindKnots: number },
): number {
  if (segments.length === 0) return 0;

  // Penalties for exposure, weighted by how much of the route is affected.
  const severityPenalty = segments.reduce((acc, s) => {
    const share = s.distanceKm / Math.max(1, totalDistanceKm);
    const waveExcess = Math.max(0, s.maxWaveHeightMeters - vessel.maxWaveHeightMeters);
    const windExcess = Math.max(0, s.maxWindKnots - vessel.maxWindKnots);
    return acc + share * (RISK_RANK[s.riskLevel] * 14 + waveExcess * 9 + windExcess * 4);
  }, 0);

  // Distance penalty: beyond ~120 km the fatigue and fuel exposure matter.
  const distancePenalty = Math.max(0, totalDistanceKm - 120) * 0.045;

  return Math.max(5, Math.min(100, Math.round(100 - severityPenalty - distancePenalty)));
}

function scanGeofences(points: Array<{ latitude: number; longitude: number }>): GeofenceViolation[] {
  const conflicts: GeofenceViolation[] = [];

  for (const fence of GEOFENCES) {
    if (fence.shape === 'circle' && fence.center) continue; // handled by the geofencing agent
    let minDistance = Number.POSITIVE_INFINITY;
    for (const point of points) {
      minDistance = Math.min(minDistance, distanceToPolygonKm(point, fence.coordinates));
    }
    if (minDistance <= fence.bufferKm) {
      const bearingDeg = initialBearingDeg(points[0], polygonCentre(fence.coordinates));
      conflicts.push({
        boundaryId: fence.id,
        boundaryName: fence.name,
        boundaryType: fence.type,
        distanceKm: roundTo(minDistance, 1),
        bearing: `${compassPoint(bearingDeg)} (${Math.round(bearingDeg)}°)`,
        severity: fence.severity,
        inside: minDistance === 0,
        withinBuffer: minDistance > 0 && minDistance <= fence.bufferKm,
        bufferKm: fence.bufferKm,
        regulation: fence.regulation,
        description: fence.description,
      });
    }
  }

  return conflicts;
}

function polygonCentre(ring: Array<[number, number]>): { latitude: number; longitude: number } {
  const sum = ring.reduce((acc, [lat, lon]) => ({ lat: acc.lat + lat, lon: acc.lon + lon }), { lat: 0, lon: 0 });
  return { latitude: sum.lat / Math.max(1, ring.length), longitude: sum.lon / Math.max(1, ring.length) };
}

function waypointLabel(
  points: Array<{ latitude: number; longitude: number }>,
  index: number,
  origin: Endpoint,
  destination: Endpoint,
): string {
  if (index <= 0) return origin.name;
  if (index >= points.length - 1) return destination.name;
  return `WP${Math.round((index / (points.length - 1)) * 100)}`;
}

function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h} h ${m} m` : `${h} h`;
}

/**
 * One-sentence verdict on a candidate corridor, in the fisher's language.
 *
 * The style label, the distance, the score, the exposure and the verdict are
 * separate fields on purpose: they are interpolated into a translated template
 * rather than concatenated with English glue, so a Tamil recommendation is
 * assembled entirely from Tamil fragments.
 */
function describeRoute(
  label: string,
  safetyScore: number,
  distanceKm: number,
  riskLevel: RiskLevel,
  exposure: Exposure,
  book: Phrasebook,
): string {
  const ui = book.ui;
  const style =
    label === 'great-circle'
      ? ui.greatCircleStyleWord
      : label === 'starboard'
        ? ui.starboardStyleWord
        : ui.inshoreStyleWord;

  const fill = (template: string): string =>
    template
      .replace('{style}', style)
      .replace('{km}', String(roundTo(distanceKm, 1)))
      .replace('{score}', String(safetyScore))
      .replace('{wave}', String(exposure.wave))
      .replace('{wind}', String(exposure.wind));

  if (riskLevel === 'LOW') return fill(ui.routeLowWord);
  if (riskLevel === 'MODERATE') return fill(ui.routeModerateWord);
  return fill(ui.routeHighWord);
}

const riskWord = (book: { riskWords: [string, string, string, string] }, level: RiskLevel): string =>
  book.riskWords[RISK_RANK[level]];
