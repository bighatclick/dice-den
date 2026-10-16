import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';

/** v1.0 ships English only (specs.md §11); every UI string lives in en.json. */
const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: 'en',
  fallbackLng: 'en',
  initAsync: false,
  interpolation: { escapeValue: false },
});

export default i18n;
