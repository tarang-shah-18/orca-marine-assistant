/**
 * Automatic language identification.
 *
 * The problem statement requires ORCA to detect the language of the incoming
 * query and reply in the same language. Two signals are combined:
 *
 *  1. Unicode script detection (decisive whenever the user types in a native
 *     script, which is the common case for voice input in the field).
 *  2. Romanised-token scoring, because a large share of Indian coastal users
 *     type in Latin script even when speaking a regional language.
 */

import { LanguageCode, LANGUAGE_BY_CODE, ScriptCode, SUPPORTED_LANGUAGES } from '../types';

const SCRIPT_RANGES: Record<ScriptCode, [number, number][]> = {
  devanagari: [[0x0900, 0x097f]],
  bengali: [[0x0980, 0x09ff]],
  gurmukhi: [[0x0a00, 0x0a7f]],
  gujarati: [[0x0a80, 0x0aff]],
  oriya: [[0x0b00, 0x0b7f]],
  tamil: [[0x0b80, 0x0bff]],
  telugu: [[0x0c00, 0x0c7f]],
  kannada: [[0x0c80, 0x0cff]],
  malayalam: [[0x0d00, 0x0d7f]],
  latin: [
    [0x0041, 0x005a],
    [0x0061, 0x007a],
    [0x00c0, 0x024f],
  ],
};

const SCRIPT_TO_LANGUAGE: Record<Exclude<ScriptCode, 'latin'>, LanguageCode> = {
  devanagari: 'hi-IN',
  bengali: 'bn-IN',
  gurmukhi: 'pa-IN',
  gujarati: 'gu-IN',
  oriya: 'or-IN',
  tamil: 'ta-IN',
  telugu: 'te-IN',
  kannada: 'kn-IN',
  malayalam: 'ml-IN',
};

export interface ScriptProfile {
  script: ScriptCode;
  counts: Record<ScriptCode, number>;
  dominant: ScriptCode;
  totalLetters: number;
}

/** Count letters per script and identify the dominant one. */
export function analyseScript(text: string): ScriptProfile {
  const counts = Object.keys(SCRIPT_RANGES).reduce((acc, key) => {
    acc[key as ScriptCode] = 0;
    return acc;
  }, {} as Record<ScriptCode, number>);

  let totalLetters = 0;

  for (const char of text) {
    const code = char.codePointAt(0);
    if (code === undefined) continue;
    if (code < 0x0080) {
      // ASCII digits and punctuation carry no linguistic signal — but ASCII
      // letters do (they are "latin" and must be counted, otherwise an English
      // question reports totalLetters=0 and "dominant" resolves to whatever
      // script happens to be first in the table).
      if (!/[A-Za-z]/.test(char)) continue;
    }

    for (const [script, ranges] of Object.entries(SCRIPT_RANGES)) {
      if (ranges.some(([lo, hi]) => code >= lo && code <= hi)) {
        counts[script as ScriptCode] += 1;
        totalLetters += 1;
        break;
      }
    }
  }

  const dominant =
    totalLetters === 0
      ? ('latin' as ScriptCode)
      : (Object.keys(counts) as ScriptCode[]).reduce((best, script) =>
          counts[script] > counts[best] ? script : best,
        ) as ScriptCode;

  return { script: dominant, counts, dominant, totalLetters };
}

/**
 * Romanised keyword fingerprints. Deliberately built from *discriminative*
 * tokens only — words that are unlikely in the neighbouring language — so that
 * "majhi" pulls towards Marathi and "aapko" towards Hindi.
 */
const ROMANISED_MARKERS: Record<LanguageCode, string[]> = {
  'en-IN': [],
  'hi-IN': [
    'hai', 'hain', 'kya', 'kyun', 'kyu', 'mera', 'meri', 'aapka', 'aapko', 'apna',
    'batao', 'bata', 'kahan', 'dhoka', 'machli', 'kripya', 'shukriya', 'kitna',
    'kitni', 'sahi', 'galat', 'chalo', 'jaldi', 'abhi', 'waqt', 'kaisa', 'kaisi',
  ],
  'mr-IN': [
    'aahe', 'aahen', 'aahet', 'kasa', 'majhi', 'majhya', 'tula', 'tumcha', 'sanga',
    'aamhi', 'tumhi', 'masa', 'purna', 'vyast', 'zale', 'thev', 'kashi', 'ghe',
    'sagarl', 'khushi', 'haan', 'nahi', 'kiti', 'kuthun', 'sadhya', 'chandgi',
  ],
  'gu-IN': [
    'chho', 'chhe', 'shu', 'tamaru', 'mash', 'samudra', 'kya', 'prayogo', 'hava',
    'vali', 'divas', 'rahe', 'karu', 'aavu', 'distant', 'nadi', 'majh', 'fer',
  ],
  'kn-IN': [
    'meenu', 'meenu', 'seeni', 'samudra', 'yalli', 'haanu', 'yaava', 'idare',
    'naanu', 'neenu', 'kasada', 'ekka', 'sabah', 'illa', 'bekagiddare', 'yaava',
  ],
  'ml-IN': [
    'meen', 'chempu', 'samudram', 'kadal', 'vayal', 'yude', 'njan', 'ee', 'illa',
    'aakramanam', 'valiya', 'naal', 'vandi', 'ethi', 'manakkal', 'paravayi',
  ],
  'te-IN': [
    'cheepalu', 'chepalu', 'kendri', 'samudram', 'nadu', 'vaadhi', 'nuvvu',
    'meeku', 'idi', 'ledu', 'kasa', 'ekkadiki', 'chalundi', 'ippudu', 'naaku',
  ],
  'ta-IN': [
    'meen', 'theem', 'kadal', 'samudram', 'poovu', 'vagai', 'naan', 'nee', 'idhu',
    'illa', 'eppo', 'engal', 'naalai', 'vaadhi', 'saafety', 'vaanam',
  ],
  'bn-IN': [
    'mach', 'hader', 'dhora', 'joler', 'bishal', 'amar', 'kemon', 'koto',
    'bhalo', 'khatra', 'shuni', 'ghumi', 'ekhon', 'kalke', 'amake', 'tomader',
  ],
  'or-IN': [
    'macha', 'jibha', 'dhora', 'samudra', 'kemon', 'koto', 'bhalo', 'khatra',
    'suna', 'ghuma', 'ekhoni', 'kalira', 'amake', 'tmane', 'ahei', 'nahi',
  ],
  'pa-IN': [
    'machhli', 'samudra', 'hae', 'hai', 'kya', 'meri', 'tuhadi', 'kado', 'kitthhe',
    'vadde', 'bhalo', 'khatarnak', 'hune', 'kal', 'abhi', 'thoda', 'puni',
  ],
};

