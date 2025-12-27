import React, { useContext, useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { LOGIN_ROUTE, REGISTRATION_ROUTE, SHOP_ROUTE } from "../utils/consts";
import { login, registration, googleLogin } from "../http/userAPI";
import { observer } from "mobx-react-lite";
import { Context } from "../index";
import { useTranslation } from "react-i18next";
import LoadingButton from "../components/LoadingButton";
import styles from "./Auth.module.css";

const Auth = observer(() => {
  const { user } = useContext(Context);
  const location = useLocation();
  const navigate = useNavigate();
  const isLogin = location.pathname === LOGIN_ROUTE;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const { t, i18n } = useTranslation();

  const languages = [
    { code: "ET", language: "est" },
    { code: "EN", language: "en" },
    { code: "RU", language: "ru" },
  ];

  const isEmailValid = (v) => /\S+@\S+\.\S+/.test(String(v || "").trim());

  const validate = () => {
    const e = {};

    if (!email.trim()) e.email = t("email_required", { ns: "auth" });
    else if (!isEmailValid(email)) e.email = t("email_invalid", { ns: "auth" });

    if (!password.trim()) e.password = t("password_required", { ns: "auth" });
    else if (password.trim().length < 6)
      e.password = t("password_min", { ns: "auth", min: 6 });

    if (!isLogin) {
      if (!confirmPassword.trim())
        e.confirmPassword = t("confirm_password_required", { ns: "auth" });
      else if (confirmPassword !== password)
        e.confirmPassword = t("passwords_not_match", { ns: "auth" });

      if (!firstName.trim())
        e.firstName = t("first_name_required", { ns: "auth" });

      if (!phone.trim()) e.phone = t("phone_required", { ns: "auth" });

      if (!agreed) e.agreed = t("agree_required", { ns: "auth" });
    }

    return e;
  };

  useEffect(() => {
    setPassword("");
    setConfirmPassword("");
  }, [isLogin]);

  const click = async () => {
    setSubmitted(true);
    const e = validate();
    setFieldErrors(e);
    if (Object.keys(e).length) return;

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
        <div className={styles.authHeader}>
          <div
            className={styles.langRow}
            aria-label={t("language", { ns: "navbar" })}
          >
            {languages.map((lang) => (
              <button
                key={lang.language}
                type="button"
                className={`${styles.langPill} ${
                  i18n.language === lang.language ? styles.langPillActive : ""
                }`}
                onClick={() => i18n.changeLanguage(lang.language)}
              >
                {lang.code}
              </button>
            ))}
          </div>
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
          {submitted && fieldErrors.email && (
            <div className={styles.fieldError}>{fieldErrors.email}</div>
          )}
          <input
            className={styles.inputField}
            placeholder={t("enter your password", { ns: "auth" })}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
          />
          {submitted && fieldErrors.confirmPassword && (
            <div className={styles.fieldError}>
              {fieldErrors.confirmPassword}
            </div>
          )}

          {!isLogin && (
            <>
              <input
                className={styles.inputField}
                placeholder={t("confirm your password", { ns: "auth" })}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type="password"
              />
              {submitted && fieldErrors.confirmPassword && (
                <div className={styles.fieldError}>
                  {fieldErrors.confirmPassword}
                </div>
              )}
              <input
                className={styles.inputField}
                placeholder={t("enter your first name", { ns: "auth" })}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
              {submitted && fieldErrors.firstName && (
                <div className={styles.fieldError}>{fieldErrors.firstName}</div>
              )}
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
              {submitted && fieldErrors.phone && (
                <div className={styles.fieldError}>{fieldErrors.phone}</div>
              )}
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
              {submitted && fieldErrors.agreed && (
                <div className={styles.fieldError}>{fieldErrors.agreed}</div>
              )}
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
          <LoadingButton
            className={styles.authButton}
            onClick={click}
            loading={loading}
            loadingText={t("processing", { ns: "auth" })}
            disabled={!isLogin && !agreed}
            minWidth={0}
            style={{ width: "100%" }}
          >
            {isLogin
              ? t("login", { ns: "auth" })
              : t("register", { ns: "auth" })}
          </LoadingButton>
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
                  alert(
                    t("an error occurred while signing in with Google", {
                      ns: "auth",
                    })
                  );
                }
              }}
              onError={() => {
                alert(t("failed to sign in with Google", { ns: "auth" }));
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
});

export default Auth;
