import React, { useContext, useEffect } from "react";
import { observer } from "mobx-react-lite";
import { Context } from "../index";
import { useTranslation } from "react-i18next";
import { fetchSubtypesByType } from "../http/deviceAPI";
import styles from "./TypeBar.module.css";

const SubTypeBar = observer(() => {
  const { device } = useContext(Context);
  const { i18n } = useTranslation();
  const currentLang = i18n.language || "en";

  useEffect(() => {
   
    if (device.selectedType.id) {
      fetchSubtypesByType(device.selectedType.id).then((data) => {
        device.setSubtypes(data);
      });
    } else {
      device.setSubtypes([]);
    }
  }, [device.selectedType]);

  const handleScrollToSubtype = (subtypeId) => {
    const element = document.getElementById(`subtype-${subtypeId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (!device.selectedType.id) {
    return null;
  }

  return (
    <div className={styles.typeBar}>
      {device.subtypes.map((subtype) => (
        <div
          key={subtype.id}
          className={`${styles.typeItem}`}
          onClick={() => handleScrollToSubtype(subtype.id)}
        >
          <span className={styles.typeName}>{subtype.translations?.name?.[currentLang] || subtype.name}</span>
        </div>
      ))}
    </div>
  );
});

export default SubTypeBar;
