/**
 * Fast, deterministic, fully-offline unit tests for the core math and rules.
 *
 * These run *before* the integration sweep on `npm test` and cover the pieces
 * the sweep only exercises indirectly: geodesy edges, advisory expiry/headline
 * rules, and localization integrity across all 11 languages. No network, no
 * server, no keys — pure imports from `src/core`.
 *
 *   npm run test:unit    → this file
 *   npm test             → this file, then scripts/test-sweep.ts
 */

import {
  COMPASS_POINTS_16,
  EARTH_RADIUS_KM,
  destinationPoint,
  formatBearing,
  haversineKm,
  initialBearingDeg,
  kmToNauticalMiles,
  nauticalMilesToKm,
  pointInPolygon,
  roundTo,
} from '../src/core/geo';
import {
  HEADLINE_HORIZON_KM,
  bulletinStillValid,
  parseBulletinExpiry,
  pickHeadlineAlert,
} from '../src/core/alerts';
import { DATA_CYCLE, GEOFENCES, TIDE_STATIONS } from '../src/core/dataset';
import { getPhrasebook, SUPPORTED_PHRASEBOOK_LANGUAGES, riskWord } from '../src/core/i18n';
import { localizeCondition, localizeSource } from '../src/core/localize';
import { buildOcean, fetchPointOceanBatch } from '../src/core/live';
import type { MarineAlert } from '../src/types';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(label: string, ok: boolean, detail = ''): void {
  if (ok) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function approx(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance;
}

/* ------------------------------------------------------------------ *
 * Section 1 — geodesy
 * ------------------------------------------------------------------ */

{
  // A quarter of the Earth's circumference along the equator: (0,0)→(0,90).
  const quarter = haversineKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 90 });
  check('geo · quarter circumference', approx(quarter, (Math.PI / 2) * EARTH_RADIUS_KM, 1), String(quarter));

  check('geo · distance symmetric', approx(
    haversineKm({ latitude: 12.97, longitude: 77.59 }, { latitude: 19.076, longitude: 72.877 }),
    haversineKm({ latitude: 19.076, longitude: 72.877 }, { latitude: 12.97, longitude: 77.59 }),
    1e-6,
  ));

  check('geo · zero distance', haversineKm({ latitude: 8.9, longitude: 76.3 }, { latitude: 8.9, longitude: 76.3 }) === 0);

  check('geo · due north bearing 0', approx(initialBearingDeg({ latitude: 0, longitude: 0 }, { latitude: 10, longitude: 0 }), 0, 0.5));
  check('geo · due east bearing 90', approx(initialBearingDeg({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 10 }), 90, 0.5));

  // Destination round-trip: travel 120 km at 33°, you should be ~120 km back.
  const origin = { latitude: 12.97, longitude: 77.59 };
  const dest = destinationPoint(origin, 33, 120);
  const back = haversineKm(origin, dest);
  check('geo · destination round-trip', approx(back, 120, 0.5), String(back));

  check('geo · formatBearing N/E/SE', formatBearing(0) === 'N (0°)' && formatBearing(90) === 'E (90°)' && /^SE \(\d+°\)$/.test(formatBearing(135)), formatBearing(135));
  check('geo · 16 compass points', COMPASS_POINTS_16.length === 16);

  // Point-in-polygon: a small triangle around (12.97, 77.59).
  const triangle = [
    { latitude: 12.5, longitude: 77.0 },
    { latitude: 13.5, longitude: 77.0 },
    { latitude: 13.0, longitude: 78.2 },
  ];
  check('geo · point inside polygon', pointInPolygon({ latitude: 12.97, longitude: 77.6 }, triangle) === true);
  check('geo · point outside polygon', pointInPolygon({ latitude: 1.0, longitude: 1.0 }, triangle) === false);

  check('geo · roundTo', roundTo(1.234, 2) === 1.23 && roundTo(1.235, 2) === 1.24);
  check('geo · nm conversion', approx(kmToNauticalMiles(1), 0.53996, 1e-3) && approx(nauticalMilesToKm(1), 1.852, 1e-3));
}

/* ------------------------------------------------------------------ *
 * Section 2 — advisory expiry & headline rules
 * ------------------------------------------------------------------ */

