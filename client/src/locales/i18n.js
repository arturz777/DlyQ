// client/src/locales/i18n.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Импорты переводов
import navbarEst from './est/navbar.json';
import searchbarEst from './est/searchbar.json';

import navbarEn from './en/navbar.json';
import searchbarEn from './en/searchbar.json';

import navbarRu from './ru/navbar.json';
import searchbarRu from './ru/searchbar.json';



i18n
  .use(LanguageDetector) // Автоматическое определение языка
  .use(initReactI18next) // Интеграция с React
  .init({
    resources: {
      en: {
        navbar: navbarEn,
        searchbar: searchbarEn,
      },
      ru: {
        navbar: navbarRu,
        searchbar: searchbarRu,
      },
      est: {
        navbar: navbarEst,
        searchbar: searchbarEst,
      },
    },

    fallbackLng: "ru", // Язык по умолчанию
    defaultNS: "navbar",
    debug: false, // Включить отладку
    interpolation: {
      escapeValue: false, // Не экранировать HTML
    },
  });

export default i18n;
