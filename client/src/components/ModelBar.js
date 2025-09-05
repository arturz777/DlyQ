import React from "react";
import { observer } from "mobx-react-lite";
import { useContext } from "react";
import { Context } from "../index";
import styles from "./ModelBar.module.css";

const ModelBar = observer(() => {
  const { device } = useContext(Context);
  if (!device.selectedMake?.id) return null;

  const toggleModel = (model) => {
    if (device.selectedModel?.id === model.id) {
      device.setSelectedModel({});
    } else {
      device.setSelectedModel(model);
    }
  };

  return (
    <div className={styles.row}>
      {device.models.map((m) => (
        <button
          key={m.id}
          className={m.id === device.selectedModel?.id ? styles.chipActive : styles.chip}
          onClick={() => toggleModel(m)}
        >
          {m.name}
        </button>
      ))}
    </div>
  );
});

export default ModelBar;
