import { CHROME_TRANSLATIONS } from './chrome-additions.mjs';
const SCRIPTS = /[\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F]/u;
const langs = Object.keys(CHROME_TRANSLATIONS);
const base = Object.keys(CHROME_TRANSLATIONS['en-IN']);
console.log(`languages: ${langs.length}   keys per language: ${base.length}`);
let bad = 0;
const ph = (s) => [...String(s).matchAll(/\{[a-zA-Z]+\}/g)].map((m) => m[0]).sort().join();
for (const l of langs) {
  const d = CHROME_TRANSLATIONS[l];
  const k = Object.keys(d);
  const missing = base.filter((x) => !k.includes(x));
  const extra = k.filter((x) => !base.includes(x));
  const blank = k.filter((x) => !String(d[x] ?? '').trim());
  const phBad = k.filter((x) => ph(d[x]) !== ph(CHROME_TRANSLATIONS['en-IN'][x]));
  const noScript = l === 'en-IN' ? [] : k.filter((x) => !SCRIPTS.test(d[x]));
  if (missing.length || extra.length || blank.length || phBad.length || noScript.length) {
    bad++;
    console.log(` ${l}: missing=[${missing}] extra=[${extra}] blank=[${blank}] placeholder=[${phBad}] no-native-script=[${noScript}]`);
    for (const x of phBad) console.log(`    en: ${CHROME_TRANSLATIONS['en-IN'][x]}\n    ${l}: ${d[x]}`);
  }
}
console.log(bad === 0 ? 'PARITY OK' : `${bad} language(s) need attention`);
process.exit(bad === 0 ? 0 : 1);
