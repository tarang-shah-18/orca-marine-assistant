/**
 * ORCA mobile design tokens.
 *
 * The same palette the web client uses, flattened to literal values because
 * React Native has no Tailwind. Keeping it in one module means the native
 * client and the web client read as the same product.
 */

export const colors = {
  void: '#020617',
  surface: '#0f172a',
  surfaceAlt: '#1e293b',
  surfaceHigh: '#334155',
  border: '#1e293b',
  borderBright: '#334155',
  cyan: '#06b6d4',
  cyanDim: '#0e7490',
  cyanWash: '#083344',
  emerald: '#10b981',
  emeraldWash: '#052e16',
  amber: '#f59e0b',
  amberWash: '#451a03',
  orange: '#f97316',
  red: '#ef4444',
  redWash: '#450a0a',
  violet: '#a855f7',
  violetWash: '#2e1065',
  purple: '#c084fc',
  sky: '#38bdf8',
  text: '#f8fafc',
  textDim: '#94a3b8',
  textFaint: '#64748b',
  white: '#ffffff',
};

export const riskColor = (level) =>
  ({
    LOW: colors.emerald,
    MODERATE: colors.amber,
    HIGH: colors.orange,
    SEVERE: colors.red,
  }[level] ?? colors.textDim);

export const riskWash = (level) =>
  ({
    LOW: colors.emeraldWash,
    MODERATE: colors.amberWash,
    HIGH: '#431407',
    SEVERE: colors.redWash,
  }[level] ?? colors.surfaceAlt);

export const advisoryColor = (level) =>
  ({
    GREEN: colors.emerald,
    YELLOW: colors.amber,
    ORANGE: colors.orange,
    RED: colors.red,
  }[level] ?? colors.textDim);

export const severityColor = (severity) =>
  ({
    CRITICAL: colors.red,
    HIGH: colors.orange,
    MODERATE: colors.amber,
    INFO: colors.sky,
  }[severity] ?? colors.cyan);

export const sky = '#38bdf8';

export const typeLabel = {
  INTERNATIONAL_BOUNDARY: 'International boundary',
  MARINE_PROTECTED_AREA: 'Marine protected area',
  ECOLOGICALLY_SENSITIVE_ZONE: 'Ecologically sensitive',
  OIL_RIG: 'Oil / gas installation',
  MILITARY_ZONE: 'Restricted military area',
  SUBMARINE_CABLE: 'Submarine cable',
  SHIPPING_LANE: 'Shipping lane',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

/**
 * Language tags the engine understands, with the BCP-47 tag expo-speech wants.
 *
 * This list is a mirror of `SUPPORTED_LANGUAGES` in the TypeScript core. The
 * server is the authority; `/api/languages` refreshes this at startup.
 */
export const LANGUAGES = [
  { code: 'en-IN', native: 'English', label: 'English', region: 'National / Coastal' },
  { code: 'hi-IN', native: 'हिन्दी', label: 'Hindi', region: 'National' },
  { code: 'mr-IN', native: 'मराठी', label: 'Marathi', region: 'Maharashtra Coast' },
  { code: 'gu-IN', native: 'ગુજરાતી', label: 'Gujarati', region: 'Gujarat Coast' },
  { code: 'kn-IN', native: 'ಕನ್ನಡ', label: 'Kannada', region: 'Karnataka Coast' },
  { code: 'ml-IN', native: 'മയാളം', label: 'Malayalam', region: 'Kerala Coast' },
  { code: 'te-IN', native: 'తెలుగు', label: 'Telugu', region: 'Andhra Pradesh Coast' },
  { code: 'ta-IN', native: 'தமிழ்', label: 'Tamil', region: 'Tamil Nadu Coast' },
  { code: 'bn-IN', native: 'বাংলা', label: 'Bengali', region: 'Sundarbans & Bay of Bengal' },
  { code: 'or-IN', native: 'ଓଡ଼ିଆ', label: 'Odia', region: 'Odisha Coast' },
  { code: 'pa-IN', native: 'ਪੰਜਾਬੀ', label: 'Punjabi', region: 'Northwest Coast' },
];

export const languageByCode = (code) => LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];

/**
 * Risk vocabulary in all eleven languages.
 *
 * A risk level is the one thing on screen a fisher must be able to read in
 * their own script, so it is translated per language rather than showing the
 * English enum. Mirrors `Phrasebook.riskWords` in `src/core/i18n.ts`.
 */
export const RISK_WORDS = {
  'en-IN': ['Low', 'Moderate', 'High', 'Severe'],
  'hi-IN': ['कम', 'मध्यम', 'उच्च', 'गंभीर'],
  'mr-IN': ['कमी', 'मध्यम', 'उच्च', 'गंभीर'],
  'gu-IN': ['ઓછું', 'મધ્યમ', 'ઊંચું', 'ગંભીર'],
  'kn-IN': ['ಕಡಿಮೆ', 'ಮಧ್ಯಮ', 'ಹೆಚ್ಚು', 'ತೀವ್ರ'],
  'ml-IN': ['കുറവ്', 'ഇടത്തരം', 'ഉയർന്ന', 'ഗുരുതരം'],
  'te-IN': ['తక్కువ', 'మధ్యస్థం', 'అధికం', 'తీవ్రం'],
  'ta-IN': ['குறைவு', 'நடுத்தரம்', 'அதிகம்', 'தீவிரம்'],
  'bn-IN': ['কম', 'মাঝারি', 'উচ্চ', 'গুরুতর'],
  'or-IN': ['କମ୍', 'ମଧ୍ଭାଅ', 'ଉଚ୍ଚ', 'ଗମ୍ଭୀର'],
  'pa-IN': ['ਘੱਟ', 'ਦਰਮਿਆਨਾ', 'ਉੱਚ', 'ਗੰਭੀਰ'],
};

const RISK_INDEX = { LOW: 0, MODERATE: 1, HIGH: 2, SEVERE: 3 };

/** The risk word for a level, in the fisher's language. */
export const riskWord = (level, language) =>
  (RISK_WORDS[language] ?? RISK_WORDS['en-IN'])[RISK_INDEX[level] ?? 0];

/** The safety sentence that must be present on every recommendation. */
export const SAFETY_NOTICE =
  'ORCA is decision support, not a guarantee. Official warnings from IMD, INCOIS and the port authority always take precedence. The decision to sail is the master’s.';
