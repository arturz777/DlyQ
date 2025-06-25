import React, { useContext, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { LOGIN_ROUTE, REGISTRATION_ROUTE, SHOP_ROUTE } from "../utils/consts";
import { login, registration } from "../http/userAPI";
import { observer } from "mobx-react-lite";
import { Context } from "../index";
import axios from "axios";
import { useTranslation } from "react-i18next";
import ruFlag from "../assets/flags/ru.png";
import enFlag from "../assets/flags/en.png";
import estFlag from "../assets/flags/est.png";
import styles from "./Auth.module.css";

const flags = {
  ru: ruFlag,
  en: enFlag,
  est: estFlag,
};

const Auth = observer(() => {
  const { user } = useContext(Context);
  const location = useLocation();
  const navigate = useNavigate();
  const isLogin = location.pathname === LOGIN_ROUTE;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [agreed, setAgreed] = useState(false);
  const { t, i18n } = useTranslation();
   const currentLang = i18n.language;
    const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);

   const languages = [
    { code: "GB", language: "en" },
    { code: "RU", language: "ru" },
    { code: "EE", language: "est" },
  ];

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    setIsLanguageMenuOpen(false);
  };

   const currentLanguage = i18n.language;
  const currentFlag = languages.find(
    (lang) => lang.language === currentLanguage
  );

  const click = async () => {
    try {
      let data;
      if (isLogin) {
        data = await login(email, password);
      } else {
        data = await registration(email, password, firstName, lastName, phone);
      }
      user.setUser(data);
      user.setIsAuth(true);
      navigate(SHOP_ROUTE);
    } catch (e) {
      alert(e.response.data.message);
    }
  };

  return (
    <div className={styles.authWrapper}>
      <div className={styles.authContainer}>

                      <div
              className={styles.languageSelectorWrapper}
              onMouseLeave={() => setIsLanguageMenuOpen(false)}
            >
              <button
                onClick={() => setIsLanguageMenuOpen(!isLanguageMenuOpen)}
                className={styles.currentLanguageButton}
              >
               <img
                 src={flags[currentFlag?.language] || flags["en"]}
                 alt={currentFlag?.language}
                 className={styles.flag}
               />
              </button>
              {isLanguageMenuOpen && (
                <div className={styles.dropdownMenu}>
                  {languages.map((lang) => (
                    <button
                      key={lang.language}
                      onClick={() => changeLanguage(lang.language)}
                      className={styles.dropdownItem}
                    >
                      <img
                        src={require(`../assets/flags/${lang.language}.png`)}
                        alt={lang.language}
                        className={styles.flag}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
                      
        <h2 className={styles.authTitle}>
          {isLogin
            ? t("authorization", { ns: "auth" })
            : t("registration", { ns: "auth" })}
        </h2>
        <form className={styles.authForm}>
          <input
            className={styles.inputField}
            placeholder={t("enter your email", { ns: "auth" })}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className={styles.inputField}
            placeholder={t("enter your password", { ns: "auth" })}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
          />
          {!isLogin && (
            <>
              <input
                className={styles.inputField}
                placeholder={t("enter your first name", { ns: "auth" })}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
              <input
                className={styles.inputField}
                placeholder={t("enter your last name", { ns: "auth" })}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
              <input
                className={styles.inputField}
                placeholder={t("enter your phone", { ns: "auth" })}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </>
          )}
          <div className={styles.authSwitch}>
            {isLogin ? (
              <span>
                {t("no account", { ns: "auth" })}{" "}
                <NavLink to={REGISTRATION_ROUTE}>
                  {t("register", { ns: "auth" })}
                </NavLink>
              </span>
            ) : (
              <span>
                {t("already have an account", { ns: "auth" })}{" "}
                <NavLink to={LOGIN_ROUTE}>{t("login", { ns: "auth" })}</NavLink>
              </span>
            )}
          </div>

          {!isLogin && (
            <div className={styles.checkboxContainer}>
              <input
                type="checkbox"
                id="policyCheckbox"
                checked={agreed}
                onChange={() => setAgreed(!agreed)}
              />
              <label htmlFor="policyCheckbox">
                <span>
                  {t("agree to terms", { ns: "auth" })}{" "}
                  <a href="/terms-of-purchase" target="_blank">
                    {t("terms of purchase", { ns: "auth" })}
                  </a>
                  <a href="/privacy-policy" target="_blank">
                    {t("privacy policy", { ns: "auth" })}
                  </a>{" "}
                  <a href="/site-rules" target="_blank">
                    {t("site rules", { ns: "auth" })}
                  </a>
                </span>
              </label>
            </div>
          )}
          <button
            type="button"
            className={styles.authButton}
            onClick={click}
            disabled={!agreed && !isLogin}
          >
            {isLogin
              ? t("login", { ns: "auth" })
              : t("register", { ns: "auth" })}
          </button>
        </form>
                       {isLogin && (
          <div className={styles.googleLoginWrapper}>
            <GoogleLogin
              onSuccess={async (credentialResponse) => {
                try {
                  const { credential } = credentialResponse;
                  const userData = await googleLogin(credential);
                  user.setUser(userData);
                  user.setIsAuth(true);
                  navigate(SHOP_ROUTE);
                } catch (e) {
                  console.error(e);
                  alert("Ошибка при входе через Google");
                }
              }}
              onError={() => {
                alert("Не удалось войти через Google");
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
});

export default Auth;
