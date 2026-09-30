/**
 * ORCA full-surface regression sweep.
 *
 * Exercises every variation the client can produce, through the *real* engine:
 *
 *   1. 13 harbours × a battery of intent-bearing queries   (location × query)
 *   2. 8 canonical capabilities × 11 languages             (query × language)
 *   3. every persona's quick asks                          (UI presets)
 *   4. every vessel profile                                (input variation)
 *   5. per-layer visualisation invariants — no layer may contain neither a
 *      series nor geo features (the "No plottable series" bug can never return)
 *   6. every HTTP endpoint against the running dev server, incl. the SSE
 *      `/chat/stream` (checks the done frame always arrives)
 *
 * Run:
 *   PATH="$HOME/.local/node/bin:$PATH" npx tsx scripts/test-sweep.ts
 *
 * Exit code 0 = all green; 1 = at least one check failed.
 */

import { orchestrate, buildSituationReport, freshMemory } from '../src/agents/orchestrator';
import { ALL_INTENTS } from '../src/core/intent';
import { HARBORS, VESSEL_PROFILES, findNearestHarbor } from '../src/core/dataset';
import { PERSONAS } from '../src/personas';
import { allScenarioQuestions } from '../src/server/scenarios';
import type { LanguageCode, OrchestrationResult, VisualizationData } from '../src/types';

const BASE = 'http://localhost:3000/api';

/* ------------------------------------------------------------------ *
 * Reporting
 * ------------------------------------------------------------------ */

interface Check {
  group: string;
  label: string;
  ok: boolean;
  detail: string;
}

const checks: Check[] = [];
const startedAt = Date.now();

function record(group: string, label: string, ok: boolean, detail = ''): void {
  checks.push({ group, label, ok, detail });
  if (!ok) {
    console.error(`  ✗ [${group}] ${label} — ${detail}`);
  }
}

function expect(ok: boolean, group: string, label: string, detail: string): void {
  record(group, label, ok, detail);
}

/* ------------------------------------------------------------------ *
 * Shared helpers
 * ------------------------------------------------------------------ */

/** Number of geographic features a visualisation carries (its layer content). */
function geoCount(viz: VisualizationData): number {
  const geo = viz.geo;
  if (!geo) return 0;
  return (geo.circles?.length ?? 0) + (geo.polygons?.length ?? 0) + (geo.points?.length ?? 0);
}

/** Invariant: a visualisation is only "contentless" when it truly has nothing. */
function vizInvariantViolation(viz: VisualizationData): string | null {
  if (viz.series.length === 0 && geoCount(viz) === 0) {
    return `${viz.id} (“${viz.title}”) has neither a series nor geo features`;
  }
  return null;
}

function findViz(vizs: VisualizationData[], id: string): VisualizationData | undefined {
  return vizs.find((v) => v.id === id);
}

const RISK_LEVELS = ['LOW', 'MODERATE', 'HIGH', 'SEVERE'];
const TREND_WORDS = ['improving', 'stable', 'deteriorating'];

const SCRIPT_PATTERNS: Record<LanguageCode, RegExp | null> = {
  'en-IN': null,
  'hi-IN': /[\u0900-\u097F]/,
  'mr-IN': /[\u0900-\u097F]/,
  'gu-IN': /[\u0A80-\u0AFF]/,
  'kn-IN': /[\u0C80-\u0CFF]/,
  'ml-IN': /[\u0D00-\u0D7F]/,
  'te-IN': /[\u0C00-\u0C7F]/,
  'ta-IN': /[\u0B80-\u0BFF]/,
  'bn-IN': /[\u0980-\u09FF]/,
  'or-IN': /[\u0B00-\u0B7F]/,
  'pa-IN': /[\u0A00-\u0A7F]/,
};

