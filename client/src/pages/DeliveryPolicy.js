import React from "react";
import styles from "./DeliveryPolicy.module.css";
import { useTranslation } from "react-i18next";
import { useContext } from "react";
import { ChatContext } from "../context/ChatContext";

const DeliveryPolicy = () => {
  const { t } = useTranslation("deliveryPolicy");
  const { openSupportChat } = useContext(ChatContext);

  return (
    <div className={styles.container}>
      <h1>{t("title")}</h1>
      <p>{t("last_updated")}</p>

      <section>
        <h2>{t("delivery_time.title")}</h2>
        <ul>
          {(t("delivery_time.text", { returnObjects: true }) || []).map(
            (item, i) => (
              <li key={i}>{item}.</li>
            )
          )}
        </ul>
      </section>

      <section>
        <h2>{t("delivery_methods.title")}</h2>
        <ul>
          {(t("delivery_methods.text", { returnObjects: true }) || []).map(
            (item, i) => (
              <li key={i}>{item}.</li>
            )
          )}
        </ul>
      </section>

      <section>
        <h2>{t("delivery_cost.title")}</h2>
        <ul>{t("delivery_cost.text")}</ul>
        <ul>
          {(t("delivery_cost.details", { returnObjects: true }) || []).map(
            (item, index) => (
              <li key={index}>{item}</li>
            )
          )}
        </ul>
      </section>

      <section>
        <h2>{t("tracking.title")}</h2>
        <ul>
          {(t("tracking.text", { returnObjects: true }) || []).map(
            (item, index) => (
              <li key={index}>{item}</li>
            )
          )}
        </ul>
      </section>

      <section>
        <h2>{t("delays.title")}</h2>
        <ul>
          <li>
            {t("delays.text")}{" "}
            <span className={styles.chatLink} onClick={openSupportChat}>
              {t("contact.open_chat")}
            </span>
          </li>
        </ul>
      </section>

      <section>
        <h2>{t("damaged_items.title")}</h2>
        <ul>
          {(t("damaged_items.text", { returnObjects: true }) || []).map(
            (item, index) => (
              <li key={index}>{item}</li>
            )
          )}
        </ul>
      </section>

      <section>
        <h2>{t("contact.title")}</h2>
        <ul>
          <li>
            {t("contact.text")}{" "}
            <span className={styles.chatLink} onClick={openSupportChat}>
              {t("contact.open_chat")}
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
};

export default DeliveryPolicy;
