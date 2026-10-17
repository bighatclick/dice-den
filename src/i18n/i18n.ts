import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import { pseudoLocalize } from './pseudo';

/**
 * v1.0 ships English only (specs.md §11); every UI string lives in en.json.
 * EXPO_PUBLIC_PSEUDO_LOCALE=1 switches to the "xx" pseudo-locale for the pre-release check.
 */
const i18n = createInstance();
const pseudo = process.env.EXPO_PUBLIC_PSEUDO_LOCALE === '1';

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ...(pseudo ? { xx: { translation: pseudoLocalize(en) } } : {}) },
  lng: pseudo ? 'xx' : 'en',
  fallbackLng: 'en',
  initAsync: false,
  interpolation: { escapeValue: false },
});

export default i18n;
