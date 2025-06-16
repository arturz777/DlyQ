import React from "react";
import styles from "./TermsOfService.module.css";
import { useTranslation } from "react-i18next";
import { useContext } from "react";
import { ChatContext } from "../context/ChatContext";

const TermsOfService = () => {
  const { t } = useTranslation("termsOfService");
  const { openSupportChat } = useContext(ChatContext);

  return (
    <div className={styles.container}>
      <h1>{t("title")}</h1>
      <p>{t("last_updated")}</p>

      <section>
        <h2>{t("general.title")}</h2>
        <ul>
          {(t("general.text", { returnObjects: true }) || []).map((item, i) => (
            <li key={i}>{item}.</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{t("account.title")}</h2>
        <ul>
          {(t("account.text", { returnObjects: true }) || []).map((item, i) => (
            <li key={i}>{item}.</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{t("orders.title")}</h2>
        <ul>
          {(t("orders.text", { returnObjects: true }) || []).map((item, i) => (
            <li key={i}>{item}.</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{t("payment.title")}</h2>
        <ul>
          {(t("payment.text", { returnObjects: true }) || []).map((item, i) => (
            <li key={i}>{item}.</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{t("liability.title")}</h2>
        <ul>
          {(t("liability.text", { returnObjects: true }) || []).map((item, i) => (
            <li key={i}>{item}.</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{t("changes.title")}</h2>
        <ul>
          {(t("changes.text", { returnObjects: true }) || []).map((item, i) => (
            <li key={i}>{item}.</li>
          ))}
        </ul>
      </section>

<section>
  <h2>{t("contact.title")}</h2>
  <ul>
    <li>
      {t("contact.text") }{" "}
      <span className={styles.chatLink} onClick={openSupportChat}>
        {t("contact.open_chat")}
      </span>
    </li>
  </ul>
</section>

    </div>
  );
};

export default TermsOfService;
