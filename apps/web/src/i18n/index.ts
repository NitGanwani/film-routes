import type { Locale } from '@film-routes/shared';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './en.js';
import { es } from './es.js';

const LANGUAGE_KEY = 'film-routes.language';

function initialLanguage(): Locale {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    if (saved === 'es' || saved === 'en') return saved;
  } catch {
    // Storage can be blocked (private mode): fall through to the browser.
  }
  return navigator.language.toLowerCase().startsWith('en') ? 'en' : 'es';
}

export function setLanguage(language: Locale) {
  void i18next.changeLanguage(language);
  document.documentElement.lang = language;
  try {
    localStorage.setItem(LANGUAGE_KEY, language);
  } catch {
    // Not saving the choice is only an inconvenience.
  }
}

export function initI18n() {
  const language = initialLanguage();
  document.documentElement.lang = language;
  return i18next.use(initReactI18next).init({
    resources: { es: { translation: es }, en: { translation: en } },
    lng: language,
    fallbackLng: 'es',
    interpolation: { escapeValue: false },
  });
}
