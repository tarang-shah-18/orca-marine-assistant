#!/usr/bin/env node
/**
 * Insert the agent-prose keys into all eleven phrasebooks in i18n.ts.
 *
 * Each language block's keys are placed immediately after its existing
 * `disasterQuestionsWord` line, a stable anchor present in every block and
 * adjacent to the other disaster-console strings these belong with.
 *
 * Idempotent by replacement, not by skip: a prior run's keys are stripped back
 * out and the current pack is written fresh. That is what lets a key be added
 * to `i18n-additions.mjs` and land in blocks that were expanded by an earlier
 * run — a skip-if-present guard silently drops the new key instead.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { TRANSLATIONS } from './i18n-additions.mjs';

const FILE = new URL('../src/core/i18n.ts', import.meta.url).pathname;
const ANCHOR = 'disasterQuestionsWord:';

/** Every key this script owns, in any language. */
const OWNED = new Set(Object.values(TRANSLATIONS).flatMap((pack) => Object.keys(pack)));

function quote(value) {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/** `      someKey: '...',` -> `someKey`, or null if the line is not one of ours. */
function ownedKey(line) {
  const match = line.match(/^ {6}([A-Za-z0-9_]+): /);
  return match && OWNED.has(match[1]) ? match[1] : null;
}

let src = readFileSync(FILE, 'utf8');
const lines = src.split('\n');
const out = [];
let lang = null;
let expanded = 0;

for (let i = 0; i < lines.length; i += 1) {
  const line = lines[i];

  // Track which phrasebook block we are inside.
  const blockStart = line.match(/^ {2}'([a-z]{2}-[A-Z]{2})':\s*\{\s*$/);
  if (blockStart) lang = blockStart[1];

  out.push(line);
  if (!lang || !line.includes(ANCHOR)) continue;

  const pack = TRANSLATIONS[lang];
  if (!pack) {
    console.error(`  ERROR: no translations for ${lang}`);
    process.exit(1);
  }

  // Strip a prior run's block: contiguous owned keys, stopping at the first
  // line that is not one of ours (block comments and multi-line values are
  // never owned, so they terminate the run safely).
  let stripped = 0;
  let next = i + 1;
  while (ownedKey(lines[next]) !== null) {
    next += 1;
    stripped += 1;
  }

  for (const [key, value] of Object.entries(pack)) {
    out.push(`      ${key}: ${quote(value)},`);
  }
  i = next - 1;
  expanded += 1;
  if (stripped) {
    process.stdout.write(`  ${lang}: replaced ${stripped}\n`);
  }
}

if (expanded !== Object.keys(TRANSLATIONS).length) {
  console.error(`  ERROR: expanded ${expanded}, expected ${Object.keys(TRANSLATIONS).length} — layout changed.`);
  process.exit(1);
}

writeFileSync(FILE, out.join('\n'));
console.log(`  expanded ${expanded} phrasebook(s) with ${OWNED.size} keys each`);
