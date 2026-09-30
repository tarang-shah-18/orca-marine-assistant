/**
 * Prose templates for the historical / productivity agent.
 *
 * That agent explained *why* a fisher's catch fell — correlations between
 * landings effort and chlorophyll, SST, rainfall — which is the most analytical
 * thing ORCA does. All of it was emitted as literal English template strings
 * interpolated with numbers, so a Tamil fisherman asking why his harbour's
 * productivity had declined got a paragraph of English prose about his own
 * harbour. This is ORCA's own analysis, not quoted authority text, so it is
 * translated like any other prose.
 *
 * Scientific and statistical tokens are deliberately left in Latin script and
 * are NOT in this file: chlorophyll-a, CPUE, SST, the r values and the units.
 * Those are the symbols on the instruments and in the reference literature, and
 * translating them would make them harder to cross-check, not easier.
 *
 * `correlationDirection*` replaces a bare English clause on `Correlation.direction`
 * which was previously chosen inline at `correlation()`.
 */

export const HISTORICAL_ADDITIONS = {
  'en-IN': {
    correlationLabelChlorophyll: 'chlorophyll-a',
    correlationLabelSst: 'sea surface temperature',
    correlationLabelEffort: 'fishing effort',
    correlationLabelRainfall: 'rainfall',
    correlationDirectionUp: 'more of it accompanies more landings',
    correlationDirectionDown: 'more of it accompanies fewer landings',
    correlationVerdictWord:
      '{label} vs landings: r = {r} over {months} months{lagClause}.',
    lagClauseWord: ', best at a {lag}-month lag (r = {lagR})',
    trendWindowWord:
      'Over {months} months ({start} to {end}), the {region} fishery shows a {trend} landings trend, {catchChange}. CPUE is {cpue} t per 1000 boat-days, {cpueChange} across the window.',
    lagLeaderWord:
      '{label} leads landings by about {lag} months (lagged r = {lagR} versus {r} contemporaneous). That lead time is the physical lag between the ocean response and the fishery, and it is why current-year conditions do not show up in this year\u2019s landings.',
    summaryWord:
      '{region}: {trend} landings, {catchChange}, CPUE {cpueChange}, driven primarily by {driver}.',
  },

  'hi-IN': {
    correlationLabelChlorophyll: 'क्लोरोफिल-ए',
    correlationLabelSst: 'समुद्री सतह तापमान',
    correlationLabelEffort: 'मछली पकड़ने का प्रयास',
    correlationLabelRainfall: 'वर्षा',
    correlationDirectionUp: 'इसकी मात्रा बढ़ने पर उत्पादन भी बढ़ता है',
    correlationDirectionDown: 'इसकी मात्रा बढ़ने पर उत्पादन घटता है',
    correlationVerdictWord: '{label} बनाम उत्पादन: {months} महीनों में r = {r}{lagClause}.',
    lagClauseWord: ', सर्वोत्तम {lag}-महीने की देरी पर (r = {lagR})',
    trendWindowWord:
      '{months} महीनों में ({start} से {end}), {region} की मत्स्य-निर्यात में उत्पादन {trend} है, {catchChange}. CPUE {cpue} टन प्रति 1000 नाव-दिन, इस अवधि में {cpueChange}.',
    lagLeaderWord:
      '{label} लगभग {lag} महीने पहले उत्पादन का नेतृत्व करता है (विलंबित r = {lagR} बनाम तत्काल r = {r})। यही वह भौतिक देरी है जो समुद्र की प्रतिक्रिया और मत्स्य-निर्यात के बीच होती है, इसीलिए इस वर्ष की स्थितियाँ इस वर्ष के उत्पादन में नहीं दिखतीं।',
    summaryWord: '{region}: उत्पादन {trend}, {catchChange}, CPUE {cpueChange}, मुख्य रूप से {driver} से प्रेरित।',
  },

  'mr-IN': {
    correlationLabelChlorophyll: 'क्लोरोफिल-अ',
    correlationLabelSst: 'समुद्री पृष्ठभूमी तापमान',
    correlationLabelEffort: 'मासेमार प्रयत्न',
    correlationLabelRainfall: 'पावस',
    correlationDirectionUp: 'याचे प्रमाण वाढल्यास उत्पादनही वाढते',
    correlationDirectionDown: 'याचे प्रमाण वाढल्यास उत्पादन घटते',
    correlationVerdictWord: '{label} विरुद्ध उत्पादन: {months} महिन्यांत r = {r}{lagClause}.',
    lagClauseWord: ', {lag}-महिन्यांच्या उशिरा सर्वोत्तम (r = {lagR})',
    trendWindowWord:
      '{months} महिन्यांत ({start} ते {end}), {region} चा मासेमारी उत्पादन {trend} आहे, {catchChange}. CPUE {cpue} टन प्रति 1000 नावदिवस, या कालावधीत {cpueChange}.',
    lagLeaderWord:
      '{label} सुमारे {lag} महिने आधी उत्पादनाचा आघाडीवर आहे (विलंबित r = {lagR} विरुद्ध तात्कालिक r = {r}). हाच तो भौतिक उशीर आहे जो समुद्राच्या प्रतिसादा आणि मासेमारीमध्ये असतो, आणि म्हणूनच यंदाची परिस्थिती यंदाच्या उत्पादनात दिसत नाही.',
    summaryWord: '{region}: उत्पादन {trend}, {catchChange}, CPUE {cpueChange}, मुख्यतः {driver} मुळे.',
  },

  'gu-IN': {
    correlationLabelChlorophyll: 'ક્લોરોફિલ-એ',
    correlationLabelSst: 'દરિયાની સપાટીનું તાપમાન',
    correlationLabelEffort: 'માછલી પકડનો પ્રયાસ',
    correlationLabelRainfall: 'વરસાદ',
    correlationDirectionUp: 'આનો જથ્થો વધે ત્યારે ઉત્પાદન પણ વધે છે',
    correlationDirectionDown: 'આનો જથ્થો વધે ત્યારે ઉત્પાદન ઘટે છે',
    correlationVerdictWord: '{label વિરુદ્ધ ઉત્પાદન: {months} મહિનામાં r = {r}{lagClause}.',
    lagClauseWord: ', {lag} મહિનાની વિલંબમાં શ્રેષ્ઠ (r = {lagR})',
    trendWindowWord:
      '{months} મહિનામાં ({start} થી {end}), {region} ની માછલી પકડમાં ઉત્પાદન {trend} છે, {catchChange}. CPUE {cpue} ટન પ્રતિ 1000 નૌકા-દિવસ, આ સમયગાળામાં {cpueChange}.',
    lagLeaderWord:
      '{label} લગભગ {lag} મહિના પહેલાં ઉત્પાદનનું નેતૃવ કરે છે (વિલંબિત r = {lagR} સામે તાત્કાલિક r = {r}). દરિયાની પ્રતિસાદ અને માછલી પકડ વચ્ચે આ જ ભૌતિક વિલંબ છે, અને તેથી જ આ વર્ષની હાલની સ્થિતિ આ વર્ષના ઉત્પાદનમાં દેખાતી નથી.',
    summaryWord: '{region}: ઉત્પાદન {trend}, {catchChange}, CPUE {cpueChange}, મુખ્યત્વે {driver} દ્વારા નિર્ધારિત.',
  },

  'kn-IN': {
    correlationLabelChlorophyll: 'ಕ್ಲೋರೋಫಿಲ್-ಎ',
    correlationLabelSst: 'ಸಮುದ್ರ ಮೇಲ್ಮೈನ ಉಷ್ಣತೆ',
    correlationLabelEffort: 'ಮೀನು ಹಿಡಿಯುವ ಪ್ರಯತ್ನ',
    correlationLabelRainfall: 'ಮಳೆ',
    correlationDirectionUp: 'ಇದರ ಪ್ರಮಾಣ ಹೆಚ್ಚಿದರೆ ಉತ್ಪಾದನೆಯೂ ಹೆಚ್ಚುತ್ತದೆ',
    correlationDirectionDown: 'ಇದರ ಪ್ರಮಾಣ ಹೆಚ್ಚಿದರೆ ಉತ್ಪಾದನೆ ಕಡಿಮೆಯಾಗುತ್ತದೆ',
    correlationVerdictWord: '{label} ಮತ್ತು ಉತ್ಪಾದನೆ: {months} ತಿಂಗಳಲ್ಲಿ r = {r}{lagClause}.',
    lagClauseWord: ', {lag} ತಿಂಗಳ ವಿಳಂಬದಲ್ಲಿ ಅತ್ಯುತ್ತಮ (r = {lagR})',
    trendWindowWord:
      '{months} ತಿಂಗಳಲ್ಲಿ ({start} ರಿಂದ {end} ರವರೆಗೆ), {region} ಮೀನುಗಾರಿಕೆಯಲ್ಲಿ ಉತ್ಪಾದನೆ {trend}, {catchChange}. CPUE {cpue} ಟನ್ ಪ್ರತಿ 1000 ದೋ-ದಿನ, ಈ ಅವಧಿಯಲ್ಲಿ {cpueChange}.',
    lagLeaderWord:
      '{label} ಸುಮಾರು {lag} ತಿಂಗಳ ಮೊದಲೇ ಉತ್ಪಾದನೆಗೆ ಮುಂದಾಗುತ್ತದೆ (ವಿಳಂಬಿತ r = {lagR} ಹೋಲಿಸಿ ಸಮವರ್ತಮಾದ r = {r}). ಸಮುದ್ರದ ಪ್ರತಿಕ್ರಿಯೆ ಮತ್ತು ಮೀನುಗಾರಿಕೆಯಿಂದ ನಡುವಿನ ಈ ಭೌತಿಕ ವಿಳಂಬವೇ ಇದು, ಮತ್ತು ಹಾಗಾಗಿ ಈ ವರ್ಷದ ಪ್ರಸ್ಥಿತಿಯು ಈ ವರ್ಷದ ಉತ್ಪಾದನೆಯಲ್ಲಿ ಕಾಣುತ್ತದೆ.',
    summaryWord: '{region}: ಉತ್ಪಾದನೆ {trend}, {catchChange}, CPUE {cpueChange}, ಮುಖ್ಯವಾಗಿ {driver} ನಿಂದ ನಿರ್ಧರಿತ.',
  },

  'ml-IN': {
    correlationLabelChlorophyll: 'ക്ലോറോഫിൽ-എ',
    correlationLabelSst: 'കടലിൽപ്പറ്റിന്റെ താപനിലവാതം',
    correlationLabelEffort: 'മീൻ പിടിക്കുന്ന ശ്രമം',
    correlationLabelRainfall: 'മഴ',
    correlationDirectionUp: 'ഇതിന്റെ അളവ് കൂടുമ്പോൾ ഉൽപ്പാദനവും കൂടുകിയും',
    correlationDirectionDown: 'ഇതിന്റെ അളവ് കൂടുമ്പോൾ ഉൽപ്പാദനം കുറയും',
    correlationVerdictWord: '{label} പരിചിതമായ ഉൽപ്പാദനം: {months} മാസഗളിൽ r = {r}{lagClause}.',
    lagClauseWord: ', {lag} മാസം വൈകൽച്ച സമയത്ത് മികച്ചത് (r = {lagR})',
    trendWindowWord:
      '{months} മാസങ്ങളിൽ ({start} മുതൽ {end} വരെ), {region} മീൻപിടുപ്പിൽ ഉൽപ്പാദനം {trend} ആണ്, {catchChange}. CPUE {cpue} ടൻ ഓരോ 1000 കപ്പുകളുടെ ദിവസത്തിനും, ഈ കാലയളവിൽ {cpueChange}.',
    lagLeaderWord:
      '{label} ഏകദേശം {lag} മാസങ്ങൾ മുമ്പ് ഉൽപ്പാദനത്തിന് നേതൃത്വം നൽകുന്നു (വൈകൽച്ച r = {lagR} പക്ഷേ സമകാലീന r = {r}). കടലിന്റെ പ്രതികരണവും മീൻപിടുപ്പും തമ്മിലുള്ള ഈ ഭൗതിക വൈകൽ ആണ്, അതുകൊണ്ടാണ് ഈ വർഷത്തെ സാഹചര്യങ്ങൾ ഈ വർഷത്തെ ഉൽപ്പാദനത്തിൽ കാണപ്പെടുന്നതില്ല.',
    summaryWord: '{region}: ഉൽപ്പാദനം {trend}, {catchChange}, CPUE {cpueChange}, പ്രധാനമായി {driver} എന്നതിനാൽ നിർണയിതം.',
  },

  'te-IN': {
    correlationLabelChlorophyll: 'క్లోరోఫిల్-ఏ',
    correlationLabelSst: 'సముద్ర ఉపరితల ఉష్ణోగ్రత',
    correlationLabelEffort: 'రెండు వేసే ప్రయత్నం',
    correlationLabelRainfall: 'వర్షం',
    correlationDirectionUp: 'దీని పరిమాణం పెరిగితే ఉత్పత్తి కూడా పెరుగుతుంది',
    correlationDirectionDown: 'దీని పరిమాణం పెరిగితే ఉత్పత్తి తగ్గుతుంది',
    correlationVerdictWord: '{label} మరియు ఉత్పత్తి: {months} నెలల్లో r = {r}{lagClause}.',
    lagClauseWord: ', {lag} నెలల తరువాత అత్యుత్తమం (r = {lagR})',
    trendWindowWord:
      '{months} నెలల్లో ({start} నుంచి {end} వరకు), {region} మత్స్య దార్పమంలో ఉత్పత్తి {trend}, {catchChange}. CPUE 1000 నౌక రోజులకు {cpue} టన్, ఈ వ్యవధిలో {cpueChange}.',
    lagLeaderWord:
      '{label} సుమారు {lag} నెలల ముందే ఉత్పత్తికి దారిదీస్తుంది (విలంబిత r = {lagR} నిరంతర r = {r} పోలిస్తే). సముద్ర స్పందన మరియు మత్స్య దార్పమం మధ్య ఉన్న ఈ భౌతిక ఆలస్యమే ఇది, అందుకే ఈ సంవత్సర పరిస్థితులు ఈ సంవత్సర ఉత్పత్తిలో కనిపించవు.',
    summaryWord: '{region}: ఉత్పత్తి {trend}, {catchChange}, CPUE {cpueChange}, ప్రధానంగా {driver} చేత నిర్ణయించబడింది.',
  },

  'ta-IN': {
    correlationLabelChlorophyll: 'குளோரோபில்-ஏ',
    correlationLabelSst: 'கடல் மேற்பரப்பு வெப்பநிலை',
    correlationLabelEffort: 'மீன் பிடிப்பு முயற்சி',
    correlationLabelRainfall: 'மழை',
    correlationDirectionUp: 'அதன் அளவு அதிகரிக்கும்போது உற்பத்தியும் அதிகரிக்கும்',
    correlationDirectionDown: 'அதன் அளவு அதிகரிக்கும்போது உற்பத்தி குறையும்',
    correlationVerdictWord: '{label} மற்றும் உற்பத்தி: {months} மாதங்களில் r = {r}{lagClause}.',
    lagClauseWord: ', {lag} மாத தாமதத்தில் சிறந்தது (r = {lagR})',
    trendWindowWord:
      '{months} மாதங்களில் ({start} முதல் {end} வரை), {region} மீன்புடைப் பகுதியில் உற்பத்தி {trend}, {catchChange}. 1000 படவு-நாட்களுக்கு CPUE {cpue} டன், இந்தக் காலளவில் {cpueChange}.',
    lagLeaderWord:
      '{label} சுமார் {lag} மாதங்கள் முன்பே உற்பத்திக்கு வழிநடத்துகிறது (தாமத r = {lagR} ஒப்பிடுகையில் தற்போதைய r = {r}). கடலின் தாக்கத்திற்கும் மீன்புடைக்கும் இடையிலான இந்த இயல்பு தாமதமே இதுவே, எனவே இந்த ஆண்டின் நிலைமைகள் இந்த ஆண்டின் உற்பத்தியில் தெரியவில்லை.',
    summaryWord: '{region}: உற்பத்தி {trend}, {catchChange}, CPUE {cpueChange}, முதன்மையாக {driver} காரணமாக.',
  },

  'bn-IN': {
    correlationLabelChlorophyll: 'ক্লোরোফিল-এ',
    correlationLabelSst: 'সমুদ্র পৃষ্ঠের তাপমাত্রা',
    correlationLabelEffort: 'মাছ ধরার প্রচেষ্টা',
    correlationLabelRainfall: 'বৃষ্টি',
    correlationDirectionUp: 'এর পরিমাণ বাড়লে উৎপাদনও বাড়ে',
    correlationDirectionDown: 'এর পরিমাণ বাড়লে উৎপাদন কমে',
    correlationVerdictWord: '{label} বনাম উৎপাদন: {months} মাসে r = {r}{lagClause}.',
    lagClauseWord: ', {lag} মাসের বিলম্বে সেরা (r = {lagR})',
    trendWindowWord:
      '{months} মাসে ({start} থেকে {end} পর্যন্ত), {region}-এর মাছ ধরায় উৎপাদন {trend}, {catchChange}. প্রতি 1000 নৌকা-দিনে CPUE {cpue} টন, এই সময়সীমায় {cpueChange}.',
    lagLeaderWord:
      '{label} প্রায় {lag} মাস আগে উৎপাদনে নেতৃত্ব দেয় (বিলম্বিত r = {lagR} বনাম সামবর্তিক r = {r})। সমুদ্রের প্রতিক্রিয়া ও মাছ ধরার মধ্যে এই ভৌত বিলম্বই এটি, তাই এ বছরের পরিস্থিতি এ বছরের উৎপাদনে দেখা যায় না।',
    summaryWord: '{region}: উৎপাদন {trend}, {catchChange}, CPUE {cpueChange}, প্রধানত {driver} দ্বারা নির্ধারিত।',
  },

  'or-IN': {
    correlationLabelChlorophyll: 'କ୍ଲୋରୋଫିଲ୍-ଏ',
    correlationLabelSst: 'ସମୁଦ୍ର ଉପରିପାଟ ତାପମାତ୍ରା',
    correlationLabelEffort: 'ମାଛ ଧରିବା ପ୍ରଚେଷ୍ଟା',
    correlationLabelRainfall: 'ବର୍ଷା',
    correlationDirectionUp: 'ଏହାର ପରିମାଣ ବଢ଼ିଲେ ଉତ୍ପାଦନ ମଧ୍ୟ ବଢ଼େ',
    correlationDirectionDown: 'ଏହାର ପରିମାଣ ବଢ଼ିଲେ ଉତ୍ପାଦନ କମେ',
    correlationVerdictWord: '{label} ପ୍ରତି ଉତ୍ପାଦନ: {months} ମାସରେ r = {r}{lagClause}.',
    lagClauseWord: ', {lag} ମାସ ବିଲମ୍ବରେ ସର୍ବୋତ୍ତମ (r = {lagR})',
    trendWindowWord:
      '{months} ମାସରେ ({start} ଠାରୁ {end} ପର୍ଯ୍ୟନ୍ତ), {region} ମାଛଧରାରେ ଉତ୍ପାଦନ {trend}, {catchChange}. 1000 ନାହାର-ଦିନ ପ୍ରତି CPUE {cpue} ଟନ, ଏହି ସମୟରେ {cpueChange}.',
    lagLeaderWord:
      '{label} ପ୍ରାୟ {lag} ମାସ ପୂର୍ବେ ଉତ୍ପାଦନକୁ ଅଗବରୁଥିବା (ବିଲମ୍ବିତ r = {lagR} ତୁଳନାରେ ସମକାଳୀନ r = {r})। ସମୁଦ୍ରର ପ୍ରତିକ୍ରିୟା ଓ ମାଛଧରା ମଧ୍ୟର ଏହି ଭୌତିକ ବିଲମ୍ବଟି ହେଉଛି, ସେଥିପାଇଁ ଚଳିତ ବର୍ଷର ପରିସ୍ଥିତି ଚଳିତ ବର୍ଷର ଉତ୍ପାଦନରେ ଦେଖାଯାତ୍ତି ନାହିଁ।',
    summaryWord: '{region}: ଉତ୍ପାଦନ {trend}, {catchChange}, CPUE {cpueChange}, ମୁଖ୍ୟଭାବେ {driver} ଦ୍ୱାରା ନିର୍ଣୟତ।',
  },

  'pa-IN': {
    correlationLabelChlorophyll: 'ਕਲੋਰੋਫਿਲ-ਏ',
    correlationLabelSst: 'ਸਮੁੰਦਰ ਸਤ੍ਹਾ ਤਾਪਮਾਨ',
    correlationLabelEffort: 'ਮੱਛ ਪਕੜਣ ਦੀ ਕੋਸ਼ਿਸ਼',
    correlationLabelRainfall: 'ਮੀਂਹ',
    correlationDirectionUp: 'ਇਸ ਦੀ ਮਾਤਰਾ ਵਧਣ ਨਾਲ ਉਤਪਾਦਨ ਵੀ ਵਧਦਾ ਹੈ',
    correlationDirectionDown: 'ਇਸ ਦੀ ਮਾਤਰਾ ਵਧਣ ਨਾਲ ਉਤਪਾਦਨ ਘਟਦਾ ਹੈ',
    correlationVerdictWord: '{label} ਬਨਾਮ ਉਤਪਾਦਨ: {months} ਮਹੀਨਿਆਂ ਵਿੱਚ r = {r}{lagClause}.',
    lagClauseWord: ', {lag} ਮਹੀਨਿਆਂ ਦੀ ਦੇਰੀ ਵਿੱਚ ਸਰਵੋਤਮ (r = {lagR})',
    trendWindowWord:
      '{months} ਮਹੀਨਿਆਂ ਵਿੱਚ ({start} ਤੋਂ {end} ਤੱਕ), {region} ਦੀ ਮੱਛ ਪਕੜ ਵਿੱਚ ਉਤਪਾਦਨ {trend}, {catchChange}. ਪ੍ਰਤੀ 1000 ਕਰਾਬ-ਦਿਨ ਲਈ CPUE {cpue} ਟਨ, ਇਸ ਮਿਹਾਦ ਵਿੱਚ {cpueChange}.',
    lagLeaderWord:
      '{label} ਲਗਭਗ {lag} ਮਹੀਨਿਆਂ ਪਹਿਲਾਂ ਉਤਪਾਦਨ ਦੀ ਅਗਵਾਈ ਕਰਦਾ ਹੈ (ਵਿਲੰਬਿਤ r = {lagR} ਬਨਾਮ ਸਮਕਾਲੀਨ r = {r})। ਸਮੁੰਦਰ ਦੀ ਪ੍ਰਤੀਕਿਰਿਆ ਅਤੇ ਮੱਛ ਪਕੜ ਵਿਚਕਾਰ ਇਹੀ ਭੌਤਿਕ ਦੇਰੀ ਹੈ, ਇਸ ਲਈ ਇਸ ਸਾਲ ਦੀਆਂ ਹਾਲਤਾਂ ਇਸ ਸਾਲ ਦੇ ਉਤਪਾਦਨ ਵਿੱਚ ਨਹੀਂ ਦਿਸਦੀਆਂ।',
    summaryWord: '{region}: ਉਤਪਾਦਨ {trend}, {catchChange}, CPUE {cpueChange}, ਮੁੱਖ ਤੌਰ \x27ਤੇ {driver} ਦੁਆਰਾ ਨਿਰਧਾਰਿਤ।',
  },
};
