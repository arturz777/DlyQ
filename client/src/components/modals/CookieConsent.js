import React, { useState, useEffect } from "react";
import styles from "./CookieConsent.module.css";

const CookieConsent = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);


  useEffect(() => {
	localStorage.removeItem("cookieConsent"); // удалить весь юзер после тестировании
	setIsVisible(true); 
  }, []);

//   useEffect(() => {
//     const consent = localStorage.getItem("cookieConsent");
//     if (!consent) {  вернуть этот код после тестировании
//       setIsVisible(true);
//     }
//   }, []);

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
            Мы используем cookies для улучшения работы сайта. Подробнее в 
            <a href="/cookie-policy"> Политике использования cookies</a>.
          </p>
          <div className={styles.buttons}>
            <button onClick={handleAcceptAll} className={styles.accept}>Принять все</button>
            <button onClick={() => setShowSettings(true)} className={styles.settings}>Настроить</button>
            <button onClick={handleNecessaryOnly} className={styles.reject}>Оставить только необходимые</button>
          </div>
        </div>
      ) : (
        <div className={styles.cookieContent}>
          <h2>Настройки cookies</h2>
          <label>
            <input
              type="checkbox"
              checked={analytics}
              onChange={() => setAnalytics(!analytics)}
            /> Разрешить аналитические cookies
          </label>
          <label>
            <input
              type="checkbox"
              checked={marketing}
              onChange={() => setMarketing(!marketing)}
            /> Разрешить маркетинговые cookies
          </label>
          <div className={styles.buttons}>
            <button onClick={handleSaveSettings} className={styles.accept}>Сохранить настройки</button>
            <button onClick={() => setShowSettings(false)} className={styles.settings}>Назад</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CookieConsent;