{
  const now = Date.now();

  const iso = parseBulletinExpiry(new Date(now + 3600e3).toISOString());
  check('expiry · ISO absolute', iso !== null && approx(iso - now, 3600e3, 2000), String(iso));

  const relIso = parseBulletinExpiry(`+3 h from ${new Date(now).toISOString()}`);
  check('expiry · relative + ISO', relIso !== null && approx(relIso - now, 3 * 3600e3, 2000), String(relIso));

  const ist = parseBulletinExpiry('+22 h from 09 Sep 2026, 08:30 IST');
  // 08:30 IST = 03:00Z; +22 h → 2026-09-10T01:00:00Z.
  check('expiry · relative + IST stamp', ist !== null && ist === Date.UTC(2026, 8, 10, 1, 0, 0), String(ist));

  check('expiry · unknown shape → conservative null', parseBulletinExpiry('tomorrow-ish') === null);

  check('expiry · seed stamps lapse', parseBulletinExpiry('+12 h from 09 Sep 2026, 08:30 IST') !== null);

  const validAlert = (over: Partial<MarineAlert>): MarineAlert =>
    ({
      id: 't',
      title: 't',
      type: 'cyclone',
      advisoryLevel: 'YELLOW',
      severity: 'moderate',
      distanceKm: 40,
      bearing: 'N',
      withinInfluence: true,
      validUntil: '+2 h from 09 Sep 2026, 08:30 IST',
      action: '',
      source: 'test',
      ...over,
    }) as MarineAlert;

  const lapsed = validAlert({ validUntil: '+1 h from 09 Sep 2026, 08:30 IST', withinInfluence: true });
  check('expiry · lapsed bulletin stops governing', bulletinStillValid(lapsed, new Date('2026-09-09T12:00:00Z')) === false);

  const future = validAlert({ validUntil: '+48 h from 09 Sep 2026, 08:30 IST', withinInfluence: true });
  check('expiry · live bulletin governs', bulletinStillValid(future, new Date('2026-09-09T12:00:00Z')) === true);

  check('expiry · outside influence never in force', bulletinStillValid(validAlert({ withinInfluence: false })) === false);

  const mk = (id: string, distanceKm: number, withinInfluence: boolean, advisoryLevel: MarineAlert['advisoryLevel']): MarineAlert =>
    validAlert({ id, distanceKm, withinInfluence, advisoryLevel });

  check('headline · far-only event NOT headlined', pickHeadlineAlert([mk('far', 980, false, 'RED')]) === null);
  check('headline · nearest inside horizon when nothing in force', pickHeadlineAlert([mk('far', 900, false, 'RED'), mk('near', 120, false, 'GREEN')])?.id === 'near');
  check('headline · advisory in force beats nearer badge', pickHeadlineAlert([mk('far', 900, false, 'RED'), mk('local', 45, true, 'YELLOW')])?.id === 'local');
  check('headline · severity wins among in-force', pickHeadlineAlert([mk('a', 40, true, 'YELLOW'), mk('b', 80, true, 'RED')])?.id === 'b');
  check('headline · horizon constant', HEADLINE_HORIZON_KM === 250);
}

/* ------------------------------------------------------------------ *
 * Section 3 — localization integrity (all 11 languages)
 * ------------------------------------------------------------------ */

{
  check('i18n · 11 phrasebooks present', SUPPORTED_PHRASEBOOK_LANGUAGES.length === 11, String(SUPPORTED_PHRASEBOOK_LANGUAGES.length));

  const books = SUPPORTED_PHRASEBOOK_LANGUAGES.map((code) => getPhrasebook(code));
  check(
    'i18n · every risk word slot filled',
    books.every((b) => b.riskWords.every((w) => typeof w === 'string' && w.length > 0)),
  );
  check(
    'i18n · riskWord resolves per level',
    books.every((b) => riskWord(b, 'SEVERE').length > 0 && riskWord(b, 'LOW').length > 0),
  );
  check(
    'i18n · localizeCondition renders a canonical phrase in every language',
    books.every((b) => {
      const s = localizeCondition('Clear sky', b);
      return s.trim().length > 0 && s !== 'Clear sky';
    }),
  );
  check(
    'i18n · localizeSource returns text in every language',
    books.every((b) => localizeSource('GDACS (UN / European Commission) real-time disaster feed', b).trim().length > 0),
  );
}

/* ------------------------------------------------------------------ *
 * Section 4 — reference dataset integrity
 * ------------------------------------------------------------------ */

{
  check('dataset · DATA_CYCLE fully shaped', typeof DATA_CYCLE.cycle === 'string' && DATA_CYCLE.label.includes('IST') && DATA_CYCLE.pfzValidFrom.length > 0, DATA_CYCLE.label);
  check('dataset · tide stations present', Object.keys(TIDE_STATIONS).length >= 10, String(Object.keys(TIDE_STATIONS).length));
  check('dataset · geofences present', GEOFENCES.length >= 4, String(GEOFENCES.length));
}

/* ------------------------------------------------------------------ *
 * Section 5 — live sea-state honesty
 *
 * Open-Meteo returns a well-formed marine block whose every value is `null`
 * when its model has no grid cell over the point (Digha, on the Bay of Bengal
 * model edge). Those nulls must never become a confident-looking 0 m / 0 °C
 * still stamped "real-time sea state" — a fisher acting on that goes to sea
 * against a sea that was never measured. No live data must be reported at all
 * in that case, so the caller falls back to the labelled reference snapshot.
 * ------------------------------------------------------------------ */