/** Structural sanity shared by every orchestration run. */
function auditResult(
  group: string,
  label: string,
  result: OrchestrationResult,
  opts: {
    expectIntent?: string;
    expectLanguage?: LanguageCode;
    expectHarborId?: string;
    expectScript?: LanguageCode | null;
  } = {},
): void {
  expect(result.answer.trim().length > 0, group, label, 'empty answer');
  expect(result.recommendation.trim().length > 0, group, label, 'empty recommendation');
  expect(ALL_INTENTS.includes(result.plan.intent as (typeof ALL_INTENTS)[number]), group, label, `unknown intent ${result.plan.intent}`);
  if (opts.expectIntent) {
    expect(result.plan.intent === opts.expectIntent, group, label, `intent ${result.plan.intent} (expected ${opts.expectIntent})`);
  }
  expect(RISK_LEVELS.includes(result.riskLevel), group, label, `risk ${result.riskLevel}`);
  expect(Number.isFinite(result.safetyScore) && result.safetyScore >= 0 && result.safetyScore <= 100, group, label, `safety ${result.safetyScore}`);
  expect(result.disclaimer.trim().length > 0, group, label, 'empty disclaimer');
  expect(result.sources.length > 0, group, label, 'no data sources');
  if (opts.expectLanguage) {
    expect(result.detectedLanguage === opts.expectLanguage, group, label, `detected ${result.detectedLanguage} (expected ${opts.expectLanguage})`);
  }
  if (opts.expectScript) {
    const pattern = SCRIPT_PATTERNS[opts.expectScript];
    if (pattern && !pattern.test(result.answer)) {
      record(group, label, false, `answer not in ${opts.expectScript} script`);
    }
  }
  if (opts.expectHarborId) {
    expect(result.memory.activeHarborId === opts.expectHarborId, group, label, `anchored to ${result.memory.activeHarborId}`);
  }
  const errored = result.agentResults.filter((a) => a.status === 'ERROR');
  expect(errored.length === 0, group, label, `agent ERROR: ${errored.map((a) => a.agent).join(', ')}`);
  for (const viz of result.visualizations) {
    const violation = vizInvariantViolation(viz);
    if (violation) record(group, label, false, violation);
  }
}

/**
 * Structural sanity for the departure-window risk trajectory product.
 * A trajectory must never contradict the risk vocabulary the rest of the
 * system speaks, and its best window must actually be one of its points.
 */
function auditTrajectory(
  group: string,
  label: string,
  result: OrchestrationResult,
  expected = true,
): void {
  const trajectory = result.riskTrajectory;
  if (!expected) {
    expect(
      trajectory === undefined,
      group,
      label,
      `expected no riskTrajectory but got ${trajectory?.points?.length ?? 0} points`,
    );
    return;
  }
  expect(
    Boolean(trajectory && trajectory.points.length >= 3),
    group,
    label,
    'riskTrajectory missing or has < 3 windows',
  );
  if (!trajectory) return;
  for (const point of trajectory.points) {
    expect(RISK_LEVELS.includes(point.riskLevel), group, label, `point ${point.validHours}h risk ${point.riskLevel}`);
    expect(
      Number.isFinite(point.safetyScore) && point.safetyScore >= 0 && point.safetyScore <= 100,
      group,
      label,
      `point ${point.validHours}h safety ${point.safetyScore}`,
    );
  }
  const hours = trajectory.points.map((p) => p.validHours);
  expect(
    hours.every((h, i) => i === 0 || h > hours[i - 1]),
    group,
    label,
    `horizons not strictly increasing: ${hours.join(',')}`,
  );
  expect(
    trajectory.bestWindow === null ||
      hours.includes(trajectory.bestWindow.validHours),
    group,
    label,
    `bestWindow ${trajectory.bestWindow?.validHours}h not among points`,
  );
  expect(
    TREND_WORDS.includes(trajectory.trend),
    group,
    label,
    `trend ${JSON.stringify(trajectory.trend)}`,
  );
}

/* ------------------------------------------------------------------ *
 * Helpers to run one query through the real engine
 * ------------------------------------------------------------------ */

async function run(
  question: string,
  opts: {
    language?: LanguageCode;
    harborId?: string;
    vessel?: string;
  } = {},
): Promise<OrchestrationResult> {
  const { result } = await orchestrate(question, {
    preferredLanguage: opts.language ?? 'en-IN',
    harborId: opts.harborId,
    memory: freshMemory({
      activeHarborId: opts.harborId,
      lastVesselType: opts.vessel ?? 'motorized_dinghy',
      turnCount: 1,
    }),
  });
  return result;
}

/* ------------------------------------------------------------------ *
 * Section 1 — every harbour × every query shape
 * ------------------------------------------------------------------ */

