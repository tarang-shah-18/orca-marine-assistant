#!/usr/bin/env node
/**
 * Residual-English detector.
 *
 * The existing sweep checks that an answer *contains* the requested script.
 * That is the wrong test for the bug it was written to prevent: a Tamil answer
 * that is 95% Tamil and 5% English sails through, because a single Tamil
 * character is enough to satisfy `pattern.test(answer)`.
 *
 * This measures the opposite: how much of the answer is Latin-script prose
 * that is not a permitted token (product names, units, severity codes, proper
 * nouns). It exists to quantify the leak, and later to hold the line as the
 * remaining English is removed.
 *
 * Run: node scripts/english-residue.mjs            (report)
 *      node scripts/english-residue.mjs --strict   (non-zero exit on any leak)
 */

const BASE = process.env.BASE ?? 'http://localhost:3000/api';

/** Tokens that are legitimately Latin in every language: data, not chrome. */
const ALLOWED = new Set([
  // product / source tokens — attribution requirements, must stay verbatim
  'open-meteo', 'ecmwf', 'ifs', 'wavewatch-iii', 'modis', 'aqua', 'viirs',
  'gdacs', 'era5', 'insat-3d', 'imd', 'incois', 'orca', 'noaa', 'nasa', 'un',
  'ec', 'gfs', 'icon', 'hrrr', 'ww3',
  // units and measures
  'km', 'm', 'kt', 'kts', 'nm', 'ms', 'c', '°c', '°', '%', 'h', 'hr', 'hrs',
  'min', 's', 'kg', 'n', 'kn',
  // severity / quality / trend codes — safety vocabulary, deliberately untranslated
  'low', 'moderate', 'high', 'severe', 'good', 'fair', 'poor',
  'increasing', 'decreasing', 'stable', 'flat', 'up', 'down',
  // identifiers and URLs
  'api', 'http', 'https', 'com', 'in', 'app', 'web',
]);

/** Common English function words. A cluster of these in one answer is prose. */
const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'and',
  'or', 'but', 'if', 'then', 'than', 'that', 'this', 'these', 'those', 'it',
  'its', 'as', 'at', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'to',
  'with', 'without', 'within', 'no', 'not', 'any', 'all', 'some', 'there',
  'here', 'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would', 'can',
  'could', 'should', 'may', 'might', 'must', 'you', 'your', 'we', 'our',
]);

/**
 * Script ranges that are NOT Latin. If a language's answer is full of these, it
 * is genuinely translated and any Latin run is a leak worth reporting.
 */
const SCRIPT_RANGES = {
  Devanagari: /[ऀ-ॿ]/,
  Bengali: /[ঀ-৿]/,
  Gujarati: /[઀-૿]/,
  Kannada: /[ಀ-೿]/,
  Malayalam: /[ഀ-ൿ]/,
  Odia: /[଀-ି]/,
  Tamil: /[஀-௿]/,
  Telugu: /[ఀ-౿]/,
  Gurmukhi: /[਀-੿]/,
};

const LANGS = {
  'hi-IN': 'Devanagari',
  'mr-IN': 'Devanagari',
  'bn-IN': 'Bengali',
  'gu-IN': 'Gujarati',
  'kn-IN': 'Kannada',
  'ml-IN': 'Malayalam',
  'or-IN': 'Odia',
  'ta-IN': 'Tamil',
  'te-IN': 'Telugu',
  'pa-IN': 'Gurmukhi',
};

const QUESTIONS = [
  { text: 'Where is the nearest fishing zone from here?', harborId: 'mumbai' },
  { text: 'Is it safe to go fishing tomorrow morning?', harborId: 'kochi' },
  { text: 'What are the tide, weather and sea conditions near the fishing zone?', harborId: 'chennai' },
  { text: 'Is there any lightning or cyclone warning for my coast?', harborId: 'goa' },
  { text: 'Where is chlorophyll high and sea surface temperature favourable?', harborId: 'kochi' },
  { text: 'What is the safest route for my country boat to reach the fishing zone?', harborId: 'vizag' },
  { text: 'Why has fish productivity declined in my harbour?', harborId: 'digha' },
  { text: 'Which zones should I avoid while fishing, and are there any active alerts?', harborId: 'veraval' },
];

