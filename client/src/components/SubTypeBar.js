import React, {
  useContext,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { observer } from "mobx-react-lite";
import { Context } from "../index";
import { useTranslation } from "react-i18next";
import styles from "./SubTypeBar.module.css";

const SubTypeBar = observer(({ variant = "default", onPick, activeId }) => {
  const { device } = useContext(Context);
  const { i18n } = useTranslation();
  const currentLang = i18n.language || "en";

  const rowRef = useRef(null);

  const list = useMemo(() => {
    if (device.loading?.subtypes) return null;

    const isAuto =
      !!device.selectedType?.name && /авто/i.test(device.selectedType.name);

    const sorter = (a, b) =>
      Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0) ||
      Number(a.id) - Number(b.id);

    if (!device.selectedType?.id) return [];

    const selectedTypeId = Number(device.selectedType.id);
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
        facets.map((f) => [Number(f.id), Number(f.count) || 0]),
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
          facets.map((f) => [Number(f.id), Number(f.count || 0)]),
        );

        return baseFromType
          .filter((s) => idSet.has(Number(s.id)) && mmAll.has(Number(s.id)))
          .map((s) => ({ ...s, count: countById.get(Number(s.id)) || 0 }));
      }

      return baseFromType.filter((s) => mmAll.has(Number(s.id)));
    }

    if (variant === "universal") {
      if (!isAuto) return baseFromType;

      const mmAll = new Set((device.facets?.mmSubtypeIdsAll || []).map(Number));
      const univ = new Set(
        (device.facets?.universalSubtypeIds || []).map(Number),
      );

      return baseFromType.filter(
        (s) => univ.has(Number(s.id)) && !mmAll.has(Number(s.id)),
      );
    }

    return baseFromType;
  }, [
    variant,
    device.loading?.subtypes,
    device.facets?.subtypes,
    device.facets?.mmSubtypeIdsAll,
    device.facets?.universalSubtypeIds,
    device.subtypes,
    device.selectedType?.id,
    device.selectedType?.name,
    device.selectedModel?.id,
  ]);

  const active = activeId ?? device.selectedSubType?.id;

  const ensureActiveVisible = useCallback((id, behavior = "smooth") => {
    const row = rowRef.current;
    if (!row || !id) return;

    const el = row.querySelector(`[data-subtype-pill="${id}"]`);
    if (!el) return;

    // центруем актив в карусели
    const targetLeft =
      el.offsetLeft - (row.clientWidth / 2 - el.clientWidth / 2);
    const maxLeft = row.scrollWidth - row.clientWidth;
    const clamped = Math.max(0, Math.min(targetLeft, maxLeft));

    row.scrollTo({ left: clamped, behavior });
  }, []);

  useEffect(() => {
    // чтобы при ручном вертикальном скролле карусель "догоняла" актив
    if (!active) return;
    requestAnimationFrame(() => ensureActiveVisible(active, "smooth"));
  }, [active, ensureActiveVisible]);

  if (device.loading?.subtypes) return null;
  if (!list || !list.length) return null;

  const handleSelect = (subtype) => {
    if (onPick) {
      onPick(subtype.id, subtype);
      return;
    }
    device.setSelectedSubType(subtype);
  };

  return (
    <div ref={rowRef} className={styles.row}>
      {list.map((subtype) => (
        <button
          key={subtype.id}
          data-subtype-pill={subtype.id}
          type="button"
          className={`${styles.chip} ${String(active) === String(subtype.id) ? styles.chipActive : ""}`}
          onClick={() => handleSelect(subtype)}
        >
          {subtype.translations?.name?.[currentLang] || subtype.name}
        </button>
      ))}
    </div>
  );
});

export default SubTypeBar;
