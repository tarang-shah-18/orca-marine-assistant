/**
 * Freshness-strip additions: the words on the live clock, the data-age readout,
 * and the GPS anchor line.
 *
 * These exist because of the second prototype defect — "the data never updates
 * and there is no clock". The readout is not decoration: a safety product that
 * silently serves twenty-minute-old numbers looks exactly like one serving fresh
 * ones, so the age of the data is stated on screen at all times, and the poll
 * that keeps it current is stated too.
 *
 * `IST` and `UTC+05:30` stay in Latin script in every language: they are the
 * International Standard Time zone identifier as printed on every IMD, INCOIS
 * and port-authority bulletin, and a bulletin reader matches them literally.
 */

export const FRESH_ADDITIONS = {
  'en-IN': {
    updatedJustNowWord: 'Updated just now',
    updatedSecondsAgoWord: 'Updated {n}s ago',
    updatedMinutesAgoWord: 'Updated {n} min ago',
    updatedHoursAgoWord: 'Updated {n} h ago',
    refreshingNowWord: 'Refreshing…',
    autoRefreshWord: 'Checks for new data every {n} min',
    anchorGpsWord: 'Anchored to {harbor} · {km} km from your position',
  },
  'hi-IN': {
    updatedJustNowWord: 'अभी अद्यतन किया गया',
    updatedSecondsAgoWord: '{n} सेकंड पहले अद्यतन',
    updatedMinutesAgoWord: '{n} मिनट पहले अद्यतन',
    updatedHoursAgoWord: '{n} घंटे पहले अद्यतन',
    refreshingNowWord: 'अद्यतन हो रहा है…',
    autoRefreshWord: 'हर {n} मिनट में नया डेटा देखता है',
    anchorGpsWord: '{harbor} से जुड़ा · आपकी स्थिति से {km} किमी',
  },
  'mr-IN': {
    updatedJustNowWord: 'आत्ताच अद्ययावत केले',
    updatedSecondsAgoWord: '{n} सेकंद पूर्वी अद्ययावत',
    updatedMinutesAgoWord: '{n} मिनिटांपूर्वी अद्ययावत',
    updatedHoursAgoWord: '{n} तासांपूर्वी अद्ययावत',
    refreshingNowWord: 'अद्ययावत होत आहे…',
    autoRefreshWord: 'दर {n} मिनिटांनी नवीन माहिती तपासते',
    anchorGpsWord: '{harbor}शी जोडले · तुमच्या स्थानापासून {km} किमी',
  },
  'gu-IN': {
    updatedJustNowWord: 'હમણાં જ અપડેટ કર્યું',
    updatedSecondsAgoWord: '{n} સેકંડ પહેલાં અપડેટ',
    updatedMinutesAgoWord: '{n} મિનિટ પહેલાં અપડેટ',
    updatedHoursAgoWord: '{n} કલાક પહેલાં અપડેટ',
    refreshingNowWord: 'અપડેટ થઈ રહ્યું છે…',
    autoRefreshWord: 'દર {n} મિનિટે નવો ડેટા તપાસે છે',
    anchorGpsWord: '{harbor} સાથે જોડાયેલું · તમારા સ્થાનથી {km} કિમી',
  },
  'kn-IN': {
    updatedJustNowWord: 'ಈಗಷ್ಟೇ ನವೀಕರಿಸಲಾಗಿದೆ',
    updatedSecondsAgoWord: '{n} ಸೆಕೆಂಡ್ ಮೊದಲು ನವೀಕರಿಸಲಾಗಿದೆ',
    updatedMinutesAgoWord: '{n} ನಿಮಿಷಗಳ ಮೊದಲು ನವೀಕರಿಸಲಾಗಿದೆ',
    updatedHoursAgoWord: '{n} ಗಂಟೆಗಳ ಮೊದಲು ನವೀಕರಿಸಲಾಗಿದೆ',
    refreshingNowWord: 'ನವೀಕರಿಸಲಾಗುತ್ತಿದೆ…',
    autoRefreshWord: 'ಪ್ರತಿ {n} ನಿಮಿಷಕ್ಕೊಮ್ಮೆ ಹೊಸ ಡೇಟಾ ಪರಿಶೀಲಿಸುತ್ತದೆ',
    anchorGpsWord: '{harbor} ಜೊತೆ ಜೋಡಿಸಲಾಗಿದೆ · ನಿಮ್ಮ ಸ್ಥಳದಿಂದ {km} ಕಿ.ಮೀ.',
  },
  'ml-IN': {
    updatedJustNowWord: 'ഇപ്പോൾ അപ്ഡേറ്റ് ചെയ്തു',
    updatedSecondsAgoWord: '{n} സെക്കന്ട് മുമ്പ് അപ്ഡേറ്റ് ചെയ്തത്',
    updatedMinutesAgoWord: '{n} മിനിറ്റ് മുമ്പ് അപ്ഡേറ്റ് ചെയ്തത്',
    updatedHoursAgoWord: '{n} മണിക്കൂർ മുമ്പ് അപ്ഡേറ്റ് ചെയ്തത്',
    refreshingNowWord: 'അപ്ഡേറ്റ് ചെയ്യുന്നു…',
    autoRefreshWord: 'ഓരോ {n} മിനിറ്റിലും പുതിയ ഡാറ്റ പരിശോധിക്കുന്നു',
    anchorGpsWord: '{harbor} എന്നതിലേക്ക് ബന്ധിപ്പിച്ചിരിക്കുന്നു · നിങ്ങളുടെ സ്ഥാനത്തിൽ നിന്ന് {km} കി.മീ.',
  },
  'te-IN': {
    updatedJustNowWord: 'ఇప్పుడే అప్‌డేట్ చేయబడింది',
    updatedSecondsAgoWord: '{n} సెకన్ల క్రితం అప్‌డేట్ చేయబడింది',
    updatedMinutesAgoWord: '{n} నిమిషాల క్రితం అప్‌డేట్ చేయబడింది',
    updatedHoursAgoWord: '{n} గంటల క్రితం అప్‌డేట్ చేయబడింది',
    refreshingNowWord: 'అప్‌డేట్ అవుతోంది…',
    autoRefreshWord: 'ప్రతి {n} నిమిషాలకు కొత్త డేటాను తనిఖీ చేస్తుంది',
    anchorGpsWord: '{harbor} కు అనుసంధానించబడింది · మీ స్థానం నుండి {km} కి.మీ.',
  },
  'ta-IN': {
    updatedJustNowWord: 'இப்போது புதுப்பிக்கப்பட்டது',
    updatedSecondsAgoWord: '{n} வினாடிகளுக்கு முன் புதுப்பிக்கப்பட்டது',
    updatedMinutesAgoWord: '{n} நிமிடங்களுக்கு முன் புதுப்பிக்கப்பட்டது',
    updatedHoursAgoWord: '{n} மணி நேரத்திற்கு முன் புதுப்பிக்கப்பட்டது',
    refreshingNowWord: 'புதுப்பிக்கப்படுகிறது…',
    autoRefreshWord: 'ஒவ்வொரு {n} நிமிடங்களுக்கும் புதிய தரவைச் சரிபார்க்கும்',
    anchorGpsWord: '{harbor} உடன் இணைக்கப்பட்டது · உங்கள் இருப்பிடத்திலிருந்து {km} கி.மீ.',
  },
  'bn-IN': {
    updatedJustNowWord: 'এইমাত্র হালনাগাদ হয়েছে',
    updatedSecondsAgoWord: '{n} সেকেন্ড আগে হালনাগাদ হয়েছে',
    updatedMinutesAgoWord: '{n} মিনিট আগে হালনাগাদ হয়েছে',
    updatedHoursAgoWord: '{n} ঘণ্টা আগে হালনাগাদ হয়েছে',
    refreshingNowWord: 'হালনাগাদ হচ্ছে…',
    autoRefreshWord: 'প্রতি {n} মিনিটে নতুন তথ্য পরীক্ষা করে',
    anchorGpsWord: '{harbor} এর সঙ্গে সংযুক্ত · আপনার অবস্থান থেকে {km} কিমি',
  },
  'or-IN': {
    updatedJustNowWord: 'ବର୍ତ୍ତମାନ ଅଦ୍ୟତନ ହେଲା',
    updatedSecondsAgoWord: '{n} ସେକେଣ୍ଡ ପୂର୍ବେ ଅଦ୍ୟତନ ହେଲା',
    updatedMinutesAgoWord: '{n} ମିନିଟ ପୂର୍ବେ ଅଦ୍ୟତନ ହେଲା',
    updatedHoursAgoWord: '{n} ଘଣ୍ଟା ପୂର୍ବେ ଅଦ୍ୟତନ ହେଲା',
    refreshingNowWord: 'ଅଦ୍ୟତନ ହେଉଛି…',
    autoRefreshWord: 'ପ୍ରତ୍ୟେକ {n} ମିନିଟରେ ନୂଆ ତଥ୍ୟ ଯାଞ୍ଚ କରେ',
    anchorGpsWord: '{harbor} ସହ ଜୋଡ଼ାଯାଇଛି · ଆପଣଙ୍କ ସ୍ଥାନରୁ {km} କି.ମି.',
  },
  'pa-IN': {
    updatedJustNowWord: 'ਹੁਣੇ ਅੱਪਡੇਟ ਕੀਤਾ ਗਿਆ',
    updatedSecondsAgoWord: '{n} ਸਕਿੰਟ ਪਹਿਲਾਂ ਅੱਪਡੇਟ ਕੀਤਾ ਗਿਆ',
    updatedMinutesAgoWord: '{n} ਮਿੰਟ ਪਹਿਲਾਂ ਅੱਪਡੇਟ ਕੀਤਾ ਗਿਆ',
    updatedHoursAgoWord: '{n} ਘੰਟੇ ਪਹਿਲਾਂ ਅੱਪਡੇਟ ਕੀਤਾ ਗਿਆ',
    refreshingNowWord: 'ਅੱਪਡੇਟ ਹੋ ਰਿਹਾ ਹੈ…',
    autoRefreshWord: 'ਹਰ {n} ਮਿੰਟ ਵਿੱਚ ਨਵਾਂ ਡਾਟਾ ਜਾਂਚਦਾ ਹੈ',
    anchorGpsWord: '{harbor} ਨਾਲ ਜੁੜਿਆ · ਤੁਹਾਡੀ ਥਾਂ ਤੋਂ {km} ਕਿਮੀ',
  },
};
