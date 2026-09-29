/**
 * Departure-window risk trajectory.
 *
 * The risk agent answers one question: "how risky is it right now (or within
 * the asked horizon)?" The trajectory answers the question a go/no-go decision
 * actually turns on: "how risky is each of the next few windows, and when is
 * the least-bad time to sail?"
 *
 * It re-runs the same weighted matrix the risk agent uses, per forecast
 * window: the nearest weather slot, the nearest ocean slot, the alert layer
 * (which decays once a bulletin's `validUntil` passes), and the tidal stream
 * phase (strongest mid-tide, weakest near the high/low extremes). One matrix,
 * many horizons — so the trajectory and the instantaneous verdict can never
 * disagree about the present.
 *
 * Deliberately self-contained: the four threshold helpers below mirror
 * `agents/base.ts` so `core/` never imports from `agents/` (which would make
 * the module graph circular).
 */

import {
  MarineAlert,
  OceanData,
  RiskLevel,
  RiskTrajectory,
  RiskTrajectoryPoint,
  TidalData,
  TideReport,
  WeatherData,
} from '../types';
import type { VesselProfile } from './dataset';
import { bulletinStillValid } from './alerts';

/* Risk rank, mirrors the risk agent so both speak one vocabulary. */
const RISK_RANK: Record<RiskLevel, number> = {
  LOW: 0,
  MODERATE: 1,
  HIGH: 2,
  SEVERE: 3,
};

/** Fishermen-facing risk from sustained wind in knots (IMD thresholds). */
function riskFromWind(knots: number): RiskLevel {
  if (knots >= 45) return 'SEVERE';
  if (knots >= 30) return 'HIGH';
  if (knots >= 20) return 'MODERATE';
  return 'LOW';
}

/** Fishermen-facing risk from significant wave height (INCOIS thresholds). */
function riskFromWaveHeight(meters: number): RiskLevel {
  if (meters >= 4) return 'SEVERE';
  if (meters >= 3) return 'HIGH';
  if (meters >= 2) return 'MODERATE';
  return 'LOW';
}

function worst(...levels: RiskLevel[]): RiskLevel {
  return levels.reduce<RiskLevel>(
    (acc, level) => (RISK_RANK[level] > RISK_RANK[acc] ? level : acc),
    'LOW',
  );
}

function scoreToRisk(score: number): RiskLevel {
  if (score >= 2.6) return 'SEVERE';
  if (score >= 1.6) return 'HIGH';
  if (score >= 0.7) return 'MODERATE';
  return 'LOW';
}

/** Mirror of the risk agent's contributor weights. */
const WEATHER_W = 22;
const OCEAN_W = 22;
const ALERT_W = 34;
const TIDE_W = 8;
const GEOFENCE_W = 14;
const ROUTE_W = 12;
const PFZ_W = 4;

/** Weights for the contributors that are constant across forecast windows. */
const CONSTANT_WEIGHTS: Record<string, number> = {
  GEOFENCING_AGENT: GEOFENCE_W,
  ROUTE_OPTIMIZATION_AGENT: ROUTE_W,
  PFZ_AGENT: PFZ_W,
};

/** Which forecast slot best describes a future hour. */
function nearestSlot<T extends { validHours: number }>(slots: T[], hours: number): T | undefined {
  if (slots.length === 0) return undefined;
  let best = slots[0];
  let bestDelta = Math.abs(best.validHours - hours);
  for (const slot of slots) {
    const delta = Math.abs(slot.validHours - hours);
    if (delta < bestDelta) {
      best = slot;
      bestDelta = delta;
    }
  }
  return best;
}

/**
 * Slots that belong to a window around a horizon. The risk agents score a
 * window by its *worst* member, never a single instant, so the trajectory must
 * do the same — "now" means the next few hours, "+24 h" means around midday
 * tomorrow, exactly how the go/no-go horizon is phrased.
 */
function bandSlots<T extends { validHours: number }>(slots: T[], hours: number, radius = 6): T[] {
  const lo = hours === 0 ? 0 : hours - radius;
  const hi = hours + radius;
  const inBand = slots.filter((s) => s.validHours >= lo && s.validHours <= hi);
  if (inBand.length > 0) return inBand;
  const nearest = nearestSlot(slots, hours);
  return nearest ? [nearest] : [];
}

function riskFromLightning(value: WeatherData['lightningRisk']): RiskLevel {
  if (value === 'HIGH') return 'HIGH';
  if (value === 'MODERATE') return 'MODERATE';
  return 'LOW';
}

