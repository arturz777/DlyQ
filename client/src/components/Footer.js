import React from "react";
import { Link } from "react-router-dom";
import styles from "./Footer.module.css";
import { useTranslation } from "react-i18next";

const Footer = () => {
  const { t, i18n } = useTranslation();

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        {/* Логотип и копирайт */}
        <div className={styles.logoSection}>
          <h2>Zang</h2>
          <p>© 2024 Zang. {t("all rights reserved", { ns: "footer" })}</p>
        </div>

        {/* Полезные ссылки */}
        <div className={styles.linksSection}>
          <Link to="/terms-of-service">
            {t("user Agreement", { ns: "footer" })}
          </Link>
          <Link to="/privacy-policy">
            {t("privacy Policy", { ns: "footer" })}
          </Link>
          <Link to="/return-policy">
            {t("warranty and Returns", { ns: "footer" })}
          </Link>
          <Link to="/shipping-policy">{t("delivery", { ns: "footer" })}</Link>
          <Link to="/cookie-policy">Cookie</Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
