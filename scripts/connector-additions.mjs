/**
 * Two connector words that leaked English glue into every non-English answer.
 *
 * "Swell SSE at 13 s" and "Wind 3 kt from SW" were built by concatenating a
 * number with the literal English words "at" and "from". Everything around them
 * was already translated, so these two function words were the only English a
 * reader saw in the busiest lines of the brief — which reads worse than a fully
 * untranslated line, because it looks like a bug rather than a missing feature.
 *
 * Direction codes (SSE, SW) stay Latin by design: they are navigational
 * shorthand a fisher reads on every instrument, and the dataset stores them
 * that way.
 */

export const CONNECTOR_ADDITIONS = {
  'en-IN': {
    atWord: 'at',
    fromWord: 'from',
  },
  'hi-IN': {
    atWord: 'पर',
    fromWord: 'से',
  },
  'mr-IN': {
    atWord: 'वर',
    fromWord: 'हून',
  },
  'gu-IN': {
    atWord: 'પર',
    fromWord: 'થી',
  },
  'kn-IN': {
    atWord: 'ನಲ್ಲಿ',
    fromWord: 'ಇಂದ',
  },
  'ml-IN': {
    atWord: 'വഴി',
    fromWord: 'നിന്ന്',
  },
  'te-IN': {
    atWord: 'వద్ద',
    fromWord: 'నుండి',
  },
  'ta-IN': {
    atWord: 'இல்',
    fromWord: 'இருந்து',
  },
  'bn-IN': {
    atWord: 'এ',
    fromWord: 'থেকে',
  },
  'or-IN': {
    atWord: 'ରେ',
    fromWord: 'ଠାରୁ',
  },
  'pa-IN': {
    atWord: 'ਤੇ',
    fromWord: 'ਤੋਂ',
  },
};
