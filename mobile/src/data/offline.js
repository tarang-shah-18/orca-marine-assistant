/**
 * Bundled reference data for the mobile client.
 *
 * The web client can re-run the entire agent engine in the browser because the
 * engine is pure TypeScript. React Native cannot do that from this folder
 * without a Metro alias into `src/`, so instead the native client ships the
 * *reference* half of the knowledge base — the harbour gazetteer and the eight
 * canonical questions in eleven languages — and is explicit that answers need
 * the engine.
 *
 * Nothing here fabricates a marine reading. A screen that cannot reach the
 * engine says so, and offers the questions it is ready to send.
 */

/** The 13 Indian fishing harbours in `src/core/dataset.ts`. */
export const HARBOURS = [
  {
    id: 'mumbai',
    name: 'Sassoon Dock, Mumbai',
    shortName: 'Mumbai',
    state: 'Maharashtra',
    region: 'Konkan',
    basin: 'Arabian Sea',
    latitude: 18.9168,
    longitude: 72.8258,
  },
  {
    id: 'ratnagiri',
    name: 'Mirkarwada Jetty, Ratnagiri',
    shortName: 'Ratnagiri',
    state: 'Maharashtra',
    region: 'Konkan',
    basin: 'Arabian Sea',
    latitude: 16.9944,
    longitude: 73.2842,
  },
  {
    id: 'goa',
    name: 'Cavelossim Fishing Jetty, Goa',
    shortName: 'Goa',
    state: 'Goa',
    region: 'Konkan',
    basin: 'Arabian Sea',
    latitude: 15.4053,
    longitude: 73.7969,
  },
  {
    id: 'veraval',
    name: 'Veraval Fishing Port, Gir Somnath',
    shortName: 'Veraval',
    state: 'Gujarat',
    region: 'Saurashtra',
    basin: 'Arabian Sea',
    latitude: 20.9077,
    longitude: 70.3678,
  },
  {
    id: 'porbandar',
    name: 'Porbandar Fishing Port, Gujarat',
    shortName: 'Porbandar',
    state: 'Gujarat',
    region: 'Saurashtra',
    basin: 'Arabian Sea',
    latitude: 21.6417,
    longitude: 69.6094,
  },
  {
    id: 'malpe',
    name: 'Malpe Harbour, Udupi',
    shortName: 'Malpe',
    state: 'Karnataka',
    region: 'Malabar Coast',
    basin: 'Arabian Sea',
    latitude: 13.3512,
    longitude: 74.7042,
  },
  {
    id: 'mangaluru',
    name: 'Mangaluru Old Harbour, Karnataka',
    shortName: 'Mangaluru',
    state: 'Karnataka',
    region: 'Malabar Coast',
    basin: 'Arabian Sea',
    latitude: 12.9141,
    longitude: 74.856,
  },
  {
    id: 'kochi',
    name: 'Thoppumpady Harbour, Kochi',
    shortName: 'Kochi',
    state: 'Kerala',
    region: 'Malabar Coast',
    basin: 'Arabian Sea',
    latitude: 9.9312,
    longitude: 76.2673,
  },
  {
    id: 'tuticorin',
    name: 'Tuticorin Port, Tamil Nadu',
    shortName: 'Tuticorin',
    state: 'Tamil Nadu',
    region: 'Coromandel Coast',
    basin: 'Gulf of Mannar',
    latitude: 8.7542,
    longitude: 78.1348,
  },
  {
    id: 'chennai',
    name: 'Kasimedu Fishing Harbour, Chennai',
    shortName: 'Chennai',
    state: 'Tamil Nadu',
    region: 'Coromandel Coast',
    basin: 'Bay of Bengal',
    latitude: 13.1256,
    longitude: 80.2982,
  },
  {
    id: 'puducherry',
    name: 'Gandigramam Fish Landing, Puducherry',
    shortName: 'Puducherry',
    state: 'Puducherry',
    region: 'Coromandel Coast',
    basin: 'Bay of Bengal',
    latitude: 11.9417,
    longitude: 79.8303,
  },
  {
    id: 'vizag',
    name: 'Visakhapatnam Fishing Port, Andhra Pradesh',
    shortName: 'Visakhapatnam',
    state: 'Andhra Pradesh',
    region: 'Andhra Coast',
    basin: 'Bay of Bengal',
    latitude: 17.6985,
    longitude: 83.2981,
  },
  {
    id: 'digha',
    name: 'Digha Mohana Belta, West Bengal',
    shortName: 'Digha',
    state: 'West Bengal',
    region: 'Sundarbans Coast',
    basin: 'Bay of Bengal',
    latitude: 21.9276,
    longitude: 87.2635,
  },
];

