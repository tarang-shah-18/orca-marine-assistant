/**
 * Idempotent inserter for the per-language vessel profile names.
 *
 * The vessel `label` in `dataset.ts` is ORCA's own copy, not quoted authority
 * text, so unlike a bulletin it is fair game for translation: it appears in the
 * vessel-fit line of the weather/ocean/PFZ findings and inside the route verdict,
 * all of which a fisher acts on. A `Country boat / surf canoe (≤ 6 m,
 * non-mechanised)` leaking into a Tamil answer told a Tamil reader nothing about
 * their own boat.
 *
 * `VESSEL_ADDITIONS` in `vessel-additions.mjs` is the source of truth. This
 * script writes one `vesselProfiles` record per phrasebook, keyed by vessel id, so
 * adding a profile means editing one file.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { VESSEL_ADDITIONS } from './vessel-additions.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TARGET = path.join(HERE, '..', 'src', 'core', 'i18n.ts');

const LANGS = Object.keys(VESSEL_ADDITIONS);
const IDS = Object.keys(VESSEL_ADDITIONS['en-IN']);

const LOCALE_RE = /^ {4}locale: '([a-z]{2}-IN)',$/;
const TREND_RE = /^ {4}trendWords: \[/;

function renderBlock(lang) {
  const pack = VESSEL_ADDITIONS[lang];
  const body = IDS.map((id) => {
    const { label, note } = pack[id];
    return `      ${id}: { label: ${JSON.stringify(label)}, note: ${JSON.stringify(note)} },`;
  }).join('\n');
  return [`    vesselProfiles: {`, body, `    },`];
}

const source = fs.readFileSync(TARGET, 'utf8');

if (!source.includes('    vesselProfiles: Record<string, { label: string; note: string }>;')) {
  throw new Error(
    'interface anchor missing: the `vesselProfiles` declaration must be on Phrasebook',
  );
}

// Strip blocks written by a previous run so re-running is safe.
const stripped = source.replace(/\n {4}vesselProfiles: \{\n[\s\S]*?\n {4}\},/g, '');

const out = [];
let currentLang = null;
let written = 0;

for (const line of stripped.split('\n')) {
  const locale = LOCALE_RE.exec(line);
  if (locale) currentLang = LANGS.includes(locale[1]) ? locale[1] : null;

  out.push(line);

  // `trendWords` sits at the same indent in every phrasebook and appears exactly
  // once per language, so it is a stable anchor.
  if (currentLang && TREND_RE.test(line)) {
    out.push(...renderBlock(currentLang));
    written += 1;
  }
}

if (written !== LANGS.length) {
  throw new Error(`expected ${LANGS.length} language blocks, wrote ${written}`);
}

fs.writeFileSync(TARGET, out.join('\n'));
console.log(`  inserted ${written} vessel-name block(s)`);
