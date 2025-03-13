import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';


import navbarEst from './est/navbar.json';
import searchbarEst from './est/searchbar.json';
import devicePageEst from './est/devicePage.json';
import deviceItemEst from './est/deviceItem.json';
import deviceListEst from './est/deviceList.json';
import cookiePolicyEst from './est/cookiePolicy.json';
import returnPolicyEst from './est/returnPolicy.json';
import termsOfServiceEst from './est/termsOfService.json';
import privacyPolicyEst from './est/privacyPolicy.json';
import deliveryPolicyEst from './est/deliveryPolicy.json';
import cookieConsentEst from './est/cookieConsent.json';
import footerEst from './est/footer.json';
import orderSidebarEst from './est/orderSidebar.json';

import navbarEn from './en/navbar.json';
import searchbarEn from './en/searchbar.json';
import devicePageEn from './en/devicePage.json';
import deviceItemEn from './en/deviceItem.json';
import deviceListEn from './en/deviceList.json';
import cookiePolicyEn from './en/cookiePolicy.json';
import returnPolicyEn from './en/returnPolicy.json';
import termsOfServiceEn from './en/termsOfService.json';
import privacyPolicyEn from './en/privacyPolicy.json';
import deliveryPolicyEn from './en/deliveryPolicy.json';
import cookieConsentEn from './en/cookieConsent.json';
import footerEn from './en/footer.json';
import orderSidebarEn from './en/orderSidebar.json';

import navbarRu from './ru/navbar.json';
import searchbarRu from './ru/searchbar.json';
import devicePageRu from './ru/devicePage.json';
import deviceItemRu from './ru/deviceItem.json';
import deviceListRu from './ru/deviceList.json';
import cookiePolicyRu from './ru/cookiePolicy.json';
import returnPolicyRu from './ru/returnPolicy.json';
import termsOfServiceRu from './ru/termsOfService.json';
import privacyPolicyRu from './ru/privacyPolicy.json';
import deliveryPolicyRu from './ru/deliveryPolicy.json';
import cookieConsentRu from './ru/cookieConsent.json';
import footerRu from './ru/footer.json';
import orderSidebarRu from './ru/orderSidebar.json';


i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        navbar: navbarEn,
        searchbar: searchbarEn,
        devicePage: devicePageEn,
        deviceItem: deviceItemEn,
        deviceList: deviceListEn,
        cookiePolicy: cookiePolicyEn,
        returnPolicy: returnPolicyEn,
        termsOfService: termsOfServiceEn,
        privacyPolicy: privacyPolicyEn,
        deliveryPolicy: deliveryPolicyEn,
        cookieConsent: cookieConsentEn,
        footer: footerEn,
        orderSidebar: orderSidebarEn,
      },
      ru: {
        navbar: navbarRu,
        searchbar: searchbarRu,
        devicePage: devicePageRu,
        deviceItem: deviceItemRu,
        deviceList: deviceListRu,
        cookiePolicy: cookiePolicyRu,
        returnPolicy: returnPolicyRu,
        termsOfService: termsOfServiceRu,
        privacyPolicy: privacyPolicyRu,
        deliveryPolicy: deliveryPolicyRu,
        cookieConsent: cookieConsentRu,
        footer: footerRu,
        orderSidebar: orderSidebarRu,
      },
      est: {
        navbar: navbarEst,
        searchbar: searchbarEst,
        devicePage: devicePageEst,
        deviceItem: deviceItemEst,
        deviceList: deviceListEst,
        cookiePolicy: cookiePolicyEst,
        returnPolicy: returnPolicyEst,
        termsOfService: termsOfServiceEst,
        privacyPolicy: privacyPolicyEst,
        deliveryPolicy: deliveryPolicyEst,
        cookieConsent: cookieConsentEst,
        footer: footerEst,
        orderSidebar: orderSidebarEst,
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
