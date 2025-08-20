import React, { useContext } from "react";
import { observer } from "mobx-react-lite";
import { Context } from "../index";
import { useTranslation } from "react-i18next";
import styles from "./SubTypeBar.module.css";

const SubTypeBar = observer(() => {
  const { device } = useContext(Context);
  const { i18n } = useTranslation();
  const currentLang = i18n.language || "en";

  const handleScrollToSubtype = (subtypeId) => {
    const element = document.getElementById(`subtype-${subtypeId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (!device.selectedType.id) return null;

  const filteredSubtypes = device.subtypes
    .filter((subtype) => subtype.typeId === device.selectedType.id)
    .slice()
    .sort((a, b) => {
      const ao = a.displayOrder ?? 0;
      const bo = b.displayOrder ?? 0;
      return ao === bo ? a.id - b.id : ao - bo;
    });

  if (filteredSubtypes.length === 0) return null;

  return (
    <div className={styles.subTypeBar}>
      {filteredSubtypes.map((subtype) => (
        <div
          key={subtype.id}
          className={styles.subTypeItem}
          onClick={() => handleScrollToSubtype(subtype.id)}
        >
          <span className={styles.typeName}>
            {subtype.translations?.name?.[currentLang] || subtype.name}
          </span>
        </div>
      ))}
    </div>
  );
});

export default SubTypeBar;
