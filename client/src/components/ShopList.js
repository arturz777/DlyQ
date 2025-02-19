import React, { useEffect, useState } from "react";
import DeviceItem from "./DeviceItem";
import styles from "./DeviceList.module.css"; // Подключаем стили из DeviceList

const ShopList = ({ devices, types, subtypes }) => {
  const [groupedDevices, setGroupedDevices] = useState({});

  useEffect(() => {
    // Группируем устройства по типам и подтипам
    const grouped = types.reduce((acc, type) => {
      acc[type.id] = {
        typeName: type.name,
        subtypes: {},
        noSubtypeDevices: [], // Устройства без подтипа
      };

      // Добавляем подтипы к типу
      subtypes
        .filter((sub) => sub.typeId === type.id)
        .forEach((sub) => {
          acc[type.id].subtypes[sub.id] = {
            devices: [],
            subtypeName: sub.name,
          };
        });

      // Распределяем устройства
      devices.forEach((device) => {
        if (device.typeId === type.id) {
          if (device.subtypeId && acc[type.id].subtypes[device.subtypeId]) {
            acc[type.id].subtypes[device.subtypeId].devices.push(device);
          } else {
            acc[type.id].noSubtypeDevices.push(device);
          }
        }
      });

      return acc;
    }, {});

    setGroupedDevices(grouped);
  }, [devices, types, subtypes]);

  return (
    <div>
      {Object.keys(groupedDevices).map((typeId) => {
        const typeGroup = groupedDevices[typeId];

        return (
          <div key={typeId} className={styles.section}>
            {/* Заголовок типа */}
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
                <div key={subtypeId} className={styles.subtypeSection}>
                  {/* Заголовок подтипа */}
                  <h3 className={styles.subtypeTitle}>
                    {subtypeGroup.subtypeName}
                  </h3>
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
};

export default ShopList;