/** Latin runs of two or more letters, which is where prose lives. */
function latinRuns(text) {
  return text.match(/[A-Za-z][A-Za-z'-]*/g) ?? [];
}

/**
 * Quoted bulletin fragments are legitimately English and are deliberately left
 * verbatim: an IMD or GDACS advisory quoted in the fisher's own words would be
 * a mis-transcription of an official warning.
 *
 * The reference advisories in core/dataset.ts are not guillemet-quoted,
 * because the sentence around them is ORCA's own. They are recognised instead
 * by asking the engine for its own advisory text and masking whatever comes
 * back. That keeps this script honest: it measures ORCA's prose, and treats
 * official bulletin wording as data. See the block comment above the reference
 * advisory set in core/dataset.ts for why that text is never translated.
 */
// Every harbour the audit exercises, so the geofence masker sees every zone a
// question can surface rather than only the default harbour's neighbourhood.
const HARBOUR_IDS = [...new Set(QUESTIONS.map((q) => q.harborId))];

let bulletinText = "";
let geofenceText = "";

async function loadBulletinText() {
  if (bulletinText) return bulletinText;
  try {
    const res = await fetch(BASE + "/alerts?language=en-IN");
    const body = await res.json();
    const all = (body && body.data && body.data.all) || [];
    const parts = [];
    for (const a of all) {
      if (a && a.params) continue;
      parts.push(a.title, a.description, a.action);
    }
    bulletinText = parts.filter(Boolean).join(" \n ");
  } catch {
    bulletinText = "";
  }
  return bulletinText;
}

/**
 * Geofence access notes are the second verbatim-authority surface.
 *
 * A geofence note restates a published access restriction — a naval exercise
 * area, a Ramsar no-take core zone — so translating it would issue a different
 * instruction rather than the same one in another language. See the block
 * comment above `GEOFENCES` in `core/dataset.ts`.
 *
 * Pulled from the live API rather than re-declared here, so this script cannot
 * drift out of sync with the dataset the way a hardcoded list would.
 */
async function loadGeofenceText() {
  if (geofenceText) return geofenceText;
  try {
    const parts = [];
    // The endpoint scopes zones to a harbour, so a single request would only mask
    // the zones near whichever harbour it defaulted to and a distant naval exercise
    // area would then be counted as an ORCA leak. Ask for every harbour the audit
    // exercises instead.
    for (const harbour of HARBOUR_IDS) {
      const res = await fetch(`${BASE}/geofences?language=en-IN&harbor=${harbour}`);
      const body = await res.json();
      const data = (body && body.data) || {};
      const zones = Array.isArray(data.zones) ? data.zones : Object.values(data.zones || {});
      for (const z of [...zones, ...(data.catalogue || [])]) {
        if (!z) continue;
        // `regulation` is the field that actually reaches the answer, not
        // `description`, and `authority` is quoted as the source of the restriction.
        parts.push(z.name, z.note, z.description, z.regulation, z.authority);
      }
    }
    geofenceText = [...new Set(parts.filter(Boolean))].join(" \n ");
  } catch {
    geofenceText = "";
  }
  return geofenceText;
}

/** Remove every verbatim advisory and access-restriction sentence before measuring. */
function stripBulletins(text) {
  let out = text;
  for (const corpus of [bulletinText, geofenceText]) {
    if (!corpus) continue;
    for (const raw of corpus.split(" \n ")) {
      const t = raw.trim();
      if (t.length < 12) continue;
      // Replace the whole phrase, longest-first, so a short advisory that is a
      // prefix of a longer one cannot leave a half-word behind.
      out = out.split(t).join(" ");
      const mid = t.slice(0, Math.min(40, t.length));
      if (mid !== t) out = out.split(mid).join(" ");
    }
  }
  return out;
}

function stripQuotedBulletin(text) {
  return text
    .replace(/\u00ab[^\u00bb]*\u00bb/gs, " ")
    .replace(/\u201c[^\u201d]*\u201d/gs, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function analyse(text) {
  const body = stripBulletins(stripQuotedBulletin(text));
  const foreign = Object.values(SCRIPT_RANGES).some((re) => re.test(body));
  const offenders = [];
  for (const raw of latinRuns(body)) {
    const w = raw.toLowerCase().replace(/^[-]|[-]$/g, "");
    if (w.length < 2) continue;
    if (ALLOWED.has(w)) continue;
    if (raw === raw[0].toUpperCase() + raw.slice(1)) continue;
    offenders.push(raw);
  }
  const stopHits = offenders.filter((w) => STOPWORDS.has(w.toLowerCase()));
  return { foreign, offenders, stopHits, isProse: stopHits.length >= 3, body };
}

async function ask(lang, q) {
  // The engine rate-limits to protect its shared upstream budget, so a 429 here
  // means "ask again shortly", not "this language is clean". Treating it as a
  // pass previously produced a false clean: the run printed 0 leaks for eight
  // languages it never actually received an answer for.
  let res = await post(lang, q);
  for (let attempt = 1; attempt <= 6 && res.status === 429; attempt += 1) {
    const waitMs = Math.min(30_000, 3_000 * 2 ** (attempt - 1));
    process.stdout.write(`  ${lang}  429 from engine, retrying in ${Math.round(waitMs / 1000)}s (attempt ${attempt}/6)\n`);
    await new Promise((r) => setTimeout(r, waitMs));
    res = await post(lang, q);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  // The chat envelope is flat: { status, language, result, ... } where `result`
  // holds the OrchestrationResult. An earlier revision of this script read
  // `body.data` and silently measured empty strings, reporting a false clean.
  return body.result ?? body.data ?? body;
}

function post(lang, q) {
  return fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: q.text, language: lang, harbor: q.harborId }),
  });
}

let totalProse = 0;
let totalOffenders = 0;
const detail = [];

console.log('\nResidual-English audit — answers served in a non-English language\n');

const bulletins = await loadBulletinText();
const geofences = await loadGeofenceText();
console.log(
  `  masking ${bulletins ? 'verbatim reference bulletins (official IMD/INCOIS/GDACS wording, never translated)' : 'no bulletins (engine unreachable)'}\n` +
    `  masking ${geofences ? 'verbatim geofence access notes (published restrictions, never translated)' : 'no geofence notes (engine unreachable)'}\n`,
);

const failed = new Set();

for (const [lang, script] of Object.entries(LANGS)) {
  let langProse = 0;
  let langOffenders = 0;
  const shown = [];

  for (const q of QUESTIONS) {
    let answer = '';
    try {
      const data = await ask(lang, q);
      answer = String(data.answer ?? '');
    } catch (err) {
      console.log(`  ${lang}  ENGINE ERROR: ${err.message}`);
      failed.add(lang);
      break;
    }
    if (!answer.trim()) continue;
    const a = analyse(answer);
    if (!a.foreign) continue; // not actually translated, skip
    if (a.offenders.length) {
      langOffenders += a.offenders.length;
      shown.push({ q: q.text, offenders: a.offenders, isProse: a.isProse });
    }
    if (a.isProse) langProse += 1;
  }

  totalProse += langProse;
  totalOffenders += langOffenders;
  const flag = langProse > 0 ? 'LEAK' : failed.has(lang) ? 'SKIP' : ' ok ';
  console.log(`  [${flag}] ${lang.padEnd(6)} ${langProse} answer(s) with English prose · ${langOffenders} stray Latin token(s)`);
  for (const s of shown.filter((x) => x.isProse).slice(0, 2)) {
    const uniq = Array.from(new Set(s.offenders)).slice(0, 10).join(', ');
    console.log(`           "${s.q.slice(0, 44)}..." -> ${uniq}`);
  }
}

  console.log(`\n  total: ${totalProse} answer(s) containing English prose, ${totalOffenders} stray Latin tokens\n`);

  if (failed.size > 0) {
  console.log(
    `  WARNING: ${failed.size} language(s) never returned an answer (${[...failed].join(', ')}).\n` +
      '  Their "0 leaks" is an absence of data, not a pass — re-run before trusting this report.\n',
  );
  }

  // A run that could not reach the engine for every language cannot certify the
  // result, so --strict fails on missing data as well as on real leakage.
  if (process.argv.includes('--strict') && (totalProse > 0 || failed.size > 0)) {
  console.log(
    totalProse > 0
      ? '  STRICT: residual English detected\n'
      : '  STRICT: incomplete coverage — some languages were never measured\n',
  );
  process.exit(1);
  }
