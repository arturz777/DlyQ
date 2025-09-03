import React from "react";
import { observer } from "mobx-react-lite";
import { useContext } from "react";
import { Context } from "../index";
import styles from "./MakeBar.module.css";

const MakeBar = observer(() => {
  const { device } = useContext(Context);

  const toggleMake = (make) => {
    if (device.selectedMake?.id === make.id) {
      device.setSelectedMake({});
      device.setSelectedModel({});
    } else {
      device.setSelectedMake(make);
      device.setSelectedModel({});
    }
  };

  return (
    <div className={styles.row}>
      {device.makes.map((m) => (
        <button
          key={m.id}
          className={
            m.id === device.selectedMake?.id ? styles.chipActive : styles.chip
          }
          onClick={() => toggleMake(m)}
        >
          {m.name}
        </button>
      ))}
    </div>
  );
});

export default MakeBar;
