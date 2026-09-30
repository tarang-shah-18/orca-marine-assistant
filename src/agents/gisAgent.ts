/**
 * GIS Agent — the spatial join layer.
 *
 * Everything downstream of "where am I" depends on this agent: it turns a
 * resolved position into distance, bearing, ETA and local-time context, and it
 * is the reason ORCA can answer "from <harbour> to <zone>" in any language
 * without the user knowing coordinates.
 */

import {
  AgentContext,
  AgentDefinition,
  clamp,
  defineAgent,
  ev,
  finding,
  ok,
} from './base';
import {
  HARBOR_BY_ID,
  getNearestPfz,
  getPfzZonesNear,
  DATA_CYCLE,
} from '../core/dataAccess';
import { liveDataCycle, liveFetchMs } from '../core/live';
import {
  compassPoint,
  destinationPoint,
  formatBearing,
  haversineKm,
  initialBearingDeg,
  roundTo,
} from '../core/geo';

/** Speed to use for an ETA when the caller has not specified a vessel plan. */
const ASSUMED_SPEED_KNOTS = 8;

/**
 * Choose the position the rest of the run should reason about.
 *
 * Priority: a fishing ground the user already has in context, else the harbour.
 * This is deliberately a GIS decision rather than a planner one so that every
 * agent shares exactly the same reference point.
 */
export function resolveReferencePosition(context: AgentContext) {
  const harbor = context.harbor;
  const remembered = context.memory.activeZone;

  if (remembered && !context.parsed.harborId) {
    return {
      position: { latitude: remembered.latitude, longitude: remembered.longitude },
      basis: 'fishing-ground' as const,
      zone: remembered,
      distanceFromPortKm: roundTo(haversineKm(harbor, remembered), 1),
    };
  }

  return {
    position: { latitude: harbor.latitude, longitude: harbor.longitude },
    basis: 'harbour' as const,
    zone: undefined,
    distanceFromPortKm: 0,
  };
}

export const gisAgent: AgentDefinition = defineAgent('GIS_AGENT', (context: AgentContext) => {
  const harbor = context.harbor;
  const reference = resolveReferencePosition(context);
  const { position, zone } = reference;

  const findings = [];
  const evidence = [
    ev(context.book.labels.zone, harbor.name, 'ORCA coastal gazetteer'),
    ev('Latitude', `${position.latitude.toFixed(3)}° N`, 'Reference position'),
    ev('Longitude', `${position.longitude.toFixed(3)}° E`, 'Reference position'),
  ];

  if (zone) {
    const bearingDeg = initialBearingDeg(harbor, position);
    const etaHours = roundTo(reference.distanceFromPortKm / ASSUMED_SPEED_KNOTS, 1);
    findings.push(
      finding(
        `${zone.name} lies ${reference.distanceFromPortKm} km from ${harbor.shortName} on a bearing of ${formatBearing(bearingDeg)} — about ${etaHours} h at ${ASSUMED_SPEED_KNOTS} kt.`,
        {
          confidence: 0.9,
          evidence: [
            ...evidence,
            ev(context.book.evidenceKeys.bearing, formatBearing(bearingDeg), 'ORCA geodesic engine'),
            ev(
              context.book.evidenceKeys.distanceFromPort,
              `${reference.distanceFromPortKm} km`,
              'ORCA geodesic engine',
            ),
            ev(context.book.evidenceKeys.eta, `${etaHours} h`, 'ORCA geodesic engine'),
          ],
        },
      ),
    );
  } else {
    findings.push(
      finding(
        `Working from ${harbor.name} (${harbor.basin}, ${harbor.state}).`,
        { confidence: 0.95, evidence },
      ),
    );
  }

  // The three nearest grounds give the user a choice instead of a verdict.
  const nearby = getPfzZonesNear(position.latitude, position.longitude).slice(0, 3);
  context.artifacts.pfzZones = nearby;

  if (nearby.length > 0) {
    findings.push(
      finding(
        `Three fishing grounds lie within reach: ${nearby
          .map((z) => `${z.name} ${context.book.ui.atWord} ${z.distanceKm} km`)
          .join(', ')}.`,
        {
          confidence: 0.85,
          evidence: nearby.map((z) =>
            ev(z.name, `${z.distanceKm} km · ${z.bearing}`, z.source),
          ),
        },
      ),
    );
  }

  // Local time-of-day band drives the "best departure window" reasoning.
  const hourBand = localHourBand(context.horizon);
  const cycle = liveDataCycle();
  findings.push(
    finding(
      `The advisory window being used is ${context.book.horizon[
        ['NOW', 'TODAY', 'TOMORROW', 'NEXT_3_DAYS', 'WEEK'].indexOf(context.horizon)
      ]} (${hourBand}).`,
      {
        confidence: 0.8,
        evidence: [
          ev(
            'Data cycle',
            cycle.label.includes('Live') ? cycle.label : DATA_CYCLE.label,
            cycle.label.includes('Live') ? 'ORCA live snapshot' : 'ORCA snapshot',
          ),
        ],
      },
    ),
  );

  context.artifacts.activeZone = zone ?? getNearestPfz(position.latitude, position.longitude);
  context.artifacts.distanceKm = reference.distanceFromPortKm || undefined;

  return ok(
    findings,
    (zone ? context.book.ui.positionFixedZoneWord : context.book.ui.positionFixedWord)
      .replace('{harbor}', harbor.shortName)
      .replace('{zone}', zone ? zone.name : ''),
    ['ORCA geodesic engine', 'ORCA coastal gazetteer'],
    ['PFZ_AGENT'],
  );
});

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function fmtDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** Deterministic local-time band for the requested horizon. */
export function localHourBand(horizon: string): string {
  // In live mode the window is phrased from the actual fetch instant so the
  // answer never quotes a reference-period date; offline it stays pinned to the
  // static reference snapshot for determinism.
  const liveMs = liveFetchMs();
  const at = liveMs !== null ? new Date(liveMs).getTime() : null;
  const plusDays = (n: number): string => (at !== null ? fmtDay(at + n * 86400e3) : '');
  switch (horizon) {
    case 'NOW': {
      if (at !== null) {
        const d = new Date(at);
        return `${fmtDay(at)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} IST snapshot`;
      }
      return '08:30 IST snapshot';
    }
    case 'TODAY':
      return at !== null ? `morning through night of ${fmtDay(at)}` : 'morning through night of 09 Sep';
    case 'TOMORROW':
      return at !== null ? plusDays(1) : '10 Sep 2026';
    case 'NEXT_3_DAYS':
      return at !== null ? `${fmtDay(at)} – ${plusDays(3)}` : '09-12 Sep 2026';
    case 'WEEK':
      return at !== null ? `${fmtDay(at)} – ${plusDays(6)}` : '09-15 Sep 2026';
    default:
      return at !== null ? fmtDay(at) : '09 Sep 2026';
  }
}

/* ------------------------------------------------------------------ *
 * Spatial utilities reused by the route, geofencing and alert agents
 * ------------------------------------------------------------------ */

/** Position `offsetKm` along `bearingDeg` from `origin` — the corridor builder. */
export const stepAlong = destinationPoint;

/** Interpolate a bearing-aware ETA at a fraction along a leg. */
export function etaAt(totalHours: number, fraction: number): number {
  return roundTo(totalHours * clamp(fraction, 0, 1), 1);
}

export const bearingText = (degrees: number): string => compassPoint(degrees);

export const harborsById = (ids: string[]) =>
  ids.map((id) => HARBOR_BY_ID[id]).filter(Boolean);
