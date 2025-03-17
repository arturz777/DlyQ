import React, { useContext } from "react";
import { observer } from "mobx-react-lite";
import { Context } from "../index";
import { useTranslation } from "react-i18next";
import styles from "./TypeBar.module.css";

const TypeBar = observer(() => {
  const { device } = useContext(Context);
  const { i18n } = useTranslation();
  const currentLang = i18n.language || "en";

  return (
    <div className={styles.typeBar}>
      {device.types.map((type) => (
        <div
          key={type.id}
          id={`type-${type.id}`}
          className={`${styles.typeItem} ${
            type.id === device.selectedType.id ? styles.active : ""
          }`}
          onClick={() => {
            device.setSelectedType(type);
            document.getElementById(`type-${type.id}`).scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }}
        >
          <img src={type.img} alt={type.name} className={styles.typeImage} />
          <span className={styles.typeName}>
            {type.translations?.name?.[currentLang] || type.name}
          </span>
        </div>
      ))}
    </div>
  );
});

export default TypeBar;
