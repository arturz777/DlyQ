import React from "react";
import styles from "./DeliveryPolicy.module.css";
import { useTranslation } from "react-i18next";

const DeliveryPolicy = () => {
  const { t } = useTranslation("deliveryPolicy");

  return (
    <div className={styles.container}>
      <h1>{t("title")}</h1>
      <p>{t("last_updated")}</p>

      <section>
        <h2>{t("delivery_time.title")}</h2>
        <p>{t("delivery_time.text")}</p>
      </section>

      <section>
        <h2>{t("delivery_methods.title")}</h2>
        <p>{t("delivery_methods.text")}</p>
      </section>

      <section>
        <h2>{t("delivery_cost.title")}</h2>
        <p>{t("delivery_cost.text")}</p>
        <ul>
          {(t("delivery_cost.details", { returnObjects: true }) || []).map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{t("tracking.title")}</h2>
        <p>{t("tracking.text")}</p>
      </section>

      <section>
        <h2>{t("delays.title")}</h2>
        <p>{t("delays.text")}</p>
      </section>

      <section>
        <h2>{t("damaged_items.title")}</h2>
        <p>{t("damaged_items.text")}</p>
      </section>

      <section>
        <h2>{t("contact.title")}</h2>
        <p>{t("contact.text")}</p>
      </section>
    </div>
  );
};

export default DeliveryPolicy;
