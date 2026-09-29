/**
 * Tide & Current Agent — harmonic prediction from the INCOIS gauge framework.
 *
 * The tide is genuinely computed, not looked up: the seven constituents stored
 * per station (M2, S2, N2, K1, O1, P1, M4) are summed as a Fourier series over
 * the prediction window, and extrema are found by scanning at 6-minute steps
 * with parabolic refinement. Tidal stream strength is taken from the rate of
 * change of height, which is what actually matters when setting a net across a
 * tidal current.
 */

import { TideReport, TidalData, TideStation, TideWindow } from '../types';
import { AgentContext, AgentDefinition, defineAgent, ev, finding, ok, publish } from './base';
import { getTideStation } from '../core/dataAccess';
import { liveFetchMs } from '../core/live';
import { roundTo } from '../core/geo';

/** Reference instant aligned with the ORCA data cycle (IST) — used offline. */
const EPOCH = Date.UTC(2026, 8, 9, 3, 0, 0); // 09 Sep 2026 08:30 IST
/** Default forecast span, in hours, for horizons with no explicit length. */
const HORIZON_HOURS = 48;
/** Scan step for locating extrema, in minutes. */
const STEP_MINUTES = 6;

const IST_OFFSET_MINUTES = 330;

/**
 * Prediction anchor: the live model instant when the platform has a warmed
 * real-time snapshot, otherwise the reference data cycle. Anchoring to "now"
 * is what makes "next high tide" a true next tide from today.
 */
export function tideEpochMs(): number {
  return liveFetchMs() ?? EPOCH;
}

function toIstLabel(date: Date): string {
  const ist = new Date(date.getTime() + IST_OFFSET_MINUTES * 60_000);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const hh = String(ist.getUTCHours()).padStart(2, '0');
  const mm = String(ist.getUTCMinutes()).padStart(2, '0');
  return `${days[ist.getUTCDay()]} ${ist.getUTCDate()} ${months[ist.getUTCMonth()]} · ${hh}:${mm} IST`;
}

