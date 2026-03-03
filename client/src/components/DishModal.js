import React, { useMemo, useState, useEffect } from "react";
import { fetchMenuItemOptions } from "../http/menuOptionsAPI";
import { useTranslation } from "react-i18next";
import deviceStyles from "../pages/DevicePage.module.css";
import styles from "./DishModal.module.css";

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

const DishModal = ({ item, seller, getImgSrc, onAdd }) => {
  const [qty, setQty] = useState(1);
  const [groups, setGroups] = useState([]);
  const [optLoading, setOptLoading] = useState(true);
  const [selected, setSelected] = useState({});
  const [errors, setErrors] = useState({});
  const imgSrc = useMemo(() => getImgSrc?.(item?.img), [getImgSrc, item?.img]);
  const basePrice = Number(item?.price || 0);
  const isAvailable = !!item?.isAvailable;
  const { t, i18n } = useTranslation();

  const lang = (i18n.language || "ru").toLowerCase();
  const pickTitle = (fallback, tr) => {
    if (!tr) return fallback;
    return tr[lang] || tr[lang.split("-")[0]] || fallback;
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setOptLoading(true);
        if (!item?.id) return;
        const g = await fetchMenuItemOptions(item.id);
        if (cancelled) return;

        setGroups(g || []);

        const init = {};
        (g || []).forEach((gr) => {
          const opts = gr.options || [];
          if (gr.type === "single") {
            const def = opts.find((o) => o.isDefault) || null;
            if (def) init[gr.id] = String(def.id);
          } else {
            const defs = opts
              .filter((o) => o.isDefault)
              .map((o) => String(o.id));
            if (defs.length) init[gr.id] = defs;
          }
        });

        setSelected(init);
        setErrors({});
      } finally {
        if (!cancelled) setOptLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [item?.id]);

  const setSingle = (groupId, optionId) => {
    setSelected((prev) => ({ ...prev, [groupId]: String(optionId) }));
  };

  const toggleMulti = (groupId, optionId, maxSelect) => {
    setSelected((prev) => {
      const cur = Array.isArray(prev[groupId]) ? prev[groupId] : [];
      const id = String(optionId);

      if (cur.includes(id)) {
        return { ...prev, [groupId]: cur.filter((x) => x !== id) };
      }

      if (
        Number.isFinite(maxSelect) &&
        Number(maxSelect) > 0 &&
        cur.length >= Number(maxSelect)
      ) {
        return prev; // limit reached
      }

      return { ...prev, [groupId]: [...cur, id] };
    });
  };

  const extras = useMemo(() => {
    let sum = 0;

    for (const g of groups) {
      const gid = g.id;
      const opts = g.options || [];
      const val = selected[gid];

      if (g.type === "single") {
        if (!val) continue;
        const o = opts.find((x) => String(x.id) === String(val));
        if (o) sum += Number(o.priceDelta || 0);
      } else {
        const arr = Array.isArray(val) ? val : [];
        for (const oid of arr) {
          const o = opts.find((x) => String(x.id) === String(oid));
          if (o) sum += Number(o.priceDelta || 0);
        }
      }
    }

    return sum;
  }, [groups, selected]);

  const unitPrice = basePrice + extras;
  const total = unitPrice * qty;

  const validate = () => {
    const nextErr = {};

    for (const g of groups) {
      if (!g.isRequired) continue;

      const gid = g.id;
      const val = selected[gid];

      if (g.type === "single") {
        if (!val) nextErr[gid] = t("choose an option", { ns: "dishModal" });
      } else {
        const arr = Array.isArray(val) ? val : [];
        const min = Number.isFinite(g.minSelect) ? Number(g.minSelect) : 1;
        if (arr.length < min) {
          nextErr[gid] = t("choose at least", { ns: "dishModal" }) + ` ${min}`;
        }
      }
    }

    setErrors(nextErr);
    return Object.keys(nextErr).length === 0;
  };

  const handleAdd = () => {
    if (!isAvailable) return;
    if (!validate()) return;

    const selectedMeta = groups.map((g) => {
      const gid = g.id;
      const opts = g.options || [];
      const val = selected[gid];

      const chosen =
        g.type === "single"
          ? val
            ? [opts.find((o) => String(o.id) === String(val))].filter(Boolean)
            : []
          : Array.isArray(val)
            ? val
                .map((id) => opts.find((o) => String(o.id) === String(id)))
                .filter(Boolean)
            : [];

      return {
        groupId: gid,
        groupTitle: g.title,
        groupTranslations: g.translations?.title || {},
        type: g.type,
        chosen: chosen.map((o) => ({
          id: o.id,
          title: o.title,
          translations: o.translations?.title || {},
          priceDelta: Number(o.priceDelta || 0),
        })),
      };
    });

    onAdd?.({
      qty,
      unitPrice,
      selectedOptions: selected,
      selectedOptionsMeta: selectedMeta,
    });
  };

  return (
    <div className={`${deviceStyles.DevicePageContainer} ${styles.container}`}>
      <div className={`${deviceStyles.DevicePageContent} ${styles.content}`}>
        <div className={deviceStyles.DevicePageColImg}>
          <div className={deviceStyles.DevicePageImageWrapper}>
            <div className={deviceStyles.ImageContainer}>
              {imgSrc ? (
                <img
                  src={imgSrc}
                  alt={item?.name || t("dish", { ns: "dishModal" })}
                  className={`${deviceStyles.DevicePageMainImage} ${styles.mainImg}`}
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              ) : (
                <div className={styles.imgPlaceholder} />
              )}
            </div>
          </div>
        </div>

        <div className={deviceStyles.DevicePageDetails}>
          <div className={deviceStyles.DevicePageCard}>
            <p className={deviceStyles.DevicePageTitle}>
              {item?.name}
              {item?.isAgeRestricted && (
                <span className={styles.ageBadge}>18+</span>
              )}
            </p>

            {seller?.name && (
              <div className={styles.sellerName}>{seller.name}</div>
            )}
            {item?.description && (
              <p className={styles.desc}>{item.description}</p>
            )}

            <div className={deviceStyles.DevicePagePriceBlock}>
              <span className={deviceStyles.DevicePageRegularPrice}>
                {unitPrice.toFixed(2)} €
              </span>
            </div>

            <div className={`${styles.bottomRow} ${styles.desktopOnly}`}>
              <div className={styles.qty}>
                <button
                  type="button"
                  className={styles.qtyBtn}
                  onClick={() => setQty((v) => clamp(v - 1, 1, 99))}
                  disabled={qty <= 1 || !isAvailable}
                >
                  −
                </button>
                <div className={styles.qtyVal}>{qty}</div>
                <button
                  type="button"
                  className={styles.qtyBtn}
                  onClick={() => setQty((v) => clamp(v + 1, 1, 99))}
                  disabled={!isAvailable}
                >
                  +
                </button>
              </div>
            </div>

            <div className={styles.extrasSection}>
              <div className={styles.extrasHeader}></div>

              {optLoading ? (
                <div className={styles.loading}>
                  {t("loading...", { ns: "dishModal" })}
                </div>
              ) : (
                <div className={styles.groups}>
                  {groups.map((g) => (
                    <div key={g.id} className={styles.group}>
                      <div className={styles.groupTitle}>
                        {pickTitle(g.title, g.translations?.title)}
                        {g.isRequired ? (
                          <span className={styles.req}>* Обязательно</span>
                        ) : null}
                        {g.type !== "single" && Number(g.maxSelect) ? (
                          <span className={styles.limit}>
                            {t("up to", {
                              ns: "dishModal",
                              defaultValue: "до",
                            })}{" "}
                            {Number(g.maxSelect)}
                          </span>
                        ) : null}
                      </div>

                      {errors[g.id] && (
                        <div className={styles.err}>{errors[g.id]}</div>
                      )}

                      <div className={styles.optionsList}>
                        {(g.options || []).map((o) => {
                          const id = String(o.id);
                          const delta = Number(o.priceDelta || 0);

                          if (g.type === "single") {
                            const checked = String(selected[g.id] || "") === id;
                            return (
                              <button
                                key={o.id}
                                type="button"
                                className={`${styles.optionRow} ${checked ? styles.optionActive : ""}`}
                                onClick={() => setSingle(g.id, o.id)}
                              >
                                <span className={styles.control}>
                                  <span
                                    className={`${styles.radio} ${checked ? styles.controlActive : ""}`}
                                  />
                                </span>

                                <span className={styles.optionText}>
                                  <span className={styles.optionName}>
                                    {pickTitle(o.title, o.translations?.title)}
                                  </span>
                                  <span className={styles.optionPrice}>
                                    +{delta.toFixed(2)} €
                                  </span>
                                </span>
                              </button>
                            );
                          }

                          const arr = Array.isArray(selected[g.id])
                            ? selected[g.id]
                            : [];
                          const checked = arr.includes(id);
                          const max = Number.isFinite(g.maxSelect)
                            ? Number(g.maxSelect)
                            : null;
                          const disabled = !checked && max && arr.length >= max;

                          return (
                            <button
                              key={o.id}
                              type="button"
                              className={`${styles.optionRow} ${checked ? styles.optionActive : ""}`}
                              onClick={() =>
                                !disabled &&
                                toggleMulti(g.id, o.id, g.maxSelect)
                              }
                              disabled={disabled}
                            >
                              <span className={styles.control}>
                                <span
                                  className={`${styles.check} ${checked ? styles.controlActive : ""}`}
                                >
                                  {checked ? "✓" : ""}
                                </span>
                              </span>

                              <span className={styles.optionText}>
                                <span className={styles.optionName}>
                                  {pickTitle(o.title, o.translations?.title)}
                                </span>
                                <span className={styles.optionPrice}>
                                  +{delta.toFixed(2)} €
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              className={`${deviceStyles.DevicePageAddToCart} ${styles.desktopAdd}`}
              disabled={!isAvailable}
              onClick={handleAdd}
            >
              {t("add", { ns: "dishModal" })} • {total.toFixed(2)} €
            </button>

            <div className={styles.mobileBar}>
              <div className={styles.mobileBarInner}>
                <div className={styles.mobileQty}>
                  <button
                    type="button"
                    className={styles.mobileQtyBtn}
                    onClick={() => setQty((v) => clamp(v - 1, 1, 99))}
                    disabled={qty <= 1 || !isAvailable}
                  >
                    −
                  </button>
                  <div className={styles.mobileQtyVal}>{qty}</div>
                  <button
                    type="button"
                    className={styles.mobileQtyBtn}
                    onClick={() => setQty((v) => clamp(v + 1, 1, 99))}
                    disabled={!isAvailable}
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  className={`${deviceStyles.DevicePageAddButtonCompact} ${styles.mobileAddBtn}`}
                  disabled={!isAvailable}
                  onClick={handleAdd}
                >
                  <span className={deviceStyles.AddText}>
                    {isAvailable
                      ? t("add", { ns: "dishModal" })
                      : t("out of stock", { ns: "dishModal" })}
                  </span>
                  <span className={deviceStyles.AddPrice}>
                    {total.toFixed(2)} €
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DishModal;