/**
 * Fold text to a comparable token stream for romanised-marker scoring.
 *
 * `\p{M}` is kept so that Indic vowel signs survive; see the note on the same
 * helper in `core/intent.ts`, where dropping them silently disables the entire
 * non-Latin lexicon.
 */
const normalise = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export interface LanguageDetection {
  language: LanguageCode;
  confidence: number;
  script: ScriptCode;
  /** True when the detection came from an explicit user selection, not the text. */
  fallback: boolean;
  alternatives: { language: LanguageCode; score: number }[];
}

/**
 * Identify the language of a query.
 *
 * @param text          The raw user utterance.
 * @param preferred     Language the user selected in the UI. Used to break ties
 *                      and as the fallback, but never overrides strong text
 *                      evidence — that is what makes the feature "automatic".
 */
export function detectLanguage(
  text: string,
  preferred: LanguageCode = 'en-IN',
): LanguageDetection {
  const scriptProfile = analyseScript(text);
  const candidates = new Map<LanguageCode, number>();

  const add = (language: LanguageCode, score: number) => {
    candidates.set(language, (candidates.get(language) ?? 0) + score);
  };

  // Signal 1: non-Latin script is decisive.
  if (scriptProfile.dominant !== 'latin' && scriptProfile.totalLetters >= 2) {
    const mapped = SCRIPT_TO_LANGUAGE[scriptProfile.dominant as Exclude<ScriptCode, 'latin'>];
    if (mapped) {
      // Devanagari maps to Hindi; Marathi shares the same script and cannot be
      // told apart from the glyphs alone. When the user has declared a
      // Devanagari-script language (Hindi *or* Marathi) in the UI, that
      // declaration breaks the tie — the answer must come back in the language
      // they chose, not whichever Devanagari variant scored first. Romanised
      // marker scoring below still differentiates Latin-script input.
      add(mapped, 12);
      if (mapped === 'hi-IN' && (preferred === 'hi-IN' || preferred === 'mr-IN')) {
        add(preferred, 12);
      }
    }
  }

  // Signal 2: Romanised keyword scoring.
  const tokens = new Set(normalise(text).split(' '));
  for (const [language, markers] of Object.entries(ROMANISED_MARKERS)) {
    for (const marker of markers) {
      if (tokens.has(marker)) {
        add(language as LanguageCode, 2);
      }
    }
  }

  // Signal 3: Marathi and Hindi are frequently written identically in Latin
  // script, so nudge towards the user's declared preference unless the other
  // language has strictly more marker hits.
  const preferredScript = LANGUAGE_BY_CODE[preferred]?.script ?? 'latin';
  if (preferredScript === 'devanagari') {
    add(preferred, 0.5);
  } else {
    add(preferred, 0.5);
  }

  const ranked = [...candidates.entries()]
    .map(([language, score]) => ({ language, score }))
    .sort((a, b) => b.score - a.score);

  const top = ranked[0];

  if (!top || top.score < 2) {
    return {
      language: preferred,
      confidence: 0.3,
      script: scriptProfile.dominant,
      fallback: true,
      alternatives: ranked.slice(0, 3),
    };
  }

  // A declared preference can only win if it is within 2 points of the leader.
  const preferredScore = candidates.get(preferred) ?? 0;
  const language =
    preferredScore >= top.score - 2 && scriptProfile.dominant === 'latin'
      ? preferred
      : top.language;

  const confidence = Math.min(0.99, 0.5 + top.score / 20);

  return {
    language,
    confidence,
    script: scriptProfile.dominant,
    fallback: language === preferred && top.language !== preferred,
    alternatives: ranked.filter((r) => r.language !== language).slice(0, 3),
  };
}

/** Map a detected language onto the BCP-47 tag the Web Speech API expects. */
export const speechTagFor = (language: LanguageCode): string =>
  LANGUAGE_BY_CODE[language]?.speechTag ?? language;

export const languageName = (language: LanguageCode): string =>
  LANGUAGE_BY_CODE[language]?.label ?? language;

export const nativeLanguageName = (language: LanguageCode): string =>
  LANGUAGE_BY_CODE[language]?.nativeLabel ?? language;

export const isSupportedLanguage = (value: string): value is LanguageCode =>
  SUPPORTED_LANGUAGES.some((lang) => lang.code === value);
