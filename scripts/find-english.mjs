#!/usr/bin/env node
/**
 * English-leakage scanner for the ORCA client UI.
 *
 * The regression sweep proves the *engine* localises correctly: it runs eight
 * capabilities through all eleven languages and asserts the answer comes back
 * in the right script. What it cannot see is the React chrome around that
 * answer. A literal English span renders identically in every language and
 * still passes 3306 checks, which is exactly how this class of bug survives.
 *
 * So this walks the source and pulls out anything that looks like literal
 * English prose: JSX text nodes, string literals in user-visible attributes
 * (title, label, aria-label, placeholder, alt), and English defaults in
 * ternaries of the shape `book ? book.ui.x : "English"`.
 *
 * Regexes are built with `new RegExp` from string literals rather than regex
 * literals on purpose. A literal like />([^<>{}]+)</g is ambiguous to read next
 * to JSX and is easy to corrupt when a character class contains a brace; the
 * string form has no such hazard.
 *
 * Run: node scripts/find-english.mjs
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const SRC = new URL('../src/', import.meta.url).pathname;

/** Attributes whose values reach the user. */
const VISIBLE_ATTRS = ['title', 'label', 'aria-label', 'placeholder', 'alt'];

/** JSX text node: greater-than, prose, less-than. */
const RE_JSX_TEXT = new RegExp('>([^<>{}]+)<', 'g');

/** Two or more ordinary words, first one capitalised — that is prose. */
const RE_PROSE_WORDS = new RegExp('^[A-Za-z][A-Za-z\'-]*$');
const RE_LETTERS = new RegExp('[A-Za-z]{3}');
const RE_CAP = new RegExp('[A-Z]');

/** `book ? book.ui.x : 'English fallback'` — the English default. */
const RE_FALLBACK = new RegExp(":\\s*'([^']{3,})'", 'g');

/**
 * A ternary, as opposed to a question mark sitting inside the string itself.
 * `{ q: 'Where is the nearest fishing zone from here?' }` is a canonical query
 * *sent to the engine*, not chrome the user reads — intent detection is
 * language-neutral by design, and the visible chip label is translated
 * separately. Counting it as a leak buried the real findings under ~30 false
 * positives, so the scanner now requires a `?` that is not inside a literal.
 */
const RE_TERNARY_QUESTION = new RegExp('\\?[^' + "'" + '"]');

/** `KEY: 'English label'` inside a label map. */
const RE_LABEL_ENTRY = new RegExp(":\\s*'([^']{3,})'", 'g');

function looksLikeEnglish(s) {
  const t = String(s).trim();
  if (t.length < 3) return false;
  if (!RE_LETTERS.test(t)) return false;
  // Prose has spaces. CamelCase identifiers and snake_case keys do not, and
  // they are never rendered to a user in the first place.
  if (t.indexOf(' ') === -1) return false;
  const words = t.split(/\s+/).filter((w) => RE_PROSE_WORDS.test(w));
  if (words.length < 2) return false;
  return RE_CAP.test(words[0]);
}

function clean(raw) {
  return String(raw)
    .replace(/^\{|\}$/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (['.tsx', '.ts'].includes(extname(p))) out.push(p);
  }
  return out;
}

/**
 * The provenance and identifier boundary.
 *
 * These are the strings the scanner is *expected* to find, because they are not
 * UI copy. Each entry is an exact match on the cleaned text plus the reason it
 * stays English; adding to this list is a claim that has to be justified, and
 * the unit tests assert that every entry still occurs in the source, so a
 * deleted or reworded string cannot quietly keep its exemption.
 *
 * The rule behind the whole list: a translation is not allowed to rename an
 * identifier or paraphrase somebody else's published words. So product and event
 * names, the organiser's problem ID, the submitting institution, the names of
 * published bulletins, and the provenance fields of the evidence ledger stay
 * verbatim. Everything ORCA itself wrote — every label, heading, sentence and
 * button — is translated into all eleven languages.
 */
const ALLOWED = new Map([
  // The product, the event, and the organiser's own identifier. A judge matches
  // these against the submission form; translating them makes that harder.
  ['ORCA — SIH 2026, Problem ID 26176', 'product name + event + organiser problem ID'],
  ['ORCA Marine Intelligence · SIH 2026 Problem 26176 · ISRO / Dept. of Space', 'footer attribution'],
  ['SIH 2026 • Problem ID: 26176', 'event name + organiser problem ID'],

  // The submitting institution and the submission's own technology bucket, as
  // recorded on the form.
  ['ISRO / Department of Space · Software · Space Technology', 'institution + technology bucket'],

  // The published name of an external bulletin, and ORCA's own snapshot
  // labels, which are the provenance field of an evidence row.
  ['IMD Marine Weather Warning bulletin', 'published IMD bulletin name (provenance)'],
  ['ORCA snapshot', 'evidence provenance field'],
]);

const findings = [];
const files = walk(SRC, []);

for (const file of files) {
  const rel = relative(SRC, file);
  const lines = readFileSync(file, 'utf8').split('\n');

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    const isComment = trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
    if (!trimmed || isComment) return;

    const push = (kind, text) => {
      const t = clean(text);
      if (ALLOWED.has(t)) return;
      if (looksLikeEnglish(t)) findings.push({ file: rel, line: idx + 1, kind, text: t });
    };

    for (const m of line.matchAll(RE_JSX_TEXT)) push('jsx-text', m[1]);

    for (const attr of VISIBLE_ATTRS) {
      const re = new RegExp(attr + '="([^"]+)"', 'g');
      for (const m of line.matchAll(re)) push(attr, m[1]);
    }

    if (RE_TERNARY_QUESTION.test(line)) {
      for (const m of line.matchAll(RE_FALLBACK)) push('fallback', m[1]);
    }

    if (RE_LABEL_ENTRY.test(line) && /[A-Z_]{4,}\s*:/.test(line)) {
      for (const m of line.matchAll(RE_LABEL_ENTRY)) push('label-map', m[1]);
    }
  });
}

const byFile = new Map();
for (const f of findings) {
  if (!byFile.has(f.file)) byFile.set(f.file, []);
  byFile.get(f.file).push(f);
}

console.log('\nEnglish-leakage scan — ' + findings.length + ' candidate(s)');
console.log('  (the provenance/identifier allowlist holds ' + ALLOWED.size + ' documented exemption(s))\n');

const sorted = Array.from(byFile.entries()).sort((a, b) => b[1].length - a[1].length);
for (const entry of sorted) {
  const pair = entry;
  const file = pair[0];
  const list = pair[1];
  console.log('  ' + String(list.length).padStart(3) + '  ' + file);
  for (const f of list) {
    const t = f.text.length > 60 ? f.text.slice(0, 57) + '...' : f.text;
    console.log('        ' + String(f.line).padStart(4) + '  [' + f.kind + '] ' + t);
  }
  console.log('');
}

if (findings.length === 0) console.log('  none found\n');
