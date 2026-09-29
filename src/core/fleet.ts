/**
 * Fleet intelligence — coast-wide overview.
 *
 * ORCA's core answers one harbour at a time. A fisheries department, a disaster
 * manager or a fleet owner needs the whole coast on one screen: which harbours
 * are untenable right now, which advisories are driving that, and where the
 * nearest fishing ground sits for each port.
 *
 * `fleetOverview` computes one snapshot per harbour from the *same* products
 * the agents consume (weather, sea state, alerts, nearest PFZ) and re-runs the
 * same weighted risk matrix the risk agent uses, so a number shown here can
 * never disagree with the number a chat turn would produce for that harbour.
 * It reads through `dataAccess` (live-first), needs no full orchestration per
 * harbour, and degrades per harbour to the reference snapshot — flagged.
 */

import {
  FleetHarbourSnapshot,
  FleetOverview,
  RiskLevel,
} from '../types';
import {
  HARBORS,
  VESSEL_BY_ID,
  DEFAULT_VESSEL_ID,
} from './dataset';
import {
  getMarineAlertsNear,
  getNearestPfz,
  getOceanState,
  getWeather,
} from './dataAccess';
import { computeRiskTrajectory } from './riskTrajectory';

/** Advisory level ordering, worst first — mirrors the critic's escalation. */
const ADVISORY_RANK: Record<string, number> = {
  RED: 3,
  ORANGE: 2,
  YELLOW: 1,
  GREEN: 0,
  NONE: -1,
};

const RISK_RANK: Record<RiskLevel, number> = {
  LOW: 0,
  MODERATE: 1,
  HIGH: 2,
  SEVERE: 3,
};

/**
 * One risk snapshot per harbour, worst harbours first.
 *
 * `vesselId` mirrors the fleet's dominant class; `now` keeps tests
 * deterministic.
 */
export function fleetOverview(
  vesselId: string = DEFAULT_VESSEL_ID,
  now: Date = new Date(),
): FleetOverview {
  const vessel = VESSEL_BY_ID[vesselId] ?? VESSEL_BY_ID[DEFAULT_VESSEL_ID];

  const harbours: FleetHarbourSnapshot[] = HARBORS.map((harbor) => {
    const weather = getWeather(harbor.id);
    const ocean = getOceanState(harbor.id);
    const alerts = getMarineAlertsNear(harbor.latitude, harbor.longitude);
    const nearestZone = getNearestPfz(harbor.latitude, harbor.longitude);

    const trajectory = computeRiskTrajectory(
      { weather, ocean, alerts, vessel, now },
      [0], // the coast-wide view is an instantaneous posture, not a window scan
    );

    const point0 = trajectory?.points[0];
    const activeAlerts = alerts
      .filter((a) => a.withinInfluence)
      .sort(
        (a, b) =>
          (ADVISORY_RANK[b.advisoryLevel] ?? -1) - (ADVISORY_RANK[a.advisoryLevel] ?? -1),
      );

    return {
      harborId: harbor.id,
      shortName: harbor.shortName,
      state: harbor.state,
      basin: harbor.basin,
      latitude: harbor.latitude,
      longitude: harbor.longitude,
      riskLevel: point0?.riskLevel ?? 'LOW',
      safetyScore: point0?.safetyScore ?? 100,
      dominant: point0?.dominant ?? 'advisories',
      windSpeedKnots: weather?.windSpeedKnots ?? 0,
      gustKnots: weather?.gustKnots ?? 0,
      waveHeightMeters: ocean?.waveHeightMeters ?? 0,
      seaStateCode: ocean?.seaStateCode ?? 0,
      topAdvisory: activeAlerts[0]?.title ?? null,
      advisoryLevel: activeAlerts[0]?.advisoryLevel ?? null,
      nearestPfzKm: nearestZone?.distanceKm ?? null,
      nearestPfzName: nearestZone?.name ?? null,
      reference:
        !/(real-time|Open-Meteo)/i.test(weather?.source ?? '') ||
        !/(real-time|Open-Meteo)/i.test(ocean?.source ?? ''),
    };
  });

  // Worst first is the honest display order for a command view.
  harbours.sort(
    (a, b) =>
      RISK_RANK[b.riskLevel] - RISK_RANK[a.riskLevel] || a.safetyScore - b.safetyScore,
  );

  const counts: Record<RiskLevel, number> = {
    LOW: 0,
    MODERATE: 0,
    HIGH: 0,
    SEVERE: 0,
  };
  for (const h of harbours) counts[h.riskLevel] += 1;

  return {
    vesselId: vessel.id,
    vesselLabel: vessel.label,
    generatedAt: now.toISOString(),
    counts,
    harbours,
    note: 'Fleet posture re-runs the ORCA weighted risk matrix per harbour from the live feeds (reference snapshot where a feed is unreachable). It is an indicative watch, not an official bulletin — IMD / INCOIS advisories always govern.',
  };
}