/**
 * Multilingual intent grammar.
 *
 * ORCA has to understand a fisherman's question in any of the eleven supported
 * Indian languages before a single agent runs. This module is that front door:
 * it maps a raw utterance onto a canonical `IntentType`, a `TimeHorizon`, and a
 * set of resolved slots (harbour, vessel, referent).
 *
 * Design notes
 * ------------
 *  - Matching is n-gram based over a normalised token stream, so Indic scripts
 *    and Romanised input go through exactly the same code path. Substring
 *    matching was rejected because it produced false positives such as the
 *    Marathi "मास" inside "मासळी".
 *  - Every lexicon carries native-script *and* Romanised variants. A user who
 *    types `kochi` and a user who types `കൊച്ചി` are the same intent.
 *  - Nothing here touches the network or the filesystem, so the module is safe
 *    to import from the browser bundle as well as the Express server.
 */

import {
  ConversationMemory,
  HarborLocation,
  LanguageCode,
  TimeHorizon,
} from '../types';
import { HARBORS, VESSEL_PROFILES, DEFAULT_VESSEL_ID } from './dataset';
import { detectLanguage, LanguageDetection } from './language';

/* ------------------------------------------------------------------ *
 * Canonical intents
 * ------------------------------------------------------------------ */

export type IntentType =
  /** "Where is the nearest fishing ground from here?" */
  | 'FIND_PFZ'
  /** "Which areas show high chlorophyll and favourable SST?" */
  | 'PFZ_HOTSPOTS'
  /** "Is it safe to venture tomorrow?" */
  | 'SAFETY_ASSESSMENT'
  /** "How are the tide, weather and sea near my landing centre?" */
  | 'TIDE_WEATHER_SEA'
  /** "Any cyclone / lightning / high-wave warnings?" */
  | 'HAZARD_ALERTS'
  /** "What is the safest route from Kochi to a fishing zone?" */
  | 'SAFE_ROUTE'
  /** "Why did fish productivity decline in this region?" */
  | 'PRODUCTIVITY_DIAGNOSIS'
  /** "Which zones should I avoid?" */
  | 'AVOID_ZONES'
  /** "Am I near a marine protected area or a boundary?" */
  | 'GEOFENCE_PROXIMITY'
  /** "How rough is the sea / how big are the waves?" */
  | 'OCEAN_STATE'
  /** "What is the weather going to do?" */
  | 'WEATHER_BRIEF'
  /** Fallback: answer with the full local marine picture. */
  | 'GENERAL_MARINE';

export const INTENT_CATALOG: Record<IntentType, { label: string; agents: string[] }> = {
  FIND_PFZ: { label: 'Locate nearest fishing ground', agents: ['GIS', 'PFZ', 'OCEAN'] },
  PFZ_HOTSPOTS: { label: 'Rank chlorophyll / SST hotspots', agents: ['PFZ', 'OCEAN', 'HISTORICAL'] },
  SAFETY_ASSESSMENT: { label: 'Go / no-go safety verdict', agents: ['WEATHER', 'OCEAN', 'TIDE', 'ALERT', 'RISK'] },
  TIDE_WEATHER_SEA: { label: 'Tide, weather and sea state brief', agents: ['TIDE', 'WEATHER', 'OCEAN'] },
  HAZARD_ALERTS: { label: 'Marine hazard advisories', agents: ['ALERT', 'WEATHER', 'OCEAN'] },
  SAFE_ROUTE: { label: 'Safest navigation corridor', agents: ['GIS', 'ROUTE', 'GEOFENCING', 'ALERT'] },
  PRODUCTIVITY_DIAGNOSIS: { label: 'Historical productivity diagnosis', agents: ['HISTORICAL', 'PFZ', 'OCEAN'] },
  AVOID_ZONES: { label: 'Restricted and hazard zones to avoid', agents: ['GEOFENCING', 'ALERT', 'GIS'] },
  GEOFENCE_PROXIMITY: { label: 'Boundary / MPA proximity check', agents: ['GEOFENCING', 'GIS'] },
  OCEAN_STATE: { label: 'Wave, swell and current state', agents: ['OCEAN', 'WEATHER'] },
  WEATHER_BRIEF: { label: 'Coastal weather forecast', agents: ['WEATHER', 'OCEAN'] },
  GENERAL_MARINE: { label: 'Full marine situation report', agents: ['WEATHER', 'OCEAN', 'TIDE', 'ALERT', 'PFZ'] },
};

/* ------------------------------------------------------------------ *
 * Lexicons
 * ------------------------------------------------------------------ */

/** A lexicon entry: the surface forms, and how strongly each implies the intent. */
interface Lexicon {
  terms: string[];
  weight: number;
}

const L = (weight: number, terms: string[]): Lexicon => ({ terms, weight });

/**
 * Domain vocabulary. Ordered strong → weak inside each intent.
 *
 * The first intent in each list that outscores the rest wins, so the more
 * specific questions (route, geofence) must be able to outrank the general
 * marine words ("sea", "fish") — hence the higher weights.
 */
