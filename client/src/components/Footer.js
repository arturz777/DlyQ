import React from "react";
import { Link } from "react-router-dom";
import styles from "./Footer.module.css";

const Footer = () => {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        {/* Логотип и копирайт */}
        <div className={styles.logoSection}>
          <h2>MyCompany</h2>
          <p>© 2024 MyCompany. Все права защищены.</p>
        </div>

        {/* Полезные ссылки */}
        <div className={styles.linksSection}>
        <Link to="/terms-of-service">Пользовательское соглашение</Link>
        <Link to="/privacy-policy">Политика конфиденциальности</Link>
        <Link to="/return-policy">Гарантия и возврат</Link>
        <Link to="/shipping-policy">Доставка</Link>
        <Link to="/cookie-policy">Cookie</Link>
        </div>

        {/* Социальные сети */}
        <div className={styles.socialSection}>
          <a href="https://facebook.com" target="_blank" rel="noreferrer">Facebook</a>
          <a href="https://instagram.com" target="_blank" rel="noreferrer">Instagram</a>
          <a href="https://twitter.com" target="_blank" rel="noreferrer">Twitter</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
