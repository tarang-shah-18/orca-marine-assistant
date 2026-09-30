/**
 * Direction words for the historical agent's percentage-change clause, plus the
 * two evidence keys that stayed English.
 *
 * `describeChange` returned `"up 12%"` / `"down 3%"` / `"flat 0%"` and was then
 * interpolated straight into a translated sentence. That is the worst kind of
 * leak: the frame was Tamil and the predicate was English, so the reader got a
 * grammatically impossible sentence rather than an obviously-untranslated one.
 */

export const CHANGE_ADDITIONS = {
  'en-IN': {
    effortChangeWord: 'Effort change',
    changeUpWord: 'up',
    changeDownWord: 'down',
    changeFlatWord: 'flat',
    landingTrendWord: 'Landing trend',
    driverWord: 'Driver',
  },
  'hi-IN': {
    effortChangeWord: 'प्रयास में परिवर्तन',
    changeUpWord: 'ऊपर',
    changeDownWord: 'नीचे',
    changeFlatWord: 'स्थिर',
    landingTrendWord: 'उत्पादन की प्रवृत्ति',
    driverWord: 'कारक',
  },
  'mr-IN': {
    effortChangeWord: 'प्रयत्नातील बदल',
    changeUpWord: 'वाढले',
    changeDownWord: 'घटले',
    changeFlatWord: 'स्थिर',
    landingTrendWord: 'उत्पादन कल',
    driverWord: 'कारक',
  },
  'gu-IN': {
    effortChangeWord: 'પ્રયત્નમાં ફેરફાર',
    changeUpWord: 'વધ્યું',
    changeDownWord: 'ઘટ્યું',
    changeFlatWord: 'સપાટ',
    landingTrendWord: 'ઉત્પાદન વલણ',
    driverWord: 'કારક',
  },
  'kn-IN': {
    effortChangeWord: 'ಪ್ರಯತ್ನದಲ್ಲಿ ಬದಲಾವಣೆ',
    changeUpWord: 'ಹೆಚ್ಚಿದೆ',
    changeDownWord: 'ಕಡಿಮೆಯಾಗಿದೆ',
    changeFlatWord: 'ಸ್ಥಿರ',
    landingTrendWord: 'ಉತ್ಪಾದನೆ ಪ್ರವೃತ್ತಿ',
    driverWord: 'ಕಾರಣ',
  },
  'ml-IN': {
    effortChangeWord: 'ശ്രമത്തിലെ മാറ്റം',
    changeUpWord: 'വർദ്ധിച്ചു',
    changeDownWord: 'കുറഞ്ഞു',
    changeFlatWord: 'സ്ഥിരം',
    landingTrendWord: 'ഉൽപ്പാദന പ്രവാഹം',
    driverWord: 'കാരണം',
  },
  'te-IN': {
    effortChangeWord: 'ప్రయత్నంలో మార్పు',
    changeUpWord: 'పెరిగింది',
    changeDownWord: 'తగ్గింది',
    changeFlatWord: 'స్థిరంగా',
    landingTrendWord: 'ఉత్పత్తి ప్రవృత్తి',
    driverWord: 'కారకం',
  },
  'ta-IN': {
    effortChangeWord: 'முயற்சி மாற்றம்',
    changeUpWord: 'அதிகரித்து',
    changeDownWord: 'குறைந்து',
    changeFlatWord: 'மாற்றமின்றி',
    landingTrendWord: 'உற்பத்தி போக்கு',
    driverWord: 'காரணி',
  },
  'bn-IN': {
    effortChangeWord: 'প্রচেষ্টার পরিবর্তন',
    changeUpWord: 'বেড়েছে',
    changeDownWord: 'কমেছে',
    changeFlatWord: 'স্থিতিশীল',
    landingTrendWord: 'উৎপাদনের ধারা',
    driverWord: 'সংঘটক',
  },
  'or-IN': {
    effortChangeWord: 'ପ୍ରଚେଷ୍ଟାରେ ପରିବର୍ତ୍ତନ',
    changeUpWord: 'ବଢ଼ିଲା',
    changeDownWord: 'କମିଲା',
    changeFlatWord: 'ସ୍ଥିର',
    landingTrendWord: 'ଉତ୍ପାଦନ ଧାରା',
    driverWord: 'କାରକ',
  },
  'pa-IN': {
    effortChangeWord: 'ਕੋਸ਼ਿਸ਼ ਵਿੱਚ ਤਬਦੀਲੀ',
    changeUpWord: 'ਵਧਿਆ',
    changeDownWord: 'ਘਟਿਆ',
    changeFlatWord: 'ਸਥਿਰ',
    landingTrendWord: 'ਉਤਪਾਦਨ ਰੁਖ',
    driverWord: 'ਕਾਰਕ',
  },
};
