/**
 * Chart-copy additions: the two series captions a fisher actually reads on the
 * productivity chart, plus the CPUE chart's title and subtitle.
 *
 * Deliberately NOT translated, and why:
 *
 *   - `unit: 'index'`, `'mg/m³'`, `'°C'`, `'t/1000 bd'` — unit tokens. Rendered
 *     next to the number they measure; a translated unit would be unreadable at
 *     the sizes used.
 *   - `CPUE` — the standard fisheries acronym (catch per unit effort), used
 *     verbatim across Indian fisheries literature. See the token policy in
 *     `core/i18n.ts`.
 *   - `'Chlorophyll (mg/m³)'`, `'SST (°C)'` — chlorophyll-a and SST are
 *     scientific parameter names, not UI copy.
 *   - the evidence ledger's field names (`ev('Lag', …)`, `ev('Chlorophyll
 *     trend', …)`, ~46 of them across the agents) — these are the column names
 *     of the audit record. They are deliberately language-stable so that an
 *     evidence ledger exported from a Tamil session can be lined up against one
 *     exported from an English session field by field. The *values* and every
 *     sentence the synthesiser writes around them are translated.
 */

export const CHART_ADDITIONS = {
  'en-IN': {
    chartLandingIndexWord: 'Landing index',
    chartEffortIndexWord: 'Effort index',
    chartCpueTitleWord: 'CPUE and effort standardisation',
    chartCpueSubtitleWord: 'Landings per unit of fishing effort',
    plannerRuntimeWord: 'Planning is handled by the runtime.',
  },
  'hi-IN': {
    chartLandingIndexWord: 'अवतरण सूचकांक',
    chartEffortIndexWord: 'प्रयास सूचकांक',
    chartCpueTitleWord: 'CPUE और प्रयास मानकीकरण',
    chartCpueSubtitleWord: 'प्रति इकाई मछली पकड़ प्रयास प्राप्त अवतरण',
    plannerRuntimeWord: 'योजना बनाने का काम रनटाइम करता है।',
  },
  'mr-IN': {
    chartLandingIndexWord: 'अवतरण निर्देशांक',
    chartEffortIndexWord: 'प्रयत्न निर्देशांक',
    chartCpueTitleWord: 'CPUE आणि प्रयत्न मानकीकरण',
    chartCpueSubtitleWord: 'प्रति मात्रा मासे पकडण्याच्या प्रयत्नाचे अवतरण',
    plannerRuntimeWord: 'नियोजन करण्याचे काम रनटाइम करते.',
  },
  'gu-IN': {
    chartLandingIndexWord: 'અવતરણ સૂચક',
    chartEffortIndexWord: 'પ્રયાસ સૂચક',
    chartCpueTitleWord: 'CPUE અને પ્રયાસનું માપદાંડીકરણ',
    chartCpueSubtitleWord: 'માછલી પકડવાના દરેક એકમ માટે અવતરણ',
    plannerRuntimeWord: 'આયોજન કરવાનું કામ રનટાઇમ કરે છે.',
  },
  'kn-IN': {
    chartLandingIndexWord: 'ಒಳಸೂಚಿ ಸೂಚ್ಯಂಕ',
    chartEffortIndexWord: 'ಪ್ರಯಾಸ ಸೂಚ್ಯಂಕ',
    chartCpueTitleWord: 'CPUE ಮತ್ತು ಪ್ರಯಾಸದ ಮಾನಕೀಕರಣ',
    chartCpueSubtitleWord: 'ಒಂದು ಮೀನು ಹಿಡುವ ಪ್ರಯಾಸಕ್ಕೆ ಒಳಸೂಚಿ',
    plannerRuntimeWord: 'ಯೋಜನೆ ಮಾಡುವುದು ರನ್‌ಟೈಮ್ ಮಾಡುತ್ತದೆ.',
  },
  'ml-IN': {
    chartLandingIndexWord: 'ഒരുപുറത്തിലെത്തിയതിന്റെ സൂചിക',
    chartEffortIndexWord: 'പരിശ്രമ സൂചിക',
    chartCpueTitleWord: 'CPUE-യും പരിശ്രമ നിയമീകരണവും',
    chartCpueSubtitleWord: 'ഒരുപരിശ്രമത്തിന് കിട്ടുന്ന ഒരുപുറത്തിലെത്തുന്ന മത്സ്യങ്ങൾ',
    plannerRuntimeWord: 'ആസൂത്രണം ചെയ്യുന്നത് റണ്‍ടൈമാണ്.',
  },
  'te-IN': {
    chartLandingIndexWord: 'రాబ సూచకం',
    chartEffortIndexWord: 'ప్రయత్న సూచకం',
    chartCpueTitleWord: 'CPUE మరియు ప్రయత్న ప్రామాణీకరణ',
    chartCpueSubtitleWord: 'మత్స్య దుష్టకరణ ప్రయత్నానికి రాబ',
    plannerRuntimeWord: 'ప్రణాళిక రూపొందించడం రన్‌టైమ్ చేస్తుంది.',
  },
  'ta-IN': {
    chartLandingIndexWord: 'இறங்கிய மீன் சுட்டு',
    chartEffortIndexWord: 'முயற்சி சுட்டு',
    chartCpueTitleWord: 'CPUE மற்றும் முயற்சி நியம்பாக்கம்',
    chartCpueSubtitleWord: 'மீன் பிடிப்பு முயற்சிக்கு இறங்கிய மீன்',
    plannerRuntimeWord: 'திட்டமிடுவது இயக்கப்பை செய்கிறது.',
  },
  'bn-IN': {
    chartLandingIndexWord: 'উত্তোলন সূচক',
    chartEffortIndexWord: 'প্রচেষ্টা সূচক',
    chartCpueTitleWord: 'CPUE ও প্রচেষ্টার আদর্শীকরণ',
    chartCpueSubtitleWord: 'একক মাছ ধরার প্রচেষ্টায় উত্তোলন',
    plannerRuntimeWord: 'পরিকল্পনা করার কাজটি রানটাইম করে।',
  },
  'or-IN': {
    chartLandingIndexWord: 'ଉତ୍ତରଣ ସୂଚକ',
    chartEffortIndexWord: 'ପ୍ରଚେଷ୍ଟା ସୂଚକ',
    chartCpueTitleWord: 'CPUE ଏବଂ ପ୍ରଚେଷ୍ଟାର ମାନକୀକରଣ',
    chartCpueSubtitleWord: 'ଏକ ମାଛ ଧରିବା ପ୍ରଚେଷ୍ଟାକୁ ଉତ୍ତରଣ',
    plannerRuntimeWord: 'ଯୋଜନା କରିବା କାମ ରଣ୍ଟାଇମ୍ କରେ।',
  },
  'pa-IN': {
    chartLandingIndexWord: 'ਉਤਰਣ ਸੂਚਕ',
    chartEffortIndexWord: 'ਯਤਨ ਸੂਚਕ',
    chartCpueTitleWord: 'CPUE ਅਤੇ ਯਤਨ ਦਾ ਮਿਆਰੀਕਰਨ',
    chartCpueSubtitleWord: 'ਇੱਕ ਮੱਛੀ ਪਕੜਨ ਦੀ ਯਤਨ ਲਈ ਉਤਰਣ',
    plannerRuntimeWord: 'ਯੋਜਨਾਬੰਦੀ ਦਾ ਕੰਮ ਰਨਟਾਈਮ ਕਰਦਾ ਹੈ।',
  },
};