/** Tidal-stream risk: weakest near the high/low extremes, strongest mid-tide. */
function tideRiskAt(events: TidalData[], hoursFromNow: number, now: Date): RiskLevel {
  if (events.length === 0) return 'LOW';
  const target = now.getTime() + hoursFromNow * 3_600_000;
  let minDelta = Number.POSITIVE_INFINITY;
  for (const event of events) {
    const delta = Math.abs(new Date(event.time).getTime() - target);
    if (delta < minDelta) minDelta = delta;
  }
  const hoursToEvent = minDelta / 3_600_000;
  if (hoursToEvent <= 1.5) return 'LOW';
  if (hoursToEvent <= 3.5) return 'MODERATE';
  return 'HIGH';
}

/** Whether the latest status of `validUntil` puts the bulletin past a window. */
function alertLevelAt(alert: MarineAlert, hoursFromNow: number, now: Date): RiskLevel {
  if (!bulletinStillValid(alert, new Date(now.getTime() + hoursFromNow * 3_600_000))) {
    return 'LOW';
  }
  if (alert.advisoryLevel === 'RED' || alert.type === 'CYCLONE' || alert.type === 'TSUNAMI') {
    return 'SEVERE';
  }
  if (alert.advisoryLevel === 'ORANGE') return 'HIGH';
  if (alert.advisoryLevel === 'YELLOW') return 'MODERATE';
  return 'LOW';
}

const LIVE_MARKER = /Open-Meteo|GDACS|ERA5|real-time/i;

interface TrajectoryInputs {
  weather?: WeatherData;
  ocean?: OceanData;
  alerts?: MarineAlert[];
  tide?: TideReport;
  /**
   * Risk contributions that do not vary over the forecast slots (statutory
   * boundaries, corridor scoring, productivity) — carried forward from the
   * instant verdict at their published level so the trajectory and the
   * instantaneous matrix can never disagree about the present.
   */
  constantNotes?: Array<{ agent: string; level: RiskLevel }>;
  vessel: VesselProfile;
  /** Optional fixed clock, used by tests to keep the run deterministic. */
  now?: Date;
}

/**
 * Compute the risk series for the standard departure horizons
 * (now · +6 h · +12 h · +24 h · +36 h · +48 h).
 *
 * Returns `null` when there is no forecast basis at all (no weather and no
 * ocean product), so callers can degrade gracefully.
 */