{
  const hours = 96;
  const series = (value: number | null): number[] => new Array(hours).fill(value);

  // Exactly the shape Digha returns: a full hourly block, every field null.
  const allNull = {
    time: new Array(hours).fill('2026-09-29T00:00'),
    wave_height: series(null),
    wave_direction: series(null),
    wave_period: series(null),
    wind_wave_height: series(null),
    swell_wave_height: series(null),
    swell_wave_direction: series(null),
    sea_surface_temperature: series(null),
    ocean_current_velocity: series(null),
    ocean_current_direction: series(null),
  };
  const refused = buildOcean('digha', 'Digha', allNull as never, 28.5, '2026-09-29T00:00:00.000Z');
  check('live · all-null marine payload refuses to build', refused === null, String(refused));

  // A healthy payload still builds, and stays physically plausible.
  const good = {
    time: new Array(hours).fill('2026-09-29T00:00'),
    wave_height: series(1.6),
    wave_direction: series(165),
    wave_period: series(9.4),
    wind_wave_height: series(0.3),
    swell_wave_height: series(1.2),
    swell_wave_direction: series(165),
    sea_surface_temperature: series(28.4),
    ocean_current_velocity: series(0.6),
    ocean_current_direction: series(90),
  };
  const built = buildOcean('kochi', 'Kochi', good as never, 27.5, '2026-09-29T00:00:00.000Z');
  check(
    'live · healthy marine payload builds plausible sea state',
    built !== null && built.waveHeightMeters > 0 && built.seaSurfaceTempCelsius > 20 && built.forecast.length > 0,
    built ? `${built.waveHeightMeters} m / ${built.seaSurfaceTempCelsius}°C` : 'null',
  );

  // A window whose hours are all null must inherit real values from the rest
  // of the series, not collapse to a flat calm.
  const holed = {
    ...good,
    sea_surface_temperature: new Array(hours).fill(null).map((_, i) => (i < 12 ? null : 28.4)),
  };
  const withHole = buildOcean('digha', 'Digha', holed as never, 28.5, '2026-09-29T00:00:00.000Z');
  check(
    'live · null hours never average down to a fabricated value',
    withHole !== null && withHole.seaSurfaceTempCelsius > 20,
    withHole ? `${withHole.seaSurfaceTempCelsius}°C` : 'null',
  );
}

/* ------------------------------------------------------------------ *
 * Section 6 — batched point sampling
 *
 * The fishing-ground and hotspot layers sample ~30 points through one
 * comma-separated upstream call, so a mis-mapped response would silently
 * attach one ground's sea temperature to another. The response echoes back
 * *snapped* coordinates, which cannot be used to line answers up — only
 * request order can. This pins that, and pins that a cell the model cannot
 * answer stays absent rather than becoming a flat 0 m / 0 °C reading.
 * ------------------------------------------------------------------ */

{
  const realFetch = globalThis.fetch;
  const requests: string[] = [];
  let responses: unknown[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    requests.push(url.search);
    const latParam = url.searchParams.get('latitude') ?? '';
    // Answer positionally, echoing deliberately *snapped* coordinates that do
    // not match what was asked for — exactly what the real API does.
    const snapped = latParam.split(',').map((_, i) => `9.${i}${i}`);
    const rows = responses.map((current, i) => ({
      latitude: Number(snapped[i]),
      longitude: 10 + i,
      current,
    }));
    return new Response(JSON.stringify(rows), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    // 1. Every point answered, each with a distinct value.
    responses = [
      { sea_surface_temperature: 28.1, wave_height: 0.9, ocean_current_velocity: 0.4 },
      { sea_surface_temperature: 27.4, wave_height: 1.8, ocean_current_velocity: 0.7 },
      { sea_surface_temperature: 29.2, wave_height: 0.3, ocean_current_velocity: 0.2 },
    ];
    requests.length = 0;
    const got = await fetchPointOceanBatch([
      { lat: 8.9, lon: 76.3 },
      { lat: 9.88, lon: 77.24 },
      { lat: 10.87, lon: 78.19 },
    ]);
    const first = got.get('8.900,76.300');
    const second = got.get('9.880,77.240');
    const third = got.get('10.870,78.190');
    check(
      'live · batched points map onto their own answers',
      first?.sst === 28.1 && second?.sst === 27.4 && third?.sst === 29.2,
      `${first?.sst}/${second?.sst}/${third?.sst}`,
    );
    check(
      'live · one call covers the whole batch',
      requests.length === 1,
      `${requests.length} call(s) for 3 points`,
    );
    check(
      'live · currents convert to knots',
      second?.currentKnots !== undefined && Math.abs((second.currentKnots ?? 0) - 1.36) < 0.02,
      String(second?.currentKnots),
    );

    // 2. A cell with no model coverage: absent, never zero.
    responses = [
      { sea_surface_temperature: 28.1, wave_height: 0.9, ocean_current_velocity: 0.4 },
      { sea_surface_temperature: null, wave_height: null, ocean_current_velocity: null },
    ];
    const gapped = await fetchPointOceanBatch([
      { lat: 1.5, lon: 2.5 },
      { lat: 42.5, lon: 87.25 },
    ]);
    const gap = gapped.get('42.500,87.250');
    check(
      'live · an uncovered cell yields no reading, not a fabricated one',
      !gap || (gap.sst === undefined && gap.wave === undefined),
      JSON.stringify(gap),
    );
  } finally {
    globalThis.fetch = realFetch;
  }
}

/* ------------------------------------------------------------------ *
 * Summary
 * ------------------------------------------------------------------ */

console.log(`\nUnit tests: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log('All unit tests green.');