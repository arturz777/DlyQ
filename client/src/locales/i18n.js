// client/src/locales/i18n.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Импорты переводов
import navbarEst from './est/navbar.json';
import searchbarEst from './est/searchbar.json';
import devicePageEst from './est/devicePage.json';
import deviceItemEst from './est/deviceItem.json';
import deviceListEst from './est/deviceList.json';

import navbarEn from './en/navbar.json';
import searchbarEn from './en/searchbar.json';
import devicePageEn from './en/devicePage.json';
import deviceItemEn from './en/deviceItem.json';
import deviceListEn from './en/deviceList.json';

import navbarRu from './ru/navbar.json';
import searchbarRu from './ru/searchbar.json';
import devicePageRu from './ru/devicePage.json';
import deviceItemRu from './ru/deviceItem.json';
import deviceListRu from './ru/deviceList.json';


i18n
  .use(LanguageDetector) // Автоматическое определение языка
  .use(initReactI18next) // Интеграция с React
  .init({
    resources: {
      en: {
        navbar: navbarEn,
        searchbar: searchbarEn,
        devicePage: devicePageEn,
        deviceItem: deviceItemEn,
        deviceList: deviceListEn,
      },
      ru: {
        navbar: navbarRu,
        searchbar: searchbarRu,
        devicePage: devicePageRu,
        deviceItem: deviceItemRu,
        deviceList: deviceListRu,
      },
      est: {
        navbar: navbarEst,
        searchbar: searchbarEst,
        devicePage: devicePageEst,
        deviceItem: deviceItemEst,
        deviceList: deviceListEst,
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
