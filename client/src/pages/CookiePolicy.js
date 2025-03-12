import React from "react";
import styles from "./CookiePolicy.module.css";
import { useTranslation } from "react-i18next";

const CookiePolicy = () => {
  const { t } = useTranslation("cookiePolicy"); 

  return (
    <div className={styles.container}>
      <h1>{t("title")}</h1>
      <p>{t("last_updated")}</p>

      <section>
        <h2>{t("sections.what_are_cookies.title")}</h2>
        <p>{t("sections.what_are_cookies.text")}</p>
      </section>

      <section>
        <h2>{t("sections.types_of_cookies.title")}</h2>
        <p>{t("sections.types_of_cookies.text")}</p>
        <ul>
          {t("sections.types_of_cookies.list", { returnObjects: true }).map(
            (item, index) => (
              <li key={index}>{item}</li>
            )
          )}
        </ul>
      </section>

      <section>
        <h2>{t("sections.disable_cookies.title")}</h2>
        <p>{t("sections.disable_cookies.text")}</p>
      </section>

      <section>
        <h2>{t("sections.data_access.title")}</h2>
        <p>{t("sections.data_access.text")}</p>
      </section>

      <section>
        <h2>{t("sections.contacts.title")}</h2>
        <p>{t("sections.contacts.text")}</p>
      </section>
    </div>
  );
};

export default CookiePolicy;
