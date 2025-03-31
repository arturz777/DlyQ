import React from "react";
import styles from "./DeliveryPolicy.module.css"; // можешь сделать CourierPolicy.module.css при желании
import { useTranslation } from "react-i18next";

const CourierPolicy = () => {
  const { t } = useTranslation("courierPolicy");

  return (
    <div className={styles.container}>
      <section>
        <h2>{t("couriers.title")}</h2>
        <p>{t("couriers.text")}</p>
      </section>

      <section>
        <h2>{t("contactless.title")}</h2>
        <p>{t("contactless.text")}</p>
      </section>

      <section>
        <h2>{t("disputes.title")}</h2>
        <p>{t("disputes.text")}</p>
      </section>

      <section>
        <h2>{t("platform.title")}</h2>
        <p>{t("platform.text")}</p>
      </section>
    </div>
  );
};

export default CourierPolicy;
