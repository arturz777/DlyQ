import React, { useContext } from "react";
import { observer } from "mobx-react-lite";
import { Context } from "../index";
import { useTranslation } from "react-i18next";
import styles from "./TypeBar.module.css";

const TypeBar = observer(() => {
  const { device } = useContext(Context);
  const { i18n } = useTranslation();
  const currentLang = i18n.language || "en";

  const scrollToTarget = (targetId) => {
    const el = document.getElementById(targetId);
    if (!el) return;

    const fixed = document.querySelector(".mobileStickyFilter");
    const offset = fixed ? fixed.offsetHeight + 10 : 10;
    const y = el.getBoundingClientRect().top + window.scrollY - offset;

    window.scrollTo({
      top: y,
      behavior: "smooth",
    });

    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("catalog:reached-subtype"));
    }, 120);
  };

  return (
    <div className={styles.typeBar}>
      {device.types.map((type) => (
        <div
          key={type.id}
          id={`type-${type.id}`}
          className={`${styles.typeItem} ${
            Number(type.id) === Number(device.selectedType?.id)
              ? styles.active
              : ""
          }`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) =>
            (e.key === "Enter" || e.key === " ") && e.currentTarget.click()
          }
          onClick={() => {
            const isSame = Number(device.selectedType?.id) === Number(type.id);
            device.clearSelectedSubType?.();

            if (isSame) {
              device.setSelectedType({});
              return;
            }

            device.setSelectedType(type);

            setTimeout(() => {
              const label =
                type.translations?.name?.[currentLang] || type.name || "";
              const isAuto = /авто/i.test(label) || /auto/i.test(label);
              const targetId = isAuto ? "make-filter" : "subtype-filter";

              scrollToTarget(targetId);
            }, 50);
          }}
        >
          <div className={styles.typeImageWrap}>
            <img
              src={type.img}
              alt=""
              className={styles.typeImage}
              loading="lazy"
              decoding="async"
            />
          </div>
          <span className={styles.typeName}>
            {type.translations?.name?.[currentLang] || type.name}
          </span>
        </div>
      ))}
    </div>
  );
});

export default TypeBar;
