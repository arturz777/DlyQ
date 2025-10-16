import React from "react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import styles from "./Maintenance.module.css";

function Maintenance() {
   const { t} = useTranslation();

  const title = t("website is temporarily unavailable", { ns: "maintenance" });
  const subtitle = t("we're doing some planned maintenance", { ns: "maintenance" });
  const message = t("please try again later", { ns: "maintenance" });
  const tryAgain = t("reload page", { ns: "maintenance" });

  return (
    <div className={styles.page}>
      <div className={styles.card} role="status" aria-live="polite">
        <div className={styles.iconWrap} aria-hidden="true">
          <svg viewBox="0 0 24 24" className={styles.icon}>
            <path
              fill="currentColor"
              d="M22.7 19.3l-6.4-6.4a7.5 7.5 0 01-9.6-9.6l3.3 3.3 2.1-.6.6-2.1L9.4 0A7.5 7.5 0 0119 9.3l6.4 6.4a2 2 0 010 2.8l-1.3 1.3a2 2 0 01-2.8 0zM7 22a3 3 0 110-6 3 3 0 010 6z"
            />
          </svg>
        </div>

        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{subtitle}</p>
        <p className={styles.message}>{message}</p>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => window.location.reload()}
          >
            {tryAgain}
          </button>
        </div>
      </div>
    </div>
  );
}

export default observer(Maintenance);