const LEXICONS: Record<Exclude<IntentType, 'GENERAL_MARINE'>, Lexicon[]> = {
  SAFE_ROUTE: [
    L(3, [
      'safest route', 'safe route', 'best route', 'shortest route', 'route path',
      'navigation route', 'route planning', 'avoid the route', 'plan a route',
      'सुरक्षित मार्ग', 'सबसे सुरक्षित रास्ता', 'मार्ग बताओ', 'रास्ता बताएं', 'कौन सा रास्जा',
      'सर्वात सुरक्षित मार्ग', 'मार्ग कसा', 'वाट कौनसा', 'नौका कैसे चलाएं',
      'સૌથી સુરક્ષિત માર્ગ', 'માર્ગ આપો', 'કઈ રીતે', 'નાવ કેવી રીતે',
      'ಸುರಕ್ಷಿತ ಮಾರ್ಗ', 'ಮಾರ್ಗ ತೋರಿಸು', 'ಯಾ ದಾರಿ', 'ಹಳ್ಳೆ ಹೇಗೆ ಸಾಗುತ್ತದೆ',
      'സുരക്ഷിത വഴി', 'വഴി പറയുക', 'ഏത് വഴി', 'വള്ളം എങ്ങനെ',
      'సురక్షిత మార్గం', 'మార్గం చెప్పండి', 'ఏ మార్గం', 'ఓడ ఎలా',
      'சுருக்கமான வழி', 'பாதை', 'எந்த வழி', 'படகு எப்படி',
      'নিরাপদ রাস্তা', 'পথ দেখান', 'কোন পথ', 'জাহাজ কিভাবে',
      'ସୁରକ୍ଷିତ ମାର୍ଗ', 'ମାର୍ଗ ଦେଖାନ୍ତୁ', 'କେଉଁଥି ମାର୍ଗ',
      'ସୁରକ୍ଷିତ ପଥ', 'ପଥ', 'ସବୁଠାରୁ ସୁରକ୍ଷିତ', 'କେଉଁଥି ପଥ', 'ମାର୍ଗ କେମିଣି',
      'ਸੁਰੱਖਿਤ ਰਾਹ', 'ਰਾਹ ਦਿਸਾਓ', 'ਕਿਹੜੀ ਰਾਹ',
    ]),
    L(2, [
      'route', 'path', 'sail from', 'navigate from', 'how do i reach', 'way to go',
      'distance to travel', 'trip to', 'voyage', 'steer', 'course',
      'मार्ग', 'रास्ता', 'रास्ते से', 'कैसे पहुँचें', 'यात्रा', 'नौका चलाना',
      'માર્ગ', 'રસ્તો', 'કેવી રીતે પહોંચ', 'મુસાફરી',
      'ಮಾರ್ಗ', 'ದಾರಿ', 'ಹೇಗೆ ತಲುಪು', 'ಪ್ರಯಾಣ',
      'വഴി', 'എങ്ങനെ എത്തിച്ചു', 'യാത്ര',
      'మార్గం', 'దారి', 'ఎలా చేరుకుంటారు', 'యాత్ర',
      'வழி', 'பாதை', 'எப்படி செல்ல', 'பயணம்',
      'পথ', 'রাস্তা', 'কীভাবে পৌঁছাব', 'যাত্রা',
      'ମାର୍ଗ', 'ଦାରି', 'କିପରି ପହଞ୍ଚିବ', 'ଯାତ୍ରା',
      'ਰਾਹ', 'ਕਿਵੇਂ ਪਹੁੰਚੀਏ',
    ]),
    L(3, [
      // Kannada joins the adjective to the noun ("ಮಾರ್ಗವೇನು"), so the bare
      // adjective must carry the route sense on its own here; it never appears
      // bare in the safety-crew questions ("ಸುರಕ್ಷಿತವೇ" is a different token).
      'ಸುರಕ್ಷಿತ',
    ]),
    L(2, [
      'ନାଓକା',
    ]),
  ],

  GEOFENCE_PROXIMITY: [
    L(3, [
      'am i near a boundary', 'near a marine protected', 'ecologically sensitive',
      'international waterline', 'how far from the boundary', 'crossing the boundary',
      'सीमा के पास', 'संरक्षित क्षेत्र', 'पारिस्थितिक रूप से संवेदनशील',
      'સીમાથી કેટલું દૂર', 'સંરક્ષિત વિભાગ', 'સર્વસંભવનીય',
      'ಸೀಮೆಗೆ ಎಷ್ಟು ದೂರ', 'ಸಂರಕ್ಷಿತ ವಲಯ', 'ಪರಿಸರದ',
      'സീമയോട് എത്ര', 'സംരക്ഷിത മേഖല', 'പരിസരസംരക്ഷക',
      'సరిహద్దు నుండి ఎంత దూరం', 'సంరక్షిత ప్రాంతం', 'పర్యావరణ',
      'கடற்சரிமையிலிருந்து எவ்வளவு', 'பாதுகாப்பு பகுதி', 'சூழல்',
      'সীমানা থেকে কত দূর', 'সুরক্ষিত এলাকা', 'পরিবেশ',
      'সীমাৰ পৰা কিমান দূৰ', 'সুৰক্ষিত অঞ্চল', 'পৰিৱেশ',
      'ਸੀਮਾ ਤੋਂ ਕਿੰਨੀ ਦੂਰ', 'ਸੁਰੱਖਿਅਤ ਖੇਤਰ',
      'ସୀମାରୁ କେତେ ଦୂର', 'ସୁରକ୍ଷିତ ଅଞ୍ଚଳ', 'ପରିବେଶ',
    ]),
    L(2, [
      'geofence', 'marine protected area', 'mpa', 'restricted water', 'restricted zone',
      'prohibited area', 'no go area', 'protected area', 'boundary', 'territorial',
      'exclusive economic zone', 'eez', 'oil rig', 'military zone', 'submarine cable',
      'geofencing', 'geofenced', 'lawful limit', 'territorial limit',
      'भू सीमा', 'सीमा', 'प्रतिबंधित क्षेत्र', 'प्रतिबंधित जल', 'संरक्षित क्षेत्र', 'तेल कुआँ',
      'જમીન સીમા', 'સીમા', 'પ્રતિબંધિત વિભાગ', 'સંરક્ષિત વિભાગ', 'તેલ કુવારો',
      'ಭೂ ಸೀಮೆ', 'ಸೀಮಾ', 'ನಿಷೇಧಿತ ವಲಯ', 'ಸಂರಕ್ಷಿತ ವಲಯ', 'ಎಣ್ಣೆಯ ಕೊಳೆ',
      'ഭൂ അതിർ', 'അതിർ', 'നിഷേധിത ജലം', 'സംരക്ഷിത മേഖല', 'എണ്ണ വാത്യം',
      'భూ సరిహద్దు', 'సరిహద్దు', 'నిషేధిత జలాలు', 'సంరక్షిత ప్రాంతం', 'తేల కువారో',
      'நில எதிர்ப்பு', 'கடற்சரிமை', 'தடைசெய்யப்பட்ட நீர்', 'பாதுகாப்பு பகுதி', 'எண்ணெய் கிணை',
      'স্থলসীমা', 'সীমানা', 'নিষিদ্ধ জল', 'সুরক্ষিত এলাকা', 'তেল খনিগ',
      'জমি সীমা', 'সীমা', 'নিষিদ্ধ জল', 'সুৰক্ষিত অঞ্চল', 'তেল খনি',
      'ਹੱਦ ਸੀਮਾ', 'ਹੱਦ', 'ਪਾਬੰਦੀ ਵਾਰਾਂ', 'ਸੁਰੱਖਿਅਤ ਖੇਤਰ', 'ਤੇਲ ਕੁਵਾ',
      'ସ୍ଥଲ ସୀମା', 'ସୀମା', 'ନିଷିଦ୍ଧ ଜଳ', 'ସୁରକ୍ଷିତ ଅଞ୍ଚଳ', 'ତେଲ କୁଅଁ',
    ]),
  ],

  PRODUCTIVITY_DIAGNOSIS: [
    L(3, [
      'why did fish productivity', 'why is fish productivity', 'why has productivity',
      'why did the catch', 'why has the catch', 'why is the catch', 'why did fishing',
      'why has fish productivity', 'why did fish productivity', 'why is my catch',
      'why has my catch', 'why is the fish catch', 'why has the fish catch',
      'falling catch', 'declining catch', 'catch decline', 'productivity decline',
      'catch has fallen', 'fish decline', 'over the last few years', 'in the last decade',
      // Inflected forms. Matching is on whole-token n-grams with no stemming, so
      // "declined" and "decline" are different tokens and the base forms above
      // never fire for a question phrased in the past tense — which is how most
      // people actually ask about a trend they have already noticed.
      'productivity declined', 'productivity declining', 'productivity dropped',
      'productivity has declined', 'productivity is declining', 'fish productivity declined',
      'fish productivity dropped', 'why is productivity declining', 'why has productivity declined',
      'fish catch declining', 'fish catch dropped', 'the catch has declined',
      'catch falling', 'catch is falling', 'catch has fallen', 'catch has dropped',
      'catch is dropping', 'catch dropped', 'catch declining', 'catch is low',
      'catching less', 'caught less', 'catches lower', 'in the last few years',
      'in the last 3 years', 'in the last 10 years', 'over the past decade',
      'in the last few months', 'over the last few years',
      'मछली की उत्पादकता क्यों', 'पकड़ क्यों कम', 'कमाई क्यों घट', 'पिछले कुछ वर्षों',
      'उत्पादकता में गिरावट', 'पकड़ में गिरावट',
      'માછ ઉત્પાદકતા કેમ', 'પકડ કેમ ઘટ', 'છેલ્લા વર્ષોમાં', 'ઉત્પાદકતા ઘટી',
      'ಮೀನು ಉತ್ಪಾದಕತೆ ಏಕೆ', 'ಮೀನು ಇರುವುದು ಏಕೆ', 'ಕಳೆಯುವಿಕೆ ಏಕೆ ಕಡಿಮೆ', 'ಇದೇ ಕೆಲವು ವರ್ಷಗಳಲ್ಲಿ',
      'ಉತ್ಪಾದಕತೆ ಕುಸಿತಿರುವುದು', 'ಮೀನು ಉತ್ಪಾದಕತೆ ಏಕೆ ಕಡಿಮೆ',
      'മീൻ ഉൽപാദനശാതം എന്തുകൊണ്ട്', 'മീൻ പിടിക്കുന്നത് എന്തുകൊണ്ട്', 'കഴിഞ്ഞ വർഷങ്ങളിൽ', 'ഉൽപാദനം കുറഞ്ഞത്',
      'చేపల ఉత్పాదకత ఎందుకు', 'చేపలు తక్కువగా ఎందుకు', 'గత కొన్ని సంవత్సరాలలో', 'ఉత్పాదకత తగ్గింది',
      'மீன் உற்பத்தி ஏன் குறைந்தது', 'மீன் பிடிப்பு ஏன் குறைந்தது', 'கடந்த சில ஆண்டுகளில்', 'உற்பத்தி குறைந்துள்ளது',
      'মাছের উৎপাদনশীলতা কেন', 'মাছ কম কেন', 'গত কয়েক বছরে', 'উৎপাদনশীলতা হ্রাস',
      'ମାଛ ଉତ୍ପାଦନଶୀଳତା କାହିଁକି', 'ମାଛ କମିଛି କାହିଁକି', 'ଗତ କିଛି ବର୍ଷରେ', 'ଉତ୍ପାଦନ କମିଛି',
      'ଉତ୍ପାଦନ କାହିଁକି', 'ମାଛ ଉତ୍ପାଦନ', 'ଉତ୍ପାଦନ କମିଛି କାହିଁକି', 'ଉତ୍ପାଦନ କମିଛି', 'ଉତ୍ପାଦକତା କାହିଁକି',
      'ਮੱਛ ਉਤਪਾਦਕਤਾ ਕਿਉਂ', 'ਮੱਛ ਘਟ ਗਏ ਕਿਉਂ', 'ਪਿਛਲੇ ਕੁਝ ਸਾਲਾਂ', 'ਉਤਪਾਦਕਤਾ ਘਟੀ',
    ]),
    L(2, [
      'historical', 'history', 'trend', 'over the years', 'long term', 'decline',
      'decreasing', 'drop in catch', 'low catch', 'less fish', 'fishery collapse',
      'past few years', 'year on year', 'cpue', 'catch per unit effort',
      'ऐतिहासिक', 'इतिहास', 'रुझान', 'पिछले वर्षों', 'गिरावट', 'कमाई',
      'ઐતિહાસિક', 'ઇતિહાસ', 'વલણ', 'ગયા વર્ષો', 'ઘટાડો', 'ઓછી માછ',
      'ಐತಿಹಾಸಿಕ', 'ಇತಿಹಾಸ', 'ಪ್ರವೃತ್ತಿ', 'ಗತ ವರ್ಷಗಳು', 'ಕುಸಿತಿ', 'ಕಡಿಮೆ ಮೀನು',
      'ചരിത്രാതാതാത്മകം', 'ചരിത്രം', 'പ്രവാഹം', 'കഴിഞ്ഞ വർഷങ്ങൾ', 'കുറവ്', 'കുറഞ്ഞ മീൻ',
      'చారిత్రక', 'చరిత్ర', 'ధరణ', 'గత సంవత్సరాలు', 'క్షీణత', 'తక్కువ చేపలు',
      'வரலாறு', 'வரலாற்று', 'போக்கு', 'கடந்த வருடங்கள்', 'குறைவு', 'குறைந்த மீன்',
      'ঐতিহাসিক', 'ইতিহাস', 'প্রবণতা', 'গত বছরগুলি', 'হ্রাস', 'কম মাছ',
      'ଐତିହାସିକ', 'ଇତିହାସ', 'ଧାରା', 'ଗତ ବର୍ଷଗୁଡ଼ିକ', 'ହ୍ରାସ', 'କମ୍ ମାଛ',
      'ਐਤਿਹਾਸਿਕ', 'ਇਤਿਹਾਸ', 'ਰੁਝਾਣ', 'ਪਿਛਲੇ ਸਾਲ', 'ਘਾਟ', 'ਘੱਟ ਮੱਛ',
      'ਉਤਪਾਦਕਤਾ', 'ਘਟਣਾ', 'ਘਟ ਰਿਹਾ', 'ਪਿਛਲੇ ਕੁਝ ਸਾਲਾਂ',
      'ਘਟ', 'ਘਟੀ ਹੈ', 'ਘਟ ਗਈ', 'ਘਟਿਆ', 'ਉਤਪਾਦਕਤਾ ਕਿਉਂ', 'ਉਤਪਾਦਕਤਾ ਘਟੀ', 'ਮੱਛੀ ਉਤਪਾਦਕਤਾ', 'ਪੱਕੜ ਘਟੀ',
    ]),
    L(3, [
      // Past-tense decline questions phrased the way they are actually typed.
      // Each bigram matches the canonical scenario phrasing exactly; the
      // unigrams below it widen coverage to nearby variants.
      'मछली उत्पादन', 'उत्पादन क्यों',
      'मासेमारीचे उत्पादन', 'उत्पादन का',
      'மீன் உற்பத்தி', 'உற்பத்தி ஏன்',
      'చేపల ఉత్పత్తి', 'ఉత్పత్తి ఎందుకు',
      'মাছের উৎপাদন', 'উৎপাদন কেন',
      'ಮೀನಿನ ಉತ್ಪಾದನೆ', 'ಉತ್ಪಾದನೆ ಏಕೆ',
      'માછનું ઉત્પાદન', 'ઉત્પાદન કેમ',
      'മീൻ ഉൽപാദനം', 'ഉൽപാദനം എന്തുകൊണ്ട്',
    ]),
    L(2, [
      'घटा है', 'घटा',
      'घटले आहे', 'घटले',
      'குறைந்துள்ளது',
      'తగ్గింది',
      'কমেছে',
      'ಕಡಿಮೆಯಾಗಿದೆ',
      'ઘટ્યું',
      'കുറഞ്ഞു',
    ]),
  ],

  PFZ_HOTSPOTS: [
    L(3, [
      'high chlorophyll', 'chlorophyll rich', 'chlorophyll concentration', 'favourable sst',
      'favorable sst', 'sea surface temperature front', 'productivity hotspot', 'fish hotspot',
      'where is chlorophyll high', 'best fishing water', 'productive waters', 'algal bloom',
      'क्लोरोफिल अधिक', 'अच्छा क्लोरोफिल', 'समुद्री सतह तापमान अनुकूल', 'मछली की पैदावार',
      'ઉચ્ચ ક્લોરોફિલ', 'સમુદ્ર સપાટી તાવમાન', 'માછ મળવાની જગ્યા', 'ઉત્પાદક જળ',
      'ಹೆಚ್ಚು ಕ್ಲೋರೊಫಿಲ್', 'ಸಮುದ್ರ ಮೇಲ್ಮೈ ತಾಪಮಾನ', 'ಮೀನು ಸಿಗುವ ಜಾಗ', 'ಉತ್ಪಾದಕ ನೀರು',
      'ഉയർന്ന ക്ലോറോഫിൽ', 'കടൽ മേല് താപനില', 'മീൻ കിട്ടുന്ന സ്ഥലം', 'ഉൽപാദനകവിധി ജലം',
      'అధిక క్లోరోఫిల్', 'సముద్ర పృష్ఠి ఉష్ణోగ్రత', 'చేపలు దొరికే ప్రాంతం', 'ఉత్పాదక నీరు',
      'அதிக பச்சையம்', 'கடல் மேற்பரப்பு வெப்பநிலை', 'மீன் கிடைக்கும் இடம்', 'உற்பத்தி நீர்',
      'উচ্চ ক্লোরোফিল', 'সামুদ্রিক পৃষ্ঠতল তাপমাত্রা', 'মাছ পাওয়ার জায়গা', 'উৎপাদক জল',
      'ଉଚ୍ଚ କ୍ଲୋରୋଫିଲ', 'ସମୁଦ୍ର ଉପରିକଠ ତାପମାତ୍ରା', 'ମାଛ ମିଳିବା ସ୍ଥାନ', 'ଉତ୍ପାଦକ ଜଳ',
      'ਉੱਚ ਕਲੋਰੋਫਿਲ', 'ਸਮੁੰਦਰੀ ਸਤਹਾ ਤਾਪਮਾਨ', 'ਮੱਛ ਮਿਲਣ ਦਾ ਸਥਾਨ', 'ਉਤਪਾਦਕ ਪਾਣੀ',
    ]),
    L(2, [
      'chlorophyll', 'sst', 'sea surface temperature', 'hotspot', 'hot spots', 'productivity',
      'bloom', 'plankton', 'nutrient', 'upwelling', 'eddies', 'front',
      'क्लोरोफिल', 'समुद्री सतह तापमान', 'गर्म पानी', 'सतह', 'उत्पादकता', 'मछली अधिक',
      'ક્લોરોફિલ', 'સમુદ્ર સપાટી તાવમાન', 'ગરમ પાણી', 'ઉત્પાદકતા', 'વધુ માછ',
      'ಕ್ಲೋರೊಫಿಲ್', 'ಸಮುದ್ರ ಮೇಲ್ಮೈ ತಾಪಮಾನ', 'ಬಿಸಿಗೆ ನೀರು', 'ಉತ್ಪಾದಕತೆ', 'ಹೆಚ್ಚು ಮೀನು',
      'ക്ലോറോഫിൽ', 'കടൽ മേൽതല താപനില', 'ചൂടുള്ള വെള്ളം', 'ഉർപ്പാദനശാതം', 'കൂടുതൽ മീൻ',
      'క్లోరోఫిల్', 'సముద్ర ఉపరితల ఉష్ణోగ్రత', 'వేడి నీరు', 'ఉత్పాదకత', 'ఎక్కువ చేపలు',
      'பச்சையம்', 'கடல் மேற்பரப்பு வெப்பநிலை', 'வெப்பமான நீர்', 'உற்பத்தி', 'அதிக மீன்',
      'ক্লোরোফিল', 'সামুদ্রিক পৃষ্ঠতল তাপমাত্রা', 'গরম পানি', 'উৎপাদনশীলতা', 'বেশি মাছ',
      'କ୍ଲୋରୋଫିଲ', 'ସମୁଦ୍ର ଉପରିକଠ ତାପମାତ୍ରା', 'ଗରମ ପାଣି', 'ଉତ୍ପାଦକତା', 'ଅଧିକ ମାଛ',
      'ਕਲੋਰੋਫਿਲ', 'ਸਮੁੰਦਰੀ ਸਤਹਾ ਤਾਪਮਾਨ', 'ਗਰਮ ਪਾਣੀ', 'ਉਤਪਾਦਕਤਾ', 'ਵੱਧ ਮੱਛ',
    ]),
    L(3, [
      // Kannada says "ಸಮುದ್ರ ಮೇಲ್ಮೈ ಉಷ್ಣತೆ" (SST) and "ಹಸಿರು" for
      // chlorophyll — different tokens from the existing "ತಾಪಮಾನ" forms.
      'ಸಮುದ್ರ ಮೇಲ್ಮೈ ಉಷ್ಣತೆ', 'ಹಸಿರು ಹೆಚ್ಚು',
    ]),
    L(2, [
      'ಸೂಕ್ತವಾಗಿದೆ',
    ]),
  ],

  HAZARD_ALERTS: [
    L(3, [
      'any cyclone', 'cyclone warning', 'cyclone alert', 'is there a storm', 'thunderstorm warning',
      'lightning warning', 'lightning risk', 'high wave warning', 'squall warning', 'storm surge',
      'any warning', 'any alert', 'alert for', 'warning issued', 'am i safe from the storm',
      'क्या चेतावनी', 'चक्रवात की चेतावनी', 'चक्रवात आएगा', 'बिजली गिरने का खतरा', 'गरज के साथ बारिश',
      'ऊँची लहरों की चेतावनी', 'तूफान की चेतावनी', 'कोई अलर्ट', 'खतरे की चेतावनी',
      'ચક્યાસવાદની છે', 'વાવાઝોડીની ચેતવણી', 'વિજળીનું જોખમ', 'ઉંચા લહેરાની ચેતવણી', 'કોઈ ચેતવણી',
      'ಚಕ್ರವರ್ತಿ ಎಚ್ಚರಿಕೆ', 'ಬಿಸಿಗುವ ಎಚ್ಚರಿಕೆ', 'ಗಂಭೀರ ಬಿಸಿಗುವುದೆ', 'ಮೇಘಾಯಿನ ಎಚ್ಚರಿಕೆ', 'ಯಾವುದೇ ಎಚ್ಚರಿಕೆ',
      'ചുറ്റുകെട്ട മഴയുടെ മുന്നറിയിപ്പും', 'ഇടിമാവിന് ആശയം', 'ഉരുമ്പിന്റെ ആശയം', 'ഉയരം താരത്തിന്റെ മുന്നറിയിപ്പും', 'ഏതെങ്കിലും മുന്നറിയിപ്പും',
      'ఉప్పు సముచ్ఛ నిగమన', 'ఆకాశపు మెరుపుల ప్రమాదం', 'ఎత్తిన అలల ప్రమాదం', 'ఏదైనా హెచ్చరిక', 'సముద్ర ప్రమాదం',
      'புயல் எச்சரிக்கை', 'மின்னல் ஆபத்து', 'உயர் அலை எச்சரிக்கை', 'ஏதேனும் எச்சரிக்கை', 'கடல் பேராற்றல்',
      'ঘূর্ণিঝড় সতর্কতা', 'বিদ্যুৎ ঝুঁকি', 'উচ্চ ঢেউয়ের সতর্কতা', 'কোনো সতর্কতা', 'ঘূর্ণিঝড়',
      'ବାଦ୍ବାଦ ସାବଧାନ', 'ବିଜଳୀ ଝୁଁକି', 'ଉଚ୍ଚ ଲହେରା ଚେତାବନୀ', 'କୌଣସି ଚେତାବନୀ',
      'ବିଦ୍ୟୁତ', 'ଚକ୍ରବାତ', 'ଚକ୍ରବାତ ଚେତାବନୀ', 'ସତର୍କତା', 'ବିଦ୍ୟୁତ ଚେତାବନୀ', 'ଅଛି କି',
      'ਚੱਕਰਵਾਤ ਚੇਤਾਵਨੀ', 'ਬਿਜਲੀ ਦਾ ਖ਼ਤਰਾ', 'ਉੱਚੀਆਂ ਲਹਿਰਾਂ ਦੀ ਚੇਤਾਵਨੀ', 'ਕੋਈ ਚੇਤਾਵਨੀ',
    ]),
    L(2, [
      'alert', 'warning', 'hazard', 'danger', 'cyclone', 'storm', 'squall', 'lightning',
      'thunder', 'thunderstorm', 'gale', 'gust', 'high wave', 'very rough sea', 'rough sea',
      'surge', 'caution', 'advisory', 'bad weather', 'inclement', 'typhoon', 'cyclonic',
      'चेतावनी', 'अलर्ट', 'खतरा', 'खतरा', 'तूफान', 'चक्रवात', 'आंधी', 'गरज', 'बिजली',
      'ऊँची लहरें', 'खराब मौसम', 'सावधान', 'नुस्खा',
      'ચેતવણી', 'અલર્ટ', 'જોખમ', 'તોફાન', 'ચક્યાસ', 'વિજળી', 'ઊંચા લહેરા',
      'ખરાબ હવામાન', 'સાવધ',
      'ಎಚ್ಚರಿಕೆ', 'ಎಚ್ಚರಿಕೆಗಳು', 'ಅಪಾಯ', 'ತುರುಗು', 'ಚಕ್ರವರ್ತಿ', 'ಗಾಳಿ', 'ಮಿಂಜುಗುಟ್ಟು',
      'ಬಿಸಿಗುವುದು', 'ಉಂಬರ ಅಲೆಗಳು', 'ಕೆಟ್ಟ ಹವಾಮಾನ', 'ಎಚ್ಚರಿಸಿ',
      'അറിയിപ്പും', 'അപകടം', 'കൊറ്റളി', 'ഇടിമാവ്', 'ഗ്രേഹം', 'ഉയരം അല്ല', 'ചെറിയ താരത്തിന്റെ അല്ല',
      'മോഡകാരം', 'അപകടകരമായ കാലാവസ്ഥ', 'ശ്രദ്ധിക്കുക',
      'హెచ్చరిక', 'ప్రమాదం', 'తుఫాను', 'చదురు', 'మెరుపు', 'ఎత్తిన అలలు', 'చెడు వాతావరణం',
      'எச்சரிக்கை', 'ஆபத்து', 'புயல்', 'இடியுருகை', 'மின்னல்', 'அதிக அலை', 'மோசமான வானிலை',
      'সতর্কতা', 'বিপদ', 'ঝড়', 'বজ্রপাত', 'ঢেউ', 'খারাপ আবহাওয়া',
      'ଚେତାବନୀ', 'ବିପଦ', 'ଝୁଡ଼', 'ବିଜଳୀ', 'ଉଚ୍ଚ ଲହେରା', 'ଖରାପ ପାଣିପାଗ',
      'ਚੇਤਾਵਨੀ', 'ਖ਼ਤਰਾ', 'ਤੁਫ਼ਾਨ', 'ਬਿਜਲੀ', 'ਉੱਚੀਆਂ ਲਹਿਰਾਂ', 'ਮਾੌਸਮ ਖ਼ਰਾਬ',
    ]),
    L(3, [
      // Marathi and Malayalam use their own warning vocabulary; without these
      // the whole question scores zero and falls through to the catch-all.
      'इशारा', 'चक्रवाताचा', 'विजा',
      'ചുറ്റലോ', 'അറിയിപ്പുകളുണ്ടോ',
    ]),
    L(2, [
      'അറിയിപ്പ്', 'മുന്നറിയിപ്പ്', 'ചുഴലിക്കാറ്റ്', 'മിന്നൽ',
    ]),
  ],

  SAFETY_ASSESSMENT: [
    L(3, [
      'is it safe', 'safe to venture', 'safe to go', 'safe to sail', 'safe to fish',
      'can i go', 'can we go', 'can i sail', 'should i go', 'should i sail', 'worth going',
      'can i venture', 'is it worth', 'should i fish', 'any risk', 'too risky', 'go or not',
      'क्या जाना सुरक्षित', 'कल जा सकते', 'जाने का जोखिम', 'क्या नौका चलाने की हिम्मत',
      'કમને જવું સુરક્ષિત', 'જઈશું', 'જવાનો જોખમ', 'નૌકા ચલાવવી',
      'ಸುರಕ್ಷಿತವಾಗಿ ಹೋಗಬಹುದೇ', 'ಹೋಗಬಹುದೇ', 'ಹೋಗುವ ಅಪಾಯ', 'ದೋಣಿ ನಡೆಯಬಹುದೇ',
      'പോകാമോ', 'സുരക്ഷിതമായി പോകാമോ', 'പോകുന്നതിലുള്ള അപകടം', 'വേണ്ടെന്നും പോകട്ടെയോ',
      'వెళ్ళకు వెళ్లడం సురక్షితమా', 'వెళ్లాలా', 'వెళ్లే ప్రమాదం', 'వెళ్ళడం విలువ',
      'செல்லலாமா', 'பாதுகாப்பாக', 'போகும் அபாயம்', 'கடலுக்கு செல்ல',
      'যাওয়া কি নিরাপদ', 'যেতে পারি', 'যাওয়ার ঝুঁকি', 'নৌকা চালাতে',
      'ଯାଓିବା କି ସୁରକ୍ଷିତ', 'ଯିବିକୁ ପାରିବେ', 'ଯାଓବାର ବିପଦ', 'ନାଓକା ଚଲାଇବା',
      'ସୁରକ୍ଷିତ କି', 'ଯିବା ସୁରକ୍ଷିତ', 'ସମୁଦ୍ରକୁ ଯିବା', 'ସମୁଦ୍ରକୁ', 'ଆସନ୍ତାକାଳେ',
      'କେଉଁଥି ସୁରକ୍ଷିତ', 'କିପରି ଅଛି', 'ବିପଦ ଅଛି କି',
      'ਜਾਣਾ ਸੁਰੱਖਿਤ ਹੈ', 'ਜਾ ਸਕਦੇ', 'ਜਾਣ ਦਾ ਖ਼ਤਰਾ', 'ਕਿਸੇ ਤਰੀਕ ਚਲਾਉਣਾ',
    ]),
    L(2, [
      'safe', 'safety', 'risk', 'risky', 'dangerous', 'danger', 'advisable', 'okay to',
      'permission', 'venture out', 'fishing trip', 'sea trip', 'go fishing today',
      'सुरक्षित', 'सुरक्षा', 'जोखिम', 'खतरा', 'खतरनाक', 'जाना', 'नौका चलाना', 'फिशिंग',
      'સુરક્ષિત', 'સુરક્ષા', 'જોખમ', 'જવામાં', 'માછ પકડવા',
      'ಸುರಕ್ಷತೆ', 'ಅಪಾಯ', 'ಹೋಗುವುದು', 'ಮೀನು ಹಿಡಿಯಲು', 'ದೋಣಿ',
      'സുരക്ഷം', 'അപകടം', 'പോകുക', 'മീൻ പിടിക്കാൻ', 'ഓടിപ്പോകുക',
      'సురక్షత', 'ప్రమాదం', 'వెళ్ళేంది', 'చేపలు పట్టుకోవడానికి',
      'பாதுகாப்பு', 'ஆபத்து', 'போக', 'மீன் பிடிக்க', 'ஈழை',
      'போக்கலாமா', 'போகலாமா', 'போகலாம்', 'போய்', 'போவது', 'கடலுக்கு',
      'வெளியே', 'கடலுக்குப்', 'நாளை கடலுக்கு', 'கடலுக்கு போக்கலாமா',
      'নিরাপত্তা', 'ঝুঁকি', 'যাওয়া', 'মাছ ধরতে',
      'ਸੁਰੱਖਿਆ', 'ਖ਼ਤਰਾ', 'ਜਾਣਾ', 'ਮੱਛ ਪਕੜਨ ਲਈ',
    ]),
    L(3, [
      // Tamil and Telugu attach the interrogative/clitic to the adjective
      // ("பாதுகாப்பா?", "సురక్షితమా?"), so the suffix-stripped base forms
      // never match — the inflected token must be its own lexicon entry.
      'பாதுகாப்பா',
      'వెళ్లడం సురక్షితమా', 'సురక్షితమా',
    ]),
    L(2, [
      'செல்வது', 'பாதுகாப்பானதா',
      'వెళ్లడం',
    ]),
  ],

  FIND_PFZ: [
    L(3, [
      'nearest fishing zone', 'nearest pfz', 'closest fishing ground', 'where should i fish',
      'where can i fish', 'best place to fish', 'good fishing spot', 'fish productivity zone',
      'potential fishing zone', 'fishing ground near', 'jaldi', 'fish kahan',
      'निकटतम मछली पेटी', 'सबसे नज़दीक मछली', 'कहाँ मछली मिलेगी', 'कहाँ पकड़ें',
      'मछली पकड़ने की जगह', 'मत्स्य पेटी',
      'નજીકનું માછ વિભાગ', 'માછ ક્યાં મળશે', 'માછ પકડવાની જગ્યા', 'મત્ય પેટી',
      'ಅತಿ ಹತ್ತಿರದ ಮೀನು ವಲಯ', 'ಮೀನು ಎಲ್ಲಿ ಸಿಗುತ್ತದೆ', 'ಮೀನು ಹಿಡಿಯುವ ಸ್ಥಳ', 'ಮತ್ಸ್ಯ ಪೆಟ್ಟಿ',
      'അടുത്തുള്ള മീൻ വലയം', 'മീൻ എവിടെ കിട്ടും', 'മീൻ പിടിക്കുന്ന സ്ഥലം', 'മത്സ്യ മണ്ഡലം',
      'దగ్గరి చేపల ప్రాంతం', 'ఎక్కడ చేపలు దొరుకుతాయి', 'చేపలు పట్టుకునే ప్రాంతం', 'మత్స్య పేట',
      'அருகில் மீன் பகுதி', 'மீன் எங்கே கிடைக்கும்', 'மீன் பிடிக்கும் இடம்', 'மீன்வள மண்டலம்',
      'কাছের মাছ এলাকা', 'মাছ কোথায় পাওয়া যায়', 'মাছ ধরার জায়গা', 'মৎস্য অঞ্চল',
      'ନିକଟସ୍ଥ ମାଛ ଅଞ୍ଚଳ', 'ମାଛ କେଉଁଥିରେ ମିଳିବ', 'ମାଛ ଧରିବା ସ୍ଥାନ', 'ମତ୍ସ୍ୟ ଅଞ୍ଚଳ',
      'ਨੇੜਲੀ ਮੱਛ ਖੇਤਰ', 'ਮੱਛ ਕਿੱਥੇ ਮਿਲਦੇ', 'ਮੱਛ ਪਕੜਣ ਦਾ ਸਥਾਨ', 'ਮੱਛ ਖੇਤਰ',
    ]),
    L(2, [
      'fishing zone', 'fish zone', 'pfz', 'fishing ground', 'fish ground', 'where to fish',
      'fish here', 'good catch', 'catches', 'fishing area', 'productive area', 'fish abundance',
      'मछली', 'मछली पेटी', 'मत्स्य', 'पकड़', 'शिकार', 'मछली का स्थान',
      'માછ', 'માછ વિભાગ', 'મત્સ્ય', 'પકડ', 'માછ આવે ત્યાં',
      'ಮೀನು', 'ಮೀನು ಹಿಡಿಯುವ', 'ಮತ್ಸ್ಯ', 'ಮೀನು ಇರುವ', 'ಮೀನು ವಲಯ',
      'മീൻ', 'മീൻ പിടിക്കുക', 'മത്സ്യം', 'മീൻ ഉള്ള സ്ഥലം', 'മീൻ വലയം',
      'చేపలు', 'చేపలు పట్టుకోవడం', 'మత్స్యం', 'చేపలు ఉన్న ప్రాంతం', 'చేపల వలయం',
      'மீன்', 'மீன் பிடிக்க', 'மீன்வளம்', 'மீன் உள்ள இடம்', 'மீன் பகுதி',
      'মাছ', 'মাছ ধরা', 'মৎস্য', 'মাছ আছে এমন জায়গা', 'মাছের এলাকা',
      'ମାଛ', 'ମାଛ ଧରିବା', 'ମତ୍ସ୍ୟ', 'ମାଛ ଥିବା ସ୍ଥାନ', 'ମାଛ ଅଞ୍ଚଳ',
      'ਮੱਛ', 'ਮੱਛ ਪਕੜਨਾ', 'ਮੱਛਲੀ', 'ਜਿੱਥੇ ਮੱਛ ਹਨ', 'ਮੱਛ ਖੇਤਰ', 'ਮੱਛੀ', 'ਪਕੜਣ ਦਾ ਖੇਤਰ',
    ]),
    L(3, [
      // "Nearest fishing ground" in Marathi, Telugu and Odia. The Marathi joins
      // "मासेमारी" + "क्षेत्र"; Telugu uses "మత్స్య ప్రాంతం" (the plain noun
      // "మత్స్యం" above is a different token); Odia declines the first word
      // ("ମାଛୁ" dative), so none of the existing base forms fire.
      'मासेमारी क्षेत्र',
      'మత్స్య ప్రాంతం',
      'ମାଛୁ ଧରିବା ଅଞ୍ଚଳ',
    ]),
    L(2, [
      'जवळचे', 'मासेमारी',
      'దగ్గరి',
      'ନିକଟସ୍ତ', 'ମାଛୁ ଧରିବା',
    ]),
  ],

  TIDE_WEATHER_SEA: [
    L(3, [
      'tide and weather', 'weather and tide', 'tide weather and sea', 'tide situation',
      'high tide time', 'low tide time', 'when is high tide', 'tide table', 'tide timing',
      'sea state near', 'how is the sea', 'how is the weather', 'weather at the harbour',
      'ज्वार और मौसम', 'ज्वार की स्थिति', 'कब है बड़ी ज्वार', 'ज्वार भरत का समय',
      'समुद्र की हालत', 'मौसम कैसा है',
      'જ્હાર અને હવામાન', 'દરિયાની હાલત', 'ક્યારે મોટો જ્હાર', 'દરિયાની સ્થિતિ',
      'ಜ್ಹಾರ ಮತ್ತು ಹವಾಮಾನ', 'ಸಮುದ್ರದ ಸ್ಥಿತಿ', 'ದೊಡ್ಡ ಜ್ಹಾರ ಯಾವಾಗ', 'ಕಡಲ ಹೇಗಿದೆ',
      'വേളയും കാലാവസ്ഥയും', 'കടലിന്റെ നില', 'വലമ്പ് വേളയ് എപ്പോൾ', 'കടൽ എങ്ങനെയാണ്',
      'ఉదయం పాటు వాతావరణం', 'సముద్ర స్థితి', 'ఎక్కువ అలల ఎప్పుడు', 'సముద్రం ఎలా ఉంది',
      'உழைப்பு மற்றும் வானிலை', 'கடல் நிலை', 'உயர் அலை எப்போது', 'கடல் எப்படி',
      'জোয়ার ও আবহাওয়া', 'সমুদ্রের অবস্থা', 'বড় জোয়ার কখন', 'সমুদ্র কেমন',
      'জোয়াৰ আৰু আৰোহ', 'সাগৰৰ অৱস্থা', 'ডালং জোয়াৰ সময়', 'সাগৰ কি কেনেকৈ',
      'ਜਵਾਰ ਅਤੇ ਮੌਸਮ', 'ਸਮੁੰਦਰ ਦੀ ਹਾਲਤ', 'ਵੱਡਾ ਜਵਾਰ ਕਦੋਂ', 'ਸਮੁੰਦਰ ਕਿਵੇਂ ਹੈ',
      'ଜୋଆର ଏବଂ ପାଣିପାଗ', 'ସମୁଦ୍ର ସ୍ଥିତି', 'ବଡ ଜୋଆର କେବେ', 'ସମୁଦ୍ର କେମିଣି',
    ]),
    L(2, [
      'tide', 'tidal', 'high tide', 'low tide', 'flood tide', 'ebb tide', 'tide height',
      'water level', 'weather', 'forecast', 'sea state', 'sea condition', 'waves', 'wind',
      'swell', 'current', 'rain', 'visibility', 'temperature', 'humidity', 'gusts',
      'बढ़ना', 'घटना', 'ऊँचा ज्वार', 'नीचा ज्वार', 'ज्वार', 'मौसम', 'तरंग', 'लहर',
      'हवा', 'समुद्र की स्थिति', 'समुद्री हालत', 'तापमान', 'बारिश', 'धुंध',
      'જ્હાર', 'તરફ', 'લહેરો', 'પવન', 'દરિયાનું તાવમાન', 'વરસાદ',
      'ಜ್ಹಾರ', 'ಅಲೆ', 'ಗಾಳಿ', 'ಸಮುದ್ರದ ತಾಪಮಾನ', 'ಮಳೆ', 'ದೃಶ್ಯ',
      'വേള', 'തിരയോടുക', 'അല്ല', 'കടൽ താപനില', 'മഴ', 'മാഹിരുമ്പുകാഴ്ച',
      'ఉదయం', 'ఇళ్గొంతు', 'అల్ల', 'సముద్ర ఉష్ణోగ్రత', 'వర్షం', 'క్షితిజస్త',
      'உழைப்பு', 'இறங்கு', 'அலை', 'கடல் வெப்பநிலை', 'மழை', 'தெரிவுப்பிடித்தன்மை',
      'জোয়ার', 'উত্তর', 'ঢেউ', 'সমুদ্র তাপমাত্রা', 'বৃষ্টি', 'দৃশ্যমানতা',
      'জোয়াৰ', 'জোয়াৰ', 'লাহ', 'সাগৰ তাপমাত্ৰা', 'বৃষ্টিপাত', 'দৃশ্যমানতা',
      'ਜਵਾਰ', 'ਲੋਵ', 'ਲਹਿਰਾਂ', 'ਸਮੁੰਦਰ ਤਾਪਮਾਨ', 'ਮੀਂਹ', 'ਦਿਖਾਈ',
      'ଜୋଆର', 'ଅଲ୍ପତା', 'ଲହେରା', 'ପାଣିପାଗ ବେଗ', 'ବର୍ଷା', 'ଦୃଶ୍ୟମାନତା',
    ]),
    L(3, [
      // Plural "tides" and the tide words Kannada / Gujarati / Malayalam /
      // Odia speakers actually use (their inflections join into the words
      // below, so bare-noun and phrase forms are both needed).
      'tides', 'tide times', 'tides today',
      'ಉಬ್ಬರ', 'ಹವಾಮಾನ', 'ಸಮುದ್ರ ಸ್ಥಿತಿ',
      'જ્વાર', 'હવામાન', 'સમુદ્રની હાલત',
      'കടൽ നില', 'കാലാസഥി',
      'ପାଣିପାଣି',
    ]),
    L(2, [
      'సముద్ర పరిస్థితి', 'వాతావరణం',
      'ಸ್ಥಿತಿ',
      'હાલત',
      'ഉദയം',
      'ସ୍ଥିତି',
    ]),
  ],

  AVOID_ZONES: [
    L(3, [
      'which zones to avoid', 'what should i avoid', 'areas to avoid', 'should i avoid',
      'zones to avoid', 'zones should i avoid', 'zone to avoid', 'where to avoid',
      'what areas to avoid', 'which areas to avoid',
      'where should i not go', 'restricted areas near', 'no fishing zones', 'danger zones',
      'किन जगहों से बचें', 'क्या बचना चाहिए', 'किन क्षेत्रों से बचें', 'कहाँ न जाएं',
      'કઈ વિભાગથી બચવું', 'શું ટાળવું', 'ક્યાં ના જવું',
      'ಯಾವ ವಲಯದಿಂದ ತಪ್ಪಬೇಕು', 'ಏನ್ನು ತಪ್ಪಿಸಬೇಕು', 'ಎಲ್ಲಿ ಹೋಗಬಾರದು',
      'ഏത് മേഖലകളിൽ ഒഴിഞ്ഞുപോകണം', 'എന്ത് ഒഴിഞ്ഞുപോകണം', 'എവിടെ പോകരുത്',
      'ఏ ప్రాంతాల నుండి నివారించాలి', 'దేని నుండి దూరం', 'ఎక్కడకు వెళ్లకుండా',
      'எந்த பகுதிகளைத் தவிர்க்க', 'எதை தவிர்க்க', 'எங்கே செல்லக் கூடாது',
      'কোন এলাকা এড়িয়ে চলবেন', 'কী এড়াবেন', 'কোথায় যাবেন না',
      'କେଉଁଥି ଅଞ୍ଚଲ ଏଡ଼ାଇବି', 'କଣ ଏଡ଼ାଇବି', 'କେଉଁଥିରେ ଯାଇବ ନାହିଁ',
      'ଏଡ଼ାଇବାଯୋଗ୍ୟ', 'ଏଡ଼ାଇବା ଉଚିତ', 'ଏଡ଼ାଇବା', 'କେଉଁ ଅଞ୍ଚଳ', 'ଅଞ୍ଚଳ ଏଡ଼ାଇବାଯୋଗ୍ୟ',
      'ਕਿਹੜੇ ਖੇਤਰਾਂ ਤੋਂ ਬਚਣਾ', 'ਕੀ ਤੋਂ ਬਚਣਾ', 'ਕਿੱਥੇ ਨਹੀਂ ਜਾਣਾ',
    ]),
    L(2, [
      'avoid', 'stay away', 'keep away', 'do not go', 'dont go', 'forbidden', 'prohibited',
      'banned', 'restricted', 'illegal', 'no fishing', 'off limits', 'danger area',
      'बचें', 'बचना', 'बचना चाहिए', 'से बचें', 'दूर रहें', 'न जाएं', 'मना', 'प्रतिबंधित',
      'निषिद्ध', 'खतरे का इलाका', 'टालना', 'टालने योग्य', 'बचने योग्य', 'न जाना',
      'બચો', 'દૂર રહો', 'ના જાઓ', 'પ્રતિબંધિત', 'નિષેધિત', 'જોખમનું વિસ્તાર',
      'ತಪ್ಪಿಸಿ', 'ದೂರವಿಡಿ', 'ಹೋಗಬೇಡಿ', 'ನಿಷೇಧಿತ', 'ಅಪಾಯಕರ ವಿಸ್ತಾರ',
      'ഒഴിഞ്ഞുപോകുക', 'അകറ്റി നിൽക്കുക', 'പോകരുത്തു', 'നിഷേധം', 'അപകട മേഖല',
      'తప్పించుకోండి', 'దూరంగా ఉండండి', 'వెళ్లకండి', 'నిషేధం', 'ప్రమాద ప్రాంతం',
      'தவிர்க்கவும்', 'தவிர்க்க', 'தவிர்ப்பது', 'தள்ளி நிற்கவும்', 'தள்ளி நிற்க', 'செல்லாதீர்',
      'தடை', 'தடுக்க', 'ஆபத்து பகுதி', 'செல்லக்கூடாத', 'போகாதீர்',
      'এড়িয়ে চলুন', 'দূরে থাকুন', 'যাবেন না', 'নিষিদ্ধ', 'বিপজ্জনক এলাকা',
      'এড়িয়ে চলা', 'চলা উচিত', 'এড়িয়ে যাওয়া', 'এড়িয়ে', 'দূরে থাকা',
      'ଏଡ଼ାଇବି', 'ଦୂରେ ରହିବି', 'ଯିବ ନାହିଁ', 'ନିଷେଧ', 'ବିପଦ ଅଞ୍ଚଳ',
      'ਬਚ ਜਾਓ', 'ਬਚਣਾ', 'ਬਚਣ ਯੋਗ', 'ਦੂਰ ਰਹੋ', 'ਨਾ ਜਾਓ', 'ਨਾ ਜਾਣਾ', 'ਪਾਬੰਦੀ',
      'ਪਾਬੰਦੀਸ਼ੁਦਾ', 'ਖ਼ਤਰਨਾਕ ਇਲਾਕਾ', 'ਟਾਲਣਾ',
    ]),
    L(3, [
      // "Avoid / restricted waters" in the Dravidian and West/East-coast
      // languages. Each bigram matches the canonical phrasing; the unigrams
      // below widen coverage. Marathi's "मासेमारी" in its question would
      // otherwise tip the row to FIND_PFZ, so its avoid terms must outscore it.
      'टाळणे आवश्यक', 'प्रतिबंधित जलक्षेत्र',
      'నివారించాలి', 'నియంత్రించిన నీటి',
      'ತಪ್ಪಿಸಬೇಕು', 'ಸೀಮಿತ ಜಲಪ್ರದೇಶ',
      'વિસ્તારો ટાળવા', 'ટાળવા જોઈએ', 'પ્રતિબంధિત જળ',
      'ഒഴിവാക്കണം', 'നിയന്ത്രിത ജലമേഖല',
      'ਖੇਤਰ ਟਾਲਣੇ', 'ਟਾਲਣੇ ਚਾਹੀਦੇ', 'ਪਾਬੰਦੀਸ਼ੁਦਾ ਜਲ',
    ]),
    L(2, [
      'प्रतिबंधित',
      'నీటి ప్రాంతాలు', 'ప్రాంతాలను',
      'ಜಲಪ್ರದೇಶಗಳಿವೆಯೇ', 'ಸೀಮಿತ',
      'વિસ્તારો', 'જળ વિસ્તાર',
      'മേഖലകൾ', 'ജലമേഖലകൾ',
      'ਜਲ ਖੇਤਰ', 'ਖੇਤਰ',
    ]),
  ],

  OCEAN_STATE: [
    L(2, [
      'sea state', 'wave height', 'wave height is', 'how big are the waves', 'how rough',
      'how rough is the sea', 'how rough is it', 'is the sea rough', 'sea is rough',
      'rough today', 'sea looks', 'how is the sea state', 'state of the sea',
      'is it calm', 'how calm', 'are the waves', 'wave forecast', 'swell height',
      'roughness', 'swell', 'ocean current', 'tidal current', 'waves are', 'big waves',
      'समुद्र की लहरें', 'लहरों की ऊंचाई', 'समुद्री धारा', 'कितनी लहरें',
      'દરિયાની લહેરો', 'લહેરાની ઊંચાઈ', 'દરિયાનો પ્રવાહ', 'કેટલી લહેરા',
      'ಸಮುದ್ರದ ಅಲೆ', 'ಅಲೆಗಳ ಎತ್ತ', 'ಸಮುದ್ರ ಪ್ರವಾಹ', 'ಎಷ್ಟು ಅಲೆ',
      'കടലിന്റെ താരത്തിന്റെ ഉയരം', 'അല്ലിന്റെ ഉയരം', 'കടൽ പ്രവാഹം',
      'సముద్ర తరంగాల ఎత్తు', 'తరంగాల ఎత్తు', 'సముద్ర ప్రవాహం',
      'அலை உயரம்', 'அலைகள் எவ்வளவு', 'கடல் ஓட்டம்',
      'ঢেউয়ের উচ্চতা', 'ঢেউ কত উঁচু', 'সামুদ্রিক প্রবাহ',
      'ଲହେରା ଉଚତା', 'ଲହେରା କେତେ ଉଚ୍ଚ', 'ସାମୁଦ୍ରିକ ପ୍ରବାହ',
      'ਲਹਿਰਾਂ ਦੀ ਊਂਚਾਈ', 'ਲਹਿਰਾਂ ਕਿੰਨੀਆਂ', 'ਸਮੁੰਦਰੀ ਧਾਰਾ',
    ]),
  ],

  WEATHER_BRIEF: [
    L(2, [
      'weather report', 'weather forecast', 'how is the weather', 'weather today',
      'coastal weather forecast', 'coastal weather', 'weather forecast for',
      'forecast for tomorrow', 'weather going to do', 'what is the weather',
      'will it rain', 'wind speed', 'temperature today', 'is it going to rain',
      'मौसम का पूर्वानुमान', 'मौसम कैसा रहेगा', 'हवा की रफ्तार', 'बारिश होगी',
      'હવામાન આગાહી', 'હવામાન કેવું રહેશે', 'પવનની ઝડપ', 'વરસાદ થશે',
      'ಹವಾಮಾನ ಮುನ್ಸೂಚನೆ', 'ಹವಾಮಾನ ಹೇಗಿರುತ್ತದೆ', 'ಗಾಳಿಯ ವೇಗ', 'ಮಳೆ ಆಗುತ್ತದೆ',
      'വാതാവരണ പ്രവാഹകം', 'കാലാവസ്ഥ എങ്ങനെ', 'കാറ്റിന്റെ വേഗം', 'മഴ പെയ്യുമോ',
      'వాతావరణ సూచన', 'వాతావరణం ఎలా', 'గాలి వేగం', 'వర్షం పడుతుందా',
      'வானிலை முன்னறிவிப்பு', 'வானிலை எப்படி', 'காற்று வேகம்', 'மழை பெய்யுமா',
      'আবহাওয়ার পূর্বাভাস', 'আবহাওয়া কেমন', 'বাতাসের গতি', 'বৃষ্টি হবে',
      'ପାଣିପାଗ ପୂରବାରଙ୍ଗନ', 'ପାଣିପାଗ କିପରି', 'ବାତାସ ବେଗ', 'ବର୍ଷା ହେବ',
      'ਮੌਸਮ ਪੂਰਵਾਂਕਣ', 'ਮੌਸਮ ਕਿਵੇਂ ਰਹੇਗਾ', 'ਹਵਾ ਦੀ ਗਤੀ', 'ਮੀਂਹ ਪੈਂਗੇ',
    ]),
  ],
};