export const harbourById = (id) => HARBOURS.find((h) => h.id === id) ?? HARBOURS[0];

/**
 * The eight capabilities from the problem statement, as real questions.
 *
 * These are the same utterances as `CANONICAL_SCENARIOS` in
 * `src/server/scenarios.ts`, so tapping one on a phone is the same test as
 * tapping it on the web client. The server is still the authority — the app
 * prefers `GET /api/scenarios` and only falls back to this list.
 */
export const CAPABILITIES = [
  {
    id: 'nearest-pfz',
    capability: 'Nearest Potential Fishing Zone',
    harborId: 'mumbai',
    questions: {
      'en-IN': 'Where is the nearest fishing zone from here?',
      'hi-IN': 'यहाँ से सबसे नज़दीक मछली पकड़ने का इलाका कहाँ है?',
      'mr-IN': 'इथून सर्वात जवळचा मासळी पकडण्याचा भाग कुठे आहे?',
      'gu-IN': 'અહીંથી સૌથી નજીકનો માછું પકડવાનો વિસ્તાર ક્યાં છે?',
      'kn-IN': 'ಇಲ್ಲಿಂದ ಹತ್ತಿರದ ಮೀನು ಹಿಡಿಯುವ ಪ್ರದೇಶ ಎಲ್ಲಿದೆ?',
      'ml-IN': 'ഇവിടെ നിന്ന് അടുത്തുള്ള മീൻ പിടിക്കുന്ന സ്ഥലം എവിടെയാണ്?',
      'te-IN': 'ఇక్కడ నుండి అతి దగ్గరి చేపలు పట్టే ప్రాంతం ఎక్కడ ఉంది?',
      'ta-IN': 'இங்கிருந்து மிக அருகிலுள்ள மீன் பிடிக்கும் இடம் எங்கே?',
      'bn-IN': 'এখান থেকে নিকটতম মাছ ধরার এলাকা কোথায়?',
      'or-IN': 'ଏଠାରୁ ନିକଟସ୍ତ ମାଛୁ ଧରିବା ଅଞ୍ଚଳ କେଉଁଠି?',
      'pa-IN': 'ਇੱਥੋਂ ਸਭ ਤੋਂ ਨੇੜੇ ਦਾ ਮੱਛੀ ਪਕੜਨ ਦਾ ਇਲਾਕਾ ਕਿੱਥੇ ਹੈ?',
    },
  },
  {
    id: 'safe-tomorrow',
    capability: 'Safe to venture tomorrow',
    harborId: 'kochi',
    questions: {
      'en-IN': 'Is it safe to go fishing tomorrow morning?',
      'hi-IN': 'क्या कल सुबह मछली पकड़ने जाना सुरक्षित है?',
      'mr-IN': 'उद्या सकाळी मासळी पकडण्यास जाणे सुरक्षित आहे का?',
      'gu-IN': 'કાલે સવારે માછું પકડવા જવું સુરક્ષિત છે?',
      'kn-IN': 'ನಾಳೆ ಬೆಳಗಿಗೆ ಮೀನು ಹಿಡಿಯಲು ಹೋಗುವುದು ಸುರಕ್ಷಿತವೇ?',
      'ml-IN': 'നാളെ രാവിലെ മീൻ പിടിക്കാൻ പോകുന്നത് സുരക്ഷിതമാണോ?',
      'te-IN': 'రేపు ఉదయం మత్స్య దుగ్గరకు వెళ్లడం సురక్షితమా?',
      'ta-IN': 'நாளை காலை மீன் பிடிக்கச் செல்வது பாதுகாப்பானதா?',
      'bn-IN': 'আগামীকাল সকালে মাছ ধরতে যাওয়া কি নিরাপদ?',
      'or-IN': 'ଆସନ୍ତାମାଣ ସକାଳେ ମାଛୁ ଧରିବାକୁ ଯାଇବିକ ସୁରକ୍ଷିତ କି?',
      'pa-IN': 'ਕੱਲ੍ਹ ਸਵੇਰੇ ਮੱਛੀ ਪਕੜਨ ਜਾਣਾ ਸੁਰੱਖਿਅਤ ਹੈ?',
    },
  },
  {
    id: 'tide-weather-sea',
    capability: 'Tide, weather and sea state at a location',
    harborId: 'mangaluru',
    questions: {
      'en-IN': 'What are the tide, weather and sea conditions near my fishing spot?',
      'hi-IN': 'मेरी मछली पकड़ने की जगह के पास ज्वार, मौसम और समुद्र की हालत क्या है?',
      'mr-IN': 'माझ्या मासळी पकडण्याच्या ठिकाणाजवळचा भरती, हवामान आणि समुद्राची स्थिती काय आहे?',
      'gu-IN': 'મારા માછ પકડવાની જગ્યા પાસે ભંટ, હવામાન અને દરિયાની હાલત શું છે?',
      'kn-IN': 'ನನ್ನ ಮೀನು ಹಿಡಿಯುವ ಸ್ಥಳದ ಹತ್ತಿರದ ಅಲೆ, ಹವಾಮಾನ ಮತ್ತು ಸಮುದ್ರದ ಸ್ಥಿತಿ ಏನು?',
      'ml-IN': 'എന്റെ മീൻ പിടിക്കുന്ന സ്ഥലത്തിനടുത്തുള്ള വേവൽ, കാലാസംപദ, കടൽ സ്ഥിതി എന്താണ്?',
      'te-IN': 'నా చేపలు పట్టే చోట దగ్గరి అలవు, వాతావరణం, సముద్ర పరిస్థితి ఏమిటి?',
      'ta-IN': 'என் மீன் பிடிக்கும் இடத்தின் அருகிலுள்ள அலை, வானிலை, கடல் நிலை என்ன?',
      'bn-IN': 'আমার মাছ ধরার জায়গার কাছে জোয়ার, আবহাওয়া ও সমুদ্রের অবস্থা কেমন?',
      'or-IN': 'ମୋ ମାଛୁ ଧରିବା ସ୍ଥାନର ନିକଟସ୍ତ ଜଳସ୍ତର, ପାଣିପାଗ ଓ ସମୁଦ୍ର ସ୍ଥିତି କେଣ?',
      'pa-IN': 'ਮੇਰੇ ਮੱਛੀ ਪਕੜਣ ਦੀ ਥਾਂ ਦੇ ਨੇੜੇ ਜਵਾਰ, ਮੌਸਮ ਅਤੇ ਸਮੁੰਦਰ ਦੀ ਹਾਲਤ ਕੀ ਹੈ?',
    },
  },
  {
    id: 'lightning-cyclone',
    capability: 'Lightning, squall and cyclone warnings',
    harborId: 'chennai',
    questions: {
      'en-IN': 'Is there any lightning, storm or cyclone warning for my coast?',
      'hi-IN': 'क्या मेरे तट पर बिजली, तूफ़ान या चक्रवात की चेतावनी है?',
      'mr-IN': 'माझ्या किनाऱ्यावर विजा, वादळ किंवा चक्रवाद्याचा इशारा आहे का?',
      'gu-IN': 'મારા દરિયા કિનારે વિજળી, તોફાન કે ચક્રવાતની ચેતવણી છે?',
      'kn-IN': 'ನನ್ನ ಕರಾವಳಿಗೆ ಮಿನುಗೆ, ಕುರುವಾಯ ಅಥವಾ ಚಕ್ರವರ್ತಿ ಎಚ್ಚರಿಕೆ ಇದೆಯೇ?',
      'ml-IN': 'എന്റെ തീരത്ത് മിന്നൽപേട്, കാറ്റയോ സൈക്ലോണ് മുന്നറിയിപ്പുണ്ടോ?',
      'te-IN': 'నా తీరంలో మెరుపు, తుఫాను లేదా సైక్లోన్ హెచ్చరిక ఉందా?',
      'ta-IN': 'என் கடற்கரையில் மின்னல், புயல் அல்லது சுழல் பற்றி எச்சரிக்கை உள்ளதா?',
      'bn-IN': 'আমার উপকূলে বিদ্যুৎ, ঝড় বা ঘূর্ণিঝড়ের সতর্কতা আছে কি?',
      'or-IN': 'ମୋ ଉକଳରେ ବିଦ୍ୟୁତ, ଝଡ଼ କିମ୍ବା ସାଇକ୍ଲୋନ ସତର୍କତା ଅଛି କି?',
      'pa-IN': 'ਕੀ ਮੇਰੇ ਤਟ ਤੇ ਬਿਜਲੀ, ਤੂਫਾਨ ਜਾਂ ਸਾਈਕਲੋਨ ਦੀ ਚੇਤਾਵਨੀ ਹੈ?',
    },
  },
  {
    id: 'chlorophyll-hotspots',
    capability: 'High chlorophyll and favourable SST regions',
    harborId: 'kochi',
    questions: {
      'en-IN': 'Where is the chlorophyll high and the sea surface temperature favourable?',
      'hi-IN': 'कहाँ क्लोरोफ़िल अधिक और समुद्री सतह का तापमान अनुकूल है?',
      'mr-IN': 'कुठे क्लोरोफिल जास्त आणि समुद्री पृष्ठभागाचे तापमान अनुकूल आहे?',
      'gu-IN': 'ક્યાં ક્લોરોફિલ વધુ અને દરિયાની સપાટીનું તાપમાન અનુકૂળ છે?',
      'kn-IN': 'ಎಲ್ಲಿ ಕ್ಲೋರೊಫಿಲ್ ಹೆಚ್ಚು ಮತ್ತು ಸಮುದ್ರ ಮೇಲ್ಮಟ್ಟದ ತಾಪಮಾನ ಸೂಕ್ತವಿದೆ?',
      'ml-IN': 'എവിടെയാണ് ക്ലോറോഫിൽ ഉയർന്നതും കടൽപ്രതലത്തിന്റെ താപനമായതും?',
      'te-IN': 'ఎక్కడ క్లోరోఫిల్ ఎక్కువగా ఉంది, సముద్ర ఉపరితల ఉష్ణోగ్రత అనుకూలంగా ఉంది?',
      'ta-IN': 'எங்கே பச்சையம் அதிகமாகவும் கடல் மேற்பரப்பு வெப்பநிலை ஏற்றதாகவும் உள்ளது?',
      'bn-IN': 'কোথায় ক্লোরোফিল বেশি এবং সমুদ্রপৃষ্ঠের তাপমাত্রা অনুকূল?',
      'or-IN': 'କେଉଁଠିରେ କ୍ଲୋରୋଫିଲ ଅଧିକ ଏବଂ ସମୁଦ୍ର ପୃଷ୍ଠର ତାପମାନ ଅନୁକୂଳ?',
      'pa-IN': 'ਕਿੱਥੇ ਕਲੋਰੋਫਿਲ ਵੱਧ ਹੈ ਅਤੇ ਸਮੁੰਦਰ ਸਤ੍ਹਾ ਦਾ ਤਾਪਮਾਨ ਅਨੁਕੂਲ ਹੈ?',
    },
  },
  {
    id: 'safest-route',
    capability: 'Safest route for a vessel',
    harborId: 'kochi',
    questions: {
      'en-IN': 'What is the safest route to reach the fishing zone?',
      'hi-IN': 'मछली पकड़ने के इलाके तक पहुँचने का सबसे सुरक्षित रास्ता कौन सा है?',
      'mr-IN': 'मासळी पकडण्याच्या भागापर्यंत पोहोचण्याचा सर्वात सुरक्षित मार्ग कोणता?',
      'gu-IN': 'માછ પકડવાના વિસ્તાર સુધી પહોંચવાનો સૌથી સુરક્ષિત માર્ગ કયો છે?',
      'kn-IN': 'ಮೀನು ಹಿಡಿಯುವ ಪ್ರದೇಶದವರೆಗೆ ತಲುಪಿಕೆಗೆ ಅತ್ಯಂತ ಸುರಕ್ಷಿತ ಮಾರ್ಗ ಯಾವುದು?',
      'ml-IN': 'മീൻ പിടിക്കുന്ന സ്ഥലം വരെ എത്താൻ ഏറ്റവും സുരക്ഷിതമായ വഴി ഏത്?',
      'te-IN': 'చేపల ప్రాంతానికి చేరుకోవడానికి అత్యంత సురక్షితమైన మార్గం ఏది?',
      'ta-IN': 'மீன் பிடிக்கும் இடத்தை அடைய எந்த பாத்த்தான் அதிகம் பாதுகாப்பானது?',
      'bn-IN': 'মাছ ধরার এলাকায় পৌঁছাতে সবচেয়ে নিরাপদ কোন পথ?',
      'or-IN': 'ମାଛୁ ଧରିବା ଅଞ୍ଚଳକୁ ପହଞ୍ଚିବାକୁ ସର୍ବନ୍ତମ ସୁରକ୍ଷିତ ପଥ କେଉଁଠି?',
      'pa-IN': 'ਮੱਛੀ ਪਕੜਣ ਦੇ ਇਲਾਕੇ ਤੱਕ ਪਹੁੰਚਣ ਦਾ ਸਭ ਤੋਂ ਸੁਰੱਖਿਅਤ ਰਾਹ ਕੌਣ ਸੀ?',
    },
  },
  {
    id: 'productivity-decline',
    capability: 'Why fish productivity declined',
    harborId: 'vizag',
    questions: {
      'en-IN': 'Why has fish productivity declined in my harbour?',
      'hi-IN': 'मेरे बंदरगाह में मछली की उत्पादन क्यों घटी है?',
      'mr-IN': 'माझ्या बंदरात मासळीची उत्पादनता का कमी झाली आहे?',
      'gu-IN': 'મારા બંદરમાં માછની ઉત્પાદકતા કેમ ઘટી છે?',
      'kn-IN': 'ನನ್ನ ರಂಭದ ಮೀನು ಉತ್ಪಾದಕತೆ ಏಕೆ ಕಡಿಮೆಯಾಗಿದೆ?',
      'ml-IN': 'എന്റെ തുറമുഖത്ത് മീൻ ഉൽപാദന എന്തുകൊണ്ട് കുറഞ്ഞു?',
      'te-IN': 'నా రేవలో చేపల ఉత్పత్తి శక్తి ఎందుకు తగ్గింది?',
      'ta-IN': 'என் துறையில் மீன் உற்பத்தி ஏன் குறைந்துள்ளது?',
      'bn-IN': 'আমার বন্দরে মাছের উৎপাদন কেন কমেছে?',
      'or-IN': 'ମୋ ବଣ୍ଟରରେ ମାଛୁ ଉତ୍ପାଦନା କାହିଁକି କମିଛି?',
      'pa-IN': 'ਮੇਰੇ ਬੰਦਰਗਾਹ ਵਿੱਚ ਮੱਛੀ ਦੀ ਉਤਪਾਦਕਤਾ ਕਿਉਂ ਘਟੀ?',
    },
  },
  {
    id: 'avoid-zones',
    capability: 'Zones to avoid — hazards and geofencing',
    harborId: 'mumbai',
    questions: {
      'en-IN': 'Which zones should I avoid before going out to sea?',
      'hi-IN': 'समुद्र में जाने से पहले मुझे किन इलाकों से बचना चाहिए?',
      'mr-IN': 'समुद्रात जाण्यापूर्वी मला कोणत्या भागांमधून वाळणे आहे?',
      'gu-IN': 'समુદરમાં જાય પહેલાં મારે કઈ વિસ્તારોથી બચવું પડશે?',
      'kn-IN': 'ಸಮುದ್ರಕ್ಕೆ ಹೋಗುವ ಮೊದಲು ನಾನು ಯಾವ ಪ್ರದೇಶಗಳಿಂದ ದೂರ ಉಳಿಯಬೇಕು?',
      'ml-IN': 'കടലിൽ പോകുന്നതിന് മുമ്പ് ഞാൻ ഏത് സ്ഥലങ്ങളിൽ നിന്ന് വഴിയേറ്റവുന്നില്ല?',
      'te-IN': 'సముద్రానికి వెళ్లే ముందు నేను ఏ ప్రాంతాల నుండి నివారించుకోవాలి?',
      'ta-IN': 'கடலுக்குச் செல்லும் முன் நான் எந்தப் பகுதிகளைத் தவிர்க்க வேண்டும்?',
      'bn-IN': 'সমুদ্রে যাওয়ার আগে আমি কোন এলাকা এড়িয়ে চলব?',
      'or-IN': 'ସମୁଦ୍ରକୁ ଯାବା ପୂର୍ବରୁ ମୁଁ କେଉଁ ଅଞ୍ଚଳରୁ ବର୍ତ୍ତନେ କରିବି?',
      'pa-IN': 'ਸਮੁੰਦਰ ਵਿੱਚ ਜਾਣ ਤੋਂ ਪਹਿਲਾਂ ਮੈਂ ਕਿਹੜੇ ਖੇਤਰਾਂ ਤੋਂ ਬਚਣਾ ਚਾਹੀਦਾ ਹਾਂ?',
    },
  },
];

