import React, { useContext } from "react";
import { observer } from "mobx-react-lite";
import { Context } from "../index";
import DeviceItem from "./DeviceItem";
import styles from "./DeviceList.module.css";

const DeviceList = observer(() => {
  const { device } = useContext(Context);

  // Группируем устройства по типам и подтипам
  const groupedDevices = device.types.reduce((acc, type) => {
    acc[type.id] = {
      typeName: type.name,
      subtypes: {},
      noSubtypeDevices: [], // Устройства без подтипа для данного типа
    };

    // Добавляем известные подтипы данного типа
    device.subtypes
      .filter((sub) => sub.typeId === type.id)
      .forEach((sub) => {
        acc[type.id].subtypes[sub.id] = {
          devices: [],
          subtypeName: sub.name, // Заголовок подтипа
        };
      });

    device.devices.forEach((dev) => {
      if (dev.typeId === type.id) {
        if (dev.subtypeId && acc[type.id].subtypes[dev.subtypeId]) {
          // Если устройство имеет валидный подтип
          acc[type.id].subtypes[dev.subtypeId].devices.push(dev);
        } else if (!dev.subtypeId) {
          // Если у устройства нет подтипа
          acc[type.id].noSubtypeDevices.push(dev);
        }
      }
    });

    // Удаляем пустые подтипы
    Object.keys(acc[type.id].subtypes).forEach((subtypeId) => {
      if (
        acc[type.id].subtypes[subtypeId].devices.length === 0 ||
        acc[type.id].subtypes[subtypeId].subtypeName === "Неизвестный подтип"
      ) {
        delete acc[type.id].subtypes[subtypeId];
      }
    });

    return acc;
  }, {});

  // Проверяем, есть ли видимые устройства
  const hasVisibleDevices = Object.values(groupedDevices).some(
    (group) =>
      Object.values(group.subtypes).some((sub) => sub.devices.length > 0) ||
      group.noSubtypeDevices.length > 0
  );

  if (!hasVisibleDevices) {
    return <p className={styles.noDevices}>Нет доступных товаров</p>;
  }

  return (
    <div>
      {Object.keys(groupedDevices).map((typeId) => {
        const typeGroup = groupedDevices[typeId];

        const hasDevices =
          typeGroup.noSubtypeDevices.length > 0 ||
          Object.values(typeGroup.subtypes).some(
            (sub) => sub.devices.length > 0
          );

        if (!hasDevices) {
          return null;
        }

        return (
          <div key={typeId} className={styles.section}>
            <h2 className={styles.sectionTitle}>{typeGroup.typeName}</h2>

            {/* Устройства без подтипов */}
            {typeGroup.noSubtypeDevices.length > 0 && (
              <div className={styles.deviceGrid}>
                {typeGroup.noSubtypeDevices.map((device) => (
                  <DeviceItem key={device.id} device={device} />
                ))}
              </div>
            )}

            {/* Устройства с подтипами */}
            {Object.keys(typeGroup.subtypes).map((subtypeId) => {
              const subtypeGroup = typeGroup.subtypes[subtypeId];

              if (subtypeGroup.devices.length === 0) {
                return null;
              }

              return (
                <div
                  key={subtypeId}
                  id={`subtype-${subtypeId}`}
                  className={styles.subtypeSection}
                >
                  <h3 className={styles.subtypeTitle}>
                    {subtypeGroup.subtypeName}
                  </h3>
                  {subtypeGroup.devices.length === 0 && (
                    <p className={styles.noDevices}>
                      Нет товаров для данного подтипа
                    </p>
                  )}
                  <div className={styles.deviceGrid}>
                    {subtypeGroup.devices.map((device) => (
                      <DeviceItem key={device.id} device={device} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
});

export default DeviceList;