/** Facet detectors decide which extra agents to run even for a specific intent. */
const FACETS: Record<string, string[]> = {
  weather: ['मौसम', 'हवा', 'बारिश', 'હવામાન', 'પવન', 'વરસાદ', 'ಹವಾಮಾನ', 'ಗಾಳಿ', 'ಮಳೆ', 'കാലാവസ്ഥ', 'മഴ', 'ഗാളി', 'వాతావరణం', 'వర్షం', 'வானிலை', 'மழை', 'காற்று', 'আবহাওয়া', 'বাতাস', 'বৃষ্টি', 'ପାଣିପାଗ', 'ਮੌਸਮ'],
  ocean: ['लहर', 'समुद्र', 'धारा', 'લહેર', 'સમુદ્ર', 'ಅಲೆ', 'ಸಮುದ್ರ', 'അല്ല', 'കടൽ', 'తరంగం', 'సముద్రం', 'அலை', 'கடல்', 'ঢেউ', 'সমুদ্র', 'ଲହେରା', 'ਸਮੁੰਦਰ', 'ਲਹਿਰ'],
  alerts: ['चेतावनी', 'अलर्ट', 'खतरा', 'चक्रवात', 'चેતવણી', 'ચેતવણી', 'જોખમ', 'ಎಚ್ചರಿಕೆ', 'ಅಪಾಯ', 'അറിയിപ്പും', 'അപകടം', 'హెచ్చరిక', 'ప్రమాదం', 'எச்சரிக்கை', 'ஆபத்து', 'সতর্কতা', 'বিপদ', 'ଚେତାବନୀ', 'ਬਿਪਦ', 'ਚੇਤਾਵਨੀ', 'warning', 'alert', 'cyclone', 'lightning', 'hazard'],
  route: ['मार्ग', 'रास्ता', 'માર્ગ', 'રસ્તો', 'ಮಾರ್ಗ', 'ದಾರಿ', 'വഴി', 'మార్గం', 'దారి', 'வழி', 'பாதை', 'পথ', 'রাস্তা', 'ମାର୍ଗ', 'ଦାରି', 'ਰਾਹ', 'route', 'path'],
  map: ['नक्शा', 'नक्शे', 'मानचित्र', 'નકશો', 'નકશા', 'ನಕ್ಷೆ', 'ഭാരഗതിക', 'మ్యాప్', 'కోటు', 'நிலப்படம்', 'মানচিত্র', 'নকশা', 'ନଖନା', 'ਨਕਸ਼ਾ', 'map', 'chart', 'graph', 'plot'],
};