export function computeRiskTrajectory(
  inputs: TrajectoryInputs,
  horizons: number[] = [0, 6, 12, 24, 36, 48],
): RiskTrajectory | null {
  const { weather, ocean, alerts = [], tide, vessel, constantNotes = [] } = inputs;
  if (!weather && !ocean) return null;

  const now = inputs.now ?? new Date();

  // Constant contributors present in this run define the matrix's total weight,
  // exactly as they do for the instantaneous verdict.
  const constantAgents = constantNotes
    .filter((n) => CONSTANT_WEIGHTS[n.agent] !== undefined)
    .map((n) => n);
  const totalWeight = WEATHER_W + OCEAN_W + ALERT_W + TIDE_W + constantAgents.reduce(
    (acc, n) => acc + CONSTANT_WEIGHTS[n.agent],
    0,
  );

  const points: RiskTrajectoryPoint[] = horizons.map((hours) => {
    const weatherSlots = weather ? bandSlots(weather.forecast, hours) : [];
    const oceanSlots = ocean ? bandSlots(ocean.forecast, hours) : [];

    const windAtHour =
      weatherSlots.length > 0
        ? Math.max(...weatherSlots.map((s) => s.windSpeedKnots))
        : weather?.windSpeedKnots ?? 0;
    const gustAtHour =
      weatherSlots.length > 0
        ? Math.max(...weatherSlots.map((s) => s.gustKnots))
        : weather?.gustKnots ?? 0;
    const lightningAtHour = weatherSlots.reduce<WeatherData['lightningRisk']>(
      (acc, s) => (riskFromLightning(s.lightningRisk) > riskFromLightning(acc) ? s.lightningRisk : acc),
      'LOW',
    );
    let weatherLevel: RiskLevel = weather
      ? worst(
          riskFromWind(windAtHour || weather.windSpeedKnots),
          riskFromWind(gustAtHour || weather.gustKnots),
          riskFromLightning(lightningAtHour),
          weather.squallWarning ? 'HIGH' : 'LOW',
        )
      : 'LOW';
    // The vessel's own limits act in the window scan exactly as they do in the
    // risk agent's verdict.
    if (windAtHour > vessel.maxWindKnots) weatherLevel = worst(weatherLevel, 'HIGH');

    const waveAtHour = Math.max(...oceanSlots.map((s) => s.waveHeightMeters), 0) || ocean?.waveHeightMeters || 0;
    let oceanLevel: RiskLevel = worst(riskFromWaveHeight(waveAtHour), 'LOW');
    // Vessel-limit breach grounds the same way the risk agent grounds it.
    if (waveAtHour > vessel.maxWaveHeightMeters) oceanLevel = worst(oceanLevel, 'HIGH');

    const alertLevel: RiskLevel = alerts.reduce<RiskLevel>(
      (worstSoFar, alert) => worst(worstSoFar, alertLevelAt(alert, hours, now)),
      'LOW',
    );

    const tideLevel: RiskLevel =
      hours === 0 ? 'LOW' : tide ? tideRiskAt(tide.events, hours, now) : 'LOW';

    const constantWeighted = constantAgents.reduce(
      (acc, n) => acc + RISK_RANK[n.level] * CONSTANT_WEIGHTS[n.agent],
      0,
    );

    const weighted =
      RISK_RANK[weatherLevel] * WEATHER_W +
      RISK_RANK[oceanLevel] * OCEAN_W +
      RISK_RANK[alertLevel] * ALERT_W +
      RISK_RANK[tideLevel] * TIDE_W +
      constantWeighted;

    const normalised = totalWeight > 0 ? weighted / totalWeight : 0;
    // The risk agent never lets the weighted average paper over a single bad
    // contributor ("one RED bulletin governs everything"): it reconciles the
    // composite with the worst contributing level and takes the worse of the
    // two. The trajectory applies the same floor per window.
    const compositeRisk = scoreToRisk(normalised);
    const worstPresent = worst(
      weatherLevel,
      oceanLevel,
      alertLevel,
      tideLevel,
      ...constantAgents.map((n) => n.level),
    );
    const riskLevel = worst(compositeRisk, worstPresent);
    const safetyScore = Math.max(0, Math.min(100, Math.round(100 - normalised * 26)));

    const contributions: Array<[RiskLevel, number, string]> = [
      [weatherLevel, WEATHER_W, 'wind'],
      [oceanLevel, OCEAN_W, 'waves'],
      [alertLevel, ALERT_W, 'advisories'],
      [tideLevel, TIDE_W, 'tide'],
      ...constantAgents.map(
        (n): [RiskLevel, number, string] => [n.level, CONSTANT_WEIGHTS[n.agent], labelForConstant(n.agent)],
      ),
    ];
    const dominant = contributions.reduce((best, c) =>
      RISK_RANK[c[0]] * c[1] > RISK_RANK[best[0]] * best[1] ? c : best,
    )[2];

    return {
      label: hours === 0 ? 'Now' : `+${hours} h`,
      validHours: hours,
      riskLevel,
      safetyScore,
      dominant,
    };
  });

  const actionable = points
    .filter((p) => p.validHours >= 6)
    .sort(
      (a, b) =>
        RISK_RANK[a.riskLevel] - RISK_RANK[b.riskLevel] || a.validHours - b.validHours,
    );

  const bestWindow = actionable[0] ?? null;
  const nowLevel = RISK_RANK[points[0].riskLevel];
  const lastLevel = RISK_RANK[points[points.length - 1].riskLevel];
  const trend: RiskTrajectory['trend'] =
    lastLevel < nowLevel ? 'improving' : lastLevel > nowLevel ? 'deteriorating' : 'stable';

  const fromLive =
    Boolean(weather && LIVE_MARKER.test(weather.source)) ||
    Boolean(ocean && LIVE_MARKER.test(ocean.source));

  return {
    points,
    bestWindow,
    trend,
    fromLive,
    note: 'Window ratings re-run the same weighted risk matrix per forecast slot. They rate conditions only — official IMD / INCOIS bulletins always take precedence, and alert validity is honoured to the minute the bulletin expires.',
  };
}

export function describeTrend(trend: RiskTrajectory['trend']): string {
  if (trend === 'improving') return 'conditions ease over the next two days';
  if (trend === 'deteriorating') return 'conditions tighten over the next two days';
  return 'conditions hold roughly steady over the next two days';
}

function labelForConstant(agent: string): string {
  if (agent === 'GEOFENCING_AGENT') return 'boundaries';
  if (agent === 'ROUTE_OPTIMIZATION_AGENT') return 'corridor';
  if (agent === 'PFZ_AGENT') return 'grounds';
  return agent.replace(/_AGENT$/, '').toLowerCase();
}

export const RISK_TRAJECTORY_HORIZONS = [0, 6, 12, 24, 36, 48];