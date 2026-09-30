/**
 * Offline answer synthesizer.
 *
 * This is the deterministic multilingual narrator. It runs whenever Gemini is
 * unavailable (no key, quota, network) and is the path that guarantees ORCA
 * still answers in the fisherman's own language with real numbers.
 *
 * The structure is: headline → situation → recommendation → evidence. Numbers,
 * units, coordinates and species names are language-neutral; the connective
 * tissue comes from the phrasebook, so a Tamil reader gets natural Tamil prose
 * around data that cannot be misread.
 */

import {
  AgentResult,
  EvidenceItem,
  GeofencingData,
  HistoricalData,
  MarineAlert,
  OceanData,
  PFZZone,
  ProductivityHotspot,
  RiskLevel,
  RouteData,
  TimeHorizon,
  TideReport,
  WeatherData,
} from '../types';
import { RISK_ORDER } from '../types';
import {
  HeadlineKey,
  HeadlineSlots,
  Phrasebook,
  formatTideEvent,
  headlineKeyFor,
  horizonWord,
  productivityWord,
  qualityWord,
  renderHeadline,
  riskWord,
  seaStateWord,
  trendWord,
} from '../core/i18n';
import { applyAlertLocalization, localizeCondition, localizeRiskNoteReason, localizeRouteReason, localizeTideReason } from '../core/localize';
import { ParsedQuery } from '../core/intent';
import { Artifacts } from './base';

export interface SynthesisInput {
  parsed: ParsedQuery;
  book: Phrasebook;
  horizon: TimeHorizon;
  artifacts: Artifacts;
  results: AgentResult[];
  riskLevel: RiskLevel;
  safetyScore: number;
}

const pct = (n: number): string => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;

/* ------------------------------------------------------------------ *
 * Headline
 * ------------------------------------------------------------------ */

/**
 * Everything a headline can be built from, in one shape.
 *
 * The synthesizer sees this as the agent artifacts blackboard; the server
 * banner sees it as an `OrchestrationResult`. Both render through
 * `headlineFor` so the banner above a chat answer and the first line of that
 * answer are the same sentence in the same language — previously each side
 * picked its own template and filled none of the slots.
 */
export interface HeadlineSource {
  intent: string;
  horizon: TimeHorizon;
  harborName: string;
  riskLevel: RiskLevel;
  safetyScore: number;
  alerts?: MarineAlert[];
  pfzZone?: PFZZone;
  hotspots?: ProductivityHotspot[];
  routeData?: RouteData;
  historicalData?: HistoricalData;
  tideReport?: TideReport;
  ocean?: OceanData;
  weather?: WeatherData;
  geofencingData?: GeofencingData;
}

/** Alerts worth putting in front of a fisher: in range and above GREEN. */
const actionableAlerts = (alerts: MarineAlert[] | undefined): MarineAlert[] =>
  (alerts ?? []).filter((a) => a.withinInfluence && a.advisoryLevel !== 'GREEN');

/**
 * Choose the headline that the data can actually support.
 *
 * `headlineKeyFor` maps intent to template, but a template whose inputs are
 * missing would render as a stub — "The nearest fishing ground is {zone}, about
 * {distance} km…" with nothing after the blank. So each key is only used when
 * the artifact it talks about is present, and we step down to the next most
 * specific thing we can honestly say.
 */
function headlineKeyForSource(source: HeadlineSource): HeadlineKey {
  const key = headlineKeyFor(source.intent);

  switch (key) {
    case 'pfz':
      return source.pfzZone ? 'pfz' : 'safety';
    case 'hotspots':
      return source.hotspots?.length ? 'hotspots' : 'generic';
    case 'route':
      return source.routeData ? 'route' : 'safety';
    case 'productivity':
      return source.historicalData ? 'productivity' : 'generic';
    case 'tide':
      return source.tideReport ? 'tide' : 'generic';
    case 'ocean':
      return source.ocean ? 'ocean' : 'generic';
    case 'weather':
      return source.weather ? 'weather' : 'generic';
    case 'avoid':
      return source.geofencingData ? 'avoid' : 'generic';
    case 'geofence':
      return source.geofencingData ? 'geofence' : 'generic';
    default:
      return key;
  }
}