/** Terms meaning "there / that place / it" — signals a context follow-up. */
const REFERENT_TERMS = [
  'there', 'that place', 'that zone', 'that area', 'it', 'same place', 'that one',
  'from there', 'and then', 'what about',
  'वहाँ', 'वहां', 'उस जगह', 'उस ज़ोन', 'वहाँ से', 'और वहाँ', 'इसके बाद',
  'ત્યાં', 'ત્યાંથી', 'તે જગ્યા', 'તે વિભાગ',
  'ಅಲ್ಲಿ', 'ಅಲ್ಲಿಂದ', 'ಆ ಜಾಗ', 'ಆ ವಲಯ',
  'അവിടെ', 'അവിടെയിൽ', 'അവിടെയുന്ന', 'ആ സ്ഥലത്ത്',
  'అక్కడ', 'అక్కడి', 'ఆ ప్రాంతం', 'అక్కడి నుండి',
  'அங்கு', 'அங்கே', 'அந்த இடத்தில்', 'அந்த பகுதி',
  'সেখানে', 'সেই জায়গা', 'সেই এলাকা', 'ওখান থেকে',
  'ସେଉଁଠି', 'ସେଇ ସ୍ଥାନ', 'ଆ ଅଞ୍ଚଳ',
  'ਉੱਥੇ', 'ਉਸ ਥਾਂ', 'ਉਸ ਜ਼ੋਨ',
];

