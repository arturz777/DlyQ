import React from "react";
import styles from "./CookiePolicy.module.css";
import { useTranslation } from "react-i18next";
import { useContext } from "react";
import { ChatContext } from "../context/ChatContext";

const CookiePolicy = () => {
  const { t } = useTranslation("cookiePolicy");
  const { openSupportChat } = useContext(ChatContext);

  return (
    <div className={styles.container}>
      <h1>{t("title")}</h1>
      <p>{t("last_updated")}</p>

      <section>
        <h2>{t("what_are_cookies.title")}</h2>
        <ul>
          {(t("what_are_cookies.text", { returnObjects: true }) || []).map(
            (item, i) => (
              <li key={i}>{item}.</li>
            )
          )}
        </ul>
      </section>

      <section>
        <h2>{t("types_of_cookies.title")}</h2>
        <p>{t("types_of_cookies.text")}</p>
        <ul>
          {t("types_of_cookies.list", { returnObjects: true }).map(
            (item, index) => (
              <li key={index}>{item}</li>
            )
          )}
        </ul>
      </section>

      <section>
        <h2>{t("disable_cookies.title")}</h2>
        <ul>
          {t("disable_cookies.text", { returnObjects: true }).map(
            (item, index) => (
              <li key={index}>{item}</li>
            )
          )}
        </ul>
      </section>

      <section>
        <h2>{t("data_access.title")}</h2>
        <ul>
          {t("data_access.text", { returnObjects: true }).map((item, index) => (
            <li key={index}>{item}</li>
          ))}
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

export default CookiePolicy;