const BATTERY: Array<{ q: string; intent: string | null }> = [
  { q: 'Give me the full marine situation report', intent: null },
  { q: 'Where is the nearest fishing zone from here?', intent: 'FIND_PFZ' },
  { q: 'Is it safe to venture out tomorrow morning?', intent: 'SAFETY_ASSESSMENT' },
  { q: 'What are the tides today?', intent: 'TIDE_WEATHER_SEA' },
  { q: 'Any lightning or cyclone alerts near my harbour?', intent: 'HAZARD_ALERTS' },
  { q: 'Which zones should I avoid while fishing today?', intent: 'AVOID_ZONES' },
  { q: 'What is the safest route from my port to the fishing zone?', intent: 'SAFE_ROUTE' },
  { q: 'Which regions show high chlorophyll and favourable sea surface temperature?', intent: 'PFZ_HOTSPOTS' },
  { q: 'Why has fish productivity declined in my region?', intent: 'PRODUCTIVITY_DIAGNOSIS' },
  { q: 'What is the current weather and sea state?', intent: null },
  { q: 'Are any geofence boundaries close to this harbour?', intent: 'GEOFENCE_PROXIMITY' },
];

async function sectionHarbours(): Promise<void> {
  console.log('\nSection 1 — harbours × queries');
  for (const harbor of HARBORS) {
    const harbourStarted = Date.now();
    for (const entry of BATTERY) {
      const label = `${harbor.shortName} :: ${entry.q}`;
      try {
        const result = await run(entry.q, { harborId: harbor.id });
        auditResult('harbours', label, result, {
          expectIntent: entry.intent ?? undefined,
          expectHarborId: harbor.id,
        });
        if (entry.q === 'Give me the full marine situation report') {
          const short = harbor.shortName.toLowerCase();
          expect(
            result.answer.toLowerCase().includes(short),
            'harbours',
            label,
            `answer does not mention ${harbor.shortName}`,
          );
        }
        if (entry.intent === 'AVOID_ZONES') {
          const geo = findViz(result.visualizations, 'viz-geofences');
          expect(Boolean(geo) && geo !== undefined && (geo.geo?.circles?.length ?? 0) + (geo.geo?.polygons?.length ?? 0) > 0, 'harbours', label, 'geofence layer has no plottable circles/polygons');
        }
        if (entry.intent === 'FIND_PFZ') {
          expect(result.pfzZone !== undefined && Number.isFinite(result.distanceKm), 'harbours', label, 'FIND_PFZ produced no zone/distance');
          const geo = findViz(result.visualizations, 'viz-pfz-map');
          expect(Boolean(geo) && geo !== undefined && (geo.geo?.circles?.length ?? 0) > 0, 'harbours', label, 'fishing-ground layer has no plottable circles');
        }
        if (entry.intent === 'GEOFENCE_PROXIMITY') {
          expect(result.geofencingData !== undefined, 'harbours', label, 'geofencingData missing');
        }
        // Departure-window intelligence: safety runs must carry a trajectory
        // (SAFETY_ASSESSMENT and the situation roster both run weather + ocean
        // + risk, so a forecast-window series must be produced).
        if (entry.intent === 'SAFETY_ASSESSMENT') {
          auditTrajectory('harbours', label, result);
        }
      } catch (error) {
        record('harbours', label, false, error instanceof Error ? error.message : String(error));
      }
    }
    const harbourChecks = checks.filter((c) => c.group === 'harbours' && c.label.startsWith(`${harbor.shortName} ::`));
    const okCount = harbourChecks.filter((c) => c.ok).length;
    const failCount = harbourChecks.length - okCount;
    console.log(
      `  ${harbor.shortName.padEnd(10)} ${okCount} ok / ${failCount} failed (${((Date.now() - harbourStarted) / 1000).toFixed(1)}s)`,
    );
  }
}

/* ------------------------------------------------------------------ *
 * Section 2 — 8 canonical capabilities × 11 languages
 * ------------------------------------------------------------------ */