/** The `{slot}` values for the chosen headline. */
function slotsFor(key: HeadlineKey, source: HeadlineSource, book: Phrasebook): HeadlineSlots {
  const harbor = source.harborName;

  switch (key) {
    case 'pfz': {
      const zone = source.pfzZone!;
      return {
        zone: zone.name,
        distance: zone.distanceKm,
        harbor,
        bearing: zone.bearing,
        depth: zone.depthMeters,
      };
    }
    case 'safety':
      return { harbor, horizon: horizonWord(book, source.horizon), risk: riskWord(book, source.riskLevel) };
    case 'tide': {
      const tide = source.tideReport!;
      return {
        harbor,
        high: tide.highTide?.label ?? '—',
        low: tide.lowTide?.label ?? '—',
        range: tide.maxRangeMeters,
      };
    }
    case 'alerts': {
      const active = actionableAlerts(source.alerts);
      return { count: active.length, top: active[0] ? applyAlertLocalization(active[0], book).title : '' };
    }
    case 'noAlerts':
      return { harbor };
    case 'hotspots':
      return { count: source.hotspots!.length, top: source.hotspots![0].name };
    case 'route': {
      const route = source.routeData!;
      return { distance: route.totalDistanceKm, hours: route.estimatedTimeHours, vessel: route.vesselLabel };
    }
    case 'productivity': {
      const history = source.historicalData!;
      return { region: history.region, change: pct(history.productivityChangePercent) };
    }
    case 'avoid': {
      const zones = source.geofencingData!.nearbyBoundaries;
      return { count: zones.length, top: zones[0]?.boundaryName ?? '' };
    }
    case 'geofence': {
      const nearest = source.geofencingData!.nearbyBoundaries[0];
      return { distance: nearest?.distanceKm ?? '', name: nearest?.boundaryName ?? '' };
    }
    case 'ocean': {
      const ocean = source.ocean!;
      return { wave: ocean.waveHeightMeters, sst: ocean.seaSurfaceTempCelsius, condition: ocean.seaCondition };
    }
    case 'weather': {
      const weather = source.weather!;
      return {
        harbor,
        wind: weather.windSpeedKnots,
        temp: weather.temperatureCelsius,
        condition: localizeCondition(weather.condition, book),
      };
    }
    default:
      return { harbor };
  }
}

/** Render the one-line summary in the fisherman's language, fully filled in. */
export function headlineFor(source: HeadlineSource, book: Phrasebook): string {
  const key = headlineKeyForSource(source);
  const slots = slotsFor(key, source, book);
  const headline = renderHeadline(book, key, slots);

  // `fillTemplate` drops slots it has no value for. That is the right failure
  // mode, but a headline that lost its own subject ("Tides at: high tide …")
  // is not acceptable, so fall back to the safety line, which only needs the
  // harbour and is always renderable.
  return headline.includes('{') || headline.length < 12
    ? renderHeadline(book, 'safety', {
        harbor: source.harborName,
        horizon: horizonWord(book, source.horizon),
        risk: riskWord(book, source.riskLevel),
      })
    : headline;
}

function buildHeadline(input: SynthesisInput): string {
  const { book, parsed, artifacts } = input;

  return headlineFor(
    {
      intent: parsed.intent,
      horizon: input.horizon,
      harborName: parsed.harborName ?? book.labels.zone,
      riskLevel: input.riskLevel,
      safetyScore: input.safetyScore,
      alerts: artifacts.alerts,
      pfzZone: artifacts.activeZone,
      hotspots: artifacts.hotspots,
      routeData: artifacts.routeData,
      historicalData: artifacts.historicalData,
      tideReport: artifacts.tideReport,
      ocean: artifacts.ocean,
      weather: artifacts.weather,
      geofencingData: artifacts.geofencingData,
    },
    book,
  );
}

