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
import paymentFormEst from './est/paymentForm.json';
import authEst from './est/auth.json';
import basketEst from './est/basket.json';
import profileSettingsEst from './est/profileSettings.json';
import userProfileEst from './est/userProfile.json';
import mobileNavBarEst from './est/mobileNavBar.json';
import homePageEst from './est/homePage.json';
import courierPolicyEst from './est/courierPolicy.json';
import brandBarEst from './est/brandBar.json';
import maintenanceEst from './est/maintenance.json';
import chatBoxEst from './est/chatBox.json';
import mainPageEst from './est/mainPage.json';
import parcelPageEst from './est/parcelPage.json';
import sellerAdminPageEst from './est/sellerAdminPage.json';
import sellerPageEst from './est/sellerPage.json';
import dishModalEst from './est/dishModal.json';

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
import paymentFormEn from './en/paymentForm.json';
import authEn from './en/auth.json';
import basketEn from './en/basket.json';
import profileSettingsEn from './en/profileSettings.json';
import userProfileEn from './en/userProfile.json';
import mobileNavBarEn from './en/mobileNavBar.json';
import homePageEn from './en/homePage.json';
import courierPolicyEn from './en/courierPolicy.json';
import brandBarEn from './en/brandBar.json';
import maintenanceEn from './en/maintenance.json';
import chatBoxEn from './en/chatBox.json';
import mainPageEn from './en/mainPage.json';
import parcelPageEn from './en/parcelPage.json';
import sellerAdminPageEn from './en/sellerAdminPage.json';
import sellerPageEn from './en/sellerPage.json';
import dishModalEn from './en/dishModal.json';

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
import paymentFormRu from './ru/paymentForm.json';
import authRu from './ru/auth.json';
import basketRu from './ru/basket.json';
import profileSettingsRu from './ru/profileSettings.json';
import userProfileRu from './ru/userProfile.json';
import mobileNavBarRu from './ru/mobileNavBar.json';
import homePageRu from './ru/homePage.json';
import courierPolicyRu from './ru/courierPolicy.json';
import brandBarRu from './ru/brandBar.json';
import maintenanceRu from './ru/maintenance.json';
import chatBoxRu from './ru/chatBox.json';
import mainPageRu from './ru/mainPage.json';
import parcelPageRu from './ru/parcelPage.json';
import sellerAdminPageRu from './ru/sellerAdminPage.json';
import sellerPageRu from './ru/sellerPage.json';
import dishModalRu from './ru/dishModal.json';


i18n
  .use(LanguageDetector)
  .use(initReactI18next)
   .init({
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },
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
        paymentForm: paymentFormEn,
        auth: authEn,
        basket: basketEn,
        profileSettings: profileSettingsEn,
        userProfile: userProfileEn,
        mobileNavBar: mobileNavBarEn,
        homePage: homePageEn,
        courierPolicy: courierPolicyEn,
        brandBar: brandBarEn,
        maintenance: maintenanceEn,
        chatBox: chatBoxEn,
        mainPage: mainPageEn,
        parcelPage: parcelPageEn,
        sellerAdminPage: sellerAdminPageEn,
        sellerPage: sellerPageEn,
        dishModal: dishModalEn,
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
        paymentForm: paymentFormRu,
        auth: authRu,
        basket: basketRu,
        profileSettings: profileSettingsRu,
        userProfile: userProfileRu,
        mobileNavBar: mobileNavBarRu,
        homePage: homePageRu,
        courierPolicy: courierPolicyRu,
        brandBar: brandBarRu,
        maintenance: maintenanceRu,
        chatBox: chatBoxRu,
        mainPage: mainPageRu,
        parcelPage: parcelPageRu,
        sellerAdminPage: sellerAdminPageRu,
        sellerPage: sellerPageRu,
        dishModal: dishModalRu,
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
        paymentForm: paymentFormEst,
        auth: authEst,
        basket: basketEst,
        profileSettings: profileSettingsEst,
        userProfile: userProfileEst,
        mobileNavBar: mobileNavBarEst,
        homePage: homePageEst,
        courierPolicy: courierPolicyEst,
        brandBar: brandBarEst,
        maintenance: maintenanceEst,
        chatBox: chatBoxEst,
        mainPage: mainPageEst,
        parcelPage: parcelPageEst,
        sellerAdminPage: sellerAdminPageEst,
        sellerPage: sellerPageEst,
        dishModal: dishModalEst,
      },
    },

    fallbackLng: "est", // Язык по умолчанию
    defaultNS: "navbar",
    debug: false, // Включить отладку
    interpolation: {
    escapeValue: false, // Не экранировать HTML
    },
  });

export default i18n;