/* ------------------------------------------------------------------ *
 * Normalisation
 * ------------------------------------------------------------------ */

/**
 * Fold a question to a comparable token stream.
 *
 * `\p{M}` (marks) has to be in the keep-set. Every Devanagari, Bengali,
 * Gujarati, Gurmukhi, Oriya, Tamil, Telugu and Kannada vowel sign is a
 * combining mark in category `Mc`, not a letter, so a keep-set of
 * `\p{L}\p{N}` silently deletes them: "मछली" tokenises to "मछल" and none of the
 * Indic lexicon entries can ever match. The consequence is not a cosmetic one —
 * it sends every question typed in an Indian language to the catch-all
 * GENERAL_MARINE intent instead of routing it to the agent that can answer it.
 */
const normalise = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** All 1..4 grams of the token stream, space-joined. */
function buildGrams(text: string): Set<string> {
  const tokens = normalise(text).split(' ').filter(Boolean);
  const grams = new Set<string>();
  for (let n = 1; n <= 4; n++) {
    for (let i = 0; i + n <= tokens.length; i++) {
      grams.add(tokens.slice(i, i + n).join(' '));
    }
  }
  return grams;
}

/* ------------------------------------------------------------------ *
 * Slot vocabularies
 * ------------------------------------------------------------------ */