/** Build the full offline answer. Returns the answer and the headline pull-quote. */
export function synthesizeOffline(input: SynthesisInput): { answer: string; recommendation: string } {
  const { parsed, book } = input;
  const L = book.labels;

  const headline = buildHeadline(input);
  const body: string[] = [];

  body.push(introFor(input));

  const situation = buildSituation(input);
  if (situation.length > 0) body.push(...situation);

  const operational = buildOperational(input);
  if (operational.length > 0) body.push(...operational);

  const recommendation = buildRecommendation(input);
  body.push(recommendation);

  if (parsed.facets.map || parsed.intent === 'GENERAL_MARINE') {
    const sources = collectSources(input.results);
    body.push(`${L.sources}: ${sources.length > 0 ? sources.join(' · ') : DATA_SOURCE_SUMMARY.join(' · ')}`);
  }

  const answer = `${headline}\n\n${body.filter(Boolean).join('\n\n')}`;

  return { answer, recommendation: recommendation.replace(/^[^\n]+\n/, '') };
}

/* ------------------------------------------------------------------ *
 * Intro
 * ------------------------------------------------------------------ */

/**
 * Opening context line for an answer.
 *
 * This is intentionally *not* `book.intro` — that is the app's greeting and it
 * already has two homes: the home-screen welcome card and the empty-chat
 * welcome bubble (plus the no-intent fallback answer). Repeating it above every
 * data-backed answer read as "…in your own language. South-West Mumbai Outer
 * Front, tomorrow." The line here is the compact context a fisher needs so the
 * headline has a position and a horizon to attach to.
 */
function introFor(input: SynthesisInput): string {
  const { book, parsed, artifacts } = input;
  // A productivity verdict is about a region's fishery, not a PFZ cell — anchor
  // it on the region the historical agent analysed (e.g. "Malabar Coast")
  // rather than whatever fishing ground happens to be nearest the harbour.
  const where =
    (parsed.intent === 'PRODUCTIVITY_DIAGNOSIS'
      ? artifacts.historicalData?.region
      : artifacts.activeZone?.name) ?? book.labels.zone;
  return `${where}, ${horizonWord(book, input.horizon)}.`;
}

/* ------------------------------------------------------------------ *
 * Situation
 * ------------------------------------------------------------------ */

