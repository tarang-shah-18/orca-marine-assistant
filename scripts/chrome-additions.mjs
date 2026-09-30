/**
 * UI-chrome strings that the English-leakage scan found outside the answer path.
 *
 * The answer prose was localized in an earlier pass; these are the frames around
 * it — the engineering panel, the build hub, the geofence panel and the map
 * tooltips. A judge reading a Tamil-language screen should not hit an English
 * section header, and a fisher reading a geofence warning should not have to
 * decode "Zones to stay clear of" in a second language while deciding whether to
 * enter a naval firing box.
 *
 * Deliberately NOT translated, because they are proper nouns or verbatim
 * identifiers rather than prose:
 *   - "ORCA", "SIH 2026", "Problem ID 26176", "ISRO / Department of Space"
 *   - "Android", "APK", "Expo", "EAS", "Expo Go", "TypeScript", "Express"
 *   - file paths, env var names, command text, JSON keys
 *   - "Software · Space Technology" (the submission's own technology bucket)
 *   - `violation.regulation` and `violation.boundaryName` (published authority
 *     text — see the provenance note above GEOFENCES in core/dataset.ts)
 *
 * `{n}` / `{name}` / `{km}` / `{cycle}` / `{count}` / `{sources}` / `{lang}` are
 * filled by the consuming component.
 */
