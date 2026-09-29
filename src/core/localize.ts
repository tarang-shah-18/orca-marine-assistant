/**
 * localize.ts
 *
 * Language-aware rendering for strings produced by the deterministic engine:
 * alert copy, weather conditions, evidence-source labels and product-source
 * attribution chips. These strings are generated once (language-agnostic) and
 * carried through the pipeline, so they are localized here — at render and
 * aggregation time — where the active phrasebook is in hand.
 *
 * Product tokens (Open-Meteo, ECMWF IFS, MODIS-Aqua, GDACS, ERA5,
 * WaveWatch-III) and quoted bulletin fragments are treated as data and stay
 * verbatim; only the role words around them are translated.
 */

import type { MarineAlert } from '../types';
import { getPhrasebook, type Phrasebook } from './i18n';

/**
 * Keyed exactly to the finite `conditionFromCode` set in `live.ts` and the
 * dataset's base-weather wording. Unknown strings pass through untouched.
 */
const CONDITION_KEYS: Array<[RegExp, keyof Phrasebook['conditions']]> = [
  [/clear sky/i, 'clear'],
  [/partly cloudy/i, 'partlyCloudy'],
  [/^overcast$/i, 'overcast'],
  [/fog/i, 'fog'],
  [/drizzle|light rain/i, 'lightRain'],
  [/rain periods/i, 'rain'],
  [/snow or sleet/i, 'snow'],
  [/snow showers/i, 'snowShowers'],
  [/rain showers/i, 'showers'],
  [/thunderstorm with hail/i, 'thunderHail'],
  [/thunderstorm|thunder/i, 'thunder'],
  [/variable cloud|moderate sea state|partly cloudy/i, 'variable'],
];

/**
 * Localize a weather-condition phrase. Falls back to the original text when
 * the phrase is not one of the canonical WMO-condition renderings.
 */
export function localizeCondition(
  condition: string | undefined | null,
  book: Phrasebook = getPhrasebook('en-IN'),
): string {
  if (!condition) return condition ?? '';
  for (const [re, key] of CONDITION_KEYS) {
    if (re.test(condition)) return book.conditions[key];
  }
  return condition;
}

/** Short evidence-source labels that appear under the situation instruments. */
const SOURCE_WORDS: Record<string, keyof Phrasebook['sourceWords']> = {
  'ORCA geodesic engine': 'geodesicEngine',
  'ORCA coastal gazetteer': 'coastalGazetteer',
  'Reference position': 'referencePosition',
};

/**
 * Localize a recommended slack-window note produced by `tideAgent.ts`. The
 * three canonical templates carry the stream strength (and level change for
 * the POOR case) as numbers, which are re-filled into the phrasebook wording.
 * Anything else passes through untouched.
 */
export function localizeTideReason(
  reason: string,
  book: Phrasebook = getPhrasebook('en-IN'),
): string {
  const kt = /([\d.]+)\s*kt/.exec(reason)?.[1] ?? '';
  const change = /([\d.]+)\s*m change/.exec(reason)?.[1];
  if (/^Slack water/i.test(reason)) return book.ui.tideNoteWord.replace('{n}', kt);
  if (/^Moderate stream/i.test(reason)) return book.ui.tideFairWord.replace('{n}', kt);
  if (/^Strong stream/i.test(reason)) {
    return book.ui.tidePoorWord.replace('{n}', kt).replace('{m}', change ?? '');
  }
  return reason;
}

/**
 * Localize an evidence/source label. Known short names map to `sourceWords`;
 * anything else falls through to the product-source dispatch.
 */
export function localizeSource(
  source: string,
  book: Phrasebook = getPhrasebook('en-IN'),
): string {
  const key = SOURCE_WORDS[source];
  if (key) return book.sourceWords[key];
  return localizeProductSource(source, book);
}

/** Exact product-source strings produced by `statusesOf` in `live.ts`. */
const PRODUCT_SOURCE_EXACT: Record<string, keyof Phrasebook['productSources']> = {
  'Open-Meteo Forecast API (ECMWF IFS)': 'weather',
  'Open-Meteo Marine API (WaveWatch-III)': 'ocean',
  'Open-Meteo marine + MODIS-Aqua climatology': 'pfz',
  'Open-Meteo marine grid scan': 'hotspots',
  'Derived live forecast + GDACS (UN)': 'alerts',
  'ERA5 reanalysis (ECMWF / Copernicus)': 'historical',
  'GDACS (UN / European Commission)': 'disasters',
  'Reference snapshot (offline fallback)': 'reference',
};

/**
 * Localize a data-cycle product chip (role words only — product tokens stay
 * verbatim). Handles the exact `productSource` strings plus recombined long
 * source lines that appear in evidence lists.
 */
export function localizeProductSource(
  source: string,
  book: Phrasebook = getPhrasebook('en-IN'),
): string {
  const exact = PRODUCT_SOURCE_EXACT[source];
  if (exact) return book.productSources[exact];

  const P = book.productSources;
  if (/derived live forecast|live-derived/i.test(source)) return P.alerts;
  if (/Open-Meteo/i.test(source) && /convective\b.*forecast|atmospheric|IFS/i.test(source)) return P.weather;
  if (/Open-Meteo/i.test(source) && /marine|WaveWatch/i.test(source) && /climatolog|MODIS/i.test(source)) return P.pfz;
  if (/Open-Meteo/i.test(source) && /marine|WaveWatch/i.test(source)) return P.ocean;
  if (/grid scan|hotspot/i.test(source)) return P.hotspots;
  if (/ERA5|reanalysis|historical|36-month/i.test(source)) return P.historical;
  if (/GDACS/i.test(source)) return P.disasters;
  if (/reference snapshot|bundled/i.test(source)) return P.reference;
  return source;
}