function buildSituation(input: SynthesisInput): string[] {
  const { book, parsed, artifacts } = input;
  const L = book.labels;
  const out: string[] = [];

  /* Fishing ground */
  if (parsed.intent === 'FIND_PFZ' && artifacts.activeZone) {
    const zone = artifacts.activeZone;
    out.push(
      `◆ ${zone.name} (${zone.basin}, ${zone.region}) — ${zone.distanceKm} km ${zone.bearing}. ` +
        `${L.sst} ${zone.sstCelsius}° C (${zone.sstAnomalyC > 0 ? '+' : ''}${zone.sstAnomalyC}° C), ` +
        `chlorophyll ${zone.chlorophyllMgM3} mg/m³, depth ${zone.depthMeters} m, ${book.evidenceKeys.radius} ${zone.radiusKm} km. ` +
        `${book.evidenceKeys.productivity}: ${zone.productivityIndex}/100 (${productivityWord(book, zone.productivityClass)}). ` +
        `${book.evidenceKeys.species}: ${zone.targetFishSpecies.join(', ')}. ` +
        `${book.evidenceKeys.chlorophyll} trend: ${trendWord(book, zone.historicalTrend)}.`,
    );
  }

  /* Hotspots */
  if (parsed.intent === 'PFZ_HOTSPOTS' && artifacts.hotspots?.length) {
    out.push(
      `◆ ${artifacts.hotspots
        .map(
          (h, i) =>
            `${i + 1}. ${h.distanceKm} km ${h.bearing} — chlorophyll ${h.chlorophyllMgM3} mg/m³, ${L.sst} ${h.sstCelsius}° C, index ${h.productivityIndex}/100 (${productivityWord(book, h.productivityClass)}); ${h.dominantSpecies.join(', ')}`,
        )
        .join('\n')}`,
    );
  }

  /* Ocean */
  if (artifacts.ocean && (parsed.facets.ocean || ['TIDE_WEATHER_SEA', 'OCEAN_STATE', 'SAFETY_ASSESSMENT', 'GENERAL_MARINE'].includes(parsed.intent))) {
    const o = artifacts.ocean;
    out.push(
      `◆ ${L.waves} ${o.waveHeightMeters} m — ${seaStateWord(book, o.waveHeightMeters)}. ` +
        `${book.ui.swellWord} ${o.swellDirection} ${book.ui.atWord} ${o.wavePeriodSeconds} s, ${book.ui.currentWord} ${o.currentKnots} kt ${o.currentDirection}. ` +
        `${L.sst} ${o.seaSurfaceTempCelsius}° C (${o.sstAnomalyC > 0 ? '+' : ''}${o.sstAnomalyC}° C).`,
    );
  }

  /* Weather */
  if (artifacts.weather && (parsed.facets.weather || ['TIDE_WEATHER_SEA', 'WEATHER_BRIEF', 'SAFETY_ASSESSMENT', 'GENERAL_MARINE'].includes(parsed.intent))) {
    const w = artifacts.weather;
    out.push(
      `◆ ${L.wind} ${w.windSpeedKnots} kt (${w.windSpeedKmph} km/h) ${book.ui.fromWord} ${w.windDirection}, ` +
        `${book.evidenceKeys.gusts} ${w.gustKnots} kt, ${book.ui.visibilityWord} ${w.visibilityKm} km, ` +
        `${book.evidenceKeys.rain} ${w.rainProbability}%, ${book.ui.lightningWord} ${w.lightningRisk}. ${localizeCondition(w.condition, book)}` +
        (w.squallWarning ? ` ${book.ui.squallBulletinWord}` : ''),
    );
  }

  /* Tide */
  if (artifacts.tideReport && (parsed.facets.tide || ['TIDE_WEATHER_SEA', 'SAFETY_ASSESSMENT', 'GENERAL_MARINE'].includes(parsed.intent))) {
    const t = artifacts.tideReport;
    out.push(
      `◆ ${L.tide} — ${book.ui.nowWord} ${t.currentLevel.toFixed(2)} m, ${t.isRising ? book.ui.risingWord : book.ui.fallingWord}. ` +
        `${book.evidenceKeys.highTide}: ${formatTideEvent(t.highTide)}. ` +
        `${book.evidenceKeys.lowTide}: ${formatTideEvent(t.lowTide)}. ` +
        `${book.evidenceKeys.tideRange}: ${t.maxRangeMeters} m.` +
        (t.recommendedWindow
          ? ` ${book.ui.transitWindowWord} ${t.recommendedWindow.startLabel}–${t.recommendedWindow.endLabel} (${qualityWord(book, t.recommendedWindow.quality)}): ${localizeTideReason(t.recommendedWindow.reason, book)}`
          : ''),
    );
  }

  /* Alerts */
  const active = (artifacts.alerts ?? []).filter((a) => a.withinInfluence);
  const nearby = (artifacts.alerts ?? []).filter((a) => !a.withinInfluence && a.distanceKm <= 250);
  if (parsed.facets.alerts || parsed.intent === 'HAZARD_ALERTS' || parsed.intent === 'SAFETY_ASSESSMENT') {
    if (active.length > 0) {
      out.push(
        `◆ ${L.alerts} — ${active.length} ${book.ui.inForceWord}:` +
          '\n' +
          active
            .map(
              (a) =>
                `   • [${a.advisoryLevel}] ${applyAlertLocalization(a, book).title} — ${a.distanceKm} km ${a.bearing}. ${applyAlertLocalization(a, book).action}`,
            )
            .join('\n'),
      );
    } else {
      out.push(
        `◆ ${L.alerts} — ` +
          renderHeadline(book, 'noAlerts', { harbor: parsed.harborName ?? L.zone }),
      );
    }
    if (nearby.length > 0) {
      out.push(
        `   ${book.ui.approachingWord}: ${nearby
          .slice(0, 2)
          .map((a) => `${applyAlertLocalization(a, book).title} (${a.distanceKm} km ${a.bearing}, ${a.advisoryLevel})`)
          .join('; ')}`,
      );
    }
  }

  /* Geofencing */
  if (artifacts.geofencingData && ['AVOID_ZONES', 'GEOFENCE_PROXIMITY', 'SAFE_ROUTE', 'GENERAL_MARINE'].includes(parsed.intent)) {
    const g = artifacts.geofencingData;
    if (g.nearbyBoundaries.length > 0) {
      out.push(
        `◆ ${book.labels.avoid} —` +
          '\n' +
          g.nearbyBoundaries
            .slice(0, 5)
            .map(
              (v) =>
                `   • ${
                  v.inside
                    ? book.ui.insideWord
                    : v.withinBuffer
                      ? `${book.ui.statutoryBufferWord.replace('{n}', String(v.bufferKm))} ${v.bearing}`
                      : `${v.distanceKm} km ${v.bearing}`
                } — ${v.boundaryName} (${v.severity}). ${v.regulation}`,
            )
            .join('\n') +
          (g.warnings.length > 0 ? `\n   ${g.warnings.join('\n   ')}` : ''),
      );
    } else {
      out.push(`◆ ${book.labels.avoid} — ${book.ui.nothingRegulatedWord.replace('{km}', '120')}.`);
    }
  }

  /* Route */
  if (artifacts.routeData) {
    const r = artifacts.routeData;
    out.push(
      `◆ ${L.route} — ${r.totalDistanceKm} km, ${r.estimatedTimeHours} ${book.ui.atWord} ${r.speedKnots} kt. ` +
        `${book.evidenceKeys.safetyScore}: ${r.safetyScore}/100 (${riskWord(book, r.riskLevel)}).` +
        (r.riskSegments.length > 0
          ? `\n   ${book.ui.watchWord}: ${r.riskSegments.map((s) => `${s.segment} — ${localizeRouteReason(s.reason, book)}`).join('; ')}`
          : '') +
        (r.alternatives.length > 0
          ? `\n   ${book.ui.alternativesWord}: ${r.alternatives.map((a) => `${a.safetyScore}/100 over ${a.totalDistanceKm} km`).join(', ')}`
          : ''),
    );
  }

  /* Historical */
  if (artifacts.historicalData) {
    const h = artifacts.historicalData;
    out.push(
      `◆ ${h.region} (${h.timeRange.start} → ${h.timeRange.end}) — landings ${trendWord(book, h.fishProductivityTrend)} ${pct(h.productivityChangePercent)}. ` +
        `CPUE ${h.cpue} t/1000 boat-days (${pct(h.cpueChangePercent)}). ` +
        `Chlorophyll ${trendWord(book, h.chlorophyllTrend)}, ${L.sst} ${trendWord(book, h.sstTrend)}.\n` +
        h.correlationAnalysis.map((c) => `   • ${c}`).join('\n'),
    );
  }

  return out;
}

