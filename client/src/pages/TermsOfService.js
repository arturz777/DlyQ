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
        <p>{t("general.text")}</p>
      </section>

      <section>
        <h2>{t("account.title")}</h2>
        <p>{t("account.text")}</p>
      </section>

      <section>
        <h2>{t("orders.title")}</h2>
        <p>{t("orders.text")}</p>
      </section>

      <section>
        <h2>{t("payment.title")}</h2>
        <p>{t("payment.text")}</p>
      </section>

      <section>
        <h2>{t("liability.title")}</h2>
        <p>{t("liability.text")}</p>
      </section>

      <section>
        <h2>{t("changes.title")}</h2>
        <p>{t("changes.text")}</p>
      </section>

       <section>
        <h2>{t("contact.title")}</h2>
        <p>
          {t("contact.text")}{" "}
          <span
            style={{
              color: "blue",
              textDecoration: "underline",
              cursor: "pointer",
            }}
            onClick={openSupportChat}
          >
            {t("contact.open_chat")}
          </span>
          .
        </p>
      </section>
    </div>
  );
};

export default TermsOfService;