async function sectionLanguages(): Promise<void> {
  console.log('\nSection 2 — capabilities × languages');
  const rows = allScenarioQuestions();
  const byLanguage = new Map<LanguageCode, { ok: number; fail: number }>();
  let index = 0;
  for (const row of rows) {
    index += 1;
    const label = `${row.language} :: ${row.capability}`;
    try {
      const result = await run(row.text, { language: row.language, harborId: row.harborId });
      auditResult('languages', label, result, {
        expectIntent: row.intent,
        expectLanguage: row.language,
        expectScript: row.language === 'en-IN' ? null : row.language,
      });
    } catch (error) {
      record('languages', label, false, error instanceof Error ? error.message : String(error));
    }
    if (index % 22 === 0) console.log(`  …${index}/${rows.length} runs`);
  }
  for (const c of checks) {
    if (c.group !== 'languages') continue;
    const lang = c.label.split(' :: ')[0] as LanguageCode;
    const agg = byLanguage.get(lang) ?? { ok: 0, fail: 0 };
    if (c.ok) agg.ok += 1;
    else agg.fail += 1;
    byLanguage.set(lang, agg);
  }
  for (const [lang, agg] of byLanguage) {
    console.log(`  ${lang.padEnd(5)} ${agg.ok} ok / ${agg.fail} failed`);
  }
}

/* ------------------------------------------------------------------ *
 * Section 3 — every persona's quick asks
 * ------------------------------------------------------------------ */

async function sectionPersonas(): Promise<void> {
  console.log('\nSection 3 — persona quick asks (kochi anchor)');
  for (const persona of PERSONAS) {
    let ok = 0;
    for (const ask of persona.quickAsk) {
      const label = `${persona.id} :: ${ask}`;
      try {
        const result = await run(ask, { harborId: 'kochi' });
        auditResult('personas', label, result, { expectHarborId: 'kochi' });
      } catch (error) {
        record('personas', label, false, error instanceof Error ? error.message : String(error));
      }
      const last = checks[checks.length - 1];
      if (last && last.group === 'personas' && last.label === label && last.ok) ok += 1;
    }
    console.log(`  ${persona.id.padEnd(10)} ${ok}/${persona.quickAsk.length} quick asks ok`);
  }
}

/* ------------------------------------------------------------------ *
 * Section 4 — every vessel profile (engine input variation)
 * ------------------------------------------------------------------ */

async function sectionVessels(): Promise<void> {
  console.log('\nSection 4 — vessel profiles (goa, SAFE_ROUTE)');
  for (const vessel of VESSEL_PROFILES) {
    const label = `vessel :: ${vessel.id}`;
    try {
      const result = await run(
        'What is the safest route from my harbour to the nearest fishing zone?',
        { harborId: 'goa', vessel: vessel.id },
      );
      auditResult('vessels', label, result, { expectIntent: 'SAFE_ROUTE', expectHarborId: 'goa' });
      expect(result.routeData !== undefined, 'vessels', label, 'routeData missing');
    } catch (error) {
      record('vessels', label, false, error instanceof Error ? error.message : String(error));
    }
    console.log(`  ${vessel.id.padEnd(18)} ok`);
  }
}

/* ------------------------------------------------------------------ *
 * Section 5 — situation-report banner (home screen payload) anchoring
 * ------------------------------------------------------------------ */