/* ------------------------------------------------------------------ *
 * Operational guidance
 * ------------------------------------------------------------------ */

function buildOperational(input: SynthesisInput): string[] {
  const { book, artifacts, results } = input;
  const out: string[] = [];

  // Vessel fit is only worth saying when the numbers are close to the limit.
  const riskNotes = artifacts.riskNotes ?? [];
  const breaches = riskNotes.filter((n) => /exceeds the/.test(n.reason));
  if (breaches.length > 0) {
    out.push(`◆ ${book.evidenceKeys.vessel} — ${breaches.map((b) => localizeRiskNoteReason(b.reason, book)).join('; ')}.`);
  }

  // Specialist calls worth surfacing that are not in the structured sections.
  const safetyFindings = results
    .filter((r) => r.status !== 'ERROR' && r.agent !== 'VISUALIZATION_AGENT')
    .flatMap((r) => r.findings)
    .filter((f) => f.riskLevel === 'HIGH' || f.riskLevel === 'SEVERE')
    .slice(0, 2);

  for (const f of safetyFindings) {
    out.push(`◆ ${f.statement}`);
  }

  return out;
}

/* ------------------------------------------------------------------ *
 * Recommendation
 * ------------------------------------------------------------------ */

function buildRecommendation(input: SynthesisInput): string {
  const { book, parsed, riskLevel, safetyScore, artifacts } = input;

  let core: string;
  switch (riskLevel) {
    case 'LOW':
      core = book.recommendations.safe;
      break;
    case 'MODERATE':
      core = book.recommendations.caution;
      break;
    case 'HIGH':
    case 'SEVERE':
      core = book.recommendations.unsafe;
      break;
    default:
      core = book.recommendations.generic;
  }

  if (parsed.intent === 'FIND_PFZ' || parsed.intent === 'PFZ_HOTSPOTS') {
    core = book.recommendations.pfz;
  }

  const extras: string[] = [];
  if (artifacts.routeData) extras.push(artifacts.routeData.recommendation);
  if (artifacts.historicalData?.recommendations.length) {
    extras.push(artifacts.historicalData.recommendations[0]);
  }
  if (artifacts.geofencingData?.violations.length) {
    const v = artifacts.geofencingData.violations[0];
    extras.push(
      v.inside
        ? book.evidenceKeys.insideBoundary
            .replace('{name}', v.boundaryName)
            .replace('{type}', v.boundaryType.replace(/_/g, ' ').toLowerCase())
        : book.evidenceKeys.keepClear
            .replace('{n}', String(v.bufferKm))
            .replace('{name}', v.boundaryName),
    );
  }
  const topAlert = (artifacts.alerts ?? []).find((a) => a.withinInfluence);
  if (topAlert) extras.push(applyAlertLocalization(topAlert, book).action);

  const headline = `${book.labels.recommendation}: ${core} (${riskWord(book, riskLevel)} · ${safetyScore}/100)`;

  return [headline, ...extras.map((e) => `→ ${e}`)].join('\n');
}

