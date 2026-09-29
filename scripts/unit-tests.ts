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
 * Summary
 * ------------------------------------------------------------------ */

console.log(`\nUnit tests: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log('All unit tests green.');