/**
 * Fill `{n}`, `{m}`, `{name}`, `{level}`, `{date}` placeholders from the
 * structured alert params.
 */
function fill(
  template: string,
  p: Record<string, string | number>,
): string {
  return template
    .replace(/\{n\}/g, String(p.n ?? ''))
    .replace(/\{m\}/g, String(p.m ?? ''))
    .replace(/\{name\}/g, String(p.name ?? ''))
    .replace(/\{level\}/g, String(p.level ?? ''))
    .replace(/\{date\}/g, String(p.date ?? p.from ?? ''));
}

/**
 * Rebuild an alert's user-facing copy from its structured params using the
 * active phrasebook. Alerts without `params` (imported/quoted advisories
 * whose text is data) are returned verbatim as an empty patch.
 */
export function localizeAlertText(
  alert: MarineAlert,
  book: Phrasebook = getPhrasebook('en-IN'),
): Partial<MarineAlert> {
  const p = alert.params;
  if (!p) return {};

  const A = book.alerts;
  const patch: Partial<MarineAlert> = {};

  const liveWindow =
    typeof p.validHours === 'number' && typeof p.from === 'string'
      ? A.windowFrom.replace('{n}', String(p.validHours)).replace('{date}', p.from)
      : undefined;

  switch (alert.type) {
    case 'STRONG_WIND': {
      patch.title = fill(A.strongWind.title, p);
      patch.description = fill(A.strongWind.description, p);
      patch.action = fill(A.strongWind.action, p);
      patch.source = A.sourceWeather;
      break;
    }
    case 'SQUALL': {
      patch.title = fill(A.squall.title, p);
      patch.description = fill(A.squall.description, p);
      patch.action = fill(A.squall.action, p);
      patch.source = A.sourceWeather;
      break;
    }
    case 'LIGHTNING': {
      patch.title = fill(A.lightning.title, p);
      patch.description = fill(A.lightning.description, p);
      patch.action = fill(A.lightning.action, p);
      patch.source = A.sourceConvective;
      break;
    }
    case 'HIGH_WAVE': {
      patch.title = fill(A.highWave.title, p);
      patch.description = fill(A.highWave.description, p);
      patch.action = fill(A.highWave.action, p);
      patch.source = A.sourceMarine;
      break;
    }
    case 'ROUGH_SEA': {
      patch.title = fill(A.roughSea.title, p);
      patch.description = fill(A.roughSea.description, p);
      patch.action = fill(A.roughSea.action, p);
      patch.source = A.sourceMarine;
      break;
    }
    case 'CYCLONE': {
      patch.title = fill(A.cyclone.title, p);
      const orange =
        (alert.params?.level as string | undefined) ?? alert.advisoryLevel;
      patch.action =
        /red|orange/i.test(String(orange))
          ? fill(A.cyclone.actionOrange, p)
          : fill(A.cyclone.actionOther, p);
      // Quoted GDACS bulletin (description) and real event window stay verbatim.
      break;
    }
    default:
      return {};
  }

  if (liveWindow) patch.validUntil = liveWindow;
  return patch;
}

/**
 * Convenience for consumers that already hold a `MarineAlert`: returns the
 * alert with localized copy applied (immutable).
 */
export function applyAlertLocalization(
  alert: MarineAlert,
  book: Phrasebook = getPhrasebook('en-IN'),
): MarineAlert {
  const patch = localizeAlertText(alert, book);
  if (Object.keys(patch).length === 0) return alert;
  return { ...alert, ...patch };
}

/**
 * Localize a risk-note reason string produced by the weather/ocean agents
 * that surfaces in the vessel-fit line of the chat answer. The engine keeps
 * canonical English because the breach filter matches `/exceeds the/` before
 * rendering; this runs at render time where the phrasebook is in hand.
 */
export function localizeRiskNoteReason(
  reason: string,
  book: Phrasebook = getPhrasebook('en-IN'),
): string {
  const wind = /^Forecast wind ([\d.]+) kt exceeds the ([\d.]+) kt limit for this vessel\.$/.exec(reason);
  if (wind) {
    return book.ui.windExceedWord
      .replace('{wind}', wind[1])
      .replace('{limit}', wind[2]);
  }
  const wave = /^Significant wave height ([\d.]+) m \(([^)]+)\), current ([\d.]+) kt\.$/.exec(reason);
  if (wave) {
    return book.ui.waveExceedWord
      .replace('{wave}', wave[1])
      .replace('{state}', wave[2])
      .replace('{current}', wave[3]);
  }
  return reason;
}

/**
 * Localize a route-segment reason string produced by `routeAgent`. Matches
 * the canonical templates and re-fills numbers and names into the phrasebook
 * wording; anything else passes through untouched.
 */
export function localizeRouteReason(
  reason: string,
  book: Phrasebook = getPhrasebook('en-IN'),
): string {
  const seas = /^seas to ([\d.]+) m exceed the ([\d.]+) m limit$/.exec(reason);
  if (seas) {
    return book.ui.seasExceedWord
      .replace('{wave}', seas[1])
      .replace('{limit}', seas[2]);
  }
  const winds = /^winds to ([\d.]+) kt exceed the ([\d.]+) kt limit$/.exec(reason);
  if (winds) {
    return book.ui.windsExceedWord
      .replace('{wind}', winds[1])
      .replace('{limit}', winds[2]);
  }
  const crosses = /^crosses (.+?) — (.+)$/.exec(reason);
  if (crosses) {
    return book.ui.crossesWord
      .replace('{name}', crosses[1])
      .replace('{reason}', crosses[2]);
  }
  if (/^clear of hazard cells and within vessel limits$/.test(reason)) {
    return book.ui.clearHazardsWord;
  }
  return reason;
}