import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslations from './locales/en.json';
import urTranslations from './locales/ur.json';

const resources = {
  en: {
    translation: enTranslations
  },
  ur: {
    translation: urTranslations
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // React already escapes values
    }
  });

// Listen to language changes to update global fonts (keeping layout LTR as requested)
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
  document.documentElement.dir = 'ltr'; // Force LTR even for Urdu
  
  if (lng === 'ur') {
    document.documentElement.style.fontFamily = "'Alvi Nastaleeq Regular', 'Alvi Nastaleeq', 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif";
  } else {
    document.documentElement.style.fontFamily = ""; // Revert to default in CSS
  }
});

// Set initial direction to ltr
document.documentElement.dir = 'ltr';

export default i18n;
