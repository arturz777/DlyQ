import React from "react";
import styles from "./PrivacyPolicy.module.css";
import { useTranslation } from "react-i18next";
import { useContext } from "react";
import { ChatContext } from "../context/ChatContext";

const PrivacyPolicy = () => {
  const { t } = useTranslation("privacyPolicy");
    const { openSupportChat } = useContext(ChatContext);

  return (
    <div className={styles.container}>
      <h1>{t("title")}</h1>
      <p>{t("last_updated")}</p>

      <section>
        <h2>{t("introduction.title")}</h2>
        <ul>
          {(t("introduction.text", { returnObjects: true }) || []).map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{t("data_collection.title")}</h2>
        <ul>{t("data_collection.text")}</ul>
        <ul>
          {(t("data_collection.list", { returnObjects: true }) || []).map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{t("data_usage.title")}</h2>
        <ul>{t("data_usage.text")}</ul>
        <ul>
          {(t("data_usage.list", { returnObjects: true }) || []).map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{t("third_parties.title")}</h2>
        <ul>{t("third_parties.text")}</ul>
        <ul>
          {(t("third_parties.list", { returnObjects: true }) || []).map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{t("security.title")}</h2>
         <ul>
          {(t("security.text", { returnObjects: true }) || []).map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{t("user_rights.title")}</h2>
        <ul>{t("user_rights.text")}</ul>
        <ul>
          {(t("user_rights.list", { returnObjects: true }) || []).map((item, index) => (
            <li key={index}>{item}</li>
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

export default PrivacyPolicy;