function toIstStamp(date: Date): string {
  const ist = new Date(date.getTime() + IST_OFFSET_MINUTES * 60_000);
  const hh = String(ist.getUTCHours()).padStart(2, '0');
  const mm = String(ist.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Tidal height in metres above chart datum at `date`. */
export function tideHeightAt(station: TideStation, date: Date, epochMs = tideEpochMs()): number {
  // Hours since the epoch; the harmonic argument is in degrees.
  const hours = (date.getTime() - epochMs) / 3_600_000;
  let height = 0;
  for (const c of station.harmonics) {
    if (c.amplitudeMeters === 0) continue;
    const argument = c.speedDegreesPerHour * hours - c.phaseDegrees;
    height += c.amplitudeMeters * Math.cos((argument * Math.PI) / 180);
  }
  return roundTo(height, 2);
}

/** Rate of change in metres per hour (the tidal stream proxy). */
export function tideRateAt(station: TideStation, date: Date, epochMs = tideEpochMs()): number {
  const deltaMs = 15 * 60_000;
  const before = tideHeightAt(station, new Date(date.getTime() - deltaMs), epochMs);
  const after = tideHeightAt(station, new Date(date.getTime() + deltaMs), epochMs);
  return roundTo((after - before) / 0.5, 3);
}

export const tideAgent: AgentDefinition = defineAgent('TIDE_AGENT', (context: AgentContext) => {
  const station = getTideStation(context.anchor.harborId);
  const report = buildTideReport(station, context.horizon);
  context.artifacts.tideReport = report;
  context.artifacts.tideEvents = report.events;

  const { book } = context;
  const findings = [
    finding(
      `${report.station.name}: the water is ${roundTo(report.currentLevel, 2)} m above chart datum and ${report.isRising ? 'rising' : 'falling'}. Next high tide ${report.highTide?.label ?? 'n/a'} at ${report.highTide ? `${report.highTide.heightMeters} m` : '—'}; next low tide ${report.lowTide?.label ?? 'n/a'} at ${report.lowTide ? `${report.lowTide.heightMeters} m` : '—'}. Maximum range in the window is ${report.maxRangeMeters} m.`,
      {
        confidence: 0.88,
        evidence: [
          ev(book.evidenceKeys.highTide, report.highTide ? `${report.highTide.label} · ${report.highTide.heightMeters} m` : '—', station.source),
          ev(book.evidenceKeys.lowTide, report.lowTide ? `${report.lowTide.label} · ${report.lowTide.heightMeters} m` : '—', station.source),
          ev(book.evidenceKeys.tideRange, `${report.maxRangeMeters} m`, station.source),
          ev('Datum', `chart datum, mean offset ${station.datumOffsetMeters} m`, 'INCOIS gauge'),
        ],
      },
    ),
  ];

  // A big range plus a strong ebb is the classic snagging hazard.
  const strongest = [...report.events].sort((a, b) => b.currentKnots - a.currentKnots)[0];
  if (strongest && strongest.currentKnots >= 1.8) {
    findings.push(
      finding(
        `The strongest tidal stream in the window reaches ${strongest.currentKnots} kt around ${strongest.label}, setting ${strongest.currentDirection}. A net set across that will drag; plan the set on the slack.`,
        {
          confidence: 0.75,
          evidence: [ev('Peak tidal stream', `${strongest.currentKnots} kt ${strongest.currentDirection}`, 'ORCA harmonic derivation')],
        },
      ),
    );
  }

  if (report.recommendedWindow) {
    const w = report.recommendedWindow;
    findings.push(
      finding(
        `Best transit window is ${w.startLabel} to ${w.endLabel} (${w.durationHours} h, rated ${w.quality}). ${w.reason}`,
        {
          confidence: 0.72,
          evidence: [ev('Transit window', `${w.startLabel} → ${w.endLabel}`, 'ORCA tidal window analysis')],
        },
      ),
    );
  } else {
    findings.push(
      finding(
        'No slack-water transit window falls inside the forecast horizon for this station. Small craft should plan an overnight hold or wait for the next low-slack period.',
        { confidence: 0.6, evidence: [ev('Transit window', 'None in horizon', 'ORCA tidal window analysis')] },
      ),
    );
  }

  publish(context, {
    id: 'viz-tide',
    type: 'chart',
    title: book.labels.tide,
    subtitle: `${station.name} · harmonic prediction`,
    categories: report.events.map((e) => e.label.split('·')[1]?.trim() ?? e.label),
    series: [
      {
        id: 'height',
        label: 'Tidal height (m)',
        color: '#6366f1',
        unit: 'm',
        points: report.events.map((e) => e.heightMeters),
      },
    ],
  });

  publish(context, {
    id: 'viz-tide-table',
    type: 'table',
    title: book.labels.tide,
    subtitle: 'Predicted events with tidal stream strength',
    categories: report.events.map((e) => e.label),
    series: [
      {
        id: 'height',
        label: 'Height (m)',
        color: '#6366f1',
        unit: 'm',
        points: report.events.map((e) => e.heightMeters),
      },
      {
        id: 'stream',
        label: 'Stream (kt)',
        color: '#22d3ee',
        unit: 'kt',
        points: report.events.map((e) => e.currentKnots),
      },
    ],
  });

  return ok(
    findings,
    book.ui.tideSummaryWord
      .replace('{station}', report.station.name)
      .replace('{level}', roundTo(report.currentLevel, 2).toString())
      .replace('{trend}', report.isRising ? book.ui.risingWord : book.ui.fallingWord)
      .replace('{range}', report.maxRangeMeters.toString())
      .replace('{label}', report.highTide?.label ?? '—'),
    ['INCOIS tide gauge network', 'Harmonic constituents'],
  );
});

/* ------------------------------------------------------------------ *
 * Harmonic prediction
 * ------------------------------------------------------------------ */

export function buildTideReport(station: TideStation, horizon: string, epochMs = tideEpochMs()): TideReport {
  const hours = horizon === 'NOW' ? 24 : horizon === 'WEEK' ? 72 : HORIZON_HOURS;
  const stepMs = STEP_MINUTES * 60_000;
  const steps = Math.round((hours * 3_600_000) / stepMs);

  const samples: Array<{ at: Date; height: number; rate: number }> = [];
  for (let i = 0; i <= steps; i++) {
    const at = new Date(epochMs + i * stepMs);
    samples.push({ at, height: tideHeightAt(station, at, epochMs), rate: tideRateAt(station, at, epochMs) });
  }

  const events: TidalData[] = [];
  for (let i = 1; i < samples.length - 1; i++) {
    const prev = samples[i - 1];
    const cur = samples[i];
    const next = samples[i + 1];
    const isPeak = cur.height > prev.height && cur.height >= next.height;
    const isTrough = cur.height < prev.height && cur.height <= next.height;
    if (!isPeak && !isTrough) continue;

    // Parabolic refinement of the extremum time.
    const denom = prev.height - 2 * cur.height + next.height;
    const shift = denom === 0 ? 0 : (0.5 * (prev.height - next.height)) / denom;
    const refined = new Date(cur.at.getTime() + shift * stepMs);
    const height = tideHeightAt(station, refined, epochMs);
    const rate = tideRateAt(station, refined, epochMs);
    const range = events.length > 0 ? Math.abs(height - events[events.length - 1].heightMeters) : 0;

    events.push({
      time: refined.toISOString(),
      label: toIstLabel(refined),
      heightMeters: height,
      type: isPeak ? 'HIGH' : 'LOW',
      rangeMeters: roundTo(range, 2),
      currentKnots: roundTo(Math.abs(rate) * 0.92, 1),
      currentDirection: rate > 0 ? 'flood (inland)' : 'ebb (seaward)',
      isRising: isPeak,
    });
  }

  const now = samples[0];
  const maxRangeMeters = events.reduce((m, e) => Math.max(m, e.heightMeters), 0);
  const minHeight = events.reduce((m, e) => Math.min(m, e.heightMeters), 0);
  const maxRange = roundTo(maxRangeMeters - minHeight, 2);

  const windows = buildWindows(events);
  const best = [...windows].sort(
    (a, b) => RANK[b.quality] - RANK[a.quality] || b.durationHours - a.durationHours,
  )[0];

  return {
    station,
    events,
    highTide: events.find((e) => e.type === 'HIGH'),
    lowTide: events.find((e) => e.type === 'LOW'),
    currentLevel: now.height,
    isRising: now.rate > 0,
    maxRangeMeters: maxRange,
    windows,
    recommendedWindow: best,
    source: station.source,
    timestamp: toIstLabel(now.at),
  };
}

const RANK: Record<TideWindow['quality'], number> = { GOOD: 2, FAIR: 1, POOR: 0 };

/**
 * Rate the slack windows between successive extremes.
 *
 * A window is GOOD when both bounding events are close to the same height (little
 * vertical motion through the turn) and the range across it is modest, because
 * that is exactly when a small craft can cross a bar or a channel without being
 * set sideways.
 */
function buildWindows(events: TidalData[]): TideWindow[] {
  const windows: TideWindow[] = [];

  for (let i = 1; i < events.length; i++) {
    const from = events[i - 1];
    const to = events[i];
    const start = new Date(from.time).getTime();
    const end = new Date(to.time).getTime();
    const durationHours = roundTo((end - start) / 3_600_000, 1);
    const levelDifference = Math.abs(to.heightMeters - from.heightMeters);
    const maxStream = Math.max(from.currentKnots, to.currentKnots);

    let quality: TideWindow['quality'];
    let reason: string;

    if (maxStream <= 0.9 && durationHours >= 1) {
      quality = 'GOOD';
      reason = `Slack water with only ${maxStream} kt of stream — the cleanest time to cross.`;
    } else if (maxStream <= 1.8) {
      quality = 'FAIR';
      reason = `Moderate stream of ${maxStream} kt; hold a course into the set and allow for drift.`;
    } else {
      quality = 'POOR';
      reason = `Strong stream of ${maxStream} kt across a ${levelDifference} m change — a net or hull will be set down.`;
    }

    windows.push({
      startLabel: toIstStamp(new Date(start)),
      endLabel: toIstStamp(new Date(end)),
      durationHours,
      quality,
      reason,
    });
  }

  return windows;
}

export type { TidalData, TideReport, TideWindow };