/** A chip label short enough for a phone row, per language. */
export const CAPABILITY_LABELS = {
  'en-IN': [
    'Nearest fishing zone',
    'Safe tomorrow?',
    'Tide & sea state',
    'Storm & cyclone',
    'Chlorophyll fronts',
    'Safest route',
    'Productivity drop',
    'Zones to avoid',
  ],
  'hi-IN': [
    'नज़दीक मछली क्षेत्र',
    'कल सुरक्षित?',
    'ज्वार और समुद्र',
    'तूफ़ान और चक्रवात',
    'क्लोरोफ़िल मोर्च',
    'सबसे सुरक्षित रास्ता',
    'उत्पादन क्यों घटा',
    'किन इलाकों से बचें',
  ],
  'ta-IN': [
    'அருகிலுள்ள மீன் பகுதி',
    'நாளை பாதுகாப்பா?',
    'அலை & கடல் நிலை',
    'புயல் & சுழல்',
    'பச்சைய முனைகள்',
    'பாதுகாப்பான வழி',
    'உற்பத்தி குறைவு',
    'தவிர்க்க வேண்டிய பகுதிகள்',
  ],
  'bn-IN': [
    'নিকটতম মাছের এলাকা',
    'আগামীকাল নিরাপদ?',
    'জোয়ার ও সমুদ্র',
    'ঝড় ও ঘূর্ণিঝড়',
    'ক্লোরোফিল ফ্রন্ট',
    'সবচেয়ে নিরাপদ পথ',
    'উৎপাদন হ্রাস',
    'যেসব এলাকা এড়াবেন',
  ],
  'ml-IN': [
    'അടുത്തുള്ള മീൻ പ്രദേശം',
    'നാളേ സുരക്ഷിതമോ?',
    'വേവൽ & കടൽ സ്ഥിതി',
    'കാറ്റ് & സൈക്ക്ലോൺ',
    'ക്ലോറോഫിൽ ഫ്രണ്ട്',
    'ഏറ്റവും സുരക്ഷിത വഴി',
    'ഉൽപാദന കുറവ്',
    'ഒഴിഞ്ഞ വേണ്ട സ്ഥലങ്ങൾ',
  ],
};

