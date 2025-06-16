import React, { useContext } from "react";
import { ChatContext } from "../context/ChatContext";
import { useTranslation } from "react-i18next";
import styles from "./ReturnPolicy.module.css";

const ReturnPolicy = () => {
  const { t } = useTranslation("returnPolicy");
  const { openSupportChat } = useContext(ChatContext);

  const formatWithDot = (text) => (text.trim().endsWith(".") ? text : `${text}.`);

  const renderStep = (step) => {
    const lower = step.toLowerCase();
    if (lower.includes("support@") || lower.includes("контакт") || lower.includes("võtke meiega")) {
      return (
        <>
          {t("how_to_return.contact_text")}{" "}
          <span
            className={styles.chatLink}
            onClick={openSupportChat}
          >
            {t("how_to_return.chat_link")}
          </span>
          .
        </>
      );
    }
    return formatWithDot(step);
  };

  return (
    <div className={styles.container}>
      <h1>{t("title")}</h1>
      <p>{t("last_updated")}</p>

      <section>
        <h2>{t("return_conditions.title")}</h2>
        <ul>
          {t("return_conditions.text").split(". ").map((sentence, i, arr) => (
            <li key={i}>
              {formatWithDot(i === arr.length - 1 ? sentence : sentence + ".")}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{t("how_to_return.title")}</h2>
        <ul>
          {(t("how_to_return.steps", { returnObjects: true }) || []).map((step, index) => (
            <li key={index}>{renderStep(step)}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{t("exceptions.title")}</h2>
        <ul>
          <li>{formatWithDot(t("exceptions.text"))}</li>
          {(t("exceptions.list", { returnObjects: true }) || []).map((item, index) => (
            <li key={index}>{formatWithDot(item)}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{t("refunds.title")}</h2>
        <ul>
          {t("refunds.text").split(". ").map((part, i, arr) => (
            <li key={i}>{formatWithDot(i === arr.length - 1 ? part : part + ".")}</li>
          ))}
          {(t("refunds.details", { returnObjects: true }) || []).map((detail, index) => (
            <li key={`d-${index}`}>{formatWithDot(detail)}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{t("warranty.title")}</h2>
        <ul>
          {t("warranty.text").split(". ").map((sentence, i, arr) => (
            <li key={i}>{formatWithDot(i === arr.length - 1 ? sentence : sentence + ".")}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{t("contact.title")}</h2>
        <ul>
          <li>
            {t("contact.text")}{" "}
            <span className={styles.chatLink} onClick={openSupportChat}>
              {t("how_to_return.chat_link")}
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
};

export default ReturnPolicy;
