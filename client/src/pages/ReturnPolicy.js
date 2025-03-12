import React from "react";
import styles from "./ReturnPolicy.module.css";
import { useTranslation } from "react-i18next";

const ReturnPolicy = () => {
  const { t } = useTranslation("returnPolicy");

  return (
    <div className={styles.container}>
      <h1>{t("title")}</h1>
      <p>{t("last_updated")}</p>

      <section>
        <h2>{t("return_conditions.title")}</h2>
        <p>{t("return_conditions.text")}</p>
      </section>

      <section>
        <h2>{t("how_to_return.title")}</h2>
        <ul>
          {(t("how_to_return.steps", { returnObjects: true }) || []).map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{t("exceptions.title")}</h2>
        <p>{t("exceptions.text")}</p>
        <ul>
          {(t("exceptions.list", { returnObjects: true }) || []).map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{t("refunds.title")}</h2>
        <p>{t("refunds.text")}</p>
        <ul>
          {(t("refunds.details", { returnObjects: true }) || []).map((detail, index) => (
            <li key={index}>{detail}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{t("warranty.title")}</h2>
        <p>{t("warranty.text")}</p>
      </section>

      <section>
        <h2>{t("contact.title")}</h2>
        <p>{t("contact.text")}</p>
      </section>
    </div>
  );
};

export default ReturnPolicy;

