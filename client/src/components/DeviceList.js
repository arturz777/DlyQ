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
  const selectedSubtypeId = Number(device.selectedSubType?.id) || null;

  const grouped = useMemo(() => {
    const types = Array.isArray(device.types) ? device.types : [];
    const subtypes = Array.isArray(device.subtypes) ? device.subtypes : [];
    const devices = Array.isArray(device.devices) ? device.devices : [];

    const result = {};
    types.forEach((type) => {
      const typeId = Number(type.id);
      if (!typeId) return;

      const typeName =
        type?.translations?.name?.[currentLang] || type?.name || "";

      result[typeId] = {
        typeId,
        typeName,
        subtypes: {},
        noSubtypeDevices: [],
      };
    });

    subtypes.forEach((st) => {
      const stId = Number(st.id);
      const stTypeId = Number(st.typeId);
      if (!stId || !stTypeId || !result[stTypeId]) return;

      result[stTypeId].subtypes[stId] = {
        subtypeId: stId,
        subtypeName: st?.translations?.name?.[currentLang] || st?.name || "",
        displayOrder: Number(st?.displayOrder ?? 0),
        devices: [],
      };
    });

    const subtypeTypeIdById = new Map();
    subtypes.forEach((st) => {
      const sid = Number(st.id);
      const tid = Number(st.typeId);
      if (sid && tid) subtypeTypeIdById.set(sid, tid);
    });

    devices.forEach((dev) => {
      const primaryTypeId =
        Number(dev?.typeId) ||
        (dev?.subtypeId ? subtypeTypeIdById.get(Number(dev.subtypeId)) : null);
      const primarySubtypeId = Number(dev?.subtypeId) || null;

      const m2mTypeIds = Array.isArray(dev?.types)
        ? dev.types.map((t) => Number(t.id)).filter(Boolean)
        : [];

      const m2mSubtypes = Array.isArray(dev?.subtypes) ? dev.subtypes : [];
      const m2mSubtypeTypeIds = m2mSubtypes
        .map((st) => Number(st.typeId))
        .filter(Boolean);

      const allTypeIds = new Set(
        [primaryTypeId, ...m2mTypeIds, ...m2mSubtypeTypeIds].filter(Boolean)
      );

      if (allTypeIds.size === 0) return;

      allTypeIds.forEach((tid) => {
        const group = result[tid];
        if (!group) return;

        const primarySubtypeIdForThisType =
          primarySubtypeId && subtypeTypeIdById.get(primarySubtypeId) === tid
            ? primarySubtypeId
            : null;

        const idsOfThisType = new Set(
          [
            primarySubtypeIdForThisType,
            ...m2mSubtypes
              .filter((st) => Number(st.typeId) === tid)
              .map((st) => Number(st.id)),
          ].filter(Boolean)
        );

        if (selectedSubtypeId) {
          if (idsOfThisType.has(selectedSubtypeId)) {
            const sub = group.subtypes[selectedSubtypeId];
            if (sub) sub.devices.push(dev);
          }
          return;
        }
        if (idsOfThisType.size === 0) {
          group.noSubtypeDevices.push(dev);
          return;
        }

        idsOfThisType.forEach((sid) => {
          const sub = group.subtypes[sid];
          if (sub) sub.devices.push(dev);
        });
      });
    });

    Object.values(result).forEach((group) => {
      Object.keys(group.subtypes).forEach((sid) => {
        if (!group.subtypes[sid].devices.length) {
          delete group.subtypes[sid];
        }
      });

      const dedup = (arr) => {
        const seen = new Set();
        return arr.filter((d) => {
          if (!d || !d.id) return false;
          if (seen.has(d.id)) return false;
          seen.add(d.id);
          return true;
        });
      };

      group.noSubtypeDevices = dedup(group.noSubtypeDevices);
      Object.values(group.subtypes).forEach((sub) => {
        sub.devices = dedup(sub.devices);
      });
    });

    return result;
  }, [
    device.types,
    device.subtypes,
    device.devices,
    currentLang,
    selectedSubtypeId,
  ]);

  const sortTypes = (a, b) => {
    const ao = Number(a.displayOrder ?? 0);
    const bo = Number(b.displayOrder ?? 0);
    return ao === bo ? Number(a.id) - Number(b.id) : ao - bo;
  };

  const isLoading = !!device.loading?.devices;
  const hasActiveFilter = Boolean(
    device.selectedType?.id ||
      device.selectedSubType?.id ||
      device.selectedBrand?.id ||
      device.selectedMake?.id ||
      device.selectedModel?.id
  );

  const orderedTypeIds = (device.types || [])
    .slice()
    .sort(sortTypes)
    .map((t) => Number(t.id));

  const nothingToShow = orderedTypeIds.every((tid) => {
    const g = grouped[tid];
    if (!g) return true;
    const hasNoSubtype = g.noSubtypeDevices?.length > 0;
    const hasAnySubtype = Object.values(g.subtypes || {}).some(
      (s) => s.devices?.length > 0
    );
    return !hasNoSubtype && !hasAnySubtype;
  });

  if (nothingToShow && !isLoading && !hasActiveFilter) {
    const flat = Array.isArray(device.devices) ? device.devices : [];
    if (!flat.length) return null;
    return (
      <div className={styles.deviceGrid}>
        {flat.map((d) => (
          <DeviceItem key={d.id} device={d} onClick={onDeviceClick} />
        ))}
      </div>
    );
  }

  return (
    <div>
      {orderedTypeIds.map((tid) => {
        const group = grouped[tid];
        if (!group) return null;

        const hasNoSubtype = group.noSubtypeDevices?.length > 0;
        const hasAnySubtype = Object.values(group.subtypes || {}).some(
          (s) => s.devices?.length > 0
        );

        if (!hasNoSubtype && !hasAnySubtype) return null;

        const subArr = Object.values(group.subtypes || {}).sort((a, b) => {
          const ao = Number(a.displayOrder ?? 0);
          const bo = Number(b.displayOrder ?? 0);
          if (ao === bo) return a.subtypeId - b.subtypeId;
          return ao - bo;
        });

        return (
          <div key={tid} className={styles.section}>
            <p className={styles.sectionTitle}>{group.typeName}</p>

            {hasNoSubtype && (
              <div className={styles.deviceGrid}>
                {group.noSubtypeDevices.map((d) => (
                  <DeviceItem key={d.id} device={d} onClick={onDeviceClick} />
                ))}
              </div>
            )}

            {subArr.map((sub) => {
              if (!sub.devices.length) return null;
              return (
                <div
                  key={sub.subtypeId}
                  id={`subtype-${sub.subtypeId}`}
                  className={styles.subtypeSection}
                >
                  <p className={styles.subtypeTitle}>{sub.subtypeName}</p>
                  <div className={styles.deviceGrid}>
                    {sub.devices.map((d) => (
                      <DeviceItem
                        key={d.id}
                        device={d}
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
