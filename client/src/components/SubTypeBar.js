import React, { useContext, useMemo } from "react";
import { observer } from "mobx-react-lite";
import { Context } from "../index";
import { useTranslation } from "react-i18next";
import styles from "./SubTypeBar.module.css";

const SubTypeBar = observer(() => {
  const { device } = useContext(Context);
  const { i18n } = useTranslation();
  const currentLang = i18n.language || "en";

  const sorter = (a, b) => {
    const ao = a.displayOrder ?? 0;
    const bo = b.displayOrder ?? 0;
    return ao === bo ? a.id - b.id : ao - bo;
  };

  const list = useMemo(() => {
    const facets = device.facets?.subtypes || [];
    if (facets.length) {
      const dict = new Map(device.subtypes.map((s) => [s.id, s]));
      return facets
        .map((f) => {
          const base = dict.get(f.id);
          return base
            ? { ...base, count: f.count }
            : { id: f.id, name: f.name, displayOrder: 0, count: f.count };
        })
        .sort(sorter);
    }
    return device.subtypes
      .filter((s) => s.typeId === device.selectedType?.id)
      .slice()
      .sort(sorter);
  }, [device.facets?.subtypes, device.subtypes, device.selectedType?.id]);

  if (!list.length) return null;

  const activeId = device.selectedSubType?.id;

  const handleSelect = (subtype) => {
    device.setSelectedSubType(subtype);
  };

  return (
    <div className={styles.subTypeBar}>
      {list.map((subtype) => (
        <div
          id={`subtype-${subtype.id}`}
          key={subtype.id}
          className={`${styles.subTypeItem} ${
            activeId === subtype.id ? styles.active : ""
          }`}
          role="button"
          tabIndex={0}
          onClick={() => handleSelect(subtype)}
          onKeyDown={(e) => e.key === "Enter" && handleSelect(subtype)}
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
