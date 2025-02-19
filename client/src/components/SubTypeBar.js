import React, { useContext, useEffect } from "react";
import { observer } from "mobx-react-lite";
import { Context } from "../index";
import styles from "./TypeBar.module.css";
import { fetchSubtypesByType } from "../http/deviceAPI";

const SubTypeBar = observer(() => {
  const { device } = useContext(Context);

  useEffect(() => {
    // Загружаем подтипы, если выбран тип
    if (device.selectedType.id) {
      fetchSubtypesByType(device.selectedType.id).then((data) => {
        device.setSubtypes(data); // Обновляем подтипы в MobX
      });
    } else {
      device.setSubtypes([]); // Очищаем подтипы, если тип не выбран
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
          <span className={styles.typeName}>{subtype.name}</span>
        </div>
      ))}
    </div>
  );
});

export default SubTypeBar;
