import React, { useContext } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChatContext } from "../context/ChatContext";
import styles from "./Footer.module.css";

const Footer = () => {
  const { openSupportChat } = useContext(ChatContext);
  const { t } = useTranslation();

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.logoSection}>
          <h2>DlyQ</h2>
          <p>© 2024 DlyQ. {t("all rights reserved", { ns: "footer" })}</p>
        </div>

        <nav className={styles.linksSection} aria-label={t("footer links", { ns: "footer", defaultValue: "Footer links" })}>
          <Link to="/terms-of-service">{t("user Agreement", { ns: "footer" })}</Link>
          <Link to="/privacy-policy">{t("privacy Policy", { ns: "footer" })}</Link>
          <Link to="/return-policy">{t("warranty and Returns", { ns: "footer" })}</Link>
          <Link to="/courier-policy">{t("about Couriers", { ns: "footer" })}</Link>
          <Link to="/shipping-policy">{t("delivery", { ns: "footer" })}</Link>
          <Link to="/cookie-policy">Cookie</Link>
        </nav>

        <div className={styles.chatCta} role="region" aria-labelledby="support-chat-heading">
          <div className={styles.chatText}>
            <span className={styles.dotOnline} aria-hidden="true"></span>
            <strong>{t("need help", { ns: "footer"})}</strong>
            <span className={styles.chatSub}>
            </span>
          </div>

          <button
            type="button"
            className={styles.chatLinkButton}
            onClick={openSupportChat}
          >
            <svg className={styles.chatIcon} viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M4 5a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H9l-4 4v-4H7a3 3 0 0 1-3-3V5z" fill="currentColor"/>
            </svg>
            {t("support chat", { ns: "footer"})}
          </button>
        </div>
          <div className={styles.bottomLine}>
          <small className={styles.muted}>
            DlyQ OÜ • Registrikood 17268052 • KMKR EE102873957 •{" "}
            <a className={styles.link} href="mailto:info@dlyq.ee">
              info@dlyq.ee
            </a>
          </small>
        </div>                                
      </div>
    </footer>
  );
};

export default Footer;
