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

// Listen to language changes to update document direction (RTL/LTR) and global fonts
i18n.on('languageChanged', (lng) => {
  const dir = i18n.dir(lng);
  document.documentElement.dir = dir;
  document.documentElement.lang = lng;
  
  if (lng === 'ur') {
    document.documentElement.style.fontFamily = "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif";
  } else {
    document.documentElement.style.fontFamily = ""; // Revert to default in CSS
  }
});

// Set initial direction based on detected language
document.documentElement.dir = i18n.dir();

export default i18n;
