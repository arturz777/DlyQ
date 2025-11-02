import React, { useContext, useMemo, useRef } from "react";
import { observer } from "mobx-react-lite";
import { Context } from "../index";
import { useTranslation } from "react-i18next";
import styles from "./SubTypeBar.module.css";

const SubTypeBar = observer(({ variant = "default" }) => {
  const { device } = useContext(Context);
  const { i18n } = useTranslation();
  const currentLang = i18n.language || "en";

  const list = useMemo(() => {
    if (device.loading?.subtypes) return null;

    const isAuto =
      !!device.selectedType?.name && /авто/i.test(device.selectedType.name);

    const sorter = (a, b) =>
      Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0) ||
      Number(a.id) - Number(b.id);

    if (!device.selectedType?.id) return [];

    const selectedTypeId = Number(device.selectedType.id);
    const selectedMakeId = device.selectedMake?.id
      ? Number(device.selectedMake.id)
      : null;
    const selectedModelId = device.selectedModel?.id
      ? Number(device.selectedModel.id)
      : null;

    const baseFromType = (device.subtypes || [])
      .filter((s) => Number(s.typeId) === selectedTypeId)
      .slice()
      .sort(sorter);

    if (variant === "default") {
      const facets = device.facets?.subtypes || [];
      if (!facets.length) return baseFromType;
      const countsById = new Map(
        facets.map((f) => [Number(f.id), Number(f.count) || 0])
      );
      return baseFromType
        .filter((s) => countsById.has(Number(s.id)))
        .map((s) => ({ ...s, count: countsById.get(Number(s.id)) }));
    }

    if (variant === "mm") {
      if (!isAuto) return baseFromType;
      if (!selectedModelId) return [];

      const mmAll = new Set((device.facets?.mmSubtypeIdsAll || []).map(Number));

      const facets = device.facets?.subtypes || [];
      if (facets.length) {
        const idSet = new Set(facets.map((f) => Number(f.id)));
        const countById = new Map(
          facets.map((f) => [Number(f.id), Number(f.count || 0)])
        );
        return baseFromType
          .filter((s) => idSet.has(Number(s.id)) && mmAll.has(Number(s.id)))
          .map((s) => ({ ...s, count: countById.get(Number(s.id)) || 0 }));
      }

      const subtypeTypeIdById = new Map(
        (device.subtypes || []).map((s) => [Number(s.id), Number(s.typeId)])
      );
      const idsFromDevices = new Set();

      for (const d of device.devices || []) {
        const sIds = new Set();
        if (d.subtypeId) sIds.add(Number(d.subtypeId));
        if (d.subtype?.id) sIds.add(Number(d.subtype.id));
        if (Array.isArray(d.subtypes))
          d.subtypes.forEach((s) => s?.id && sIds.add(Number(s.id)));

        for (const sid of sIds) {
          if (subtypeTypeIdById.get(sid) === selectedTypeId)
            idsFromDevices.add(sid);
        }
      }

      return baseFromType.filter(
        (s) => idsFromDevices.has(Number(s.id)) && mmAll.has(Number(s.id))
      );
    }

    if (variant === "universal") {
      if (!isAuto) return baseFromType;

      const mmAll = new Set((device.facets?.mmSubtypeIdsAll || []).map(Number));
      const univ = new Set(
        (device.facets?.universalSubtypeIds || []).map(Number)
      );

      return baseFromType.filter(
        (s) => univ.has(Number(s.id)) && !mmAll.has(Number(s.id))
      );
    }

    return baseFromType;
  }, [
    variant,
    device.loading?.subtypes,
    device.loading?.devices,
    device.devices?.length,
    device.facets?.subtypes,
    device.facets?.mmSubtypeIdsAll,
    device.subtypes,
    device.selectedType?.id,
    device.selectedType?.name,
    device.selectedMake?.id,
    device.selectedModel?.id,
    device.selectedSubType?.id,
  ]);

  if (device.loading?.subtypes) return null;
  if (!list || !list.length) return null;

  const activeId = device.selectedSubType?.id;
  const handleSelect = (subtype) => device.setSelectedSubType(subtype);

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
