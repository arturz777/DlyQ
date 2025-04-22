import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import styles from "./CookieConsent.module.css";

const CookieConsent = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const { t, i18n } = useTranslation();


  // useEffect(() => {
	// localStorage.removeItem("cookieConsent"); // удалить весь юзер после тестировании
	// setIsVisible(true); 
  // }, []);

  useEffect(() => {
    const consent = localStorage.getItem("cookieConsent");
    if (!consent) {  // вернуть этот код после тестировании
      setIsVisible(true);
    }
  }, []);

  const handleAcceptAll = () => {
    localStorage.setItem("cookieConsent", "accepted");
    localStorage.setItem("analyticsCookies", "true");
    localStorage.setItem("marketingCookies", "true");
    setIsVisible(false);
  };

  const handleNecessaryOnly = () => {
    localStorage.setItem("cookieConsent", "necessary");
    localStorage.setItem("analyticsCookies", "false");
    localStorage.setItem("marketingCookies", "false");
    setIsVisible(false);
  };

  const handleSaveSettings = () => {
    localStorage.setItem("cookieConsent", "custom");
    localStorage.setItem("analyticsCookies", analytics);
    localStorage.setItem("marketingCookies", marketing);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className={styles.cookieBanner}>
      {!showSettings ? (
        <div className={styles.cookieContent}>
          <p>
          {t("cookies_info", { ns: "cookieConsent" })}
            <a href="/cookie-policy"> {t("cookies_policy", { ns: "cookieConsent" })}</a>.
          </p>
          <div className={styles.buttons}>
            <button onClick={handleAcceptAll} className={styles.accept}>{t("Accept all", { ns: "cookieConsent" })}</button>
            <button onClick={() => setShowSettings(true)} className={styles.settings}>{t("customize", { ns: "cookieConsent" })}</button>
            <button onClick={handleNecessaryOnly} className={styles.reject}>{t("only_necessary", { ns: "cookieConsent" })}</button>
          </div>
        </div>
      ) : (
        <div className={styles.cookieContent}>
          <h2>{t("cookies_settings", { ns: "cookieConsent" })}</h2>
          <label>
            <input
              type="checkbox"
              checked={analytics}
              onChange={() => setAnalytics(!analytics)}
            /> {t("allow_analytics_cookies", { ns: "cookieConsent" })}
          </label>
          <label>
            <input
              type="checkbox"
              checked={marketing}
              onChange={() => setMarketing(!marketing)}
            /> {t("allow_marketing_cookies", { ns: "cookieConsent" })}
          </label>
          <div className={styles.buttons}>
            <button onClick={handleSaveSettings} className={styles.accept}>{t("save_settings", { ns: "cookieConsent" })}</button>
            <button onClick={() => setShowSettings(false)} className={styles.settings}>{t("back", { ns: "cookieConsent" })}</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CookieConsent;