/** English fallback when a language has no hand-written short labels. */
export const labelFor = (index, language) =>
  CAPABILITY_LABELS[language]?.[index] ?? CAPABILITY_LABELS['en-IN'][index];

/**
 * The greeting shown before the first question.
 *
 * The engine writes its own localised introduction, so this is only what the
 * chat shows while the screen is empty and nothing has been asked yet.
 */
export const INTRO = {
  'en-IN':
    'I am ORCA, your marine decision assistant. Ask me about fishing zones, tides, weather, the sea state, routes, warnings or why the catch has fallen — in any of 11 Indian languages. I show my reasoning and the sources behind every answer.',
  'hi-IN':
    'मैं ORCA हूँ, आपका समुद्री निर्णय सहायक। मछली पकड़ने के इलाके, ज्वार, मौसम, समुद्र की हालत, मार्ग या चेतावनियों के बारे में पूछिए — 11 भारतीय भाषाओं में। हर उत्तर में मैं अपना तर्क और स्रोत दिखाता हूँ।',
  'ta-IN':
    'நான் ORCA, உங்கள் கடல் முடிவு உதவியாளர். மீன் பிடிக்கும் இடங்கள், அலை, வானிலை, கடல் நிலை, வழிகள் அல்லது எச்சரிக்கைகள் பற்றி கேளுங்கள் — 11 இந்திய மொழிகளில். ஒவ்வொரு பதிலிலும் என் சிந்தனையையும் ஆதாரங்களையும் காட்டுகிறேன்.',
  'bn-IN':
    'আমি ORCA, আপনার সামুদ্রিক সিদ্ধান্ত সহায়ক। মাছ ধরার এলাকা, জোয়ার, আবহাওয়া, সমুদ্রের অবস্থা, পথ বা সতর্কতা নিয়ে জিজ্ঞাসা করুন — ১১টি ভারতীয় ভাষায়। প্রতিটি উত্তরে আমি যুক্তি ও উৎস দেখাই।',
  'ml-IN':
    'ഞാൻ ORCA, നിങ്ങളുടെ കടൽ തീരുമാന സഹായി. മീൻ പിടിക്കുന്ന സ്ഥലങ്ങൾ, വേവൽ, കാലാസംപദം, കടൽ സ്ഥിതി, വഴികള് അല്ലെങ്കില് അറിയിപ്പുകള് എന്നിവയെക്കുറിച്ച് ചോദിക്കൂ — 11 ഇന്ത്യൻ ഭാഷകളിൽ. ഓരോ ഉത്തരത്തിലും എന്റെ ചിന്തനയും സൂത്രങ്ങളും കാണിക്കാം.',
};
