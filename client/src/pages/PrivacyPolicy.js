import React from "react";
import styles from "./PrivacyPolicy.module.css";
import { useTranslation } from "react-i18next";

const PrivacyPolicy = () => {
  const { t } = useTranslation("privacyPolicy");

  return (
    <div className={styles.container}>
      <h1>{t("title")}</h1>
      <p>{t("last_updated")}</p>

      <section>
        <h2>{t("introduction.title")}</h2>
        <p>{t("introduction.text")}</p>
      </section>

      <section>
        <h2>{t("data_collection.title")}</h2>
        <p>{t("data_collection.text")}</p>
        <ul>
          {(t("data_collection.list", { returnObjects: true }) || []).map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{t("data_usage.title")}</h2>
        <p>{t("data_usage.text")}</p>
        <ul>
          {(t("data_usage.list", { returnObjects: true }) || []).map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{t("third_parties.title")}</h2>
        <p>{t("third_parties.text")}</p>
        <ul>
          {(t("third_parties.list", { returnObjects: true }) || []).map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{t("security.title")}</h2>
        <p>{t("security.text")}</p>
      </section>

      <section>
        <h2>{t("user_rights.title")}</h2>
        <p>{t("user_rights.text")}</p>
        <ul>
          {(t("user_rights.list", { returnObjects: true }) || []).map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{t("contact.title")}</h2>
        <p>{t("contact.text")}</p>
      </section>
    </div>
  );
};

export default PrivacyPolicy;
