import React, { useContext, useMemo } from "react";
import { observer } from "mobx-react-lite";
import { Context } from "../index";
import DeviceItem from "./DeviceItem";
import { useTranslation } from "react-i18next";
import styles from "./DeviceList.module.css";

const DeviceList = observer(({ onDeviceClick }) => {
  const { device } = useContext(Context);
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language || "en";

  const groupedDevices = useMemo(() => {
    const result = {};

    device.types.forEach((type) => {
      const typeName = type.translations?.name?.[currentLang] || type.name;
      result[type.id] = {
        typeName,
        subtypes: {},
        noSubtypeDevices: [],
      };

      device.subtypes
        .filter((sub) => sub.typeId === type.id)
        .forEach((sub) => {
          const subtypeName = sub.translations?.name?.[currentLang] || sub.name;
          result[type.id].subtypes[sub.id] = {
            devices: [],
            subtypeName,
            displayOrder: sub.displayOrder ?? 0,
            subtypeId: sub.id,
          };
        });
    });

    device.devices.forEach((dev) => {
      const typeGroup = result[dev.typeId];
      if (!typeGroup) return;

      if (dev.subtypeId && typeGroup.subtypes[dev.subtypeId]) {
        typeGroup.subtypes[dev.subtypeId].devices.push(dev);
      } else {
        typeGroup.noSubtypeDevices.push(dev);
      }
    });

    Object.values(result).forEach((group) => {
      for (const [subId, sub] of Object.entries(group.subtypes)) {
        if (sub.devices.length === 0) {
          delete group.subtypes[subId];
        }
      }
    });

    return result;
  }, [device.types, device.subtypes, device.devices, currentLang]);

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
            <p className={styles.sectionTitle}>{typeGroup.typeName}</p>

            {typeGroup.noSubtypeDevices.length > 0 && (
              <div className={styles.deviceGrid}>
                {typeGroup.noSubtypeDevices.map((device) => (
                  <DeviceItem
                    key={device.id}
                    device={device}
                    onClick={onDeviceClick}
                  />
                ))}
              </div>
            )}

            {Object.values(typeGroup.subtypes)
              .sort((a, b) => {
                const ao = Number(a.displayOrder ?? 0);
                const bo = Number(b.displayOrder ?? 0);
                return ao === bo ? 0 : ao - bo;
              })
              .map((subtypeGroup) => {
                if (subtypeGroup.devices.length === 0) {
                  return null;
                }

                return (
                  <div
                    key={subtypeGroup.subtypeId}
                    id={`subtype-${subtypeGroup.subtypeId}`}
                    className={styles.subtypeSection}
                  >
                    <p className={styles.subtypeTitle}>
                      {subtypeGroup.subtypeName}
                    </p>
                    {subtypeGroup.devices.length === 0 && (
                      <p className={styles.noDevices}>
                        {t("No products for this subtype", {
                          ns: "deviceList",
                        })}
                      </p>
                    )}
                    <div className={styles.deviceGrid}>
                      {subtypeGroup.devices.map((device) => (
                        <DeviceItem
                          key={device.id}
                          device={device}
                          onClick={onDeviceClick}
                        />
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
