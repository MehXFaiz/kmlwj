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

/** Languages that render right-to-left. */
const RTL_LANGUAGES = new Set(['ur', 'ar', 'fa', 'ps']);

export const isRtlLanguage = (lng) => RTL_LANGUAGES.has(String(lng || '').split('-')[0]);

/**
 * Applies direction, lang and font stack for the active language.
 *
 * `dir` is set on <html> so the whole tree flips via CSS logical properties,
 * and a `lang-ur` / `dir-rtl` class is mirrored onto the root element so
 * stylesheets can target RTL without relying on the [dir] attribute selector
 * winning specificity battles against utility classes.
 *
 * Note: this deliberately reverses the previous "force LTR even for Urdu"
 * behaviour — Urdu now renders as a true RTL layout.
 */
export function applyLanguageDirection(lng) {
  const root = document.documentElement;
  const rtl = isRtlLanguage(lng);

  root.lang = lng;
  root.dir = rtl ? 'rtl' : 'ltr';
  root.classList.toggle('dir-rtl', rtl);
  root.classList.toggle('lang-ur', String(lng || '').startsWith('ur'));

  // Urdu uses the Nastaleeq stack; English reverts to the sans stack in CSS.
  root.style.fontFamily = rtl
    ? "'Alvi Nastaleeq Regular', 'Alvi Nastaleeq', 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif"
    : '';
}

i18n.on('languageChanged', applyLanguageDirection);

// Apply immediately for the language the detector resolved on boot.
applyLanguageDirection(i18n.language || 'en');

export default i18n;