export const CHROME_TRANSLATIONS = {
'en-IN': {
    /* ---- InfoScreen: build hub ---- */
    infoBuildHubWord: 'Android build & source',
    infoApkGuideWord: 'APK & deployment guide',
    infoApkGuideBodyWord:
      'Expo React Native client, the TypeScript agent engine and the Express API — with the commands to run and package each one.',
    infoOpenBuildWord: 'Open build instructions',

    /* ---- InfoScreen: engine status ---- */
    infoEngineStatusWord: 'Engine status',
    infoBrowserEngineWord:
      'In-browser engine — the API is unreachable, so the same agents are running locally.',
    infoServerConnectedWord: 'Server connected — agents running on the Node engine.',
    infoVersionWord: 'Version',
    infoAiLayerWord: 'AI layer',
    infoSessionsWord: 'Sessions',
    infoReferenceCycleWord: 'Reference cycle',
    infoLocalWord: 'local',
    infoDeterministicWord: 'deterministic',
    infoBundledSnapshotWord: 'bundled snapshot',
    infoNoApiKeyWord:
      'No GEMINI_API_KEY set. ORCA is fully functional without it — the optional model only rewrites the plan rationale and the answer prose, and can never add or remove a safety-critical agent.',

    /* ---- InfoScreen: roster, coverage, acceptance, safety ---- */
    infoRosterWord: 'Agent roster ({n})',
    infoRosterBodyWord:
      'A planner decomposes each question into a task graph and selects a subset of these specialists. They publish typed findings to a shared blackboard, any agent may request collaboration from a peer, and a critic audits the synthesised answer before it is shown.',
    infoCoverageWord: 'Coverage',
    infoLanguagesWord: '{n} languages',
    infoHarboursWord: '{n} Indian fishing harbours',
    infoVesselProfilesWord: '{n} vessel profiles',
    infoVesselBodyWord: 'route limits, sea-keeping and speed are evaluated per vessel class.',
    infoCycleBodyWord: 'aligned to a {cycle} model run across {sources} source products.',
    infoBaseHarbourWord: 'Base harbour',
    infoBaseHarbourBodyWord:
      'Every spatial calculation is anchored to this port unless a GPS fix is supplied.',
    infoAcceptanceWord: 'Acceptance test',
    infoAcceptanceBodyWord:
      'The problem statement’s eight capabilities are pre-loaded as real questions in all {n} languages. Each is fed through the same pipeline as anything you type — so tapping one is a live test of language detection, intent parsing, roster selection and synthesis, not a scripted answer.',
    infoOpenChatWord: 'Open the conversation in {lang}',
    infoSafetyWord: 'Safety standard & responsible AI',
    infoSafetyBodyWord:
      'ORCA provides decision support. It never guarantees safety, and it never overrides an official advisory. A dedicated critic agent re-reads every answer before it is shown, removes over-confident phrasing, escalates any ORANGE or RED advisory, and appends the deferral to IMD, INCOIS and port authority warnings. The vessel remains the master’s decision.',

    /* ---- ApkExportModal ---- */
    apkTitleWord: 'ORCA Build & Demonstration Hub',
    apkSubtitleWord: 'One TypeScript agent engine · web client + Android APK',
    apkTabBuildWord: 'APK Build',
    apkTabEngineWord: 'Engine & API',
    apkTabStructureWord: 'Folder Structure',
    apkTabDemoWord: '3-Min Demo Script',
    apkStep1Word: '1. Standalone APK with Expo EAS cloud build',
    apkStep1BodyWord:
      'EAS prints a download link and a QR code for a directly installable APK — no Android Studio, no local SDK, nothing to configure on the receiving phone.',
    apkStep2Word: '2. Instant testing on a physical phone with Expo Go',
    apkStep3Word: '3. Pointing the APK at a hosted engine',
    apkStep3BodyWord:
      'The address lives in exactly one place, mobile/src/services/api.js, and reads an environment variable first:',
    apkStep3Body2Word:
      'For a build-time target, set it in eas.json as EXPO_PUBLIC_ORCA_API=https://your-host.',
    apkStep3NoteWord:
      'If the engine is unreachable the app says so plainly — it never substitutes a fabricated forecast.',
    apkEngineHeadingWord: 'Running the agent engine',
    apkEngineKeyNoteWord:
      'GEMINI_API_KEY is optional. Without it the deterministic engine still plans, reasons, synthesises and audits every answer.',
    apkProjectOrgWord: 'Project organization',
    apkDemoHeadingWord: 'Smart India Hackathon demonstration script',
    copyApkBuildWord: 'APK build commands',
    copyExpoGoWord: 'Expo Go commands',
    copyEngineWord: 'Engine commands',
    copyFolderWord: 'Folder structure',
    copyDemoWord: 'Demo script',
    closeWord: 'Close',
    copyWord: 'Copy',
    copiedWord: 'Copied',

    /* ---- GeofencePanel ---- */
    geofenceTypeBoundaryWord: 'International boundary',
    geofenceTypeRestrictedWord: 'Restricted waters',
    geofenceTypeProtectedWord: 'Marine protected area',
    geofenceTypeSensitiveWord: 'Ecologically sensitive zone',
    geofenceTypeOilRigWord: 'Oil / gas installation',
    geofenceTypeMilitaryWord: 'Military zone',
    geofenceTypeCableWord: 'Submarine cable',
    geofenceTypeLaneWord: 'Shipping lane',
    geofenceClearWord:
      'No maritime boundary, protected area or restricted water is close to this track.',
    geofenceStayClearWord: 'Zones to stay clear of',
    geofenceEvaluatedWord: '{n} evaluated',
    geofenceNothingToEnterWord: 'Nothing to enter right now. Nearest regulated water:',
    geofenceBufferWord: 'within {km} km buffer',
    geofenceInsideWord: 'INSIDE',

    /* ---- MapScreen + server error paths ---- */
    mapLoadFailedWord: 'Could not load the marine picture.',
    errOrchestrationWord: 'Orchestration failed',
    errSituationWord: 'Situation report failed',
    errPlanningWord: 'Planning failed',
  },
'hi-IN': {
    infoBuildHubWord: 'Android बिल्ड और स्रोत',
    infoApkGuideWord: 'APK और परिनियोजन गाइड',
    infoApkGuideBodyWord:
      'Expo React Native क्लाइंट, TypeScript एजेंट इंजन और Express API — तीनों को चलाने और पैकेज करने के आदेशों के साथ।',
    infoOpenBuildWord: 'बिल्ड निर्देश खोलें',

    infoEngineStatusWord: 'इंजन स्थिति',
    infoBrowserEngineWord:
      'ब्राउज़र-आधारित इंजन — API अनुपलब्ध है, इसलिए वही एजेंट स्थानीय रूप से चल रहे हैं।',
    infoServerConnectedWord: 'सर्वर जुड़ा — एजेंट Node इंजन पर चल रहे हैं।',
    infoVersionWord: 'संस्करण',
    infoAiLayerWord: 'AI परत',
    infoSessionsWord: 'सत्र',
    infoReferenceCycleWord: 'संदर्भ चक्र',
    infoLocalWord: 'स्थानीय',
    infoDeterministicWord: 'निर्धारित',
    infoBundledSnapshotWord: 'बंडल स्नैपशॉट',
    infoNoApiKeyWord:
      'GEMINI_API_KEY सेट नहीं है। उसके बिना भी ORCA पूरी तरह कार्यशील है — वैकल्पिक मॉडल केवल योजना का तर्क और उत्तर की भाषा दोबारा लिखता है, और वह कभी कोई सुरक्षा-महत्वपूर्ण एजेंट जोड़ या हटा नहीं सकता।',

    infoRosterWord: 'एजेंट सूची ({n})',
    infoRosterBodyWord:
      'एक प्लानर हर प्रश्न को कार्य-ग्राफ में तोड़ता है और इन विशेषज्ञों में से एक उप-समुच्चय चुनता है। वे एक साझा ब्लैकबोर्ड पर टाइप किए गए निष्कर्ष प्रकाशित करते हैं, कोई भी एजेंट साथी से सहयोग का अनुरोध कर सकता है, और एक आलोचक संश्लेषित उत्तर दिखाने से पहले उसकी समीक्षा करता है।',
    infoCoverageWord: 'कवरेज',
    infoLanguagesWord: '{n} भाषाएँ',
    infoHarboursWord: '{n} भारतीय मछली पकड़ने के बंदरगाह',
    infoVesselProfilesWord: '{n} जहाज़ प्रोफ़ाइल',
    infoVesselBodyWord:
      'मार्ग सीमाएँ, समुद्र-रक्षा क्षमता और गति हर जहाज़ वर्ग के लिए अलग से मूल्यांकित होती हैं।',
    infoCycleBodyWord: '{sources} स्रोत उत्पादों पर {cycle} मॉडल-चालित संदर्भ चक्र के अनुरूप।',
    infoBaseHarbourWord: 'आधार बंदरगाह',
    infoBaseHarbourBodyWord:
      'जब तक GPS स्थिति न दी जाए, हर स्थानिक गणना इसी बंदरगाह से जुड़ी होती है।',
    infoAcceptanceWord: 'स्वीकृति परीक्षण',
    infoAcceptanceBodyWord:
      'समस्या कथन की आठ क्षमताएँ सभी {n} भाषाओं में वास्तविक प्रश्नों के रूप में पहले से लोड हैं। प्रत्येक उसी पाइपलाइन से होकर जाता है जिससे आप कुछ भी टाइप करें — इसलिए किसी एक पर टैप करना भाषा-पहचान, इंटेंट-पार्सिंग, सूची-चयन और संश्लेषण का वास्तविक परीक्षण है, कोई स्क्रिप्ट किया हुआ उत्तर नहीं।',
    infoOpenChatWord: '{lang} में बातचीत खोलें',
    infoSafetyWord: 'सुरक्षा मानक और ज़िम्मेदार AI',
    infoSafetyBodyWord:
      'ORCA निर्णय-सहायता प्रदान करता है। यह कभी सुरक्षा की गारंटी नहीं देता, और कभी किसी आधिकारिक चेतावनी को नहीं नकारता। दिखाने से पहले एक समर्पित आलोचक एजेंट हर उत्तर दोबारा पढ़ता है, अति-आत्मविश्वासपूर्ण वाक्य हटाता है, किसी भी ORANGE या RED चेतावनी को बढ़ा देता है, और IMD, INCOIS तथा बंदरगाह प्राधिकारी की चेतावनियों के साथ उसे जोड़ देता है। जहाज़ का निर्णय मालिक का ही रहता है।',

    apkTitleWord: 'ORCA बिल्ड और प्रदर्शन केंद्र',
    apkSubtitleWord: 'एक TypeScript एजेंट इंजन · वेब क्लाइंट + Android APK',
    apkTabBuildWord: 'APK बिल्ड',
    apkTabEngineWord: 'इंजन और API',
    apkTabStructureWord: 'फ़ोल्डर संरचना',
    apkTabDemoWord: '3-मिनट डेमो स्क्रिप्ट',
    apkStep1Word: '1. Expo EAS क्लाउड बिल्ड से स्टैंडएलोन APK',
    apkStep1BodyWord:
      'EAS एक डाउनलोड लिंक और QR कोड छापता है जिससे APK सीधे इंस्टॉल हो जाती है — न Android Studio, न स्थानीय SDK, और प्राप्त करने वाले फ़ोन पर कुछ भी सेट न करना पड़ता है।',
    apkStep2Word: '2. Expo Go से वास्तविक फ़ोन पर तुरंत परीक्षण',
    apkStep3Word: '3. APK को होस्ट किए गए इंजन से जोड़ना',
    apkStep3BodyWord:
      'पता ठीक एक ही जगह लिखा है, mobile/src/services/api.js, और वह पहले एक एनवायरनमेंट वेरिएबल पढ़ता है:',
    apkStep3Body2Word:
      'बिल्ड-टाइम लक्ष्य के लिए, eas.json में EXPO_PUBLIC_ORCA_API=https://your-host सेट करें।',
    apkStep3NoteWord:
      'यदि इंजन अनुपलब्ध हो तो ऐप साफ़ बता देता है — यह कभी कोई बनावटी पूर्वानुमान नहीं जोड़ता।',
    apkEngineHeadingWord: 'एजेंट इंजन चलाना',
    apkEngineKeyNoteWord:
      'GEMINI_API_KEY वैकल्पिक है। इसके बिना निर्धारित इंजन फिर भी हर उत्तर की योजना बनाता, तर्क करता, संश्लेषित करता और जाँच करता है।',
    apkProjectOrgWord: 'परियोजना संरचना',
    apkDemoHeadingWord: 'स्मार्ट इंडिया हैकथॉन प्रदर्शन स्क्रिप्ट',
    copyApkBuildWord: 'APK बिल्ड आदेश',
    copyExpoGoWord: 'Expo Go आदेश',
    copyEngineWord: 'इंजन आदेश',
    copyFolderWord: 'फ़ोल्डर संरचना',
    copyDemoWord: 'डेमो स्क्रिप्ट',
    closeWord: 'बंद करें',
    copyWord: 'कॉपी',
    copiedWord: 'कॉपी हो गया',

    geofenceTypeBoundaryWord: 'अंतरराष्ट्रीय सीमा',
    geofenceTypeRestrictedWord: 'प्रतिबंधित जल',
    geofenceTypeProtectedWord: 'सामुद्रिक संरक्षित क्षेत्र',
    geofenceTypeSensitiveWord: 'पारिस्थितिकी-संवेदनशील क्षेत्र',
    geofenceTypeOilRigWord: 'तेल / गैस संस्थापना',
    geofenceTypeMilitaryWord: 'सैन्य क्षेत्र',
    geofenceTypeCableWord: 'समुद्रतलीय केबल',
    geofenceTypeLaneWord: 'शिपिंग मार्ग',
    geofenceClearWord:
      'इस मार्ग के पास कोई सामुद्रिक सीमा, संरक्षित क्षेत्र या प्रतिबंधित जल नहीं है।',
    geofenceStayClearWord: 'जिन क्षेत्रों से दूर रहना है',
    geofenceEvaluatedWord: '{n} का मूल्यांकन',
    geofenceNothingToEnterWord: 'अभी प्रवेश के लिए कुछ नहीं। निकटतम विनियमित जल:',
    geofenceBufferWord: '{km} km बफ़र के भीतर',
    geofenceInsideWord: 'अंदर',

    mapLoadFailedWord: 'समुद्री चित्र लोड नहीं हो सका।',
    errOrchestrationWord: 'समन्वयन विफल रहा',
    errSituationWord: 'स्थिति रिपोर्ट विफल रही',
    errPlanningWord: 'योजना विफल रही',
  },

  'mr-IN': {
    infoBuildHubWord: 'Android बिल्ड आणि स्रोत',
    infoApkGuideWord: 'APK आणि डिप्लॉयमेंट मार्गदर्शक',
    infoApkGuideBodyWord:
      'Expo React Native क्लायंट, TypeScript एजंट इंजिन आणि Express API — तिन्ही चालवण्याच्या आणि पॅकेज करण्याच्या आदेशांसह.',
    infoOpenBuildWord: 'बिल्ड सूचना उघडा',

    infoEngineStatusWord: 'इंजिन स्थिती',
    infoBrowserEngineWord:
      'ब्राउझर-आधारित इंजिन — API अनुपलब्ध आहे, म्हणून तेच एजंट स्थानिक पातळ्यावर चालू आहेत.',
    infoServerConnectedWord: 'सर्व्हर जोडलेला — एजंट Node इंजिनवर चालू आहेत.',
    infoVersionWord: 'आवृत्ती',
    infoAiLayerWord: 'AI स्तर',
    infoSessionsWord: 'सत्रे',
    infoReferenceCycleWord: 'संदर्भ चक्र',
    infoLocalWord: 'स्थानिक',
    infoDeterministicWord: 'निश्चित',
    infoBundledSnapshotWord: 'बंडल स्नॅपशॉट',
    infoNoApiKeyWord:
      'GEMINI_API_KEY सेट केलेला नाही. त्याशिवायही ORCA पूर्णपणे कार्यरत आहे — पर्यायी मॉडेल फक्त योजनेचे तर्क आणि उत्तराची भाषा पुन्हा लिहितो, आणि तो कधीही कोणताही सुरक्षा-महत्त्वाचा एजंट जोडू किंवा काढू शकत नाही.',

    infoRosterWord: 'एजंट यादी ({n})',
    infoRosterBodyWord:
      'एक प्लॅनर प्रत्येक प्रश्नाला कार्य-आलेखात विभागते आणि या तज्ज्ञांमधील एक भाग निवडते. ते सामायिक ब्लॅकबोर्डवर टाइप केलेले निष्कर्ष प्रकाशित करतात, कोणताही एजंट सहकारीकडून सहाय्य विनंती करू शकतो, आणि एक समीक्षक दाखवण्यापूर्वी संश्लेषित उत्तराचा आढावा घेतो.',
    infoCoverageWord: 'व्यापी',
    infoLanguagesWord: '{n} भाषा',
    infoHarboursWord: '{n} भारतीय मासेमारी बंदर',
    infoVesselProfilesWord: '{n} जहाज प्रोफाइल',
    infoVesselBodyWord:
      'मार्ग मर्यादा, समुद्र-सहनशक्ती आणि वेग प्रत्येक जहाज वर्गासाठी स्वतंत्रपणे मूल्यांकित केले जातात.',
    infoCycleBodyWord: '{sources} स्रोत उत्पादनांवर {cycle} मॉडेलवर आधारित संदर्भ चक्राशी जुळणारे.',
    infoBaseHarbourWord: 'मूळ बंदर',
    infoBaseHarbourBodyWord:
      'GPS स्थान दिल्याशिवाय प्रत्येक स्थानिक गणना याच बंदराशी जोडलेली असते.',
    infoAcceptanceWord: 'स्वीकृती चाचणी',
    infoAcceptanceBodyWord:
      'समस्या मजकुरातील आठ क्षमतांच्या प्रश्ना सर्व {n} भाषांत प्रत्यक्ष प्रश्नांच्या रूपाने आधीच भरलेल्या आहेत. प्रत्येक त्याच पाइपलाइनमधून जातो ज्यातून तुम्ही काहीही टाइप करा — म्हणजे एखाद्यावर टॅप करणे हे भाषा-ओळखणे, इंटेंट-पार्सिंग, यादी-निवड आणि संश्लेषण यांचा खरा चाचणी आहे, लिहिलेले उत्तर नाही.',
    infoOpenChatWord: '{lang} मध्ये संवाद उघडा',
    infoSafetyWord: 'सुरक्षा मानक आणि जबाबदार AI',
    infoSafetyBodyWord:
      'ORCA निर्णय-सहाय्य पुरवते. ते कधीही सुरक्षेची हमी देत नाही, आणि कधीही अधिकृत सूचना टाकते नाही. दाखवण्यापूर्वी एक समर्पित समीक्षक एजंट प्रत्येक उत्तर पुन्हा वाचते, अतिशय आत्मविश्वासाच्या वाक्यांना काढून टाकते, कोणतीही ORANGE किंवा RED सूचना वाढवते, आणि तिला IMD, INCOIS व बंदर प्राधिकाऱ्यांच्या सूचनांसोबत जोडते. जहाजाचा निर्णय मालकाचाच राहतो.',

    apkTitleWord: 'ORCA बिल्ड आणि प्रदर्शन केंद्र',
    apkSubtitleWord: 'एक TypeScript एजंट इंजिन · वेब क्लायंट + Android APK',
    apkTabBuildWord: 'APK बिल्ड',
    apkTabEngineWord: 'इंजिन आणि API',
    apkTabStructureWord: 'फोल्डर रचना',
    apkTabDemoWord: '3-मिनिट डेमो स्क्रिप्ट',
    apkStep1Word: '1. Expo EAS क्लाउड बिल्डसह स्वतंत्र APK',
    apkStep1BodyWord:
      'EAS एक डाउनलोड लिंक आणि QR कोड छापतो ज्यामुळे APK थेट इन्स्टॉल होते — Android Studio नाही, स्थानिक SDK नाही, आणि घेणार्या फोनवर काहीही सेट करावं लागत नाही.',
    apkStep2Word: '2. Expo Go वापरून प्रत्यक्ष फोनवर तातडीची चाचणी',
    apkStep3Word: '3. APK ला होस्ट केलेल्या इंजिनकडे जोडणे',
    apkStep3BodyWord:
      'पत्ता अगदी एकाच ठिकाणी लिहिलेला आहे, mobile/src/services/api.js, आणि तो प्रथम एक एनव्हायरनमेंट व्हेरिएबल वाचतो:',
    apkStep3Body2Word:
      'बिल्ड-टाइम लक्ष्यासाठी, eas.json मध्ये EXPO_PUBLIC_ORCA_API=https://your-host सेट करा.',
    apkStep3NoteWord:
      'इंजिन अनुपलब्ध असल्यास अ‍ॅप तसे स्पष्ट सांगतो — तो कधीही कृत्रिम अंदाज किंवा बनावटी हवामानीला पुरवत नाही.',
    apkEngineHeadingWord: 'एजंट इंजिन चालवणे',
    apkEngineKeyNoteWord:
      'GEMINI_API_KEY ऐच्छिक आहे. त्याशिवाय निश्चित इंजिन प्रत्येक उत्तराची योजना तयार करते, तर्क करते, संश्लेषित करते आणि तपासते.',
    apkProjectOrgWord: 'प्रकल्पाची रचना',
    apkDemoHeadingWord: 'स्मार्ट इंडिया हॅकथॉन प्रदर्शन स्क्रिप्ट',
    copyApkBuildWord: 'APK बिल्ड आदेश',
    copyExpoGoWord: 'Expo Go आदेश',
    copyEngineWord: 'इंजिन आदेश',
    copyFolderWord: 'फोल्डर रचना',
    copyDemoWord: 'डेमो स्क्रिप्ट',
    closeWord: 'बंद करा',
    copyWord: 'कॉपी',
    copiedWord: 'कॉपी झाले',

    geofenceTypeBoundaryWord: 'आंतरराष्ट्रीय सीमा',
    geofenceTypeRestrictedWord: 'प्रतिबंधित पाणी',
    geofenceTypeProtectedWord: 'सागरी संरक्षित क्षेत्र',
    geofenceTypeSensitiveWord: 'पारिस्थितिकी-संवेदनशील क्षेत्र',
    geofenceTypeOilRigWord: 'तेल / गॅस संस्थापना',
    geofenceTypeMilitaryWord: 'लष्करी क्षेत्र',
    geofenceTypeCableWord: 'तलजाळीतून जाणारी केबल',
    geofenceTypeLaneWord: 'जहाजवाहिनी मार्ग',
    geofenceClearWord:
      'या मार्गाजवळ कोणतेही सागरी सीमा, संरक्षित क्षेत्र किंवा प्रतिबंधित पाणी नाही.',
    geofenceStayClearWord: 'यांपासून दूर राहण्याचे क्षेत्र',
    geofenceEvaluatedWord: '{n} चे मूल्यांकन',
    geofenceNothingToEnterWord: 'सध्या प्रवेशासाठी काहीही नाही. निकटचे नियमित पाणी:',
    geofenceBufferWord: '{km} km बफरच्या आत',
    geofenceInsideWord: 'आत',

    mapLoadFailedWord: 'सागरी चित्र लोड करता आले नाही.',
    errOrchestrationWord: 'समन्वयन अयशस्वी',
    errSituationWord: 'स्थिती अहवाल अयशस्वी',
    errPlanningWord: 'नियोजन अयशस्वी',
  },
'gu-IN': {
    infoBuildHubWord: 'Android બિલ્ડ અને સ્રોત',
    infoApkGuideWord: 'APK અને ડિપ્લોયમેન્ટ માર્ગદર્શિકા',
    infoApkGuideBodyWord:
      'Expo React Native ક્લાયન્ટ, TypeScript એજન્ટ એન્જિન અને Express API — ત્રણેય ચલાવવા અને પેકેજ કરવાના આદેશો સાથે.',
    infoOpenBuildWord: 'બિલ્ડ સૂચનાઓ ખોલો',

    infoEngineStatusWord: 'એન્જિન સ્થિતિ',
    infoBrowserEngineWord:
      'બ્રાઉઝર-આધારિત એન્જિન — API અલગમ્ય છે, તેથી એ જ એજન્ટો સ્થાનિક રીતે ચાલી રહ્યા છે.',
    infoServerConnectedWord: 'સર્વર જોડાયો — એજન્ટો Node એન્જિન પર ચાલી રહ્યા છે.',
    infoVersionWord: 'આવૃત્તિ',
    infoAiLayerWord: 'AI સ્તર',
    infoSessionsWord: 'સત્રો',
    infoReferenceCycleWord: 'સંદર્ભ ચક્ર',
    infoLocalWord: 'સ્થાનિક',
    infoDeterministicWord: 'નિર્ધારિત',
    infoBundledSnapshotWord: 'બંડલ સ્નેપશોટ',
    infoNoApiKeyWord:
      'GEMINI_API_KEY સેટ કરેલો નથી. તેની વગર પણ ORCA સંપૂર્ણપણે કામ કરે છે — વૈકલ્પિક મોડેલ ફક્ત યોજનાનું તર્ક અને જવાબની ભાષા ફરી લખે છે, અને તે ક્યારેય કોઈ સુરક્ષા-મહત્વનો એજન્ટ ઉમેરી કે દૂર કરી શકે તેમ નથી.',

    infoRosterWord: 'એજન્ટ યાદી ({n})',
    infoRosterBodyWord:
      'એક પ્લાનર દરેક પ્રશ્નને કાર્ય-આલેખમાં વિભાજિત કરે છે અને આ નિષ્ણાતોમાંથી એક પેટાગિત કરે છે. તેઓ સહિયારી બ્લેકબોર્ડ પર ટાઇપ કરેલા તારણો પ્રકાશિત કરે છે, કોઈપણ એજન્ટ સાથી પાસેથી સહકારની વિનંતી કરી શકે, અને એક ટીકાતકાર બતાવાતા પહેલાં સંશ્લેષિત જવાબની સમીક્ષા કરે છે.',
    infoCoverageWord: 'વ્યાપ',
    infoLanguagesWord: '{n} ભાષાઓ',
    infoHarboursWord: '{n} ભારતીય માછલી પકડના બંદરો',
    infoVesselProfilesWord: '{n} જહાજ પ્રોફાઇલ',
    infoVesselBodyWord:
      'માર્ગ મર્યાદાઓ, દરિયાઈ સહનશક્તિ અને ઝડપ દરેક જહાજ વર્ગ માટે અલગથી મૂલ્યાંકિત થાય છે.',
    infoCycleBodyWord: '{sources} સ્રોત ઉત્પાદનો પર {cycle} મોડેલ-આધારિત સંદર્ભ ચક્ર સમાન.',
    infoBaseHarbourWord: 'આધાર બંદર',
    infoBaseHarbourBodyWord:
      'જ્યામાં સુધી GPS સ્થિતિ આપવામાં ન આવે, ત્યાં સુધી દરેક અવકાશિક ગણતરી આ જ બંદર સાથે જોડાયેલી હોય છે.',
    infoAcceptanceWord: 'સ્વીકૃતિ ચકાસણી',
    infoAcceptanceBodyWord:
      'સમસ્યાના વિધાનની આઠ ક્ષમતાઓ બધી {n} ભાષાઓમાં વાસ્તવિક પ્રશ્નો તરીકે પહેલેથી લોડ થયેલી છે. દરેક એ જ પાઇપલાઇનમાંથી પસાર થાય છે જેમાંથી તમે ગમે તે ટાઇપ કરો — એટલે કોઈકાને ટેપ કરવું એ ભાષા-ઓળખણ, ઇન્ટેન્ટ-પાર્સિંગ, યાદી-પસંદગી અને સંશ્લેષણનું સાચું પરીક્ષણ છે, લખેલો જવાબ નહીં.',
    infoOpenChatWord: '{lang} માં વાતચીત ખોલો',
    infoSafetyWord: 'સુરક્ષા ધોરણ અને જવાબદાર AI',
    infoSafetyBodyWord:
      'ORCA નિર્ણય-મદદ પૂરી પાડે છે. તે ક્યારેય સુરક્ષાની ખાતરી આપતું નથી, અને ક્યારેય અધિકૃત સૂચનાનો અસ્વીકાર કરતું નથી. બતાવાતા પહેલાં એક સંકલ્પિત ટીકાતકાર એજન્ટ દરેક જવાબ ફરી વાંચે છે, અતિ-આતમવિશ્વાસવાળા વાક્યો દૂર કરે છે, કોઈપણ ORANGE કે RED સૂચનાને વધારે છે, અને તેને IMD, INCOIS તેમજ બંદર અધિકારીની સૂચનાઓ સાથે જોડે છે. જહાજ અંગે નિર્ણય માલિકનો જ રહે છે.',

    apkTitleWord: 'ORCA બિલ્ડ અને પ્રદર્શન કેન્દ્ર',
    apkSubtitleWord: 'એક TypeScript એજન્ટ એન્જિન · વેબ ક્લાયન્ટ + Android APK',
    apkTabBuildWord: 'APK બિલ્ડ',
    apkTabEngineWord: 'એન્જિન અને API',
    apkTabStructureWord: 'ફોલ્ડર માળખું',
    apkTabDemoWord: '3-મિનિટ ડેમો સ્ક્રિપ્ટ',
    apkStep1Word: '1. Expo EAS ક્લાઉડ બિલ્ડ સાથે સ્ટેન્ડલોન APK',
    apkStep1BodyWord:
      'EAS ડાઉનલોડ લિંક અને QR કોડ છાપે છે જેથી APK સીધો ઇન્સ્ટોલ થાય છે — ન Android Studio, ન સ્થાનિક SDK, અને મળવાનારા ફોન પર કંઈ ગોઠવવાની જરૂર નથી.',
    apkStep2Word: '2. Expo Go વડે વાસ્તવિક ફોન પર તાત્કાલિક પરીક્ષણ',
    apkStep3Word: '3. APK ને હોસ્ટ કરેલા એન્જિન સાથે જોડવું',
    apkStep3BodyWord:
      'સરનામું બરાબર એક જ જગ્યાએ લખેલું છે, mobile/src/services/api.js, અને તે પહેલાં એક એન્વાયરનમેન્ટ વેરિએબલ વાંચે છે:',
    apkStep3Body2Word:
      'બિલ્ડ-ટાઇમ લક્ષ્ય માટે, eas.json માં EXPO_PUBLIC_ORCA_API=https://your-host સેટ કરો.',
    apkStep3NoteWord:
      'જો એન્જિન અલગમ્ય હોય તો એપ તે સ્પષ્ટ કહે છે — તે ક્યારેય કલ્પિત આગાહી મૂકતું નથી.',
    apkEngineHeadingWord: 'એજન્ટ એન્જિન ચલાવવું',
    apkEngineKeyNoteWord:
      'GEMINI_API_KEY વૈકલ્પિક છે. તેના વગર નિર્ણયાત્મક એન્જિન હજી દરેક જવાબની યોજના બનાવે છે, તર્ક કરે છે, સંશ્લેષિત કરે છે અને તપાસે છે.',
    apkProjectOrgWord: 'પ્રોજેક્ટ માળખું',
    apkDemoHeadingWord: 'સ્માર્ટ ઇન્ડિયા હેકથોન પ્રદર્શન સ્ક્રિપ્ટ',
    copyApkBuildWord: 'APK બિલ્ડ આદેશો',
    copyExpoGoWord: 'Expo Go આદેશો',
    copyEngineWord: 'એન્જિન આદેશો',
    copyFolderWord: 'ફોલ્ડર માળખું',
    copyDemoWord: 'ડેમો સ્ક્રિપ્ટ',
    closeWord: 'બંધ કરો',
    copyWord: 'કોપી',
    copiedWord: 'કોપી થયું',

    geofenceTypeBoundaryWord: 'આંતરરાષ્ટ્રીય સીમા',
    geofenceTypeRestrictedWord: 'પ્રતિબંધિત જળ',
    geofenceTypeProtectedWord: 'દરિયાઈ સુરક્ષિત વિસ્તાર',
    geofenceTypeSensitiveWord: 'પર્યાવરણીય-સંવેદનશીલ વિસ્તાર',
    geofenceTypeOilRigWord: 'તેલ / ગેસ સ્થાપના',
    geofenceTypeMilitaryWord: 'લશ્કરી વિસ્તાર',
    geofenceTypeCableWord: 'દરિયાનીચેલી કેબલ',
    geofenceTypeLaneWord: 'શિપિંગ માર્ગ',
    geofenceClearWord:
      'આ માર્ગ નજીક કોઈ દરિયાઈ સીમા, સુરક્ષિત વિસ્તાર કે પ્રતિબંધિત જળ નથી.',
    geofenceStayClearWord: 'આ વિસ્તારોથી દૂર રહેલા',
    geofenceEvaluatedWord: '{n} નું મૂલ્યાંકન',
    geofenceNothingToEnterWord: 'હાલ પ્રવેશ માટે કંઈ નથી. નજીકનું નિયમિત જળ:',
    geofenceBufferWord: '{km} km બફર અંદર',
    geofenceInsideWord: 'અંદર',

    mapLoadFailedWord: 'દરિયાઈ ચિત્ર લોડ થઈ શક્યું નથી.',
    errOrchestrationWord: 'ગોઠવણી વિફળ થઈ',
    errSituationWord: 'સ્થિતિ અહેવાલ વિફળ થયો',
    errPlanningWord: 'આયોજન વિફળ થયું',
  },

  'kn-IN': {
    infoBuildHubWord: 'Android ಬಿಲ್ಡ್ ಮತ್ತು ಮೂಲ',
    infoApkGuideWord: 'APK ಮತ್ತು ನಿಯೋಜನೆ ಮಾರ್ಗದರ್ಶಿ',
    infoApkGuideBodyWord:
      'Expo React Native ಕ್ಲೈಯಂಟ್, TypeScript ಏಜೆಂಟ್ ಎಂಜಿನ್ ಮತ್ತು Express API — ಮೂರನ್ನೂ ಓಡಿಸಲು ಮತ್ತು ಪ್ಯಾಕೇಜ್ ಮಾಡಲು ಆದೇಶಗಳ ಜೊತೆ.',
    infoOpenBuildWord: 'ಬಿಲ್ಡ್ ಸೂಚನೆಗಳನ್ನು ತೆರೆಯಿರಿ',

    infoEngineStatusWord: 'ಎಂಜಿನ್ ಸ್ಥಿತಿ',
    infoBrowserEngineWord:
      'ಬ್ರೌಸರ್-ಆಧಾರಿತ ಎಂಜಿನ್ — API ಲಭ್ಯವಿಲ್ಲ, ಹಾಗಾಗಿ ಅದೇ ಏಜೆಂಟ್‌ಗಳು ಸ್ಥಳೀಯವಾಗಿ ಓಡುತ್ತಿವೆ.',
    infoServerConnectedWord: 'ಸರ್ವರ್ ಸಂಪರ್ಕಿತವಾಗಿದೆ — ಏಜೆಂಟ್‌ಗಳು Node ಎಂಜಿನ್‌ನಲ್ಲಿ ಓಡುತ್ತಿವೆ.',
    infoVersionWord: 'ಆವೃತ್ತಿ',
    infoAiLayerWord: 'AI ಪದರ',
    infoSessionsWord: 'ಸತ್ರಗಳು',
    infoReferenceCycleWord: 'ಉಲ್ಲೇಖ ಚಕ್ರ',
    infoLocalWord: 'ಸ್ಥಳೀಯ',
    infoDeterministicWord: 'ನಿರ್ಧಾರಿತ',
    infoBundledSnapshotWord: 'ಬಂಡಲ್ ಸ್ನಾಪ್‌ಶಾಟ್',
    infoNoApiKeyWord:
      'GEMINI_API_KEY ಹೊಂದಿಸಿಲ್ಲ. ಅದಿಲ್ಲದೆಯೂ ORCA ಪೂರ್ಣವಾಗಿ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತದೆ — ಐಚ್ಛಿಕ ಮಾದರಿ ಯೋಜನೆಯ ತರ್ಕ ಮತ್ತು ಉತ್ತರದ ಪದಗಳನ್ನು ಮಾತ್ರ ಮತ್ತೆ ಬರೆಯುತ್ತದೆ, ಮತ್ತು ಅದು ಎಂದಿಗೂ ಸುರಕ್ಷತಾ-ಮುಖ್ಯವಾದ ಏಜೆಂಟ್ ಅನ್ನು ಸೇರಿಸಲು ಅಥವಾ ತೆಗೆದುಹಾಕಲು ಸಾಧ್ಯವಿಲ್ಲ.',

    infoRosterWord: 'ಏಜೆಂಟ್ ಪಟ್ಟಿ ({n})',
    infoRosterBodyWord:
      'ಒಂದು ಯೋಜಕನು ಪ್ರತಿ ಪ್ರಶ್ನನ್ನು ಕೆಲಸದ ರೂಪದಲ್ಲಿ ವಿಂಗಡಿಸಿ ಈ ತಜ್ಞರಲ್ಲಿ ಒಂದು ಭಾಗವನ್ನು ಆರಿಸುತ್ತದೆ. ಅವರು ಒಂದೇ ಕಪ್ಪು ಬೋರ್ಡ್‌ನಲ್ಲಿ ಟೈಪ್ ಮಾಡಿದ ಫಲಿತಾಂಶಗಳನ್ನು ಪ್ರಕಟಿಸುತ್ತಾರೆ, ಯಾವುದೇ ಏಜೆಂಟ್ ಸಹವಾಗಿರುವವರಿಂದ ಸಹಕಾರದ ವಿನಂತಿ ಮಾಡಬಹುದು, ಮತ್ತು ಒಂದು ವಿಮರ್ಶಕ ಸಂಶ್ಲೇಷಿತ ಉತ್ತರವನ್ನು ತೋರಿಸುವ ಮೊದಲು ಪರಿಶೀಲಿಸುತ್ತದೆ.',
    infoCoverageWord: 'ವ್ಯಾಪ್ತಿ',
    infoLanguagesWord: '{n} ಭಾಷೆಗಳು',
    infoHarboursWord: '{n} ಭಾರತೀಯ ಮೀನುಗಾರಿ ರಂದುಗಳು',
    infoVesselProfilesWord: '{n} ದೋಣಿ ಪ್ರೊಫೈಲ್‌ಗಳು',
    infoVesselBodyWord:
      'ಮಾರ್ಗದ ಮಿತಿಗಳು, ಸಮುದ್ರ ಸಹಿಷ್ಣುತೆ ಮತ್ತು ವೇಗವನ್ನು ಪ್ರತಿ ದೋಣಿ ವರ್ಗಕ್ಕೆ ಪ್ರತ್ಯೇಕವಾಗಿ ಮೌಲ್ಯಮಾಪಿಸಲಾಗುತ್ತದೆ.',
    infoCycleBodyWord: '{sources} ಮೂಲ ಉತ್ಪನ್ನಗಳ ಮೇಲೆ {cycle} ಮಾದರಿ ಚಾಲನೆಯ ಉಲ್ಲೇಖ ಚಕ್ರಕ್ಕೆ ಹೊಂದಿಕೆ.',
    infoBaseHarbourWord: 'ಮೂಲ ರಂದು',
    infoBaseHarbourBodyWord:
      'GPS ಸ್ಥಾನ ನೀಡದ ವರೆಗೆ ಪ್ರತಿ ಬಾಹುಗಮನ ಲೆಕ್ಕಾಚಾರ ಈ ರಂದಿಗೆ ಆಂಕಿತವಾಗಿದೆ.',
    infoAcceptanceWord: 'ಸ್ವೀಕೃತಿ ಪರೀಕ್ಷೆ',
    infoAcceptanceBodyWord:
      'ಸಮಸ್ಯೆಯ ಹೇಳಿಕೆಯ ಎಂಟು ಸಾಮರ್ಮ್ಯಗಳನ್ನು ಎಲ್ಲಾ {n} ಭಾಷೆಗಳಲ್ಲೂ ನಿಜವಾದ ಪ್ರಶ್ನೆಗಳಾಗಿ ಮೊದಲೇ ಲೋಡ್ ಮಾಡಲಾಗಿದೆ. ಪ್ರತಿಯೊಂದೂ ನೀವು ಟೈಪ್ ಮಾಡುವುದರಿಂದ ಅದೇ ಪೈಪ್‌ಲೈನ್ ಮೂಲಕ ಹೋಗುತ್ತದೆ — ಆದ್ದರಿಂದ ಯಾವುದನ್ನೂ ಟ್ಯಾಪ್ ಮಾಡುವುದು ಭಾಷೆ ಗುರುತಿಸುವಿಕೆ, ಇಂಟೆಂಟ್ ಪಾರ್ಸಿಂಗ್, ಪಟ್ಟಿ ಆಯ್ಕೆ ಮತ್ತು ಸಂಶ್ಲೇಷಣೆಯ ನಿಜವಾದ ಪರೀಕ್ಷೆ, ಬರೆದ ಉತ್ತರ ಅಲ್ಲ.',
    infoOpenChatWord: '{lang} ನಲ್ಲಿ ಸಂವಾದ ತೆರೆಯಿರಿ',
    infoSafetyWord: 'ಸುರಕ್ಷತಾ ಮಾನದಂಡ ಮತ್ತು ಜವಾಬ್ದಾರಿ AI',
    infoSafetyBodyWord:
      'ORCA ನಿರ್ಧಾರ ಸಹಾಯ ನೀಡುತ್ತದೆ. ಅದು ಎಂದಿಗೂ ಸುರಕ್ಷತೆಯ ಖಾತರಿ ನೀಡುವುದಿಲ್ಲ, ಮತ್ತು ಎಂದಿಗೂ ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆಯನ್ನು ತಡೆಯುವುದಿಲ್ಲ. ತೋರಿಸುವ ಮೊದಲು ಒಂದು ಮೀಸಲಾತಿ ವಿಮರ್ಶಕ ಏಜೆಂಟ್ ಪ್ರತಿ ಉತ್ತರವನ್ನು ಮತ್ತೆ ಓದುತ್ತದೆ, ಅತಿ ಆತ್ಮವಿಶ್ವಾಸದ ವಾಕ್ಯಗಳನ್ನು ತೆಗೆದುಹಾಕುತ್ತದೆ, ORANGE ಅಥವಾ RED ಎಚ್ಚರಿಕೆಯನ್ನು ಎತ್ತರಿಸುತ್ತದೆ, ಮತ್ತು ಅದರನ್ನು IMD, INCOIS ಮತ್ತು ರಂದು ಅಧಿಕಾರಿಗಳ ಎಚ್ಚರಿಕೆಗಳಿಗೆ ಜೋಡಿಸುತ್ತದೆ. ದೋಣಿಯ ನಿರ್ಧಾರ ಮಾಲಕನದ್ದೇ ಉಳಿಯುತ್ತದೆ.',

    apkTitleWord: 'ORCA ಬಿಲ್ಡ್ ಮತ್ತು ಪ್ರದರ್ಶನ ಕೇಂದ್ರ',
    apkSubtitleWord: 'ಒಂದು TypeScript ಏಜೆಂಟ್ ಎಂಜಿನ್ · ವೆಬ್ ಕ್ಲೈಯಂಟ್ + Android APK',
    apkTabBuildWord: 'APK ಬಿಲ್ಡ್',
    apkTabEngineWord: 'ಎಂಜಿನ್ ಮತ್ತು API',
    apkTabStructureWord: 'ಫೋಲ್ಡರ್ ರಚನೆ',
    apkTabDemoWord: '3-ನಿಮಿಷದ ಡೆಮೊ ಸ್ಕ್ರಿಪ್ಟ್',
    apkStep1Word: '1. Expo EAS ಕ್ಲೌಡ್ ಬಿಲ್ಡ್‌ನೊಂದಿಗೆ ಸ್ವತಂತ್ರ APK',
    apkStep1BodyWord:
      'EAS ನೇರ ಸ್ಥಾಪಿಸಬಹುದಾದ APK ಗಾಗಿ ಡೌನ್‌ಲೋಡ್ ಲಿಂಕ್ ಮತ್ತು QR ಕೋಡ್ ಮುದ್ರಿಸುತ್ತದೆ — Android Studio ಬೇಡ, ಸ್ಥಳೀಯ SDK ಬೇಡ, ಪಡೆಯುವ ಫೋನಿನಲ್ಲಿ ಏನೂ ಸಿಲುವಿಸಬೇಕಿಲ್ಲ.',
    apkStep2Word: '2. Expo Go ಜೊತೆ ನಿಜವಾದ ಫೋನಿನಲ್ಲಿ ತಕ್ಷಣ ಪರೀಕ್ಷೆ',
    apkStep3Word: '3. APK ಅನ್ನು ಹೋಸ್ಟ್ ಮಾಡಿದ ಎಂಜಿನ್‌ಗೆ ಸಂಪರ್ಕಿಸುವುದು',
    apkStep3BodyWord:
      'ವಿಳಾಸವು ನಿಖರಾಗಿ ಒಂದೇ ಒಂದು ಸ್ಥಳದಲ್ಲಿ ಬರೆದಿದೆ, mobile/src/services/api.js, ಮತ್ತು ಅದು ಮೊದಲು ಒಂದು ಪರಿಸರಣ ಪರಿಸರವನ್ನು ಓದುತ್ತದೆ:',
    apkStep3Body2Word:
      'ಬಿಲ್ಡ್-ಟೈಮ್ ಗುರಿಗಾಗಿ, eas.json ನಲ್ಲಿ EXPO_PUBLIC_ORCA_API=https://your-host ಎಂದು ಹೊಂದಿಸಿ.',
    apkStep3NoteWord:
      'ಎಂಜಿನ್ ಲಭ್ಯವಿಲ್ಲದಿದ್ದರೆ ಆ್ಯಪ್ ಅದನ್ನು ಸ್ಪಷ್ಟವಾಗಿ ಹೇಳುತ್ತದೆ — ಅದು ಎಂದಿಗೂ ಕಲ್ಪನೆಯ ಮುನ್ಸೂಚನೆ ಹಾಕುವುದಿಲ್ಲ.',
    apkEngineHeadingWord: 'ಏಜೆಂಟ್ ಎಂಜಿನ್ ಓಡಿಸುವುದು',
    apkEngineKeyNoteWord:
      'GEMINI_API_KEY ಐಚ್ಛಿಕ. ಅದರಿಲ್ಲದೆಯೂ ನಿರ್ಧಾರಿತ ಎಂಜಿನ್ ಪ್ರತಿ ಉತ್ತರದ ಯೋಜನೆ ಹೆಜ್ಜೆದೆಯೆ, ತರ್ಕಿಸುತ್ತದೆ, ಸಂಯೋಜಿಸುತ್ತದೆ ಮತ್ತು ಪರಿಶೀಲಿಸುತ್ತದೆ.',
    apkProjectOrgWord: 'ಯೋಜನಾ ರಚನೆ',
    apkDemoHeadingWord: 'ಸ್ಮಾರ್ಟ್ ಇಂಡಿಯಾ ಹ್ಯಾಕ್‌ಥಾನ್ ಪ್ರದರ್ಶನ ಸ್ಕ್ರಿಪ್ಟ್',
    copyApkBuildWord: 'APK ಬಿಲ್ಡ್ ಆದೇಶಗಳು',
    copyExpoGoWord: 'Expo Go ಆದೇಶಗಳು',
    copyEngineWord: 'ಎಂಜಿನ್ ಆದೇಶಗಳು',
    copyFolderWord: 'ಫೋಲ್ಡರ್ ರಚನೆ',
    copyDemoWord: 'ಡೆಮೊ ಸ್ಕ್ರಿಪ್ಟ್',
    closeWord: 'ಮುಚ್ಚಿ',
    copyWord: 'ನಕಲಿಸಿ',
    copiedWord: 'ನಕಲಾಗಿದೆ',

    geofenceTypeBoundaryWord: 'ಅಂತರ್ರಾಷ್ಟ್ರೀಯ ಗಡಿ',
    geofenceTypeRestrictedWord: 'ನಿಷೇಧಿತ ಜಲ',
    geofenceTypeProtectedWord: 'ಸಮುದ್ರ ಸಂರಕ್ಷಿತ ಪ್ರದೇಶ',
    geofenceTypeSensitiveWord: 'ಪರಿಸರದ ಸೂಕ್ಷ್ಮ ಪ್ರದೇಶ',
    geofenceTypeOilRigWord: 'ಎಣ್ಣೆ / ಅನಿಲ ಸ್ಥಾಪನೆ',
    geofenceTypeMilitaryWord: 'ಸೈನಿಕ ಪ್ರದೇಶ',
    geofenceTypeCableWord: 'ಸಮುದ್ರದೆಯಲ್ಲಿನ ಕೇಬಲ್',
    geofenceTypeLaneWord: 'ಜಹಾಜು ಮಾರ್ಗ',
    geofenceClearWord:
      'ಈ ಮಾರ್ಗಕ್ಕೆ ಹತ್ತಿರದಲ್ಲಿ ಯಾವುದೇ ಸಮುದ್ರ ಗಡಿ, ಸಂರಕ್ಷಿತ ಪ್ರದೇಶ ಅಥವಾ ನಿಷೇಧಿತ ಜಲ ಇಲ್ಲ.',
    geofenceStayClearWord: 'ದೂರವಿಡಬೇಕಾದ ಪ್ರದೇಶಗಳು',
    geofenceEvaluatedWord: '{n} ಮೌಲ್ಯಮಾಪಿಸಲಾಗಿದೆ',
    geofenceNothingToEnterWord: 'ಈಗ ಪ್ರವೇಶಕ್ಕೆ ಏನೂ ಇಲ್ಲ. ಅತಿ ಹತ್ತಿರದ ನಿಯಮಿತ ಜಲ:',
    geofenceBufferWord: '{km} km ಬಫರ್ ಒಳಗೆ',
    geofenceInsideWord: 'ಒಳಗೆ',

    mapLoadFailedWord: 'ಸಮುದ್ರ ಚಿತ್ರವನ್ನು ಲೋಡ್ ಮಾಡಲಾಗಲಿಲ್ಲ.',
    errOrchestrationWord: 'ಒಂದಾದೆಯೊಡೆಯುವಿಕೆ ವಿಫಲವಾಗಿದೆ',
    errSituationWord: 'ಪರಿಸ್ಥಿತಿ ವರದಿ ವಿಫಲವಾಗಿದೆ',
    errPlanningWord: 'ಯೋಜನೆ ವಿಫಲವಾಗಿದೆ',
  },
'ml-IN': {
    infoBuildHubWord: 'Android ബിൽഡും സോഴ്‌സും',
    infoApkGuideWord: 'APK ഉം ഡിപ്ലോയ്‌മെന്റ് ഗൈഡും',
    infoApkGuideBodyWord:
      'Expo React Native ക്ലയന്റ്, TypeScript ഏജന്റ് എഞ്ചിനും Express API — മൂന്നും ഓടിക്കാനും പാക്കേജ് ചെയ്യാനുമുള്ള കമാൻഡുകളോടെ.',
    infoOpenBuildWord: 'ബിൽഡ് നിർദ്ദേശങ്ങൾ തുറക്കുക',

    infoEngineStatusWord: 'എഞ്ചിൻ സ്റ്റാറ്റസ്',
    infoBrowserEngineWord:
      'ബ്രൗസറിൽ ഓടുന്ന എഞ്ചിൻ — API ലഭ്യമല്ല, അതിനാല് അതേ ഏജന്റുകൾ നാട്ടിലാണ് ഓടുന്നത്.',
    infoServerConnectedWord: 'സെർവർ ബന്ധിച്ചു — ഏജന്റുകൾ Node എഞ്ചിനിൽ ഓടുന്നു.',
    infoVersionWord: 'പതിപ്പ്',
    infoAiLayerWord: 'AI തലം',
    infoSessionsWord: 'സെഷനുകൾ',
    infoReferenceCycleWord: 'റഫറൻസ് ചക്രം',
    infoLocalWord: 'നാട്ടിലെ',
    infoDeterministicWord: 'നിശ്ചിതം',
    infoBundledSnapshotWord: 'ബണ്ഡിൽ ചെയ്ത സ്നാപ്പ്ഷോട്ട്',
    infoNoApiKeyWord:
      'GEMINI_API_KEY സജ്ജമാക്കിയിട്ടില്ല. അതില്ലാതെയും ORCA പൂർണ്ണമായി പ്രവർത്തിക്കുന്നു — ഐച്ഛിക മോഡൽ പദ്യസിദ്ധതയുടെ യുക്തിയും ഉത്തരത്തിന്റെ ഭാഷയും മാത്രമാണ് വീണ്ടും എഴുതുക; സുരക്ഷാപ്രധാനമായ ഏജന്റുകളെ ചിലതെ കൂടിയോ നീക്കുകയോ ഒരിക്കലും ചെയ്യാൻ അതിനാ കഴിയില്ല.',

    infoRosterWord: 'ഏജന്റ് പട്ടിക ({n})',
    infoRosterBodyWord:
      'ഒരു പ്ലാനർ ഓരോ ചോദ്യത്തെയും ടാസ്ക് ഗ്രാഫ്കളായി വിഭജിക്കുകയും ഈ വിദഗ്ധരിൽ ഒരു പാങ്കൾ തിരഞ്ഞെടുക്കുകയും ചെയ്യുന്നു. അവർ ഒരു സാമാന്യ ബ്ലാക്ക്‌ബോർഡിൽ ടൈപ്പ് ചെയ്ത ഫലങ്ങൾ പ്രസിദ്ധീകരിക്കുന്നു, ഏതെങ്കിലും ഏജന്റിന് സഹായത്തിന് ആരോ മറ്റൊരു ഏജന്റിനോട് ആവശ്യപ്പെടുകയാണ്, ഒരു വിമർശകൻ പ്രസാദമാക്കിയ ഉത്തരം കാണിക്കുന്നതിന് മുമ്പ് അതിനെ പരിശോധിക്കുന്നു.',
    infoCoverageWord: 'വ്യാപ്തി',
    infoLanguagesWord: '{n} ഭാഷകൾ',
    infoHarboursWord: '{n} ഇന്ത്യൻ മീൻപിടുപ്പുകളുള്ള തുറമുഖങ്ങൾ',
    infoVesselProfilesWord: '{n} കപ്പൽ പ്രൊഫൈലുകൾ',
    infoVesselBodyWord:
      'വഴിയുടെ പരിധികളും കടലാരുകാട്ടലും വേഗവും ഓരോ കപ്പൽ വർഗത്തിനും വേറതായി കണക്കാക്കുന്നു.',
    infoCycleBodyWord: '{sources} ഉറവിടെ ഉൽപ്പന്നങ്ങളിൽ {cycle} മോഡൽ അധിഷ്ഠിതമായ റഫറൻസ് ചക്രത്തിന് അനുരൂപമാണ്.',
    infoBaseHarbourWord: 'അടിസ്ഥാന തുറമുഖം',
    infoBaseHarbourBodyWord:
      'GPS സ്ഥാനം നൽകുന്നവരെങ്കിൽ ഓരോ ദേശീയ കണക്കുകൂടുത്തലും ഈ തുറമുഖത്തിലേക്കാണ് ബന്ധിപ്പിച്ചിരിക്കുന്നത്.',
    infoAcceptanceWord: 'അംഗീകാര പരിശോധന',
    infoAcceptanceBodyWord:
      'പ്രശ്നം പറഞ്ഞിട്ടുന്ന എട്ട് കഴവുകൾ എല്ലാ {n} ഭാഷകളിലും യഥാർത്ഥ ചോദ്യങ്ങളായി മുൻകൂട്ടിയെടുത്തിരിക്കുന്നു. ഓരോന്നും നിങ്ങൾ ടൈപ്പ് ചെയ്യുന്നതിന് തുല്യമായ അതേ പൈപ്പ്‌ലൈനിലൂടെ കടത്തിച്ചുപോകുന്നു — അതിനാൽ ഏതെങ്കിലും ഒന്നിൽ ടാപ്പ് ചെയ്യുന്നത് ഭാഷാ കണ്ടെത്തൽ, ഇന്റെന്റ് പാർസിംഗ്, ഏജന്റ് തിരഞ്ഞെടുക്കൽ, സംശ്ലേഷണം എന്നിവയുടെ യഥാർത്ഥ പരീക്ഷയാണ്, ക്രമീകരിച്ച ഉത്തരമല്ല.',
    infoOpenChatWord: '{lang} എന്ന ഭാഷയിൽ സംഭാഷണം തുറക്കുക',
    infoSafetyWord: 'സുരക്ഷാ മാനദംഡവും ഉത്തരാധികാരിത്വവും ഹെയുള്ള AI',
    infoSafetyBodyWord:
      'ORCA തീരുമാന സഹായം നൽകുന്നു. അത് ഒരിക്കലും സുരക്ഷ ഉറപ്പാക്കുകയില്ല, ഔദ്യോഗിക അറിയിക്കൽ മറക്കുകയും ചെയ്യില്ല. തോരുക്കുന്നതിന് മുമ്പ് ഒരു വിശേഷ വിമർശക ഏജന്റ് ഓരോ ഉത്തരവും വീണ്ടും വായിക്കുകയും, അതികഥിതമായ വാക്കാരങ്ങൾ ഒഴിവാക്കുകയും, ORANGE അല്ലെങ്കിൽ RED അറിയിക്കളെ ഉയരിപ്പിക്കുകയും, അതിനെ IMD, INCOIS, തുറമുഖ അധികൃത അറിയിക്കളുടെ സഹിഞ്ഞായി ചേർക്കുകയും ചെയ്യും. കപ്പലിനെപ്പറ്റിയ തീരുമാനം ഉടമയുടെതന്നെയാണ്.',

    apkTitleWord: 'ORCA ബിൽഡും പ്രദർശന കേന്ദ്രവും',
    apkSubtitleWord: 'ഒരു TypeScript ഏജന്റ് എഞ്ചിൻ · വെബ് ക്ലയന്റ് + Android APK',
    apkTabBuildWord: 'APK ബിൽഡ്',
    apkTabEngineWord: 'എഞ്ചിനും API',
    apkTabStructureWord: 'ഫോൾഡർ ഘടന',
    apkTabDemoWord: '3-മിനിറ്റ് ഡെമോ സ്ക്രിപ്റ്റ്',
    apkStep1Word: '1. Expo EAS ക്ലൗഡ് ബിൽഡിലൂടെ സ്വതന്ത്ര APK',
    apkStep1BodyWord:
      'നേരിട്ട് ഇൻസ്റ്റാൾ ചെയ്യാവുന്ന APK-യിനായി EAS ഒരു ഡൗൺലോഡ് ലിങ്കും QR കോഡും അച്ചപ്പെടുത്തും — Android Studio വേണ്ട, ലോക്കൽ SDK വേണ്ട, ലഭിക്കുന്ന ഫോണിൽ ഒന്നും ക്രമീകരിക്കേണ്ടതില്ല.',
    apkStep2Word: '2. Expo Go ഉപയോഗിച്ച് യഥാർത്ഥ ഫോണിൽ ഉടൻ പരീക്ഷണം',
    apkStep3Word: '3. APK-യെ ഹോസ്റ്റ് ചെയ്ത എഞ്ചിനോട് ബന്ധിപ്പിക്കുക',
    apkStep3BodyWord:
      'വിലാസം കൃത്യമായി ഒരിടത്ത് മാത്രമാണ് ഉള്ളത്, mobile/src/services/api.js, അത് ആദ്യം ഒരു എൻവൈറോൺമെന്റ് വാരിയബിൾ വായിക്കുന്നു:',
    apkStep3Body2Word:
      'ബിൽഡ്-ടൈം ലക്ഷ്യത്തിന്, eas.json-ൽ EXPO_PUBLIC_ORCA_API=https://your-host എന്ന് സജ്ജമാക്കുക.',
    apkStep3NoteWord:
      'എഞ്ചിൻ ലഭ്യമല്ലെങ്കിൽ ആപ്പ് അത് വ്യക്തമായി പറയും — അത് ഒരിക്കലും കാര്യമായ പ്രവാഹന സൃഷ്ടിക്കില്ല.',
    apkEngineHeadingWord: 'ഏജന്റ് എഞ്ചിൻ ഓടിക്കുക',
    apkEngineKeyNoteWord:
      'GEMINI_API_KEY ഐച്ഛികമാണ്. അത് ഇല്ലാത്തവരെയും നിശ്ചിത എഞ്ചിൻ ഓരോ ഉത്തരത്തിനും ആസൂത്രണം ചെയ്യുകയും ചിന്തിക്കുകയും സംശ്ലേഷിക്കുകയും പരിശോധിക്കുകയും ചെയ്യുന്നു.',
    apkProjectOrgWord: 'പ്രോജക്റ്റ് ഘടന',
    apkDemoHeadingWord: 'സ്മാർട്ട് ഇന്ത്യ ഹാക്കത്ഹോൺ പ്രദർശന സ്ക്രിപ്റ്റ്',
    copyApkBuildWord: 'APK ബിൽഡ് കമാൻഡുകൾ',
    copyExpoGoWord: 'Expo Go കമാൻഡുകൾ',
    copyEngineWord: 'എഞ്ചിൻ കമാൻഡുകൾ',
    copyFolderWord: 'ഫോൾഡർ ഘടന',
    copyDemoWord: 'ഡെമോ സ്ക്രിപ്റ്റ്',
    closeWord: 'അടയ്ക്കുക',
    copyWord: 'പകർത്തുക',
    copiedWord: 'പകർത്തി',

    geofenceTypeBoundaryWord: 'അന്തർദേശീയ അതിർവര',
    geofenceTypeRestrictedWord: 'നിഷേധിത ജലം',
    geofenceTypeProtectedWord: 'സമുദ്ര സംരക്ഷിത മേഖല',
    geofenceTypeSensitiveWord: 'പരിസരം സംവേദനശീലമായ മേഖല',
    geofenceTypeOilRigWord: 'എണ്ണ / വാതയ സ്ഥാപനം',
    geofenceTypeMilitaryWord: 'സൈന്യ മേഖല',
    geofenceTypeCableWord: 'കടലാക്കീഴിലെ കേബിൾ',
    geofenceTypeLaneWord: 'കപ്പൽ വഴി',
    geofenceClearWord:
      'ഈ വഴിയോട് അടുത്ത് ഒരു സമുദ്ര അതിർവരത്തിലും സംരക്ഷിത മേഖലയിലും നിഷേധിത ജലത്തിലും ഒന്നുമില്ല.',
    geofenceStayClearWord: 'സന്ദർശിക്കാത്ത മേഖലകൾ',
    geofenceEvaluatedWord: '{n} മേലാണ് നിരൈകരണം ചെയ്തത്',
    geofenceNothingToEnterWord: 'ഇപ്പോൾ പ്രവേശിക്കാവുന്നതേല്ല. അടുത്തുള്ള നിയമബദ്ധ ജലം:',
    geofenceBufferWord: '{km} km ബഫറിനുള്ളിൽ',
    geofenceInsideWord: 'അകത്ത്',

    mapLoadFailedWord: 'സമുദ്ര ചിത്രം ലോഡ് ചെയ്യാൻ കഴിഞ്ഞില്ല.',
    errOrchestrationWord: 'ഏറ്റാദെയുമായ വിനിയോഗം പരാജയപ്പെട്ടു',
    errSituationWord: 'സാഹചര്യ റിപ്പോർട്ട് പരാജയപ്പെട്ടു',
    errPlanningWord: 'ആസൂത്രണം പരാജയപ്പെട്ടു',
  },

  'te-IN': {
    infoBuildHubWord: 'Android బిల్డ్ & సోర్స్',
    infoApkGuideWord: 'APK & డిప్లాయ్‌మెంట్ గైడ్',
    infoApkGuideBodyWord:
      'Expo React Native క్లైంట్, TypeScript ఏజెంట్ ఇంజిన్ మరియు Express API — మూడింటినీ పరుగ చేయడం మరియు ప్యాకేజ్ చేయడం కోసం ఆదేశాలతో.',
    infoOpenBuildWord: 'బిల్డ్ సూచనలు తెరవండి',

    infoEngineStatusWord: 'ఇంజిన్ స్థితి',
    infoBrowserEngineWord:
      'బ్రౌజర్‌లో పనిచేసే ఇంజిన్ — API అందుబాటులో లేదు, అందువల్ల అదే ఏజెంట్లు స్థానికంగా పనిచేస్తున్నాయి.',
    infoServerConnectedWord: 'సర్వర్ కలిపివేయబడింది — ఏజెంట్లు Node ఇంజిన్‌పై పనిచేస్తున్నాయి.',
    infoVersionWord: 'వెర్షన్',
    infoAiLayerWord: 'AI పొర',
    infoSessionsWord: 'సెషన్లు',
    infoReferenceCycleWord: 'రిఫరెన్స్ చక్రం',
    infoLocalWord: 'స్థానిక',
    infoDeterministicWord: 'నిర్ధారిత',
    infoBundledSnapshotWord: 'బండిల్ స్నాప్‌షాట్',
    infoNoApiKeyWord:
      'GEMINI_API_KEY సెట్ చేయలేదు. దాని లేకుండానూ ORCA పూర్తిగా పనిచేస్తుంది — ఐచ్ఛిక మోడెల్ భావనా సాకార్యాన్ని, సమాధాన వాక్యాలను మాత్రమే మళ్లీ రాస్తుంది, భద్రతా ప్రధానమైన ఏజెంట్‌ను ఎప్పుడూ జోడించలేదు లేదా తీసివేయలేదు.',

    infoRosterWord: 'ఏజెంట్ జాబితా ({n})',
    infoRosterBodyWord:
      'ఒక ప్లానర్ ప్రతి ప్రశ్నను పని గ్రాఫ్‌గా విభజించి, ఈ నిపుణుల్లో ఒక భాగాన్ని ఎంచుకుంటుంది. వారు ఒక ఉమ్మడి బ్లాక్‌బోర్డ్‌పై టైప్ చేసిన ఫలితాలను ప్రచురిస్తారు, ఏ ఏజెంట్ అయినా సహచరుడి నుంచి సహాయాన్ని అభ్యర్థించవచ్చు, మరియు ఒక విమర్శకుడు చూపే ముందు సంశ్లేషిత సమాధానాన్ని సమీక్షిస్తాడు.',
    infoCoverageWord: 'కవరేజ్',
    infoLanguagesWord: '{n} భాషలు',
    infoHarboursWord: '{n} భారత మత్స్య దేశీయ రేవలు',
    infoVesselProfilesWord: '{n} జహాజ్ ప్రొఫైల్‌లు',
    infoVesselBodyWord:
      'మార్గ పరిమితులు, సముద్ర సహనశీలత మరియు వేగం ప్రతి జహాజ్ తరగతికి వేరుగా మూల్యాంకనం చేయబడతాయి.',
    infoCycleBodyWord: '{sources} మూల ఉత్పత్తులపై {cycle} మోడల్ ఆధారిత రిఫరెన్స్ చక్రానికి అనుగుణంగా.',
    infoBaseHarbourWord: 'బేస్ రేవు',
    infoBaseHarbourBodyWord:
      'GPS స్థానం ఇవ్వబేర వరకు ప్రతి స్థానిక గణన ఈ రేవుకే అనుసంధానితం.',
    infoAcceptanceWord: 'అంగీకార పరీక్ష',
    infoAcceptanceBodyWord:
      'సమస్యా వాక్యంలోని ఎనిమిది సామర్థ్యాలు అన్ని {n} భాషల్లోనూ నిజమైన ప్రశ్నలుగా ముందే లోడ్ చేయబడ్డాయి. ప్రతిదాన్నీ మీరు టైప్ చేసేదానికి సమానమైన అదే పైప్‌లైన్ ద్వారా పంపబడతుంది — కాబట్టి ఏదైనా ఒకటి టాప్ చేయడం అనేది భాష గుర్తింపు, ఇంటెంట్ పార్సింగ్, జాబితా ఎంపిక మరియు సంశ్లేషణకు నిజమైన పరీక్ష, స్క్రిప్ట్ చేసిన సమాధానం కాదు.',
    infoOpenChatWord: '{lang} లో సంభాషణ తెరవండి',
    infoSafetyWord: 'భద్రతా ప్రమాణం & జవాబుదారిత్వ AI',
    infoSafetyBodyWord:
      'ORCA నిర్ణయ మద్దతును అందిస్తుంది. అది ఎప్పుడూ భద్రతను హామీ ఇవ్వదు, అధికారిక హెచ్చరికను ఎప్పుడూ విరుద్ధించదు. చూపే ముందు ఒక ప్రత్యేక విమర్శక ఏజెంట్ ప్రతి సమాధానాన్ని మళ్లీ చదివి, ఆత్మవిశ్వాసంగా ఉన్న వాక్యాలను తీసివేసి, ఏ ఆరెంజ్ లేదా రెడ్ హెచ్చరికనైనా ఎత్తేము, అలాగే IMD, INCOIS మరియు రేవు అధికారుల హెచ్చరికలతో దాన్ని జోడిస్తుంది. జహాజ్ నిర్ణయం యజమాని వద్దే ఉంటుంది.',

    apkTitleWord: 'ORCA బిల్డ్ & ప్రదర్శన కేంద్రం',
    apkSubtitleWord: 'ఒక TypeScript ఏజెంట్ ఇంజిన్ · వెబ్ క్లైంట్ + Android APK',
    apkTabBuildWord: 'APK బిల్డ్',
    apkTabEngineWord: 'ఇంజిన్ & API',
    apkTabStructureWord: 'ఫోల్డర్ నిర్మాణం',
    apkTabDemoWord: '3-నిమిష డెమో స్క్రిప్ట్',
    apkStep1Word: '1. Expo EAS క్లౌడ్ బిల్డ్‌తో స్టాండ్‌అలోన్ APK',
    apkStep1BodyWord:
      'EAS నేరుగా ఇన్‌స్టాల్ చేయగల APK కోసం డౌన్‌లోడ్ లింక్ మరియు QR కోడ్‌ను ముద్రిస్తుంది — Android Studio అవసరం లేదు, లోకల్ SDK అవసరం లేదు, స్వీకరించే ఫోన్‌పై ఏదీ సెట్ చేయాల్సిన అవసరం లేదు.',
    apkStep2Word: '2. Expo Go తో నిజమైన ఫోన్‌పై వెంటనే పరీక్ష',
    apkStep3Word: '3. APK ను హోస్ట్ చేసిన ఇంజిన్‌కు కలిపించడం',
    apkStep3BodyWord:
      'చిరునామా ఖచ్చితంగా ఒకే చోట ఉంది, mobile/src/services/api.js, మరియు అది మొదట ఒక ఎన్‌విరాన్‌మెంట్ వేరియబుల్‌ను చదువుతుంది:',
    apkStep3Body2Word:
      'బిల్డ్-టైమ్ లక్ష్యం కోసం, eas.json లో EXPO_PUBLIC_ORCA_API=https://your-host గా సెట్ చేయండి.',
    apkStep3NoteWord:
      'ఇంజిన్ అందుబాటులో లేకపోతే యాప్ స్పష్టంగా చెబుతుంది — అది ఎప్పుడూ కల్పితమైన వాతావరణ అంచనావేసేలా చేయదు.',
    apkEngineHeadingWord: 'ఏజెంట్ ఇంజిన్ నడపడం',
    apkEngineKeyNoteWord:
      'GEMINI_API_KEY ఐచ్ఛికం. దీని లేకుండా నిర్ణియిత ఇంజిన్ ప్రతి సమాధానానికి ప్రణాళిక రూపొందిస్తుంది, సిద్ధాంతం చేస్తుంది, సంశ్లేషిస్తుంది మరియు తనిఖీ చేస్తుంది.',
    apkProjectOrgWord: 'ప్రాజెక్ట్ నిర్మాణం',
    apkDemoHeadingWord: 'స్మార్ట్ ఇండియా హ్యాక్‌థాన్ ప్రదర్శన స్క్రిప్ట్',
    copyApkBuildWord: 'APK బిల్డ్ ఆదేశాలు',
    copyExpoGoWord: 'Expo Go ఆదేశాలు',
    copyEngineWord: 'ఇంజిన్ ఆదేశాలు',
    copyFolderWord: 'ఫోల్డర్ నిర్మాణం',
    copyDemoWord: 'డెమో స్క్రిప్ట్',
    closeWord: 'మూసివేయండి',
    copyWord: 'కాపీ',
    copiedWord: 'కాపీ అయింది',

    geofenceTypeBoundaryWord: 'అంతర్జాతీయ సరిహద్దు',
    geofenceTypeRestrictedWord: 'నిషేధిత జలాలు',
    geofenceTypeProtectedWord: 'సముద్ర సంరక్షణ ప్రాంతం',
    geofenceTypeSensitiveWord: 'పర్యావరణ సంవेदనశీల ప్రాంతం',
    geofenceTypeOilRigWord: 'చెన్ను / వాయువ స్థాపన',
    geofenceTypeMilitaryWord: 'మిలిటరీ ప్రాంతం',
    geofenceTypeCableWord: 'సముద్ర అంతర్గత కేబుల్',
    geofenceTypeLaneWord: 'షిప్పింగ్ మార్గం',
    geofenceClearWord:
      'ఈ మార్గానికి దగ్గరలో ఏ సముద్ర సరిహద్దు, సంరక్షణ ప్రాంతం లేదా నిషేధిత జలాలు లేవు.',
    geofenceStayClearWord: 'ఢీకి వద్దుండాల్సిన ప్రాంతాలు',
    geofenceEvaluatedWord: '{n} మూల్యాంకన చేయబడ్డాయి',
    geofenceNothingToEnterWord: 'ఇప్పుడు ప్రవేశించేంది ఏమీ లేదు. అత్ర నియంత్రిత జలం:',
    geofenceBufferWord: '{km} km బఫర్ లోపల',
    geofenceInsideWord: 'లోపల',

    mapLoadFailedWord: 'సముద్ర చిత్రాన్ని లోడ్ చేయలేకపోయాము.',
    errOrchestrationWord: 'ఆర్కెస్ట్రేషన్ విఫలమైంది',
    errSituationWord: 'సిట్టువేషన్ నివేదిక విఫలమైంది',
    errPlanningWord: 'ప్రణాళిక విఫలమైంది',
  },
'ta-IN': {
    infoBuildHubWord: 'Android உருவாக்கம் & மூலக் குறிப்பு',
    infoApkGuideWord: 'APK & பயன்பாட்டு வழிகாட்டி',
    infoApkGuideBodyWord:
      'Expo React Native கிளையென்ட், TypeScript முக்கிய எந்திரம் மற்றும் Express API — மூன்றையும் இயக்குவதற்கான மற்றும் பொதியிடுவதற்கான கட்டளைகளுடன்.',
    infoOpenBuildWord: 'உருவாக்க வழிமுறைகளைத் திற',
    infoEngineStatusWord: 'எந்திர நிலை',
    infoBrowserEngineWord:
      'உலாவியல் எந்திரம் — API கிடைக்கவில்லை, எனவே அதே முக்கிய எந்திரங்கள் உள்ளூரில் இயங்குகின்றன.',
    infoServerConnectedWord: 'சேவிக்கு இணைக்கப்பட்டது — முக்கிய எந்திரங்கள் Node எந்திரத்தில் இயங்குகின்றன.',
    infoVersionWord: 'பதிப்பு',
    infoAiLayerWord: 'AI அடுக்கு',
    infoSessionsWord: 'அமர்வுகள்',
    infoReferenceCycleWord: 'குறிப்பு வட்டம்',
    infoLocalWord: 'உள்ளூர்',
    infoDeterministicWord: 'நிண்ணயிக்கப்பட்டது',
    infoBundledSnapshotWord: 'இணைக்கப்பட்ட படவுரு',
    infoNoApiKeyWord:
      'GEMINI_API_KEY அமைக்கப்படவில்லை. அதிலிருந்தும் ORCA முழுமையாகச் செயல்படுகிறது — விருப்ப மாதிரி திட்டத்தின் காரணத்தையும் பதில் உரையையும் மட்டுமே மீண்டும் எழுதுகிறது, பாதுகாப்பு முக்கியமான முக்கிய எந்திரத்தை ஒருபோதும் சேர்க்கவோ நீக்கவோ முடியாது.',
    infoRosterWord: 'முக்கிய எந்திரப் பட்டியல் ({n})',
    infoRosterBodyWord:
      'ஒரு திட்டமைப்பாளர் ஒவ்வொரு கேள்வியையும் பணி வரைபடமாகப் பிரித்து, இந்த நிபுணர்களில் ஒரு பகுதியைத் தேர்ந்தெடுக்கிறார். அவர்கள் ஒரு பொதுப் பலகையில் அமைந்த கணிகளை வெளியிடுகின்றனர், எந்த முக்கிய எந்திரமும் ஒரு துணையிடம் காரணம் கேட்டுக்கொள்ளலாம், மேலும் ஒரு விமர்சனக் கருவி காட்டப்படும் முன் உருவாக்கப்பட்ட பதிலை மதிப்பாய்விற்கு உட்படுத்துகிறது.',
    infoCoverageWord: 'உரோபம்',
    infoLanguagesWord: '{n} மொழிகள்',
    infoHarboursWord: '{n} இந்திய மீனவைத் துறைகள்',
    infoVesselProfilesWord: '{n} கப்பல் விவரங்கள்',
    infoVesselBodyWord: 'பாதை வரம்புகள், கடல் தாங்கும் திறன் மற்றும் வேகம் ஒவ்வொரு கப்பல் வகைக்கும் தனித்தனியாக மதிப்பிடப்படுகின்றன.',
    infoCycleBodyWord: '{sources} மூலப் பொருட்களில் {cycle} மாதிரியால் இயங்கும் குறிப்பு வட்டத்துடன் ஒருங்க.',
    infoBaseHarbourWord: 'அடிப்படைத் துறை',
    infoBaseHarbourBodyWord: 'GPS நிலையை வழங்கும் வரை ஒவ்வொரு இட அளவீடும் இந்தத் துறையுடனே இணைக்கப்படுகிறது.',
    infoAcceptanceWord: 'ஏற்றுக்கொள்ளும் சோதனை',
    infoAcceptanceBodyWord:
      'கேள்விப் பிரகடனத்தின் எட்டு திறன்களும் அனைத்து {n} மொழிகளிலும் உண்மையான கேள்விகளாக ஏற்கனவே ஏற்றப்பட்டுள்ளன. ஒவ்வொன்றும் நீங்கள் தட்டச்சு செய்வது போலவே அதே பொயில் வழியாகச் செல்கிறது — எனவே ஒன்றைத் தட்டுவது மொழி கண்டறிதல், நோக்கப் பகுப்பாய்வு, பட்டியல் தேர்வு மற்றும் பொதுச்செயல் ஆகியவற்றின் உண்மையான சோதனை, நிரலாக்கப்பட்ட பதில் அல்ல.',
    infoOpenChatWord: '{lang} மொழியில் உரையாடலைத் திற',
    infoSafetyWord: 'பாதுகாப்பு தரநிலை & பொறுப்புடைய AI',
    infoSafetyBodyWord:
      'ORCA முடிவு ஆதரவளிக்கிறது. அது ஒருபோதும் பாதுகாப்பை உறுதிப்படுத்துவதில்லை, அதேபோது அதிகாரப்பூர்வ எச்சரிக்கையை ஒருபோதும் முற்றிலும் மறுக்காது. காட்டுவதற்கு முன் ஒரு பிரத்யேக மதிப்பாய்வுக் கருவி ஒவ்வொரு பதிலையும் மீண்டும் வாசிக்கிறது, அதிக நம்பிக்கையான சொற்றொடர்களை நீக்குகிறது, எந்த ORANGE அல்லது RED எச்சரிக்கையையும் உயர்த்துகிறது, மேலும் அதை IMD, INCOIS மற்றும் துறை உரிமையாளர் எச்சரிக்கைகளுடன் இணைக்கிறது. கப்பலின் முடிவாக தோட்டி எடுத்த முடிவே மட்டும்.',
    apkTitleWord: 'ORCA உருவாக்கம் & செயல்விளக்கக் கூடம்',
    apkSubtitleWord: 'ஒரு TypeScript முக்கிய எந்திரம் · இணைய கிளையென்ட் + Android APK',
    apkTabBuildWord: 'APK உருவாக்கம்',
    apkTabEngineWord: 'எந்திரம் & API',
    apkTabStructureWord: 'கோப்புறை அமைப்பு',
    apkTabDemoWord: '3-நிமிட செயல்விளக்கக் குறிப்பு',
    apkStep1Word: '1. Expo EAS மேகக் கட்டுதலுடன் சுதந்திர APK',
    apkStep1BodyWord:
      'EAS நேரடியாக நிறுவப்படக்கூடிய APK க்கான ஒரு பதிவிறக்க இணைப்பையும் QR குறியீட்டையும் அச்சிடுகிறது — Android Studio தேவையில்லை, உள்ளூர் SDK தேவையில்லை, பெறும் தொலைபேசியில் எதையும் அமைக்க வேண்டியதில்லை.',
    apkStep2Word: '2. Expo Go உடன் உண்மையான தொலைபேசியில் உடனே சோதனை',
    apkStep3Word: '3. APK ஐ வழங்கப்பட்ட எந்திரத்துடன் இணைத்தல்',
    apkStep3BodyWord: 'முகவரி சரியாக ஒரே இடத்தில் உள்ளது, mobile/src/services/api.js, மேலும் அது முதலில் ஒரு சூழல் மாற்றியைப் படிக்கிறது:',
    apkStep3Body2Word: 'உருவாக்க நேர இலக்குக்காக, eas.json இல் EXPO_PUBLIC_ORCA_API=https://your-host என அமைக்கவும்.',
    apkStep3NoteWord:
      'எந்திரம் கிடைக்காவிட்டால் செயலி தெளிவாகச் சொல்கிறது — அது ஒருபோதும் கற்பனையான முன்னறிவிப்பைச் சேர்ப்பதில்லை.',
    apkEngineHeadingWord: 'முக்கிய எந்திரத்தை இயக்குதல்',
    apkEngineKeyNoteWord:
      'GEMINI_API_KEY என்பது விருப்பத்தேர்வு. அது இல்லாவிட்டாலும் நிர்ணயமான இயந்திரம் ஒவ்வொரு பதிலுக்கும் திட்டமிடுகிறது, காரணம் விளக்குகிறது, இணைக்கிறது மற்றும் சரிபார்க்கிறது.',
    apkProjectOrgWord: 'திட்ட அமைப்பு',
    apkDemoHeadingWord: 'ஸ்மார்ட் இந்தியா ஹேக்தான் செயல்விளக்கக் குறிப்பு',
    copyApkBuildWord: 'APK உருவாக்கக் கட்டளைகள்',
    copyExpoGoWord: 'Expo Go கட்டளைகள்',
    copyEngineWord: 'எந்திரக் கட்டளைகள்',
    copyFolderWord: 'கோப்புறை அமைப்பு',
    copyDemoWord: 'செயல்விளக்கக் குறிப்பு',
    closeWord: 'மூடு',
    copyWord: 'நகலெடு',
    copiedWord: 'நகலெடுக்கப்பட்டது',
    geofenceTypeBoundaryWord: 'சரவாய் எலும்பு',
    geofenceTypeRestrictedWord: 'தடைசெய்யப்பட்ட நீர்',
    geofenceTypeProtectedWord: 'கடல் பாதுகாப்பு பகுதி',
    geofenceTypeSensitiveWord: 'சூழல் உணர்திறனுள்ள பகுதி',
    geofenceTypeOilRigWord: 'எண்ணெய் / எரிவாயு நிறுவனம்',
    geofenceTypeMilitaryWord: 'இராணுப் பகுதி',
    geofenceTypeCableWord: 'கடலடி கம்பி',
    geofenceTypeLaneWord: 'கப்பல் வழித்தடம்',
    geofenceClearWord: 'இந்த வழித்தடத்திற்கு அருகில் எந்த கடல் எலும்பு, பாதுகாப்புப் பகுதி அல்லது தடைசெய்யப்பட்ட நீரும் இல்லை.',
    geofenceStayClearWord: 'தவிர்க்க வேண்டிய பகுதிகள்',
    geofenceEvaluatedWord: '{n} மதிப்பிடப்பட்டன',
    geofenceNothingToEnterWord: 'இப்போது நுழைக்க ஒன்றும் இல்லை. அருகிலுள்ள ஒழுங்குபடுத்தப்பட்ட நீர்:',
    geofenceBufferWord: '{km} km இடைப்பட்ட தளத்திற்குள்',
    geofenceInsideWord: 'உள்ளே',
    mapLoadFailedWord: 'கடற்சார்வத்தை ஏற்ற முடியவில்லை.',
    errOrchestrationWord: 'ஒருங்கிணைப்பு தோல்வி',
    errSituationWord: 'நிலை அறிக்கை தோல்வி',
    errPlanningWord: 'திட்டமிடல் தோல்வி',
  },

  'bn-IN': {
    infoBuildHubWord: 'Android বিল্ড ও সোর্স',
    infoApkGuideWord: 'APK ও ডিপ্লয়মেন্ট গাইড',
    infoApkGuideBodyWord:
      'Expo React Native ক্লায়েন্ট, TypeScript এজেন্ট ইঞ্জিন এবং Express API — তিনটি চালানো ও প্যাকেজ করার কমান্ডসহ।',
    infoOpenBuildWord: 'বিল্ড নির্দেশনা খুলুন',
    infoEngineStatusWord: 'ইঞ্জিনের অবস্থা',
    infoBrowserEngineWord:
      'ব্রাউজার-ভিত্তিক ইঞ্জিন — API পৌঁছাচ্ছে না, তাই একই এজেন্টগুলো স্থানীয়ভাবে চলছে।',
    infoServerConnectedWord: 'সার্ভার সংযুক্ত — এজেন্টগুলো Node ইঞ্জিনে চলছে।',
    infoVersionWord: 'সংস্করণ',
    infoAiLayerWord: 'AI স্তর',
    infoSessionsWord: 'সেশন',
    infoReferenceCycleWord: 'রেফারেন্স চক্র',
    infoLocalWord: 'স্থানীয়',
    infoDeterministicWord: 'নির্ধারিত',
    infoBundledSnapshotWord: 'বান্ডিল স্ন্যাপশট',
    infoNoApiKeyWord:
      'GEMINI_API_KEY সেট করা নেই। তা সত্ত্বেও ORCA পুরোপুরি কাজ করে — ঐচ্ছিক মডেল কেবল পরিকল্পনার যুক্তি ও উত্তরের ভাষা আবার লেখে, এবং কখনও কোনো নিরাপত্তা-গুরুত্বপূর্ণ এজেন্ট যোগ বা সরাতে পারে না।',
    infoRosterWord: 'এজেন্ট তালিকা ({n})',
    infoRosterBodyWord:
      'একজন প্ল্যানার প্রতিটি প্রশ্নকে কাজের গ্রাফে ভেঙে এই বিশেষজ্ঞদের মধ্যে একটি অংশ বেছে নেয়। তারা একটি সাধারণ ব্ল্যাকবোর্ডে টাইপ করা ফলাফল প্রকাশ করে, যেকোনো এজেন্ট সহকর্মীর কাছে সহায়তা চাইতে পারে, এবং একটি সমালোচক দেখানোর আগে সংশ্লিষ্ট উত্তর পর্যালোচনা করে।',
    infoCoverageWord: 'কভারেজ',
    infoLanguagesWord: '{n}টি ভাষা',
    infoHarboursWord: '{n}টি ভারতীয় মৎস্য বন্দর',
    infoVesselProfilesWord: '{n}টি জাহাজ প্রোফাইল',
    infoVesselBodyWord: 'পথের সীমা, সমুদ্রে টেকা সহনশীলতা ও গতি প্রতিটি জাহাজ শ্রেণির জন্য আলাদাভাবে মূল্যায়ন করা হয়।',
    infoCycleBodyWord: '{sources}টি উৎস পণ্যের উপর চালিত {cycle} মডেল-ভিত্তিক রেফারেন্স চক্রের সঙ্গে সামঞ্জস্যপূর্ণ।',
    infoBaseHarbourWord: 'ভিত্তি বন্দর',
    infoBaseHarbourBodyWord: 'GPS অবস্থান দেওয়া না হওয়া পর্যন্ত প্রতিটি স্থানিক হিসাব এই বন্দরের সঙ্গেই যুক্ত।',
    infoAcceptanceWord: 'গ্রহণযোগ্যতা পরীক্ষা',
    infoAcceptanceBodyWord:
      'সমস্যা বিবৃতির আটটি সক্ষমতা সব {n}টি ভাষাতেই আসল প্রশ্ন হিসেবে আগেই লোড করা আছে। প্রতিটি আপনি যা টাইপ করেন তার মতো একই পাইপলাইনের মধ্য দিয়ে যায় — তাই একটিতে ট্যাপ করা মানে ভাষা শনাক্তকরণ, ইনটেন্ট পার্সিং, তালিকা নির্বাচন ও সংশ্লেষণের একটি সত্যিকারের পরীক্ষা, স্ক্রিপ্ট করা উত্তর নয়।',
    infoOpenChatWord: '{lang}-এ কথোপকথন খুলুন',
    infoSafetyWord: 'নিরাপত্তা মান ও দায়বদ্ধ AI',
    infoSafetyBodyWord:
      'ORCA সিদ্ধান্ত-সহায়তা দেয়। এটি কখনও নিরাপত্তার নিশ্চয়তা দেয় না, এবং কখনও কোনো সরকারি সতর্কতাকে বাতিল করে না। দেখানোর আগে একটি নিবেদিত সমালোচক এজেন্ট প্রতিটি উত্তর আবার পড়ে, অতি-আত্মবিশ্বাসী বাক্য সরায়, যেকোনো ORANGE বা RED সতর্কতাকে উচ্চতর করে, এবং তা IMD, INCOIS ও বন্দর কর্তৃপক্ষের সতর্কতার সঙ্গে যুক্ত করে। জাহাজের সিদ্ধান্ত মালিকেরই থাকে।',
    apkTitleWord: 'ORCA বিল্ড ও প্রদর্শন কেন্দ্র',
    apkSubtitleWord: 'একটি TypeScript এজেন্ট ইঞ্জিন · ওয়েব ক্লায়েন্ট + Android APK',
    apkTabBuildWord: 'APK বিল্ড',
    apkTabEngineWord: 'ইঞ্জিন ও API',
    apkTabStructureWord: 'ফোল্ডার কাঠামো',
    apkTabDemoWord: '3-মিনিট ডেমো স্ক্রিপ্ট',
    apkStep1Word: '1. Expo EAS ক্লাউড বিল্ড সহ স্বতন্ত্র APK',
    apkStep1BodyWord:
      'EAS সরাসরি ইনস্টলযোগ্য APK-এর জন্য একটি ডাউনলোড লিঙ্ক ও QR কোড ছাপে — Android Studio লাগে না, স্থানীয় SDK লাগে না, যে ফোনে পাবেন তাতে কিছু সেট করতে হয় না।',
    apkStep2Word: '2. Expo Go দিয়ে আসল ফোনে তাৎক্ষণিক পরীক্ষা',
    apkStep3Word: '3. APK-কে হোস্ট করা ইঞ্জিনের সঙ্গে যুক্ত করা',
    apkStep3BodyWord: 'ঠিকানাটি হুবহু এক জায়গায় আছে, mobile/src/services/api.js, এবং সেটি প্রথমে একটি এনভায়রনমেন্ট ভ্যারিয়েবল পড়ে:',
    apkStep3Body2Word: 'বিল্ড-টাইম লক্ষ্যের জন্য, eas.json-এ EXPO_PUBLIC_ORCA_API=https://your-host সেট করুন।',
    apkStep3NoteWord: 'ইঞ্জিন না পৌঁছালে অ্যাপ তা সোজাসাপা জানায় — এটি কখনও বানানো আবহাওয়া বসায় না।',
    apkEngineHeadingWord: 'এজেন্ট ইঞ্জিন চালানো',
    apkEngineKeyNoteWord:
      'GEMINI_API_KEY ঐচ্ছিক। এটি না থাকলেও নির্ণিশ্চিত ইঞ্জিন প্রতিটি উত্তরের পরিকল্পনা করে, যুক্তি দেয়, সংশ্লেষণ করে এবং যাচাই করে।',
    apkProjectOrgWord: 'প্রকল্পের কাঠামো',
    apkDemoHeadingWord: 'স্মার্ট ইন্ডিয়া হ্যাকথন প্রদর্শন স্ক্রিপ্ট',
    copyApkBuildWord: 'APK বিল্ড কমান্ড',
    copyExpoGoWord: 'Expo Go কমান্ড',
    copyEngineWord: 'ইঞ্জিন কমান্ড',
    copyFolderWord: 'ফোল্ডার কাঠামো',
    copyDemoWord: 'ডেমো স্ক্রিপ্ট',
    closeWord: 'বন্ধ করুন',
    copyWord: 'অনুলিপি',
    copiedWord: 'অনুলিপি হয়েছে',
    geofenceTypeBoundaryWord: 'আন্তর্জাতিক সীমানা',
    geofenceTypeRestrictedWord: 'নিষিদ্ধ জল',
    geofenceTypeProtectedWord: 'সামুদ্রিক সুরক্ষিত এলাকা',
    geofenceTypeSensitiveWord: 'পরিবেশ-সংবেদনশীল এলাকা',
    geofenceTypeOilRigWord: 'তেল / গ্যাস প্রতিষ্ঠান',
    geofenceTypeMilitaryWord: 'সামরিক এলাকা',
    geofenceTypeCableWord: 'সমুদ্রতলের ক্যাবল',
    geofenceTypeLaneWord: 'জাহাজ চলার পথ',
    geofenceClearWord: 'এই পথের কাছে কোনো সামুদ্রিক সীমানা, সুরক্ষিত এলাকা বা নিষিদ্ধ জল নেই।',
    geofenceStayClearWord: 'যেখান থেকে দূরে থাকতে হবে',
    geofenceEvaluatedWord: '{n}টি মূল্যায়ন করা হয়েছে',
    geofenceNothingToEnterWord: 'এখন প্রবেশযোগ্য কিছু নেই। নিকটতম নিয়ন্ত্রিত জল:',
    geofenceBufferWord: '{km} km বাফারের ভেতরে',
    geofenceInsideWord: 'ভেতরে',
    mapLoadFailedWord: 'সামুদ্রিক চিত্র লোড করা যায়নি।',
    errOrchestrationWord: 'সমন্বয় ব্যর্থ',
    errSituationWord: 'পরিস্থিতি প্রতিবেদন ব্যর্থ',
    errPlanningWord: 'পরিকল্পনা ব্যর্থ',
  },

  'or-IN': {
    infoBuildHubWord: 'Android ବିଲ୍ଡ ଓ ସୋର୍ସ',
    infoApkGuideWord: 'APK ଓ ଡିପ୍ଲାୟମେଣ୍ଟ ନିର୍ଦ୍ଦେଶିକା',
    infoApkGuideBodyWord:
      'Expo React Native କ୍ଲାଏଣ୍ଟ, TypeScript ଏଜେଣ୍ଟ ଇଞ୍ଜିନ ଏବଂ Express API — ତିନୋଟି ଚଲାଇବା ଓ ପ୍ୟାକେଜ କରିବା ଆଦେଶ ସହିତ।',
    infoOpenBuildWord: 'ବିଲ୍ଡ ନିର୍ଦ୍ଦେଶ ଖୋଲନ୍ତୁ',
    infoEngineStatusWord: 'ଇଞ୍ଜିନ ସ୍ଥିତି',
    infoBrowserEngineWord:
      'ବ୍ରାଉଜର୍-ଆଧାରିତ ଇଞ୍ଜିନ — API ଅଲଭ୍ୟ, ତେଣୁ ସେହି ଏଜେଣ୍ଟ ଗୁଡ଼ିକ ସ୍ଥାନୀୟ ଭାବେ ଚଲୁଛନ୍ତି।',
    infoServerConnectedWord: 'ସର୍ଭର ଯୋଡ଼ିଛି — ଏଜେଣ୍ଟ ଗୁଡ଼ିକ Node ଇଞ୍ଜିନରେ ଚଲୁଛନ୍ତି।',
    infoVersionWord: 'ସଂସ୍କରଣ',
    infoAiLayerWord: 'AI ସ୍ତର',
    infoSessionsWord: 'ସେସନ',
    infoReferenceCycleWord: 'ସନ୍ଦର୍ଭ ଚକ୍ର',
    infoLocalWord: 'ସ୍ଥାନୀୟ',
    infoDeterministicWord: 'ନିର୍ଧାରିତ',
    infoBundledSnapshotWord: 'ବନ୍ଡଲ ସ୍ନାପସଟ',
    infoNoApiKeyWord:
      'GEMINI_API_KEY ସେଟ କରାଯାଇନି। ସେହି ଥକରେ ମଧ୍ୟ ORCA ସମ୍ପୂର୍ଣ୍ଣ କାର୍ଯ୍ୟକ୍ଷମ — ଇଚ୍ଛାଧୀନ ମଡେଲ କେବଳ ଯୋଜନାର ଯୁକ୍ତି ଓ ଉତ୍ତରର ଭାଷା ପୁନର୍ବାର ଲେଖେ, ଏବଂ କେବଳ ସୁରକ୍ଷା-ଗୁରୁତ୍ୱ ଏଜେଣ୍ଟ କଦେ ଯୋଡ଼ିବା କିମ୍ବା ହଟାଇବା ସମ୍ଭବ ନୁହେଁ।',
    infoRosterWord: 'ଏଜେଣ୍ଟ ତାଲିକା ({n})',
    infoRosterBodyWord:
      'ଜଣେ ପ୍ଲାନର ପ୍ରତ୍ୟେକ ପ୍ରଶ୍ନକୁ କାର୍ଯ୍ୟ ଗ୍ରାଫରେ ବିଭଜନ କରି ଏହି ବିଶେଷଜ୍ଞଙ୍କ ମଧ୍ୟରୁ ଏକ ଭାଗ ବାଛନ୍ତି। ସେମାନେ ଏକ ସାଧାର୍ଣ ବ୍ଲ୍ୟାକବୋର୍ଡରେ ଟାଇପ୍ ହୋଇଥିବା ଫଳାଫଳ ପ୍ରକାଶ କରନ୍ତି, ଯେକୌଁସି ଏଜେଣ୍ଟ ସହକର୍ମୀରୁ ସାହାଯ୍ୟ ପାଇଁ ଅନୁରୋଧ କରିପାରିବ, ଏବଂ ଏଜଣ ସମୀକ୍ଷକ ଦେଖାଇବା ପୂର୍ବରୁ ସଂଶ୍ଳେଷିତ ଉତ୍ତର ସମୀକ୍ଷା କରେ।',
    infoCoverageWord: 'ଆବରଣ',
    infoLanguagesWord: '{n}ଟି ଭାଷା',
    infoHarboursWord: '{n}ଟି ଭାରତୀୟ ମାଛଧରା ବନ୍ଦର',
    infoVesselProfilesWord: '{n}ଟି ଜହାଜ ପ୍ରୋଫାଇଲ',
    infoVesselBodyWord:
      'ପଥର ସୀମା, ସମୁଦ୍ର ସହନ କ୍ଷମତା ଓ ଗତି ପ୍ରତ୍ୟେକ ଜହାଜ ଶ୍ରେଣୀ ପାଇଁ ଅଲଗାଅଲଗା ମୂଲ୍ୟାଙ୍କନ କରାଯାଏ।',
    infoCycleBodyWord: '{sources}ଟି ଉତ୍ସ ଉତ୍ପାଦ ଉପରେ {cycle} ମଡେଲ-ଆଧାରିତ ସନ୍ଦର୍ଭ ଚକ୍ର ସହିତ ମେଳ ଖାଇଁ।',
    infoBaseHarbourWord: 'ମୂଳ ବନ୍ଦର',
    infoBaseHarbourBodyWord: 'GPS ଅବସ୍ଥାନ ଦେବା ପର୍ଯ୍ୟନ୍ତ ପ୍ରତ୍ୟେକ ସ୍ଥାନିକ ଗଣନା ଏହି ବନ୍ଦର ସହିତ ଯୋଡ଼ାଯାଇଛି।',
    infoAcceptanceWord: 'ଗ୍ରହାଯୋଗ୍ୟତା ପରୀକ୍ଷା',
    infoAcceptanceBodyWord:
      'ସମସ୍ୟା ବିବର୍ଣୀର ଆଠଟି କ୍ଷମତା ସମସ୍ତ {n}ଟି ଭାଷାରେ ପ୍ରକୃତ ପ୍ରଶ୍ନ ଭାବେ ଆଗରୁ ଲୋଡ୍ କରାଯାଇଛି। ପ୍ରତ୍ୟେକଟି ଆପଣ ଯାହା ଟାଇପ କରନ୍ତି ତାହା ସହିତ ସେହି ଏକା ପାଇପଲାଇନ୍ ମଧୁଦେ ଯାଏ — ତେଣୁ କୌଣସି ଏକଟାରେ ଟାପ୍ କରିବା ଭାଷା ଚିହ୍ନଟ, ଇଣ୍ଟେଣ୍ଟ ପାର୍ସିଂ, ତାଲିକା ନିର୍ବାଚନ ଓ ସଂଶ୍ଳେଷଣର ପ୍ରକୃତ ପରୀକ୍ଷା, ଲିପିବଦ୍ଧ ଉତ୍ତର ନୁହେଁ।',
    infoOpenChatWord: '{lang}ରେ କଥାବାର୍ତ୍ତା ଖୋଲନ୍ତୁ',
    infoSafetyWord: 'ସୁରକ୍ଷା ମାନକ ଓ ଦାୟିତ୍ୱ AI',
    infoSafetyBodyWord:
      'ORCA ନିଷ୍ପତ୍ତି ସହାୟତା ଦେଇଥାଏ। ଏହା କେବେ ସୁରକ୍ଷାର ନିଶ୍ଚୟତା ଦେଇନାହିଁ, ଏବଂ କେବେ କୌଣସି ସରକାରୀ ସତର୍କତାକୁ ଅନୁଲୋମନ କରେ ନାହିଁ। ଦେଖାଇବା ପୂର୍ବରୁ ଏକ ନିବେଦିତ ସମୀକ୍ଷକ ଏଜେଣ୍ଟ ପ୍ରତ୍ୟେକ ଉତ୍ତର ପୁନଃ ପଢ଼େ, ଅତି ଆତ୍ମବିଶ୍ୱାସକାର ବାକ୍ୟ ହଟାଏ, ORANGE କିମ୍ବା RED ସତର୍କତାକୁ ଉଚ୍ଚରିଗମ କରେ, ଏବଂ ତାହାକୁ IMD, INCOIS ଓ ବନ୍ଦର କର୍ତ୍ତୃପକ୍ଷର ସତର୍କତା ସହିତ ଯୋଡ଼ାଏ। ଜହାଜର ନିଷ୍ପତ୍ତି ମାଲିକର ହିଁରେ ରହେ।',
    apkTitleWord: 'ORCA ବିଲ୍ଡ ଓ ପ୍ରଦର୍ଶନ କେନ୍ଦ୍ର',
    apkSubtitleWord: 'ଏକ TypeScript ଏଜେଣ୍ଟ ଇଞ୍ଜିନ · ଓୱେବ କ୍ଲାଏଣ୍ଟ + Android APK',
    apkTabBuildWord: 'APK ବିଲ୍ଡ',
    apkTabEngineWord: 'ଇଞ୍ଜିନ ଓ API',
    apkTabStructureWord: 'ଫୋଲ୍ଡର ସଂରଚନା',
    apkTabDemoWord: '3-ମିନିଟ ଡେମୋ ସ୍କ୍ରିପ୍ଟ',
    apkStep1Word: '1. Expo EAS କ୍ଲାଉଡ ବିଲ୍ଡ ସହ ସ୍ୱତନ୍ତ୍ର APK',
    apkStep1BodyWord:
      'EAS ସିଧାସଧାପୀ ଇନ୍‌ସ୍ଟଲ ହେଉଥିବା APK ପାଇଁ ଏକ ଡାଉନଲୋଡ ଲିଙ୍କ ଓ QR କୋଡ ମୁଦ୍ରଣ କରେ — Android Studio ଲେବାରୁ ନାହିଁ, ସ୍ଥାନୀୟ SDK ଲେବାରୁ ନାହିଁ, ଯେ ଫୋନରେ ମିଳିବ ତାରେ କିଛି ସେଟ୍ କରିବାକୁ ନେହଇ।',
    apkStep2Word: '2. Expo Go ସହ ପ୍ରକୃତ ଫୋନରେ ତୁରନ୍ତ ପରୀକ୍ଷା',
    apkStep3Word: '3. APK କୁ ହୋଷ୍ଟ କରାଯାଇଥିବା ଇଞ୍ଜିନ ସହ ଜୋଡ଼ିବା',
    apkStep3BodyWord: 'ଠিকଣା ଠିକ୍ ଏକ ସ୍ଥାନରେ ଅଛି, mobile/src/services/api.js, ଏବଂ ସେହି ପ୍ରଥମେ ଏକ ପରିବେଶ ପରିବର୍ତ୍ତକ ପଢ଼େ:',
    apkStep3Body2Word: 'ବିଲ୍ଡ-ଟାଇମ ଲକ୍ଷ୍ୟ ପାଇଁ, eas.json ରେ EXPO_PUBLIC_ORCA_API=https://your-host ସେଟ୍ କରନ୍ତୁ।',
    apkStep3NoteWord: 'ଇଞ୍ଜିନ ଅଲଭ୍ୟ ନଥିଲେ ଆପ୍ ତାହା ସ୍ପଷ୍ଟ କହେ — ଏହା କେବେ ବାହାର କଳ୍ପନା ପୂର୍ବାଭାସ ଯୋଗ କରେ ନାହିଁ।',
    apkEngineHeadingWord: 'ଏଜେଣ୍ଟ ଇଞ୍ଜିନ ଚଲାଇବା',
    apkEngineKeyNoteWord:
      'GEMINI_API_KEY ଐଚ୍ଛିକ। ଏହା ନଥିବାରେ ନିର୍ଣୟାତ୍ମକ ଇଞ୍ଜିନ୍ ପ୍ରତ୍ୟେକ ଉତ୍ତରର ଯୋଜନା କରେ, ତର୍କ କରେ, ସଂଶ୍ଲେଷଣ କରେ ଏବଂ ଯଞ୍ଚ କରେ।',
    apkProjectOrgWord: 'ପ୍ରକଳ୍ପ ସଂରଚନା',
    apkDemoHeadingWord: 'ସ୍ମାର୍ଟ ଇଣ୍ଡିଆ ହ୍ୟାକଥନ ପ୍ରଦର୍ଶନ ସ୍କ୍ରିପ୍ଟ',
    copyApkBuildWord: 'APK ବିଲ୍ଡ ଆଦେଶ',
    copyExpoGoWord: 'Expo Go ଆଦେଶ',
    copyEngineWord: 'ଇଞ୍ଜିନ ଆଦେଶ',
    copyFolderWord: 'ଫୋଲ୍ଡର ସଂରଚନା',
    copyDemoWord: 'ଡେମୋ ସ୍କ୍ରିପ୍ଟ',
    closeWord: 'ବନ୍ଦ କରନ୍ତୁ',
    copyWord: 'ଅନୁଲିପି',
    copiedWord: 'ଅନୁଲିପି ହେଲା',
    geofenceTypeBoundaryWord: 'ଆଂତର୍ଜାତୀୟ ସୀମା',
    geofenceTypeRestrictedWord: 'ନିଷେଧିତ ଜଳ',
    geofenceTypeProtectedWord: 'ସମୁଦ୍ରୀୟ ସଂରକ୍ଷିତ ଅଞ୍ଚଳ',
    geofenceTypeSensitiveWord: 'ପରିବେଶ ସଂବେଦନଶୀଳ ଅଞ୍ଚଳ',
    geofenceTypeOilRigWord: 'ତେଲ / ଗ୍ୟାସ ସ୍ଥାପନା',
    geofenceTypeMilitaryWord: 'ସୈନ୍ୟ ଅଞ୍ଚଳ',
    geofenceTypeCableWord: 'ସମୁଦ୍ର ତଳ କେବଲ୍',
    geofenceTypeLaneWord: 'ଜହାଜ ମାର୍ଗ',
    geofenceClearWord: 'ଏହି ମାର୍ଗ ନିକଟରେ କୌଣସି ସମୁଦ୍ରୀୟ ସୀମା, ସଂରକ୍ଷିତ ଅଞ୍ଚଳ କିମ୍ବା ନିଷେଧିତ ଜଳ ନାହିଁ।',
    geofenceStayClearWord: 'ଯେଉଁଥିବାରୁ ଦୂରେ ରହିବାକୁ ହେବ',
    geofenceEvaluatedWord: '{n}ଟି ମୂଲ୍ୟାଙ୍କନ କରାଯାଇଛି',
    geofenceNothingToEnterWord: 'ବର୍ତ୍ତମାନ ପ୍ରବେଶ ପାଇଁ କିଛି ନାହିଁ। ନିକଟତମ ନିୟନ୍ତ୍ରିତ ଜଳ:',
    geofenceBufferWord: '{km} km ବଫର ଭିତରେ',
    geofenceInsideWord: 'ଭିତରେ',
    mapLoadFailedWord: 'ସମୁଦ୍ରୀୟ ଚିତ୍ର ଲୋଡ୍ କରିବାଗିଲା ନାହିଁ।',
    errOrchestrationWord: 'ସଂଯୋଜନ ବିଫଳ',
    errSituationWord: 'ପରିସ୍ଥିତି ରିପୋର୍ଟ ବିଫଳ',
    errPlanningWord: 'ଯୋଜନା ବିଫଳ',
  },

  'pa-IN': {
    infoBuildHubWord: 'Android ਬਿਲਡ ਅਤੇ ਸਰੋਤ',
    infoApkGuideWord: 'APK ਅਤੇ ਡਿਪਲਾਇਮੈਂਟ ਗਾਇਡ',
    infoApkGuideBodyWord:
      'Expo React Native ਕਲਾਈਐਂਟ, TypeScript ਏਜੰਟ ਇੰਜਣ ਅਤੇ Express API — ਤਿੰਨੋਂ ਚਲਾਉਣ ਅਤੇ ਪੈਕੇਜ ਕਰਨ ਦੇ ਕਮਾਂਡਾਂ ਨਾਲ।',
    infoOpenBuildWord: 'ਬਿਲਡ ਹਦਾਇਤਾਂ ਖੋਲ੍ਹੋ',
    infoEngineStatusWord: 'ਇੰਜਣ ਸਥਿਤੀ',
    infoBrowserEngineWord:
      'ਬ੍ਰਾਊਜ਼ਰ ਵਿੱਚ ਚੱਲਣ ਵਾਲਾ ਇੰਜਣ — API ਨਹੀਂ ਮਿਲ ਰਹਾ, ਇਸ ਲਈ ਉਹੀ ਏਜੰਟ ਸਥਾਨਕ ਤੌਰ ’ਤੇ ਚੱਲ ਰਹੇ ਹਨ।',
    infoServerConnectedWord: 'ਸਰਵਰ ਜੁੜ ਗਿਆ — ਏਜੰਟ Node ਇੰਜਣ ਉੱਤੇ ਚੱਲ ਰਹੇ ਹਨ।',
    infoVersionWord: 'ਵਰਜਨ',
    infoAiLayerWord: 'AI ਪਰਤ',
    infoSessionsWord: 'ਸੈਸ਼ਨ',
    infoReferenceCycleWord: 'ਹਵਾਲਾ ਚੱਕਰ',
    infoLocalWord: 'ਸਥਾਨਕ',
    infoDeterministicWord: 'ਨਿਰਧਾਰਤ',
    infoBundledSnapshotWord: 'ਬੰਡਲ ਸਨੈਪਸ਼ਾਟ',
    infoNoApiKeyWord:
      'GEMINI_API_KEY ਸੈੱਟ ਨਹੀਂ ਕੀਤਾ ਗਿਆ। ਇਸ ਤੋਂ ਬਿਨਾਂ ਵੀ ORCA ਪੂਰੀ ਤਰ੍ਹਾਂ ਕੰਮ ਕਰਦਾ ਹੈ — ਚੋਣਵੀਂ ਮਾਡਲ ਸਿਰਫ਼ ਯੋਜਨਾ ਦਾ ਤਰਕ ਅਤੇ ਜਵਾਬ ਦੀ ਭਾਸ਼ਾ ਮੁੜ ਲਿਖਦਾ ਹੈ, ਅਤੇ ਉਹ ਕਦੇ ਵੀ ਕੋਈ ਸੁਰੱਖਿਆ-ਅਹਿਮ ਏਜੰਟ ਨਹੀਂ ਜੋੜ ਕੇ ਹਟਾ ਸਕਦਾ।',
    infoRosterWord: 'ਏਜੰਟ ਸੂਚੀ ({n})',
    infoRosterBodyWord:
      'ਇੱਕ ਪਲੈਨਰ ਹਰ ਸਵਾਲ ਨੂੰ ਕੰਮ-ਗ੍ਰਾਫ ਵਿੱਚ ਵੰਡਦਾ ਹੈ ਅਤੇ ਇਨ੍ਹਾਂ ਮਾਹਰਾਂ ਵਿੱਚੋਂ ਇੱਕ ਹਿੱਸਾ ਚੁਣਦਾ ਹੈ। ਉਹ ਇੱਕ ਸਾਂਝੀ ਬਲੈਕਬੋਰਡ ’ਤੇ ਟਾਈਪ ਕੀਤੇ ਨਤੀਜੇ ਪ੍ਰਕਾਸ਼ਿਤ ਕਰਦੇ ਹਨ, ਕੋਈ ਵੀ ਏਜੰਟ ਸਾਥੀ ਤੋਂ ਮਦਦ ਮੰਗ ਸਕਦਾ ਹੈ, ਅਤੇ ਇੱਕ ਸਮੀਖਿਅਕ ਦਿਖਾਉਣ ਤੋਂ ਪਹਿਲਾਂ ਸੰਸਲਿਟ ਜਵਾਬ ਦੀ ਸਮੀਖਿਆ ਕਰਦਾ ਹੈ।',
    infoCoverageWord: 'ਕਵਰੇਜ',
    infoLanguagesWord: '{n} ਭਾਸ਼ਾਵਾਂ',
    infoHarboursWord: '{n} ਭਾਰਤੀ ਮੱਛੀ ਪ੍ਰਧਾਨਗਿਆਂ',
    infoVesselProfilesWord: '{n} ਜਹਾਜ਼ ਪ੍ਰੋਫਾਈਲਾਂ',
    infoVesselBodyWord:
      'ਰਾਹਗੀ ਸੀਮਾਵਾਂ, ਸਮੁੰਦਰੀ ਸਹਿਲ ਸਮਰੱਥਾ ਅਤੇ ਰਫ਼ਤਾਰ ਹਰ ਜਹਾਜ਼ ਵਰਗ ਲਈ ਵੱਖ-ਵੱਖ ਮੁਲਾਂਕਣ ਕੀਤੇ ਜਾਂਦੇ ਹਨ।',
    infoCycleBodyWord: '{sources} ਸਰੋਤ ਉਤਪਾਦਾਂ ਉੱਤੇ {cycle} ਮਾਡਲ-ਆਧਾਰਿਤ ਹਵਾਲਾ ਚੱਕਰ ਨਾਲ ਮੇਲ਼ ਖਾਂਦਾ ਹੈ।',
    infoBaseHarbourWord: 'ਮੁੱਖ ਬੰਦਰ',
    infoBaseHarbourBodyWord: 'ਜਦੋਂ ਤੱਕ GPS ਸਥਿਤੀ ਨਹੀਂ ਦਿੱਤੀ ਜਾਂਦੀ, ਹਰ ਸਥਾਨਕ ਗਣਨਾ ਇਸੇ ਬੰਦਰ ਨਾਲ ਹੀ ਜੁੜੀ ਰਹਿੰਦੀ ਹੈ।',
    infoAcceptanceWord: 'ਸਵੀਕਾਰਤਾ ਜਾਂਚ',
    infoAcceptanceBodyWord:
      'ਸਮੱਸਿਆ ਬਿਆਨ ਦੀਆਂ ਅੱਠ ਸਮਰੱਥਾਵਾਂ ਸਾਰੀਆਂ {n} ਭਾਸ਼ਾਵਾਂ ਵਿੱਚ ਪਹਿਲਾਂ ਹੀ ਅਸਲੀ ਸਵਾਲਾਂ ਵਜੋਂ ਲੋਡ ਕੀਤੀਆਂ ਹਨ। ਹਰੇਕ ਉਹੀ ਪਾਈਪਲਾਈਨ ਤੋਂ ਲੰਘਦੀ ਹੈ ਜਿਸ ਤੋਂ ਤੁਸੀਂ ਕੁਝ ਵੀ ਟਾਈਪ ਕਰਦੇ ਹੋ — ਇਸ ਲਈ ਕਿਸੇ ਇੱਕ ਨੂੰ ਟੈਪ ਕਰਨਾ ਭਾਸ਼ਾ ਪਛਾਣ, ਇੰਟੈਂਟ ਪਾਰਸਿੰਗ, ਸੂਚੀ ਚੋਣ ਅਤੇ ਸੰਸਥਾਪਨ ਦੀ ਅਸਲੀ ਜਾਂਚ ਹੈ, ਲਿਖਤੀ ਜਵਾਬ ਨਹੀਂ।',
    infoOpenChatWord: '{lang} ਵਿੱਚ ਗੱਲਬਾਤ ਖੋਲ੍ਹੋ',
    infoSafetyWord: 'ਸੁਰੱਖਿਆ ਮਿਆਰਕ ਅਤੇ ਜ਼ਿੰਮੇਵਾਰ AI',
    infoSafetyBodyWord:
      'ORCA ਫ਼ੈਸਲਾ ਸਹਾਇਤਾ ਦਿੰਦਾ ਹੈ। ਇਹ ਕਦੇ ਸੁਰੱਖਿਆ ਦੀ ਗਰੰਟੀ ਨਹੀਂ ਦਿੰਦਾ, ਅਤੇ ਕਦੇ ਕੋਈ ਅਧਿਕਾਰਤ ਚੇਤਾਵਨੀ ਨੂੰ ਵੀ ਰੱਦ ਨਹੀਂ ਦਿੰਦਾ। ਦਿਖਾਉਣ ਤੋਂ ਪਹਿਲਾਂ ਇੱਕ ਵਿਸ਼ੇਸ਼ ਸਮੀਖਿਅਕ ਏਜੰਟ ਹਰ ਜਵਾਬ ਨੂੰ ਮੁੜ ਪੜ੍ਹਦਾ ਹੈ, ਬਹੁਤ ਆਤਮਵਿਸ਼ਵਾਸ ਵਾਲੇ ਵਾਕ ਹਟਾਉਂਦਾ ਹੈ, ORANGE ਜਾਂ RED ਚੇਤਾਵਨੀ ਨੂੰ ਉੱਚਾ ਦਿਖਾਉਂਦਾ ਹੈ, ਅਤੇ ਉਸ ਨੂੰ IMD, INCOIS ਅਤੇ ਬੰਦਰ ਅਥਾਰਟੀ ਦੀਆਂ ਚੇਤਾਵਨੀਆਂ ਨਾਲ ਜੋੜਦਾ ਹੈ। ਜਹਾਜ਼ ਦਾ ਫ਼ੈਸਲਾ ਮਾਲਕ ਦਾ ਹੀ ਰਹਿੰਦਾ ਹੈ।',
    apkTitleWord: 'ORCA ਬਿਲਡ ਅਤੇ ਪ੍ਰਦਰਸ਼ਨ ਕੇਂਦਰ',
    apkSubtitleWord: 'ਇੱਕ TypeScript ਏਜੰਟ ਇੰਜਣ · ਵੈੱਬ ਕਲਾਈਐਂਟ + Android APK',
    apkTabBuildWord: 'APK ਬਿਲਡ',
    apkTabEngineWord: 'ਇੰਜਣ ਅਤੇ API',
    apkTabStructureWord: 'ਫੋਲਡਰ ਸਟ੍ਰਕਚਰ',
    apkTabDemoWord: '3-ਮਿੰਟ ਡੈਮੋ ਸਕ੍ਰਿਪਟ',
    apkStep1Word: '1. Expo EAS ਕਲਾਉਡ ਬਿਲਡ ਨਾਲ ਸਟੈਂਡਲੋਨ APK',
    apkStep1BodyWord:
      'EAS ਸਿੱਧਾ ਇੰਸਟਾਲ ਹੋਣ ਵਾਲੀ APK ਲਈ ਇੱਕ ਡਾਊਨਲੋਡ ਲਿੰਕ ਅਤੇ QR ਕੋਡ ਪ੍ਰਿੰਟ ਕਰਦਾ ਹੈ — ਨਾ Android Studio, ਨਾ ਲੋਕਲ SDK, ਅਤੇ ਜਿਸ ਫ਼ੋਨ ’ਤੇ ਮਿਲੇਗਾ ਉੱਥੇ ਕੁਝ ਵੀ ਸੈੱਟ ਕਰਨ ਦੀ ਲੋੜ ਨਹੀਂ।',
    apkStep2Word: '2. Expo Go ਨਾਲ ਅਸਲੀ ਫ਼ੋਨ ਉੱਤੇ ਤੁਰੰਤ ਜਾਂਚ',
    apkStep3Word: '3. APK ਨੂੰ ਹੋਸਟ ਕੀਤੇ ਇੰਜਣ ਨਾਲ ਜੋੜਨਾ',
    apkStep3BodyWord: 'ਪਤਾ ਬਿਲਕੁਲ ਇੱਕੋ ਥਾਂ ਲਿਖਿਆ ਹੈ, mobile/src/services/api.js, ਅਤੇ ਇਹ ਪਹਿਲਾਂ ਇੱਕ ਐਨਵਾਇਰੋਨਮੈਂਟ ਵੇਰੀਏਬਲ ਪੜ੍ਹਦਾ ਹੈ:',
    apkStep3Body2Word: 'ਬਿਲਡ-ਟਾਈਮ ਟੀਚੇ ਲਈ, eas.json ਵਿੱਚ EXPO_PUBLIC_ORCA_API=https://your-host ਸੈੱਟ ਕਰੋ।',
    apkStep3NoteWord: 'ਜੇ ਇੰਜਣ ਨਹੀਂ ਮਿਲਦਾ ਤਾਂ ਐਪ ਸਾਫ਼ ਦੱਸਦਾ ਹੈ — ਇਹ ਕਦੇ ਵੀ ਬਣਾਈ ਅੰਦਾਜ਼ਾ ਨਹੀਂ ਲਾਉਂਦਾ।',
    apkEngineHeadingWord: 'ਏਜੰਟ ਇੰਜਣ ਚਲਾਉਣਾ',
    apkEngineKeyNoteWord:
      'GEMINI_API_KEY ਚੋਣਵੀਆ ਹੈ। ਇਸ ਦੇ ਬਿਨਾਂ ਨਿਰਧਾਰਨ ਇੰਜਣ ਹਾਲੇ ਵੀ ਹਰ ਜਵਾਬ ਦੀ ਯੋਜਨਾ ਬਣਾਉਂਦਾ, ਤਰਕ ਕਰਦਾ, ਸੰਯੋਜਨ ਕਰਦਾ ਅਤੇ ਜਾਂਚਦਾ ਹੈ।',
    apkProjectOrgWord: 'ਪ੍ਰੋਜੈਕਟ ਸਟ੍ਰਕਚਰ',
    apkDemoHeadingWord: 'ਸਮਾਰਟ ਇੰਡੀਆ ਹੈਕਥੋਨ ਪ੍ਰਦਰਸ਼ਨ ਸਕ੍ਰਿਪਟ',
    copyApkBuildWord: 'APK ਬਿਲਡ ਕਮਾਂਡਾਂ',
    copyExpoGoWord: 'Expo Go ਕਮਾਂਡਾਂ',
    copyEngineWord: 'ਇੰਜਣ ਕਮਾਂਡਾਂ',
    copyFolderWord: 'ਫੋਲਡਰ ਸਟ੍ਰਕਚਰ',
    copyDemoWord: 'ਡੈਮੋ ਸਕ੍ਰਿਪਟ',
    closeWord: 'ਬੰਦ ਕਰੋ',
    copyWord: 'ਕਾਪੀ',
    copiedWord: 'ਕਾਪੀ ਹੋ ਗਿਆ',
    geofenceTypeBoundaryWord: 'ਅੰਤਰਰਾਸ਼ਟਰੀ ਸੀਮਾ',
    geofenceTypeRestrictedWord: 'ਪਾਬੰਦੀਸ਼ੁਦਾ ਪਾਣੀ',
    geofenceTypeProtectedWord: 'ਸਮੁੰਦਰੀ ਸੁਰੱਖਿਆਉਤ ਖੇਤਰ',
    geofenceTypeSensitiveWord: 'ਪਰਿਸਥਿਤਿ-ਸੰਵੇਦਨਸ਼ੀਲ ਖੇਤਰ',
    geofenceTypeOilRigWord: 'ਤੇਲ / ਗੈਸ ਸਥਾਪਨਾ',
    geofenceTypeMilitaryWord: 'ਫੌਜੀ ਖੇਤਰ',
    geofenceTypeCableWord: 'ਸਮੁੰਦਰ ਹੇਠਲਾਈ ਕੇਬਲ',
    geofenceTypeLaneWord: 'ਜਹਾਜ਼ੀ ਰਸਤਾ',
    geofenceClearWord: 'ਇਸ ਰਸਤੇ ਦੇ ਨੇੜੇ ਕੋਈ ਸਮੁੰਦਰੀ ਸੀਮਾ, ਸੁਰੱਖਿਆਉਤ ਖੇਤਰ ਜਾਂ ਪਾਬੰਦੀਸ਼ੁਦਾ ਪਾਣੀ ਨਹੀਂ ਹੈ।',
    geofenceStayClearWord: 'ਜਿਨ੍ਹਾਂ ਤੋਂ ਦੂਰ ਰਹਿਣਾ ਹੈ',
    geofenceEvaluatedWord: '{n} ਦਾ ਮੁਲਾਂਕਣ ਕੀਤਾ ਗਿਆ',
    geofenceNothingToEnterWord: 'ਹੁਣ ਦਾਖ਼ਲੇ ਲਈ ਕੁਝ ਨਹੀਂ। ਨੇੜਲਾ ਨਿਯਾਮਿਤ ਪਾਣੀ:',
    geofenceBufferWord: '{km} km ਬਫ਼ਰ ਦੇ ਅੰਦਰ',
    geofenceInsideWord: 'ਅੰਦਰ',
    mapLoadFailedWord: 'ਸਮੁੰਦਰੀ ਚਿੱਤਰ ਲੋਡ ਨਹੀਂ ਹੋ ਸਕਿਆ।',
    errOrchestrationWord: 'ਤਾਲਮੇਲ ਅਸਫਲ',
    errSituationWord: 'ਹਾਲਤ ਰਿਪੋਰਟ ਅਸਫਲ',
    errPlanningWord: 'ਯੋਜਨਾਬੰਦੀ ਅਸਫਲ',
  }
};
