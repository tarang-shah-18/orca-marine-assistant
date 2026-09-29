/**
 * Advisory currency — the one rule every validity-aware consumer shares.
 *
 * A bulletin has force only while it is inside the influence radius AND its
 * validity window still covers the decision instant. Bulletins without a
 * parseable expiry are treated as governing (conservative: an unknown end is
 * not a reason to weaken a warning). The alert agent, the risk agent's
 * escalation floor and the departure-window trajectory all read the same
 * helper, so an expired cyclone can never keep driving a SEVERE verdict while
 * the trajectory (correctly) shows it has lapsed.
 *
 * Expiry strings arrive in three shapes and all three must *actually* lapse:
 *
 *   - ISO 8601                    → `2026-09-29T10:08:47.854Z`
 *   - relative + N h from <stamp> → `+22 h from 2026-09-29T10:08:47.854Z`
 *   - relative + N h from <IST>   → `+22 h from 29 Sept 2026, 15:20 IST`
 *
 * The IST stamp is produced by `Intl.DateTimeFormat('en-IN', {...Asia/Kolkata})`
 * (e.g. `29 Sept 2026, 15:20`), which platform `Date` parsers do not reliably
 * understand, so it is decoded deterministically here.
 */

import { ADVISORY_WEIGHT, MarineAlert } from '../types';

/** Asia/Kolkata is UTC+5:30 — the offset used by every ORCA time label. */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function monthIndex(name: string): number {
  const prefix = name.slice(0, 3).toLowerCase();
  return MONTHS.indexOf(prefix);
}

/**
 * Decode one expiry stamp into an epoch millisecond, or `null` when the shape
 * is not understood. ISO 8601 goes through the platform parser; the IST
 * stamp is decoded with an explicit calendar so it is identical on every
 * host timezone.
 */
function parseExpiryStamp(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // ISO 8601 (`2026-09-29T10:08:47.854Z`) — used by live alerts and GDACS.
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    const iso = new Date(trimmed).getTime();
    if (Number.isFinite(iso)) return iso;
  }

  // IST stamp: `29 Sept 2026, 15:20` with an optional trailing timezone word.
  const ist = trimmed.match(
    /^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\s*,?\s*(\d{1,2}):(\d{2})(?:\s*[A-Za-z]+)?$/,
  );
  if (ist) {
    const month = monthIndex(ist[2]);
    if (month >= 0 && Number(ist[1]) >= 1 && Number(ist[1]) <= 31) {
      return Date.UTC(Number(ist[3]), month, Number(ist[1]), Number(ist[4]), Number(ist[5])) - IST_OFFSET_MS;
    }
  }

  // Last resort: let the platform parser try (covers any future format).
  const fallback = new Date(trimmed).getTime();
  return Number.isFinite(fallback) ? fallback : null;
}

/**
 * Resolve a bulletin's `validUntil` string to an absolute expiry in epoch
 * milliseconds, or `null` when it cannot be decoded (callers treat that as
 * "no known end" so a warning is never silently weakened).
 */
export function parseBulletinExpiry(validUntil: string): number | null {
  const relative = validUntil.match(/^\s*\+?(\d+(?:\.\d+)?)\s*h(?:ours?)?\s+from\s+(.+)$/i);
  const raw = relative ? relative[2] : validUntil;
  const hours = relative ? Number(relative[1]) : 0;
  if (!Number.isFinite(hours) || hours < 0) return null;
  const base = parseExpiryStamp(raw);
  return base === null ? null : base + hours * 3600_000;
}

export function bulletinStillValid(alert: MarineAlert, at: Date = new Date()): boolean {
  if (!alert.withinInfluence) return false;
  if (!alert.validUntil) return true;
  const end = parseBulletinExpiry(alert.validUntil);
  if (end === null) return true; // unknown end — conservative
  return end > at.getTime();
}

export function currentBulletins(alerts: MarineAlert[], at: Date = new Date()): MarineAlert[] {
  return alerts.filter((a) => bulletinStillValid(a, at));
}

/** In-influence bulletins that have lapsed, for transparent reporting. */
export function lapsedBulletins(alerts: MarineAlert[], at: Date = new Date()): MarineAlert[] {
  return alerts.filter((a) => a.withinInfluence && !bulletinStillValid(a, at));
}

/* ------------------------------------------------------------------ *
 * Proactive-banner headline selection — shared by the server brief
 * (`summariseForBanner`) and the offline client fallback
 * (`briefFromResult`), so a harbour answer and its banner can never
 * disagree about which alert is being shown.
 * ------------------------------------------------------------------ */

/**
 * Radius for the no-advisory headline fallback. A basin-wide cyclone 1000 km
 * up the coast must not headline a harbour that has no warning of its own,
 * so the fallback only reaches for alerts inside a genuinely local horizon.
 */
export const HEADLINE_HORIZON_KM = 250;

/** The single alert the proactive banner should headline, or `null`. */
export function pickHeadlineAlert(alerts: MarineAlert[]): MarineAlert | null {
  // An advisory in force at this position always wins, ranked by severity.
  const actionable = alerts.filter((a) => a.withinInfluence && a.advisoryLevel !== 'GREEN');
  const best = [...actionable].sort(
    (a, b) => ADVISORY_WEIGHT[b.advisoryLevel] - ADVISORY_WEIGHT[a.advisoryLevel],
  )[0];
  if (best) return best;

  // Nothing is in force here: fall back to the nearest alert inside a local
  // horizon only — never to a far-away basin event. `null` tells the banner
  // to show the harbour's risk posture with no advisory card.
  const nearby = alerts
    .filter((a) => a.distanceKm <= HEADLINE_HORIZON_KM)
    .sort((a, b) => a.distanceKm - b.distanceKm)[0];
  return nearby ?? null;
}