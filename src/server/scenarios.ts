/**
 * The eight canonical capabilities from the problem statement, expressed as
 * real questions in eleven Indian languages.
 *
 * These are not demo-scripted answers. Each entry is fed straight into the
 * same `orchestrate()` pipeline a user's message goes through, which is what
 * makes them a genuine acceptance test: if the intent lexicons, the planner
 * roster or the phrasebook regress in any language, the scenario stops
 * selecting the right agents and the demo makes that obvious.
 *
 * The numbers, units and place names inside the questions are deliberately
 * language-neutral, exactly as a fisher would speak them.
 */

import { LanguageCode } from '../types';

export interface ScenarioTranslation {
  language: LanguageCode;
  text: string;
}

export interface Scenario {
  id: string;
  /** Which requirement from the problem statement this exercises. */
  capability: string;
  intent: string;
  /** Harbour the question is asked from, for a reproducible answer. */
  harborId: string;
  translations: ScenarioTranslation[];
}

export const CANONICAL_SCENARIOS: Scenario[] = [
  /* 1 ------------------------------------------------------------ */
  {
    id: 'nearest-pfz',
    capability: 'Potential Fishing Zone discovery',
    intent: 'FIND_PFZ',
    harborId: 'mumbai',
    translations: [
      { language: 'en-IN', text: 'Where is the nearest fishing zone from here?' },
      { language: 'hi-IN', text: 'यहाँ से निकटतम मत्स्य क्षेत्र कहाँ है?' },
      { language: 'mr-IN', text: 'इथून सर्वात जवळचे मासेमारी क्षेत्र कुठे आहे?' },
      { language: 'ta-IN', text: 'இங்கிருந்து அருகிலுள்ள மீன் பிடிக்கும் பகுதி எங்கே உள்ளது?' },
      { language: 'te-IN', text: 'ఇక్కడి నుండి అత్యంత దగ్గరి మత్స్య ప్రాంతం ఎక్కడ ఉంది?' },
      { language: 'bn-IN', text: 'এখান থেকে নিকটতম মাছ ধরার এলাকা কোথায়?' },
      { language: 'kn-IN', text: 'ಇಲ್ಲಿನಿಂದ ಅತ್ಯಂತ ಹತ್ತಿರದ ಮೀನು ಮತ್ತೆಲೆ ಎಲ್ಲಿದೆ?' },
      { language: 'gu-IN', text: 'અહીંથી નજીકનો માછ લાવવાનો વિસ્તાર ક્યાં છે?' },
      { language: 'ml-IN', text: 'ഇവിടെന്ന് അടുത്ത മീൻ പിടിക്കുന്ന സ്ഥലം എവിടെയാണ്?' },
      { language: 'pa-IN', text: 'ਇੱਥੋਂ ਸਭ ਤੋਂ ਨੇੜਲਾ ਮੱਛ ਪਕੜਣ ਖੇਤਰ ਕਿੱਥੇ ਹੈ?' },
      { language: 'or-IN', text: 'ଏଠାରୁ ନିକଟସ୍ତ ମାଛୁ ଧରିବା ଅଞ୍ଚଳ କେଉଁଥିରେ?' },
    ],
  },

  /* 2 ------------------------------------------------------------ */
  {
    id: 'safe-tomorrow',
    capability: 'Go / no-go safety assessment',
    intent: 'SAFETY_ASSESSMENT',
    harborId: 'mumbai',
    translations: [
      { language: 'en-IN', text: 'Is it safe to go fishing tomorrow morning?' },
      { language: 'hi-IN', text: 'क्या कल सुबह मछली पकड़ने जाना सुरक्षित है?' },
      { language: 'mr-IN', text: 'उद्या सकाळी मासेमारीसाठी जाणे सुरक्षित आहे का?' },
      { language: 'ta-IN', text: 'நாளை காலை மீன் பிடிக்கச் செல்வது பாதுகாப்பா?' },
      { language: 'te-IN', text: 'రేపు ఉదయం మత్స్యం పట్టుకోవడానికి వెళ్లడం సురక్షితమా?' },
      { language: 'bn-IN', text: 'আগামীকাল সকালে মাছ ধরতে যাওয়া কি নিরাপদ?' },
      { language: 'kn-IN', text: 'ನಾಳೆ ಬೆಳಗ್ಗೆ ಮೀನು ಮೀನಿಗೆ ಹೋಗುವುದು ಸುರಕ್ಷಿತವೇ?' },
      { language: 'gu-IN', text: 'કાલે સવારે માછ પકડવા જવું સુરક્ષિત છે?' },
      { language: 'ml-IN', text: 'നാളെ രാവിലെ മീൻ പിടിക്കാൻ പോകുക സുരക്ഷിതമാണോ?' },
      { language: 'pa-IN', text: 'ਕੱਲ੍ਹ ਸਵੇਰੇ ਮੱਛ ਪਕੜਨ ਜਾਣਾ ਸੁਰੱਖਿਅਤ ਹੈ?' },
      { language: 'or-IN', text: 'ଆସନ୍ତାମା ସକାଲେ ମାଛ ଧରିବାକୁ ଯାଇବା ସୁରକ୍ଷିତ କି?' },
    ],
  },

  /* 3 ------------------------------------------------------------ */
  {
    id: 'tide-weather-sea',
    capability: 'Correlated tide + weather + sea state',
    intent: 'TIDE_WEATHER_SEA',
    harborId: 'mumbai',
    translations: [
      {
        language: 'en-IN',
        text: 'What are the tide, weather and sea conditions near the fishing ground?',
      },
      {
        language: 'hi-IN',
        text: 'मछली पकड़ने की जगह के पास ज्वार, मौसम और समुद्र की हालत क्या है?',
      },
      {
        language: 'mr-IN',
        text: 'मासेमारीच्या ठिकाणाजवळचा ज्वार, हवामान आणि समुद्राची स्थिती काय आहे?',
      },
      {
        language: 'ta-IN',
        text: 'மீன் பிடிக்கும் இடத்தை அருகில் எந்த நிலை, வானிலை மற்றும் கடல் நிலை என்ன?',
      },
      {
        language: 'te-IN',
        text: 'మత్స్య ప్రాంతం దగ్గర ఉదయం, వాతావరణం మరియు సముద్ర పరిస్థితి ఏమిటి?',
      },
      {
        language: 'bn-IN',
        text: 'মাছ ধরার জায়গার কাছে জোয়ার, আবহাওয়া ও সমুদ্রের অবস্থা কেমন?',
      },
      {
        language: 'kn-IN',
        text: 'ಮೀನು ಮೀನಿಗೆ ಸ್ಥಳದ ಹತ್ತಿರದ ಉಬ್ಬರ, ಹವಾಮಾನ ಮತ್ತು ಸಮುದ್ರ ಸ್ಥಿತಿ ಏನು?',
      },
      {
        language: 'gu-IN',
        text: 'માછ પકડવાની જગ્યા નજીક જ્વાર, હવામાન અને સમુદ્રની હાલત શું છે?',
      },
      {
        language: 'ml-IN',
        text: 'മീൻ പിടിക്കുന്ന സ്ഥലത്തിനരികിയിലെ ഉദയം, കാലാസഥി, കടൽ നില എന്താണ്?',
      },
      {
        language: 'pa-IN',
        text: 'ਮੱਛ ਪਕੜਨ ਥਾਂ ਦੇ ਨੇੜੇ ਜਵਾਰ, ਮੌਸਮ ਅਤੇ ਸਮੁੰਦਰ ਦੀ ਹਾਲਤ ਕੀ ਹੈ?',
      },
      {
        language: 'or-IN',
        text: 'ମାଛ ଧରିବା ସ୍ଥାନ ନିକଟରେ ଜୋଆର, ପାଣିପାଣି ଓ ସମୁଦ୍ର ସ୍ଥିତି କ\'ଣ?',
      },
    ],
  },

  /* 4 ------------------------------------------------------------ */
  {
    id: 'lightning-cyclone',
    capability: 'Lightning / cyclone / squall alerting',
    intent: 'HAZARD_ALERTS',
    harborId: 'mumbai',
    translations: [
      { language: 'en-IN', text: 'Is there any lightning or cyclone warning for my coast?' },
      { language: 'hi-IN', text: 'क्या मेरे तट पर बिजली या चक्रवात की चेतावनी है?' },
      { language: 'mr-IN', text: 'माझ्या किनाऱ्यावर विजा किंवा चक्रवाताचा इशारा आहे का?' },
      {
        language: 'ta-IN',
        text: 'என் கடற்கரைக்கு மின்னல் அல்லது சுழியுநாக்கம் எச்சரிக்கை உள்ளதா?',
      },
      { language: 'te-IN', text: 'నా తీరానికి మెరుపు లేదా తుఫాను హెచ్చరిక ఉందా?' },
      { language: 'bn-IN', text: 'আমার উপকূলে বজ্রপাত বা ঘূর্ণিঝড়ের সতর্কতা আছে কি?' },
      {
        language: 'kn-IN',
        text: 'ನನ್ನ ಕರಾವಳಿಗೆ ಮಿನುಗೆ ಅಥವಾ ಚಕ್ರವರ್ತಿ ಎಚ್ಚರಿಕೆ ಇದೆಯೇ?',
      },
      { language: 'gu-IN', text: 'મારા કિનારે વીજળી કે ચક્રવાતની ચેતવણી છે?' },
      { language: 'ml-IN', text: 'എന്റെ തീരത്ത് പെട്ടിന്നതോ ചുറ്റലോ അറിയിപ്പുകളുണ്ടോ?' },
      {
        language: 'pa-IN',
        text: 'ਕੀ ਮੇਰੀ ਤਟ ਤੇ ਬਿਜਲੀ ਜਾਂ ਚੱਕਰਵਾਤ ਦੀ ਚੇਤਾਵਨੀ ਹੈ?',
      },
      {
        language: 'or-IN',
        text: 'ମୋ କୂଳରେ ବିଦ୍ୟୁତ୍ କିମ୍ବା ବାତ୍ୟାସ ଚେତାବନୀ ଅଛି କି?',
      },
    ],
  },

  /* 5 ------------------------------------------------------------ */
  {
    id: 'chlorophyll-hotspots',
    capability: 'High chlorophyll + favourable SST region search',
    intent: 'PFZ_HOTSPOTS',
    harborId: 'mangaluru',
    translations: [
      {
        language: 'en-IN',
        text: 'Where is chlorophyll high and sea surface temperature favourable for fishing?',
      },
      {
        language: 'hi-IN',
        text: 'कहाँ क्लोरोफिल अधिक है और समुद्री सतह का तापमान मछली पकड़ने के लिए अनुकूल है?',
      },
      {
        language: 'mr-IN',
        text: 'कुठे क्लोरोफिल जास्त आहे आणि समुद्राच्या पृष्ठभागाचा तापमान मासेमारीसाठी अनुकूल आहे?',
      },
      {
        language: 'ta-IN',
        text: 'எங்கே பச்சையம் அதிகமாகவும் கடல் மேற்பரப்பு வெப்பநிலை மீன்பிடிக்க ஏற்றதாகவும் உள்ளது?',
      },
      {
        language: 'te-IN',
        text: 'ఎక్కడ క్లోరోఫిల్ ఎక్కువగా ఉంది, సముద్ర పృష్ఠతల ఉష్ణోగ్రత మత్స్య పట్టుకోవడానికి అనుకూలంగా ఉంది?',
      },
      {
        language: 'bn-IN',
        text: 'কোথায় ক্লোরোফিল বেশি এবং সমুদ্রপৃষ্ঠের তাপমাত্রা মাছ ধরার জন্য উপযোগী?',
      },
      {
        language: 'kn-IN',
        text: 'ಎಲ್ಲಿ ಹಸಿರು ಹೆಚ್ಚು ಮತ್ತು ಸಮುದ್ರ ಮೇಲ್ಮೈ ಉಷ್ಣತೆ ಮೀನು ಮೀನಿಗೆ ಸೂಕ್ತವಾಗಿದೆ?',
      },
      {
        language: 'gu-IN',
        text: 'ક્યાં ક્લોરોફિલ વધુ છે અને સમુદ્રની સપાટીનો તાપમાન માછ પકડવા માટે અનુકૂળ છે?',
      },
      {
        language: 'ml-IN',
        text: 'എവിടെയാണ് ക്ലോറോഫിൽ ഉയർന്നതും കടൽ ഉപരിപ്പല താപനം മീൻ പിടിക്കാൻ അനുയോഗ്യവും?',
      },
      {
        language: 'pa-IN',
        text: 'ਕਿੱਥੇ ਕਲੋਰੋਫਿਲ ਵੱਧ ਹੈ ਅਤੇ ਸਮੁੰਦਰ ਦੀ ਸਤ੍ਹਾ ਦੀ ਤਾਪਮਾਨ ਮੱਛ ਪਕੜਨ ਲਈ ਢੁਕਵਾਂ ਹੈ?',
      },
      {
        language: 'or-IN',
        text: 'କେଉଁଥିରେ କ୍ଲୋରୋଫିଲ ଅଧିକ ଏବଂ ସମୁଦ୍ର ପୃଷ୍ଠର ତାପମାନ ମାଛ ଧରିବାକୁ ଉପଯୁକ୍ତ?',
      },
    ],
  },

  /* 6 ------------------------------------------------------------ */
  {
    id: 'safest-route',
    capability: 'Vessel-aware route optimisation',
    intent: 'SAFE_ROUTE',
    harborId: 'mumbai',
    translations: [
      {
        language: 'en-IN',
        text: 'What is the safest route for my country boat to reach the fishing zone?',
      },
      {
        language: 'hi-IN',
        text: 'मछली पकड़ने की जगह तक मेरी नाव के लिए सबसे सुरक्षित मार्ग कौन सा है?',
      },
      {
        language: 'mr-IN',
        text: 'मासेमारीच्या ठिकाणापर्यंत माझ्या नावेसाठी सर्वात सुरक्षित मार्ग कोणता आहे?',
      },
      {
        language: 'ta-IN',
        text: 'மீன் பிடிக்கும் இடத்தை அடைய என் படகிற்கான மிகவும் பாதுகாப்பான பாதை எது?',
      },
      {
        language: 'te-IN',
        text: 'మత్స్య ప్రాంతాన్ని చేరుకోవడానికి నా దొక్క చోట్లకు అత్యంత సురక్షితమైన మార్గం ఏది?',
      },
      {
        language: 'bn-IN',
        text: 'মাছ ধরার জায়গায় পৌঁছাতে আমার নৌকার জন্য সবচেয়ে নিরাপদ পথ কোনটি?',
      },
      {
        language: 'kn-IN',
        text: 'ಮೀನು ಮೀನಿಗೆ ತಲುಪಿಕೊಳ್ಳಲು ನನ್ನ ದೋಣಿಗೆ ಅತ್ಯಂತ ಸುರಕ್ಷಿತ ಮಾರ್ಗವೇನು?',
      },
      {
        language: 'gu-IN',
        text: 'માછ પકડવાની જગ્યા સુધી મારી નૌકા માટે સૌથી સુરક્ષિત માર્ગ કયો છે?',
      },
      {
        language: 'ml-IN',
        text: 'മീൻ പിടിക്കുന്ന സ്ഥലത്തേക്ക് എന്റെ തോണിക്ക് ഏറ്റവും സുരക്ഷിതമായ വഴി ഏതുകൊണ്ട്?',
      },
      {
        language: 'pa-IN',
        text: 'ਮੱਛ ਪਕੜਨ ਥਾਂ ਤੱਕ ਮੇਰੀ ਡੰਗੀ ਲਈ ਸਭ ਤੋਂ ਸੁਰੱਖਿਅਤ ਰਾਹ ਕਿਹੜਾ ਹੈ?',
      },
      {
        language: 'or-IN',
        text: 'ମାଛ ଧରିବା ସ୍ଥାନ ପର୍ଯ୍ୟନ୍ତ ମୋ ନାଓକା ପାଇଁ ସବୁତମାନ ସୁରକ୍ଷିତ ପଥ କେଉଁଟି?',
      },
    ],
  },

  /* 7 ------------------------------------------------------------ */
  {
    id: 'productivity-decline',
    capability: 'Historical productivity diagnosis',
    intent: 'PRODUCTIVITY_DIAGNOSIS',
    harborId: 'kochi',
    translations: [
      { language: 'en-IN', text: 'Why has fish productivity declined in my harbour?' },
      { language: 'hi-IN', text: 'मेरे बंदरगाह में मछली उत्पादन क्यों घटा है?' },
      { language: 'mr-IN', text: 'माझ्या बंदरात मासेमारीचे उत्पादन का घटले आहे?' },
      { language: 'ta-IN', text: 'என் துறையில் மீன் உற்பத்தி ஏன் குறைந்துள்ளது?' },
      { language: 'te-IN', text: 'నా నగరంలో చేపల ఉత్పత్తి ఎందుకు తగ్గింది?' },
      { language: 'bn-IN', text: 'আমার বন্দরে মাছের উৎপাদন কেন কমেছে?' },
      { language: 'kn-IN', text: 'ನನ್ನ ರಂಭದಲ್ಲಿ ಮೀನಿನ ಉತ್ಪಾದನೆ ಏಕೆ ಕಡಿಮೆಯಾಗಿದೆ?' },
      { language: 'gu-IN', text: 'મારા બંદરમાં માછનું ઉત્પાદન કેમ ઘટ્યું છે?' },
      { language: 'ml-IN', text: 'എന്റെ തുറത്തിൽ മീൻ ഉൽപാദനം എന്തുകൊണ്ട് കുറഞ്ഞു?' },
      { language: 'pa-IN', text: 'ਮੇਰੇ ਬੰਦਰ ਵਿੱਚ ਮੱਛ ਦੀ ਉਤਪਾਦਨਾ ਕਿਉਂ ਘਟੀ ਹੈ?' },
      { language: 'or-IN', text: 'ମୋ ବଣ୍ଦରରେ ମାଛ ଉତ୍ପାଦନ କାହିଁକି କମିଗଲା?' },
    ],
  },

  /* 8 ------------------------------------------------------------ */
  {
    id: 'avoid-zones',
    capability: 'Hazard + geofencing exclusion advice',
    intent: 'AVOID_ZONES',
    harborId: 'kochi',
    translations: [
      {
        language: 'en-IN',
        text: 'Which zones should I avoid while fishing, and are there any restricted waters?',
      },
      {
        language: 'hi-IN',
        text: 'मछली पकड़ते समय मुझे किन क्षेत्रों से बचना चाहिए, और क्या कोई प्रतिबंधित जल क्षेत्र है?',
      },
      {
        language: 'mr-IN',
        text: 'मासेमारी करताना कोणत्या भागांतून टाळणे आवश्यक आहे, आणि प्रतिबंधित जलक्षेत्र आहेत का?',
      },
      {
        language: 'ta-IN',
        text: 'மீன் பிடிக்கும்போது எந்த பகுதிகளைத் தவிர்க்க வேண்டும், மற்றும் கட்டுப்படுத்தப்பட்ட நீர்ப்பகுதிகள் உள்ளனவா?',
      },
      {
        language: 'te-IN',
        text: 'మత్స్య పట్టుకుంటున్నప్పుడు ఏ ప్రాంతాలను నివారించాలి, మరియు నియంత్రించిన నీటి ప్రాంతాలు ఉన్నాయా?',
      },
      {
        language: 'bn-IN',
        text: 'মাছ ধরার সময় কোন কোন এলাকা এড়িয়ে চলা উচিত, এবং সীমাবদ্ধ জলাঞ্চল আছে কি?',
      },
      {
        language: 'kn-IN',
        text: 'ಮೀನು ಮೀನಿಗೆ ಮಾಡುವಾಗ ಯಾವ ಪ್ರದೇಶಗಳನ್ನು ತಪ್ಪಿಸಬೇಕು, ಮತ್ತು ಸೀಮಿತ ಜಲಪ್ರದೇಶಗಳಿವೆಯೇ?',
      },
      {
        language: 'gu-IN',
        text: 'માછ પકડતી વખતે કઈ વિસ્તારો ટાળવા જોઈએ, અને પ્રતિબંધિત જળ વિસ્તાર છે?',
      },
      {
        language: 'ml-IN',
        text: 'മീൻ പിടിക്കുമ്പോഴ് ഏ മേഖലകൾ ഒഴിവാക്കണം, നിയന്ത്രിത ജലമേഖലകൾ ഉണ്ടോ?',
      },
      {
        language: 'pa-IN',
        text: 'ਮੱਛ ਪਕੜਦੇ ਹੋਏ ਕਿਹੜੇ ਖੇਤਰ ਟਾਲਣੇ ਚਾਹੀਦੇ ਹਨ, ਅਤੇ ਕੀ ਪਾਬੰਦੀਸ਼ੁਦਾ ਜਲ ਖੇਤਰ ਹਨ?',
      },
      {
        language: 'or-IN',
        text: 'ମାଛ ଧରୁଥିବା ସମୟରେ କେଉଁଥି ଅଞ୍ଚଳ ଏଡ଼ାଇବା ଉଚିତ, ଏବଂ ପ୍ରତିବନ୍ଧିତ ଜଳ ଅଞ୍ଚଳ ଅଛି କି?',
      },
    ],
  },
];

/** Flattened view: one row per (scenario, language) pair. */
export function allScenarioQuestions(language?: LanguageCode): Array<{
  scenarioId: string;
  capability: string;
  intent: string;
  harborId: string;
  language: LanguageCode;
  text: string;
}> {
  const rows: Array<{
    scenarioId: string;
    capability: string;
    intent: string;
    harborId: string;
    language: LanguageCode;
    text: string;
  }> = [];

  for (const scenario of CANONICAL_SCENARIOS) {
    for (const t of scenario.translations) {
      if (language && t.language !== language) continue;
      rows.push({
        scenarioId: scenario.id,
        capability: scenario.capability,
        intent: scenario.intent,
        harborId: scenario.harborId,
        language: t.language,
        text: t.text,
      });
    }
  }

  return rows;
}