/** Location vocabulary harvested from the harbour gazetteer plus regions. */
const LOCATION_TERMS: Array<{ term: string; harbor: HarborLocation }> = (() => {
  const seen = new Set<string>();
  const out: Array<{ term: string; harbor: HarborLocation }> = [];

  const push = (term: string, harbor: HarborLocation) => {
    const key = normalise(term);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push({ term: key, harbor });
  };

  for (const harbor of HARBORS) {
    push(harbor.shortName, harbor);
    push(harbor.id, harbor);
    push(harbor.name, harbor);
    for (const alias of harbor.aliases) push(alias, harbor);
  }

  // Region and state names resolve to the region's representative harbour.
  const byRegion = new Map<string, HarborLocation>();
  for (const harbor of HARBORS) {
    if (!byRegion.has(harbor.region)) byRegion.set(harbor.region, harbor);
  }
  for (const [region, harbor] of byRegion) {
    push(region, harbor);
  }

  return out;
})().sort((a, b) => b.term.length - a.term.length);

/** Vessel vocabulary keyed to `VesselProfile.id`. */
const VESSEL_TERMS: Array<{ term: string; vesselId: string }> = [
  { term: 'country boat', vesselId: 'country_boat' },
  { term: 'country boat', vesselId: 'country_boat' },
  { term: 'surf canoe', vesselId: 'country_boat' },
  { term: 'कंट्री बोट', vesselId: 'country_boat' },
  { term: 'દેશી બોટ', vesselId: 'country_boat' },
  { term: 'ದೇಶದ ದೋಣಿ', vesselId: 'country_boat' },
  { term: 'കാര്കിക്കൽ', vesselId: 'country_boat' },
  { term: 'డంగీ', vesselId: 'country_boat' },
  { term: 'సొమ్ము', vesselId: 'country_boat' },
  { term: 'நாட்டு படகு', vesselId: 'country_boat' },
  { term: 'কাটা বোট', vesselId: 'country_boat' },
  { term: 'କଟା ବୋଟ', vesselId: 'country_boat' },
  { term: 'ਕੌਰਟਰੀ ਬੋਟ', vesselId: 'country_boat' },

  { term: 'dinghy', vesselId: 'motorized_dinghy' },
  { term: 'dingi', vesselId: 'motorized_dinghy' },
  { term: 'motorised boat', vesselId: 'motorized_dinghy' },
  { term: 'motorized boat', vesselId: 'motorized_dinghy' },
  { term: 'small boat', vesselId: 'motorized_dinghy' },
  { term: 'fibre glass boat', vesselId: 'motorized_dinghy' },
  { term: 'frp boat', vesselId: 'motorized_dinghy' },
  { term: 'डिंगी', vesselId: 'motorized_dinghy' },
  { term: 'छोटी नाव', vesselId: 'motorized_dinghy' },
  { term: 'ડીંગી', vesselId: 'motorized_dinghy' },
  { term: 'નાની બોટ', vesselId: 'motorized_dinghy' },
  { term: 'ಡಿಂಗಿ', vesselId: 'motorized_dinghy' },
  { term: 'ಸಣ್ಣ ದೋಣಿ', vesselId: 'motorized_dinghy' },
  { term: 'ഡിംഗി', vesselId: 'motorized_dinghy' },
  { term: 'ചെറിയ വള്ളം', vesselId: 'motorized_dinghy' },
  { term: 'డింగి', vesselId: 'motorized_dinghy' },
  { term: 'చిన్న పడవు', vesselId: 'motorized_dinghy' },
  { term: 'சிறிய படகு', vesselId: 'motorized_dinghy' },
  { term: 'ছোট নৌকা', vesselId: 'motorized_dinghy' },
  { term: 'ଅତି କିଛୁ ନାଓକା', vesselId: 'motorized_dinghy' },
  { term: 'ਛੋਟੀ ਨੌਕਾ', vesselId: 'motorized_dinghy' },

  { term: 'gillnetter', vesselId: 'gillnetter' },
  { term: 'gill netter', vesselId: 'gillnetter' },
  { term: 'gill net', vesselId: 'gillnetter' },
  { term: 'गिलनेटर', vesselId: 'gillnetter' },
  { term: 'ગિલનેટર', vesselId: 'gillnetter' },
  { term: 'ಗಿಲ್‌ನೆಟ್', vesselId: 'gillnetter' },
  { term: 'ഗിൽനെറ്റർ', vesselId: 'gillnetter' },
  { term: 'జిల్‌నెట్టర్', vesselId: 'gillnetter' },
  { term: 'கில்நெட்டர்', vesselId: 'gillnetter' },
  { term: 'জিলনেটার', vesselId: 'gillnetter' },
  { term: 'ଜିଲନେଟଟର', vesselId: 'gillnetter' },
  { term: 'ਜਿਲਨੈਟਰ', vesselId: 'gillnetter' },

  { term: 'trawler', vesselId: 'trawler' },
  { term: 'trawling boat', vesselId: 'trawler' },
  { term: 'ट्रॉलर', vesselId: 'trawler' },
  { term: 'ટ્રાવલર', vesselId: 'trawler' },
  { term: 'ಟ್ರಾವ್ಲರ್', vesselId: 'trawler' },
  { term: 'ട്രോളർ', vesselId: 'trawler' },
  { term: 'ట్రௌలர்', vesselId: 'trawler' },
  { term: 'டிராலர்', vesselId: 'trawler' },
  { term: 'ট্রলার', vesselId: 'trawler' },
  { term: 'ଟ୍ରାଲର', vesselId: 'trawler' },
  { term: 'ਟਰਾਵਲਰ', vesselId: 'trawler' },

  { term: 'purse seiner', vesselId: 'purse_seiner' },
  { term: 'seiner', vesselId: 'purse_seiner' },
  { term: 'पर्स सीनर', vesselId: 'purse_seiner' },
  { term: 'પર્સ સીનર', vesselId: 'purse_seiner' },
  { term: 'ಪರ್ಸ್ ಸೀನರ್', vesselId: 'purse_seiner' },
  { term: 'പേർസ് സീനർ', vesselId: 'purse_seiner' },
  { term: 'పర్స్ సీనర్', vesselId: 'purse_seiner' },
  { term: 'பர்ஸ் சீனர்', vesselId: 'purse_seiner' },
  { term: 'পার্স সিনার', vesselId: 'purse_seiner' },
  { term: 'ପର୍ସ ସିନର', vesselId: 'purse_seiner' },
  { term: 'ਪਰਸ ਸੀਨਰ', vesselId: 'purse_seiner' },

  { term: 'deep sea trawler', vesselId: 'deep_sea_trawler' },
  { term: 'deep sea', vesselId: 'deep_sea_trawler' },
  { term: 'बड़ी नाव', vesselId: 'deep_sea_trawler' },
  { term: 'મોટું વહાણ', vesselId: 'deep_sea_trawler' },
  { term: 'ದೊಡ್ಡ ಹಡದು', vesselId: 'deep_sea_trawler' },
  { term: 'വലിയ കപ്പൽ', vesselId: 'deep_sea_trawler' },
  { term: 'పెద్ద ఓడ', vesselId: 'deep_sea_trawler' },
  { term: 'பெரிய கப்பல்', vesselId: 'deep_sea_trawler' },
  { term: 'বড় জাহাজ', vesselId: 'deep_sea_trawler' },
  { term: 'ବଡ ଜହାଜ', vesselId: 'deep_sea_trawler' },
  { term: 'ਵੱਡਾ ਜਹਾਜ਼', vesselId: 'deep_sea_trawler' },
].sort((a, b) => b.term.length - a.term.length);

