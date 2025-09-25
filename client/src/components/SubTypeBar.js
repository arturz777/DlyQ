import React, { useContext, useMemo, useRef } from "react";
import { observer } from "mobx-react-lite";
import { Context } from "../index";
import { useTranslation } from "react-i18next";
import styles from "./SubTypeBar.module.css";

const SubTypeBar = observer(({ variant = "default" }) => {
  const { device } = useContext(Context);
  const { i18n } = useTranslation();
  const currentLang = i18n.language || "en";

  const lastUniversalIdsRef = useRef(new Map());

  const list = useMemo(() => {
    if (device.loading?.subtypes) return null;

    const isAuto =
      !!device.selectedType?.name && /авто/i.test(device.selectedType.name);

    const sorter = (a, b) => {
      const ao = a.displayOrder ?? 0;
      const bo = b.displayOrder ?? 0;
      return ao === bo ? a.id - b.id : ao - bo;
    };

    if (!device.selectedType?.id) return [];

    const selectedTypeId = Number(device.selectedType.id);
    const selectedMakeId = device.selectedMake?.id
      ? Number(device.selectedMake.id)
      : null;
    const selectedModelId = device.selectedModel?.id
      ? Number(device.selectedModel.id)
      : null;
    const selectedSubtypeId = device.selectedSubType?.id
      ? Number(device.selectedSubType.id)
      : null;

    const baseFromType = (device.subtypes || [])
      .filter((s) => Number(s.typeId) === selectedTypeId)
      .slice()
      .sort(sorter);

    if (variant === "default") {
      const facets = device.facets?.subtypes || [];
      if (!facets.length) return baseFromType;

      const dict = new Map(
        (device.subtypes || []).map((s) => [Number(s.id), s])
      );
      return facets
        .map((f) => {
          const b = dict.get(Number(f.id));
          return b
            ? { ...b, count: f.count }
            : { id: f.id, name: f.name, displayOrder: 0, count: f.count };
        })
        .sort(sorter);
    }

    if (variant === "universal") {
      if (!isAuto) return baseFromType;

      const getCompatList = (d) => {
        if (!d) return [];
        if (Array.isArray(d.compat)) return d.compat;
        if (Array.isArray(d.compatibility)) return d.compatibility;
        if (Array.isArray(d.carCompat)) return d.carCompat;
        return [];
      };
      const hasMM = (c) => {
        const mk = c?.makeId ?? c?.make?.id ?? c?.model?.makeId ?? null;
        const md = c?.modelId ?? c?.model?.id ?? null;
        return !!(mk || md);
      };
      const isUniversalDevice = (d) => {
        const compat = getCompatList(d);
        if (!compat.length) return true;
        if (compat.some((c) => c?.isUniversal)) return true;
        return !compat.some((c) => hasMM(c));
      };

      const canRecomputeCache =
        !selectedMakeId && !selectedModelId && !selectedSubtypeId;

      let universalIds = lastUniversalIdsRef.current.get(selectedTypeId);

      if (canRecomputeCache || !universalIds) {
        universalIds = new Set();

        const subtypeTypeIdById = new Map(
          (device.subtypes || []).map((s) => [Number(s.id), Number(s.typeId)])
        );

        for (const d of device.devices || []) {
          if (!isUniversalDevice(d)) continue;

          const sIds = new Set();
          if (d.subtypeId) sIds.add(Number(d.subtypeId));
          if (d.subtype?.id) sIds.add(Number(d.subtype.id));
          if (Array.isArray(d.subtypes)) {
            d.subtypes.forEach(
              (s) => s?.id && s.typeId && sIds.add(Number(s.id))
            );
          }

          for (const sid of sIds) {
            if (subtypeTypeIdById.get(sid) === selectedTypeId) {
              universalIds.add(sid);
            }
          }
        }

        const mapCopy = new Map(lastUniversalIdsRef.current);
        mapCopy.set(selectedTypeId, universalIds);
        lastUniversalIdsRef.current = mapCopy;
      }

      if (!universalIds || universalIds.size === 0) return baseFromType;

      return baseFromType.filter((s) => universalIds.has(Number(s.id)));
    }

    if (!isAuto) return baseFromType;
    if (!selectedMakeId) return [];

    const getCompatList = (d) => {
      if (!d) return [];
      if (Array.isArray(d.compat)) return d.compat;
      if (Array.isArray(d.compatibility)) return d.compatibility;
      if (Array.isArray(d.carCompat)) return d.carCompat;
      return [];
    };
    const matchSelectedMM = (c) => {
      const mk = c?.makeId ?? c?.make?.id ?? c?.model?.makeId ?? null;
      const md = c?.modelId ?? c?.model?.id ?? null;
      if (!mk) return false;
      if (selectedMakeId && mk !== selectedMakeId) return false;
      if (selectedModelId && md !== selectedModelId) return false;
      return true;
    };

    const subtypeTypeIdById = new Map(
      (device.subtypes || []).map((s) => [Number(s.id), Number(s.typeId)])
    );

    const allowed = new Set();
    for (const d of device.devices || []) {
      const sIds = new Set();
      if (d.subtypeId) sIds.add(Number(d.subtypeId));
      if (d.subtype?.id) sIds.add(Number(d.subtype.id));
      if (Array.isArray(d.subtypes)) {
        d.subtypes.forEach((s) => s?.id && s.typeId && sIds.add(Number(s.id)));
      }
      const sIdsThisType = [...sIds].filter(
        (sid) => subtypeTypeIdById.get(Number(sid)) === selectedTypeId
      );
      if (!sIdsThisType.length) continue;

      const compat = getCompatList(d);
      if (compat.some((c) => matchSelectedMM(c))) {
        sIdsThisType.forEach((sid) => allowed.add(sid));
      }
    }

    return baseFromType.filter((s) => allowed.has(Number(s.id)));
  }, [
    variant,
    device.loading?.subtypes,
    device.facets?.subtypes,
    device.subtypes,
    device.devices,
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