async function sectionSituationAnchoring(): Promise<void> {
  console.log('\nSection 5 — /api/situation anchoring (via engine)');
  for (const harbor of HARBORS) {
    const label = `situation :: ${harbor.id}`;
    try {
      const result = await buildSituationReport(harbor.id, 'en-IN');
      auditResult('situation', label, result, { expectHarborId: harbor.id });
      const short = harbor.shortName.toLowerCase();
      expect(
        result.answer.toLowerCase().includes(short),
        'situation',
        label,
        `answer does not mention ${harbor.shortName}`,
      );
      // The provenance line must name the SAME harbour as the report — a
      // "anchored on Mumbai" line inside a Goa report is the same class of
      // regression as the Goa/Mumbai mix-up and is caught here explicitly.
      const reasoningText = result.plan?.reasoning ?? result.answer ?? '';
      const anchor = reasoningText.match(/anchored on\s+([^\s(]+)/i);
      expect(
        !anchor || anchor[1].toLowerCase() === short,
        'situation',
        label,
        `reasoning anchors on "${anchor?.[1]}" not ${harbor.shortName}`,
      );
      // The proactive brief reuses the situation roster, so it must expose the
      // departure-window trajectory exactly like a conversational turn would.
      auditTrajectory('situation', label, result);
    } catch (error) {
      record('situation', label, false, error instanceof Error ? error.message : String(error));
    }
  }
}

/* ------------------------------------------------------------------ *
 * Section 6 — live server endpoints (dev :3000)
 * ------------------------------------------------------------------ */

async function httpJson(path: string, init?: RequestInit): Promise<{ status: number; body: any }> {
  const res = await fetch(`${BASE}${path}`, init);
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

async function sectionServerEndpoints(): Promise<void> {
  console.log('\nSection 6 — server endpoints (:3000)');

  const simples: Array<[string, string]> = [
    ['/health', 'health'],
    ['/status', 'status'],
    ['/agents', 'agents'],
    ['/languages', 'languages'],
    ['/harbors', 'harbors'],
    ['/scenarios', 'scenarios'],
    ['/scenarios?capability=avoid-zones&language=ta-IN', 'scenarios ta filter'],
    ['/pfz?harbor=goa&limit=5', 'pfz goa'],
    ['/hotspots?harbor=goa', 'hotspots goa'],
    ['/weather?harbor=vizag', 'weather vizag'],
    ['/ocean?harbor=vizag&lat=15.5&lon=81.5', 'ocean offshore vizag'],
    ['/tides?harbor=kochi&horizon=TODAY', 'tides kochi today'],
    ['/tides?harbor=kochi&horizon=NEXT_3_DAYS', 'tides kochi 3d'],
    ['/alerts?harbor=mumbai', 'alerts mumbai'],
    ['/geofences?harbor=mumbai', 'geofences mumbai'],
    ['/route?from=goa&lat=14.9&lon=73.8&vessel=trawler', 'route goa trawler'],
    ['/route?from=chennai&to=puducherry&vessel=country_boat', 'route chennai→puducherry'],
    ['/historical?harbor=kochi', 'historical kochi'],
    ['/historical?region=Arabian Sea&months=12', 'historical region raw'],
    ['/situation?harbor=goa&language=en-IN', 'situation goa en'],
    ['/situation?harbor=goa&language=mr-IN', 'situation goa mr'],
    ['/situation?harbor=chennai&language=ta-IN', 'situation chennai ta'],
    ['/situation?harbor=veraval&language=gu-IN', 'situation veraval gu'],
  ];

  for (const [path, label] of simples) {
    try {
      const { status, body } = await httpJson(path);
      expect(
        status === 200 && body !== null && (body.status === 'success' || body.status === 'ok'),
        'server',
        label,
        `HTTP ${status}`,
      );
    } catch (error) {
      record('server', label, false, error instanceof Error ? error.message : String(error));
    }
  }

  // Situation anchoring via the HTTP path.
  try {
    const { body } = await httpJson('/situation?harbor=goa&language=en-IN');
    expect(
      String(body?.result?.answer ?? '').toLowerCase().includes('goa'),
      'server',
      'situation goa anchors to Goa',
      'answer does not mention Goa',
    );
    expect(Array.isArray(body?.result?.visualizations), 'server', 'situation goa has visualizations', 'missing');
  } catch (error) {
    record('server', 'situation goa anchors to Goa', false, error instanceof Error ? error.message : String(error));
  }

  /*
   * GPS anchoring over HTTP.
   *
   * This is the first prototype defect. `acquireGps` was a one-shot
   * `getCurrentPosition` whose result was displayed in the header badge and
   * never sent anywhere: the report was still built for whichever port happened
   * to be selected, so turning location on visibly did nothing except light a
   * green dot. Worse, the client *assumed* its own request had won, so there was
   * no way to tell a stale render from a broken feature.
   *
   * The engine now resolves a fix to the nearest port and reports the anchor it
   * actually used. These checks pin all four behaviours that made that
   * trustworthy: a fix is honoured, it outranks the selected port, a fix the
   * server cannot parse degrades to the selection instead of to a default port,
   * and the server agrees with the client about which port is nearest.
   */
  {
    // Two fixes at sea, each deliberately far enough from its nearest port that
    // a sign error in latitude or longitude would be visible in the distance.
    const FIXES: Array<{ name: string; lat: number; lon: number; wrongHarbor: string }> = [
      { name: 'digha coastal', lat: 21.43, lon: 87.08, wrongHarbor: 'kochi' },
      { name: 'chennai offshore', lat: 13.1, lon: 80.9, wrongHarbor: 'digha' },
    ];

    for (const fix of FIXES) {
      const label = `gps ${fix.name} anchors to nearest port`;

      // Resolved locally with the same function the server uses, so this asserts
      // agreement rather than restating a hardcoded expectation.
      const nearest = findNearestHarbor(fix.lat, fix.lon);

      try {
        const { body } = await httpJson(
          `/situation?lat=${fix.lat}&lon=${fix.lon}&harbor=${fix.wrongHarbor}&language=en-IN`,
        );
        const anchor = body?.anchor;

        expect(
          anchor?.source === 'gps',
          'gps',
          `${label} (reported as GPS)`,
          `source=${anchor?.source}`,
        );
        expect(
          anchor?.harborId === nearest.id,
          'gps',
          `${label} (client and engine agree)`,
          `engine=${anchor?.harborId} client=${nearest.id}`,
        );
        expect(
          typeof anchor?.distanceKm === 'number' &&
            Number.isFinite(anchor.distanceKm) &&
            anchor.distanceKm > 0,
          'gps',
          `${label} (distance is a real measurement)`,
          `distanceKm=${anchor?.distanceKm}`,
        );
        // The engine echoing the fix back is what lets the client tell the
        // difference between "my fix was ignored" and "my fix moved the anchor".
        expect(
          anchor?.latitude === fix.lat && anchor?.longitude === fix.lon,
          'gps',
          `${label} (engine echoes the fix)`,
          `got ${anchor?.latitude},${anchor?.longitude}`,
        );
        // And the report itself has to be about that port, not about the port
        // that was asked for.
        expect(
          String(body?.result?.answer ?? '')
            .toLowerCase()
            .includes(nearest.shortName.toLowerCase()),
          'gps',
          `${label} (answer describes that port)`,
          `answer does not mention ${nearest.shortName}`,
        );
      } catch (error) {
        record('gps', label, false, error instanceof Error ? error.message : String(error));
      }
    }

    // A fix the server cannot parse must fall back to the requested port. The
    // dangerous behaviour would be to fall back to HARBORS[0] and silently
    // change which port the user is being briefed about.
    try {
      const { body } = await httpJson('/situation?lat=not-a-number&lon=also-not&harbor=kochi&language=en-IN');
      expect(
        body?.anchor?.source === 'selection' && body?.anchor?.harborId === 'kochi',
        'gps',
        'gps unparseable fix falls back to the selected port',
        `anchor=${JSON.stringify(body?.anchor)}`,
      );
    } catch (error) {
      record('gps', 'gps unparseable fix falls back to the selected port', false, error instanceof Error ? error.message : String(error));
    }

    // No fix at all must report a selection anchor and no measured distance,
    // rather than a null masquerading as a measurement.
    try {
      const { body } = await httpJson('/situation?harbor=digha&language=en-IN');
      expect(
        body?.anchor?.source === 'selection' && body?.anchor?.distanceKm === null,
        'gps',
        'gps absent fix reports the selection with no distance',
        `anchor=${JSON.stringify(body?.anchor)}`,
      );
    } catch (error) {
      record('gps', 'gps absent fix reports the selection with no distance', false, error instanceof Error ? error.message : String(error));
    }
  }

  // Fleet Watch — coast-wide posture endpoint.
  try {
    const { status, body } = await httpJson('/fleet');
    const fleet = body?.data;
    expect(status === 200 && typeof fleet === 'object', 'server', 'fleet endpoint', `HTTP ${status}`);
    expect(Array.isArray(fleet?.harbours) && fleet.harbours.length === HARBORS.length, 'server', 'fleet covers every harbour', `got ${fleet?.harbours?.length}`);
    const sum = RISK_LEVELS.reduce((acc, level) => acc + (fleet?.counts?.[level] ?? 0), 0);
    expect(sum === HARBORS.length, 'server', 'fleet counts sum to harbour count', `sum ${sum}`);
    const rank = (level: string): number => RISK_LEVELS.indexOf(level);
    let sorted = true;
    for (let i = 1; i < (fleet?.harbours?.length ?? 0); i++) {
      if (rank(fleet.harbours[i - 1].riskLevel) < rank(fleet.harbours[i].riskLevel)) sorted = false;
    }
    expect(sorted, 'server', 'fleet sorted worst-first', 'risk not non-increasing');
    for (const snap of fleet?.harbours ?? []) {
      expect(
        HARBORS.some((h) => h.id === snap.harborId),
        'server',
        'fleet harbour ids valid',
        `unknown harbour ${snap.harborId}`,
      );
      expect(RISK_LEVELS.includes(snap.riskLevel), 'server', 'fleet risk vocabulary', `${snap.harborId} → ${snap.riskLevel}`);
      expect(
        Number.isFinite(snap.safetyScore) && snap.safetyScore >= 0 && snap.safetyScore <= 100,
        'server',
        'fleet safety bounds',
        `${snap.harborId} → ${snap.safetyScore}`,
      );
    }
    const trawler = await httpJson('/fleet?vessel=trawler');
    expect(
      trawler.body?.data?.vesselId === 'trawler',
      'server',
      'fleet vessel filter',
      `vesselId ${trawler.body?.data?.vesselId}`,
    );
  } catch (error) {
    record('server', 'fleet watch', false, error instanceof Error ? error.message : String(error));
  }

  // Geofence check: point near the Manora cable (not inside any MPA) and a
  // corridor that clips the Gulf of Mannar MPA buffer near Tuticorin.
  try {
    const point = await httpJson('/geofence/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: 18.92, longitude: 72.99, language: 'en-IN' }),
    });
    expect(point.status === 200 && Array.isArray(point.body?.data?.nearbyBoundaries), 'server', 'geofence point check', `HTTP ${point.status}`);
    const corridor = await httpJson('/geofence/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ track: [[8.75, 78.13], [8.6, 78.05], [8.3, 77.9]], language: 'en-IN' }),
    });
    expect(corridor.status === 200 && corridor.body?.data?.mode === 'corridor', 'server', 'geofence corridor check', `HTTP ${corridor.status}`);
  } catch (error) {
    record('server', 'geofence checks', false, error instanceof Error ? error.message : String(error));
  }

  // Full JSON chat round trips.
  const chatRoundTrips: Array<[string, Record<string, unknown>]> = [
    ['chat en goa', { message: 'Give me the full marine situation report', language: 'en-IN', harbor: 'goa' }],
    ['chat ml kochi', { message: 'കൊച്ചിയിലെ പൂർണ്ണ കടൽ സ്ഥിതി റിപ്പോർട്ട്', language: 'ml-IN', harbor: 'kochi' }],
    // Bare situation query — no harbour word in the message — must still anchor
    // on the harbour the client explicitly selected, never the default one.
    ['chat en digha bare', { message: 'Give me the full marine situation report', language: 'en-IN', harbor: 'digha' }],
  ];
  for (const [label, payload] of chatRoundTrips) {
    try {
      const { status, body } = await httpJson('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      expect(status === 200 && typeof body?.result?.answer === 'string', 'server', label, `HTTP ${status}`);
      const reasoningText = String(body?.result?.plan?.reasoning ?? body?.result?.answer ?? '');
      const anchor = reasoningText.match(/anchored on\s+([^\s(]+)/i);
      const expName = typeof payload.harbor === 'string' ? payload.harbor.toLowerCase() : null;
      expect(
        !anchor || !expName || anchor[1].toLowerCase() === expName,
        'server',
        label,
        `reasoning anchors on "${anchor?.[1]}", expected ${expName}`,
      );
      // Go/no-go and situation turns must ship the departure-window series.
      if (payload.harbor === 'goa' && String(payload.message).toLowerCase().includes('situation')) {
        expect(
          Array.isArray(body?.result?.riskTrajectory?.points) &&
            body.result.riskTrajectory.points.length >= 3,
          'server',
          label,
          'riskTrajectory missing from chat result',
        );
      }
    } catch (error) {
      record('server', label, false, error instanceof Error ? error.message : String(error));
    }
  }

  // Map bundle for every harbour — the layers the map screen renders.
  for (const harbor of HARBORS) {
    const label = `map-data :: ${harbor.id}`;
    try {
      const { status, body } = await httpJson(`/map-data?harbor=${harbor.id}&language=en-IN`);
      const bundled = body?.data ?? body;
      expect(status === 200, 'server', label, `HTTP ${status}`);
      expect(Array.isArray(bundled?.fishingZones) && bundled.fishingZones.length > 0, 'server', label, 'fishingZones empty');
      expect(Array.isArray(bundled?.geofences) && bundled.geofences.length > 0, 'server', label, 'geofences empty');
      expect(Array.isArray(bundled?.visualizations) && bundled.visualizations.length > 0, 'server', label, 'visualizations empty');
      for (const viz of bundled?.visualizations ?? []) {
        const violation = vizInvariantViolation(viz);
        if (violation) record('server', label, false, violation);
      }
    } catch (error) {
      record('server', label, false, error instanceof Error ? error.message : String(error));
    }
  }
}

/* ------------------------------------------------------------------ *
 * Section 7 — SSE chat stream (must always terminate with a done frame)
 * ------------------------------------------------------------------ */

async function sseStatus(
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; done: boolean; answer: string; text: string }> {
  try {
    const res = await fetch(`${BASE}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    const done = text.includes('"type":"done"');
    const lastDone = text
      .split('\n')
      .filter((l) => l.startsWith('data: '))
      .map((l) => {
        try {
          return JSON.parse(l.slice(6));
        } catch {
          return null;
        }
      })
      .find((e) => e?.type === 'done');
    return {
      ok: res.ok,
      done,
      answer: lastDone?.result?.answer ?? '',
      text,
    };
  } catch (error) {
    return { ok: false, done: false, answer: '', text: error instanceof Error ? error.message : String(error) };
  }
}

async function sectionSse(): Promise<void> {
  console.log('\nSection 7 — SSE /chat/stream');
  const runs: Array<[string, Record<string, unknown>, boolean]> = [
    ['sse en goa situation', { message: 'Give me the full marine situation report', language: 'en-IN', harbor: 'goa' }, true],
    ['sse mr vizag alerts', { message: 'क्या विजाग में गरज या तूफान है?', language: 'mr-IN', harbor: 'vizag' }, false],
    ['sse ta kochi route', { message: 'மீன் பிடிக்கும் இடத்திற்கு என் படகிற்கு பாதுகாப்பான பாதை எது?', language: 'ta-IN', harbor: 'kochi' }, false],
    ['sse bn chennai avoid', { message: 'মাছ ধরার সময় কোন এলাকা এড়িয়ে চলা উচিত?', language: 'bn-IN', harbor: 'chennai' }, false],
  ];
  for (const [label, payload, anchors] of runs) {
    try {
      const { ok, done, answer, text } = await sseStatus(payload);
      expect(ok, 'sse', label, `HTTP not ok`);
      expect(done, 'sse', label, 'stream never sent the done frame (client would fall back to OFFLINE ENGINE)');
      expect(answer.trim().length > 0, 'sse', label, 'done frame carried an empty answer');
      if (anchors) {
        expect(answer.toLowerCase().includes('goa'), 'sse', label, 'answer does not mention Goa');
      }
      if (!done || !ok) {
        console.error(`         ${text.slice(0, 300)}`);
      }
    } catch (error) {
      record('sse', label, false, error instanceof Error ? error.message : String(error));
    }
  }
}

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */

async function main(): Promise<void> {
  console.log(`ORCA sweep — ${HARBORS.length} harbours, ${ALL_INTENTS.length} intents, ${new Set(allScenarioQuestions().map((r) => r.language)).size} languages, ${VESSEL_PROFILES.length} vessels, ${PERSONAS.length} personas`);
  console.log(`Engine harbour count: ${HARBORS.length}; geofence gazetteer imported from dataset.`);

  await sectionHarbours();
  await sectionLanguages();
  await sectionPersonas();
  await sectionVessels();
  await sectionSituationAnchoring();
  await sectionServerEndpoints();
  await sectionSse();

  const failed = checks.filter((c) => !c.ok);
  const byGroup = new Map<string, number>();
  for (const c of failed) byGroup.set(c.group, (byGroup.get(c.group) ?? 0) + 1);

  console.log('\n──────────────────────────────────────────────');
  console.log(`Summary: ${checks.length - failed.length}/${checks.length} checks passed in ${((Date.now() - startedAt) / 1000).toFixed(0)}s`);
  if (failed.length > 0) {
    console.log('Failures by group:');
    for (const [group, count] of byGroup) console.log(`  ${group}: ${count}`);
    // Show the first 30 failing labels.
    console.log('Sample failures:');
    for (const c of failed.slice(0, 30)) console.log(`  [${c.group}] ${c.label}: ${c.detail}`);
  }
  process.exit(failed.length > 0 ? 1 : 0);
}

void main();