const DEFAULT_VESSEL = DEFAULT_VESSEL_ID;

/* ------------------------------------------------------------------ *
 * Horizon parsing
 * ------------------------------------------------------------------ */

const HORIZON_TERMS: Array<{ horizon: TimeHorizon; terms: string[] }> = [
  {
    horizon: 'WEEK',
    terms: [
      'this week', 'next week', 'whole week', 'for the week', 'weekly', 'over the week',
      'सप्ताह', 'हफ्ते', 'इस सप्ताह', 'अगले सप्ताह',
      'અઠવાડિયું', 'આ અઠવાડિયું', 'આગલા અઠવાડિયા',
      'ವಾರ', 'ಈ ವಾರ', 'ಮುಂದಿನ ವಾರ',
      'ആഴ്ച', 'ഈ ആഴ്ച', 'അടുത്ത ആഴ്ച',
      'వారం', 'ఈ వారం', 'వచ్చే వారం',
      'வாரம்', 'இந்த வாரம்', 'அடுத்த வாரம்',
      'সপ্তাহ', 'এই সপ্তাহ', 'পরের সপ্তাহ',
      'ସପ୍ତାହ', 'ଏଇ ସପ୍ତାହ', 'ଆଗଲା ସପ୍ତାହ',
      'ਹਫ਼ਤੇ', 'ਇਹ ਹਫ਼ਤੇ', 'ਅਗਲੇ ਹਫ਼ਤੇ',
    ],
  },
  {
    horizon: 'NEXT_3_DAYS',
    terms: [
      'next 3 days', 'next three days', '3 days', 'three days', 'coming 3 days',
      'few days', 'next few days', 'coming days', '2 days', 'next 2 days',
      '3 दिन', 'तीन दिन', 'अगले 3 दिन', 'अगले कुछ दिन', 'आने वाले दिन', '2 दिन',
      '3 દિવસ', 'ત્રણ દિવસ', 'આગલા 3 દિવસ', 'આગલા થોડા દિવસ', '2 દિવસ',
      '3 ದಿನ', 'ಮೂರು ದಿನ', 'ಮುಂದಿನ 3 ದಿನ', 'ಇತ್ತೀಚಿನ ಕೆಲವು ದಿನ', '2 ದಿನ',
      '3 ദിവസം', 'മൂന്ന് ദിവസം', 'അടുത്ത 3 ദിവസം', 'അടുത്ത കുറച്ച് ദിവസങ്ങൾ', '2 ദിവസം',
      '3 రోజులు', 'మూడు రోజులు', 'రాబోయి 3 రోజులు', 'రాబోయి కొన్ని రోజులు', '2 రోజులు',
      '3 நாட்கள்', 'மூன்று நாட்கள்', 'வரும் 3 நாட்கள்', 'சில நாட்கள்', '2 நாட்கள்',
      '3 দিন', 'তিন দিন', 'পরের 3 দিন', 'পরের কয়েক দিন', '2 দিন',
      '3 ଦିନ', 'ତିନି ଦିନ', 'ଆଗଲା 3 ଦିନ', 'ଆଗଲା କିଛି ଦିନ', '2 ଦିନ',
      '3 ਦਿਨ', 'ਤਿੰਨ ਦਿਨ', 'ਅਗਲੇ 3 ਦਿਨ', 'ਅਗਲੇ ਕੁਝ ਦਿਨ',
    ],
  },
  {
    horizon: 'TOMORROW',
    terms: [
      'tomorrow', 'tomorow', 'next day', 'the day after', 'kal',
      'कल', 'उदा', 'उद्दा', 'उधवा', 'आने वाला कल', 'कल का',
      'કાલે', 'આવતી કાલે', 'આવતા કાલે',
      'ನಾಳೆ', 'ಮುಂದಿನ ದಿನ', 'ನಾಳೆಯ',
      'നാളെ', 'വരുന്ന ദിവസം',
      'రేదు', 'రేటు', 'వచ్చే రోజు',
      'நாளை', 'நாளைய',
      'আগামীকাল', 'আগামী দিন', 'পরদিন',
      'ଆଗାମୀକାଲ', 'ଆଗାମୀ ଦିନ',
      'ਕੱਲ੍ਹ', 'ਅਗਲੀ ਸਵੇਰ',
    ],
  },
  {
    horizon: 'TODAY',
    terms: [
      'today', 'aaj', 'this morning', 'this evening', 'this afternoon', 'tonight',
      'in hours', 'within hours', 'later today', 'this time',
      'आज', 'इस समय', 'आज के', 'आज सुबह', 'आज शाम',
      'આજે', 'આ સમયે', 'આજે સવારે', 'આજે સાંજે',
      'ಇಂದು', 'ಇದುದು', 'ಈ ಸಮಯ', 'ಇಂದು ಬೆಳಗೆ', 'ಇಂದು ಸಂಜೆ',
      'ഇന്ന്‍കുന്ന്‍രേറ്റ്', 'ഇന്ന്', 'ഇപ്പോള്', 'ഇന്ന് രാവിലെ', 'ഇന്ന് ഉച്ചയോളം',
      'ఈరోజు', 'ఈ రోజు', 'ఇప్పుడు', 'ఈ సమయంలో', 'ఈరోజు ఉదయం',
      'இன்று', 'இப்போது', 'இந்த நேரம்', 'இன்று காலை', 'இன்று மாலை',
      'আজ', 'এখন', 'এই সময়', 'আজ সকালে', 'আজ সন্ধ্যায়',
      'ଆଜି', 'ଏବେ', 'ଏହା ସମୟରେ', 'ଆଜି ସକାଳେ',
      'ਅੱਜ', 'ਹੁਣ', 'ਇਸ ਸਮੇਂ', 'ਅੱਜ ਸਵੇਰ',
    ],
  },
  {
    horizon: 'NOW',
    terms: [
      'now', 'right now', 'currently', 'current', 'at the moment', 'present',
      'immediately', 'this minute', 'abhi', 'at this moment',
      'अभी', 'इस समय', 'वर्तमान', 'फिलहाल',
      'હવે', 'અત્યારે', 'વર્તમાન',
      'ಈಗ', 'ಇದೀಗ', 'ಪ್ರಸ್ತುತ',
      'ഇപ്പോഴും', 'ഇപ്പോൾ', 'വർത്തമാനം',
      'ఇప్పుడు', 'ప్రస్తుతం', 'ఈ సమయంలో',
      'இப்போது', 'தற்போது', 'இந்நாளை',
      'এখন', 'বর্তমান', 'এই মুহূর্তে',
      'ବର୍ତ୍ମାନ', 'ଏବେ', 'ତକ୍ଷଣ',
      'ਹੁਣ', 'ਇਸ ਵੇਲੇ', 'ਮੌਜੂਦਾ',
    ],
  },
];