/* ------------------------------------------------------------------ *
 * Evidence appendix
 * ------------------------------------------------------------------ */

/** Flatten the agent findings into the evidence ledger surfaced in the UI. */
export function collectEvidence(results: AgentResult[]): EvidenceItem[] {
  const ledger: EvidenceItem[] = [];
  const seen = new Set<string>();

  for (const result of results) {
    for (const f of result.findings) {
      for (const item of f.evidence) {
        const key = `${item.label}|${item.value}|${item.source}`;
        if (seen.has(key)) continue;
        seen.add(key);
        ledger.push(item);
      }
    }
  }

  return ledger;
}

/** Unique upstream data products touched by this run. */
export function collectSources(results: AgentResult[]): string[] {
  const set = new Set<string>();
  for (const result of results) {
    for (const source of result.dataSources) set.add(source);
    for (const f of result.findings) {
      for (const item of f.evidence) if (item.source) set.add(item.source);
    }
  }
  return [...set];
}

const DATA_SOURCE_SUMMARY = [
  'INCOIS PFZ & OSF',
  'IMD marine warnings',
  'INCOIS tide gauges',
  'MODIS/VIIRS ocean colour',
  'INSAT-3D SST',
];

/* ------------------------------------------------------------------ *
 * Risk helpers shared with the critic
 * ------------------------------------------------------------------ */

/** True when the answer must not be softened, whatever the phrasing. */
export function isHardStop(level: RiskLevel): boolean {
  return RISK_ORDER[level] >= RISK_ORDER.HIGH;
}