/* ------------------------------------------------------------------ *
 * Parsed query
 * ------------------------------------------------------------------ */

export interface ParsedQuery {
  raw: string;
  /** Lower-cased, punctuation-free form used for all matching. */
  normalised: string;
  language: LanguageCode;
  languageDetection: LanguageDetection;
  intent: IntentType;
  intentConfidence: number;
  /** Surface forms that produced the winning intent, for explainability. */
  matchedTerms: string[];
  /** Full ranking, so the planner can justify a decision or re-route. */
  candidates: Array<{ intent: IntentType; score: number }>;
  horizon: TimeHorizon;
  harborId?: string;
  harborName?: string;
  /** `from` and `to` positions for routing questions. */
  originHarborId?: string;
  destinationHarborId?: string;
  vesselId: string;
  /** True when the utterance leans on previous context ("there", "from there"). */
  referencesContext: boolean;
  facets: {
    tide: boolean;
    weather: boolean;
    ocean: boolean;
    alerts: boolean;
    route: boolean;
    map: boolean;
  };
}

const HORIZON_BY_DAY: Array<[TimeHorizon, string[]]> = HORIZON_TERMS.map((h) => [h.horizon, h.terms]);

function parseHorizon(grams: Set<string>, normal: string): TimeHorizon {
  for (const [horizon, terms] of HORIZON_BY_DAY) {
    for (const term of terms) {
      if (grams.has(term)) return horizon;
    }
  }

  // Fall back to a loose substring test so inflected forms ("tomorrow's",
  // "कलवाले") still land on the right horizon.
  for (const [horizon, terms] of HORIZON_BY_DAY) {
    if (terms.some((term) => term.length >= 3 && normal.includes(term))) return horizon;
  }

  return 'TODAY';
}

function findHarbor(grams: Set<string>, normal: string): HarborLocation | undefined {
  for (const entry of LOCATION_TERMS) {
    if (grams.has(entry.term)) return entry.harbor;
  }
  for (const entry of LOCATION_TERMS) {
    if (entry.term.length >= 4 && normal.includes(entry.term)) return entry.harbor;
  }
  return undefined;
}

function findVessel(grams: Set<string>, normal: string): string {
  for (const entry of VESSEL_TERMS) {
    if (grams.has(entry.term)) return entry.vesselId;
  }
  for (const entry of VESSEL_TERMS) {
    if (entry.term.length >= 5 && normal.includes(entry.term)) return entry.vesselId;
  }
  return DEFAULT_VESSEL;
}

function scoreIntent(grams: Set<string>): { intent: IntentType; score: number; terms: string[] }[] {
  const results: Array<{ intent: IntentType; score: number; terms: string[] }> = [];

  for (const [intent, lexicons] of Object.entries(LEXICONS) as Array<
    [Exclude<IntentType, 'GENERAL_MARINE'>, Lexicon[]]
  >) {
    let score = 0;
    const terms: string[] = [];

    for (const { terms: lexiconTerms, weight } of lexicons) {
      let hits = 0;
      for (const term of lexiconTerms) {
        if (grams.has(term)) {
          hits += 1;
          terms.push(term);
        }
      }
      if (hits > 0) {
        // Diminishing returns inside one lexicon group so that a single long
        // question stuffed with synonyms cannot dominate outright.
        score += weight * (1 + Math.log2(hits) * 0.4);
      }
    }

    if (score > 0) results.push({ intent, score, terms });
  }

  return results.sort((a, b) => b.score - a.score);
}

const MARINE_CONTEXT_TERMS = [
  'sea', 'ocean', 'coast', 'fish', 'fishing', 'boat', 'vessel', 'harbour', 'harbor', 'port',
  'tide', 'wave', 'wind', 'weather', 'pfz', 'alert', 'route', 'marine',
  'समुद्र', 'नाव', 'मछली', 'समुद्री', 'किनारा', 'बंदरगाह',
  'દરિયા', 'નાવ', 'માછ', 'દરિયાકિનારો', 'દરિયાકૂલ',
  'ಸಮುದ್ರ', 'ದೋಣಿ', 'ಮೀನು', 'ಕರಾವಳಿ', 'ಸಮುದ್ರದ',
  'കടൽ', 'വള്ളം', 'മീൻ', 'തീരം', 'തുറ',
  'సముద్రం', 'వచ్చన', 'చేపలు', 'తీరం', 'రేవ',
  'கடல்', 'படகு', 'மீன்', 'கரை', 'துறை',
  'সমুদ্র', 'নৌকা', 'মাছ', 'উপকূল', 'বন্দর',
  'ସାଗର', 'ନାଓକା', 'ମାଛ', 'ତଟ', 'ବନ୍ଦର',
  'ਸਮੁੰਦਰ', 'ਨੌਕਾ', 'ਮੱਛ', 'ਤਟ', 'ਬੰਦਰ',
];

/**
 * Parse a user utterance into a canonical intent plus resolved slots.
 *
 * @param raw        The user's message.
 * @param preferred  The UI language selection, used only to break ties.
 * @param memory     Prior turns, used to resolve anaphora like "there".
 */
export function parseQuery(
  raw: string,
  preferred: LanguageCode = 'en-IN',
  memory?: ConversationMemory,
): ParsedQuery {
  const text = (raw ?? '').trim();
  const normalised = normalise(text);
  const grams = buildGrams(text);
  const languageDetection = detectLanguage(text, preferred);

  const ranked = scoreIntent(grams);
  const winner = ranked[0];

  let intent: IntentType = 'GENERAL_MARINE';
  let intentConfidence = 0.25;
  let matchedTerms: string[] = [];

  if (winner) {
    intent = winner.intent;
    matchedTerms = winner.terms;
    const runnerUp = ranked[1]?.score ?? 0;
    // Margin-based confidence: a clear winner is trusted more than a tie.
    const margin = runnerUp > 0 ? winner.score / (winner.score + runnerUp) : 1;
    const volume = Math.min(1, winner.score / 4);
    intentConfidence = Math.min(0.97, 0.4 + margin * 0.35 + volume * 0.25);
  } else {
    // No lexical hit at all: if the utterance still sounds like marine chat,
    // fall back to the situation report rather than pretending we understood.
    const marineHits = MARINE_CONTEXT_TERMS.filter((t) => grams.has(t)).length;
    if (marineHits === 0 && normalised.length > 0 && memory?.turnCount) {
      intent = 'GENERAL_MARINE';
      intentConfidence = 0.2;
    } else {
      intentConfidence = 0.3;
    }
  }

  const horizon = parseHorizon(grams, normalised);
  const explicitHarbor = findHarbor(grams, normalised);
  const vesselId = findVessel(grams, normalised);

  const referencesContext =
    (explicitHarbor === undefined && memory?.turnCount !== undefined && memory.turnCount > 0) ||
    REFERENT_TERMS.some((term) => grams.has(term));

  // Routing: the first mentioned harbour is the origin, the second the
  // destination. With only one, the origin is the harbour and the
  // destination becomes the nearest fishing ground (filled in by the planner).
  let originHarborId: string | undefined;
  let destinationHarborId: string | undefined;
  if (intent === 'SAFE_ROUTE') {
    const mentioned: string[] = [];
    for (const entry of LOCATION_TERMS) {
      if (grams.has(entry.term) || (entry.term.length >= 4 && normalised.includes(entry.term))) {
        if (!mentioned.includes(entry.harbor.id)) mentioned.push(entry.harbor.id);
      }
      if (mentioned.length >= 2) break;
    }
    originHarborId = mentioned[0];
    destinationHarborId = mentioned[1];
  }

  const tideFacetTerms = new Set<string>([
    'tide', 'tidal', 'high tide', 'low tide', 'ज्वार', 'भरत', 'तिहार', 'जॉर',
    'જ્હાર', 'તરફ', 'ಜ್ಹಾರ', 'ಎಬೆ', 'വേള', 'തിരയോടുക', 'വേളയും', 'ఉదయం', 'ఇళ్గొంతు',
    'உழைப்பு', 'இறங்கு', 'உழைப்பு நீர்', 'உழைப்பு நீர்நிலை', 'ஜোয়ার', 'জোয়াৰ', 'জোয়াৰ জোয়াৰ',
    'ਜਵਾਰ', 'ਲੋਵ', 'ਲੋਵ ਟਾਈਮ',
  ]);

  const facets = {
    tide: intent === 'TIDE_WEATHER_SEA' || [...tideFacetTerms].some((t) => grams.has(t)),
    weather: FACETS.weather.some((t) => grams.has(t)) || intent === 'WEATHER_BRIEF',
    ocean: FACETS.ocean.some((t) => grams.has(t)) || intent === 'OCEAN_STATE',
    alerts: FACETS.alerts.some((t) => grams.has(t)) || intent === 'HAZARD_ALERTS',
    route: FACETS.route.some((t) => grams.has(t)) || intent === 'SAFE_ROUTE',
    map: FACETS.map.some((t) => grams.has(t)),
  };

  return {
    raw: text,
    normalised,
    language: languageDetection.language,
    languageDetection,
    intent,
    intentConfidence,
    matchedTerms,
    candidates: ranked.map((r) => ({ intent: r.intent, score: Math.round(r.score * 100) / 100 })),
    horizon,
    harborId: explicitHarbor?.id,
    harborName: explicitHarbor?.shortName,
    originHarborId,
    destinationHarborId,
    vesselId,
    referencesContext,
    facets,
  };
}

/** Resolve the reference point a request should be evaluated from. */
export function resolveAnchor(parsed: ParsedQuery, memory?: ConversationMemory): {
  harborId: string;
  label: string;
  basis: 'explicit' | 'memory' | 'default';
} {
  if (parsed.harborId) {
    const harbor = HARBORS.find((h) => h.id === parsed.harborId);
    if (harbor) return { harborId: harbor.id, label: harbor.shortName, basis: 'explicit' };
  }
  if (parsed.originHarborId) {
    const harbor = HARBORS.find((h) => h.id === parsed.originHarborId);
    if (harbor) return { harborId: harbor.id, label: harbor.shortName, basis: 'explicit' };
  }
  if (parsed.referencesContext && memory?.activeHarborId) {
    const harbor = HARBORS.find((h) => h.id === memory.activeHarborId);
    if (harbor) return { harborId: harbor.id, label: harbor.shortName, basis: 'memory' };
  }
  return { harborId: HARBORS[0].id, label: HARBORS[0].shortName, basis: 'default' };
}

/** Every intent the current roster should be able to answer, for the UI. */
export const ALL_INTENTS: IntentType[] = [
  'FIND_PFZ',
  'PFZ_HOTSPOTS',
  'SAFETY_ASSESSMENT',
  'TIDE_WEATHER_SEA',
  'HAZARD_ALERTS',
  'SAFE_ROUTE',
  'PRODUCTIVITY_DIAGNOSIS',
  'AVOID_ZONES',
  'GEOFENCE_PROXIMITY',
  'OCEAN_STATE',
  'WEATHER_BRIEF',
  'GENERAL_MARINE',
];

/** Default vessel list re-export so callers need only import this module. */
export const SUPPORTED_VESSEL_IDS = VESSEL_PROFILES.map((v) => v.id);
