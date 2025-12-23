import React, { useContext, useMemo } from "react";
import { observer } from "mobx-react-lite";
import { Context } from "../index";
import DeviceItem from "./DeviceItem";
import { useTranslation } from "react-i18next";
import catalogSuggestImg from "../assets/catalog-suggest.png";
import styles from "./DeviceList.module.css";

const DeviceList = observer(({ onDeviceClick }) => {
  const { device } = useContext(Context);
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language || "en";
  const selectedSubtypeId = Number(device.selectedSubType?.id) || null;
  const forcedTypeId = Number(device.selectedType?.id) || null;

  const ui = useMemo(
    () => ({
      noMake: t("no_make", { ns: "deviceList" }),
      noModel: t("no_model", { ns: "deviceList" }),
      multipleMakes: t("multiple_makes", { ns: "deviceList" }),

      bannerTitle: t("banner_title", { ns: "deviceList" }),
      bannerText: t("banner_text", { ns: "deviceList" }),
      suggestBtn: t("suggest_product", { ns: "deviceList" }),
    }),
    [t, i18n.language]
  );

  const mmAllSet = useMemo(() => {
    return new Set(
      (device.facets?.mmSubtypeIdsAll || []).map((x) => Number(x))
    );
  }, [device.facets?.mmSubtypeIdsAll]);

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

      const targetTypeIds = forcedTypeId ? new Set([forcedTypeId]) : allTypeIds;

      targetTypeIds.forEach((tid) => {
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
    forcedTypeId,
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
    .filter((t) => !forcedTypeId || Number(t.id) === forcedTypeId)
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

  const extractAutoPairs = (d) => {
    const pairs = [];

    const pushPair = (make, model) => {
      const m = (make || "").toString().trim();
      const mo = (model || "").toString().trim();
      if (!m && !mo) return;
      pairs.push({ make: m || ui.noMake, model: mo || ui.noModel });
    };

    const compat0 = Array.isArray(d?.compat)
      ? d.compat
      : d?.compat
      ? [d.compat]
      : [];
    compat0.forEach((c) => {
      pushPair(c?.make?.name || c?.makeName, c?.model?.name || c?.modelName);
    });

    pushPair(d?.make?.name || d?.makeName, d?.model?.name || d?.modelName);

    const compatArrays = [
      d?.compatibilities,
      d?.compatibility,
      d?.mmCompatibilities,
      d?.autoCompatibilities,
      d?.carCompatibilities,
    ].filter(Array.isArray);

    compatArrays.forEach((arr) => {
      arr.forEach((c) => {
        pushPair(
          c?.make?.name || c?.makeName || c?.brand?.name,
          c?.model?.name || c?.modelName
        );
      });
    });

    if (Array.isArray(d?.models)) {
      d.models.forEach((m) => {
        const modelName = m?.name || m?.modelName;
        const makeName =
          m?.make?.name ||
          m?.makeName ||
          (m?.makeId && Array.isArray(device.makes)
            ? device.makes.find((x) => Number(x.id) === Number(m.makeId))?.name
            : null);

        pushPair(makeName, modelName);
      });
    }

    const uniq = new Map();
    pairs.forEach((p) => uniq.set(`${p.make}|||${p.model}`, p));
    const arr = Array.from(uniq.values());

    const hasRealModel = arr.some((p) => p.model !== ui.noModel);
    if (hasRealModel) {
      const makesWithRealModel = new Set(
        arr.filter((p) => p.model !== ui.noModel).map((p) => p.make)
      );

      return arr.filter(
        (p) => !(p.model === ui.noModel && makesWithRealModel.has(p.make))
      );
    }

    return arr;
  };

  const getMakeForUniversal = (d) => {
    const pairs = extractAutoPairs(d);
    if (!pairs.length) return ui.noMake;
    const uniqMakes = Array.from(new Set(pairs.map((p) => p.make)));
    return uniqMakes.length === 1 ? uniqMakes[0] : ui.multipleMakes;
  };

  const splitByMake = (arr) => {
    const map = new Map();
    (arr || []).forEach((d) => {
      const label = getMakeForUniversal(d);
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(d);
    });

    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === ui.noMake) return 1;
      if (b === ui.noMake) return -1;
      return a.localeCompare(b, "ru");
    });
  };

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

        const typeLabel = group.typeName || "";
        const isAutoTypeHere =
          /авто/i.test(typeLabel) || /auto/i.test(typeLabel);

        const universalSubArr = isAutoTypeHere
          ? subArr.filter((s) => !mmAllSet.has(Number(s.subtypeId)))
          : subArr;

        const mmSubArr = isAutoTypeHere
          ? subArr.filter((s) => mmAllSet.has(Number(s.subtypeId)))
          : [];

        return (
          <div key={tid} className={styles.section}>
            {hasNoSubtype && (
              <div className={styles.deviceGrid}>
                {group.noSubtypeDevices.map((d) => (
                  <DeviceItem key={d.id} device={d} onClick={onDeviceClick} />
                ))}
              </div>
            )}

            {universalSubArr.map((sub) => {
              if (!sub.devices.length) return null;

              const makeGroups = isAutoTypeHere ? splitByMake(sub.devices) : [];
              const showMakeHeaders = makeGroups.length > 1;

              return (
                <div
                  key={sub.subtypeId}
                  id={`subtype-${sub.subtypeId}`}
                  className={styles.subtypeSection}
                >
                  <p className={styles.subtypeTitle}>{sub.subtypeName}</p>

                  {isAutoTypeHere ? (
                    makeGroups.map(([makeLabel, items]) => (
                      <div key={`${sub.subtypeId}-${makeLabel}`}>
                        {showMakeHeaders && (
                          <p
                            className={styles.subtypeTitle}
                            style={{
                              fontSize: 14,
                              marginTop: 20,
                              marginBottom: 20,
                            }}
                          >
                            {makeLabel}
                          </p>
                        )}

                        <div className={styles.deviceGrid}>
                          {items.map((d) => (
                            <DeviceItem
                              key={d.id}
                              device={d}
                              onClick={onDeviceClick}
                            />
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={styles.deviceGrid}>
                      {sub.devices.map((d) => (
                        <DeviceItem
                          key={d.id}
                          device={d}
                          onClick={onDeviceClick}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {isAutoTypeHere &&
              (() => {
                const buckets = new Map();

                const put = (make, model, sub, dev) => {
                  const key = `${make}|||${model}`;
                  if (!buckets.has(key)) {
                    buckets.set(key, {
                      make,
                      model,
                      subtypes: new Map(),
                    });
                  }
                  const bucket = buckets.get(key);

                  if (!bucket.subtypes.has(sub.subtypeId)) {
                    bucket.subtypes.set(sub.subtypeId, {
                      subtypeId: sub.subtypeId,
                      subtypeName: sub.subtypeName,
                      displayOrder: Number(sub.displayOrder ?? 0),
                      items: [],
                    });
                  }

                  bucket.subtypes.get(sub.subtypeId).items.push(dev);
                };

                mmSubArr.forEach((sub) => {
                  if (!sub.devices?.length) return;

                  sub.devices.forEach((d) => {
                    const pairs = extractAutoPairs(d);

                    if (!pairs.length) {
                      put(ui.noMake, ui.noModel, sub, d);
                      return;
                    }

                    pairs.forEach((p) => put(p.make, p.model, sub, d));
                  });
                });

                const orderedBuckets = Array.from(buckets.values()).sort(
                  (a, b) => {
                    if (a.make === ui.noMake && b.make !== ui.noMake) return 1;
                    if (b.make === ui.noMake && a.make !== ui.noMake) return -1;
                    const mk = a.make.localeCompare(b.make, "ru");
                    if (mk !== 0) return mk;
                    return a.model.localeCompare(b.model, "ru");
                  }
                );

                orderedBuckets.forEach((bucket) => {
                  bucket.subtypes.forEach((st) => {
                    const seen = new Set();
                    st.items = st.items.filter(
                      (x) => x?.id && !seen.has(x.id) && (seen.add(x.id), true)
                    );
                  });
                });

                const safeId = (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, "_");

                return orderedBuckets.map((bucket) => {
                  const subtypesArr = Array.from(bucket.subtypes.values()).sort(
                    (a, b) => {
                      const ao = Number(a.displayOrder ?? 0);
                      const bo = Number(b.displayOrder ?? 0);
                      if (ao === bo)
                        return Number(a.subtypeId) - Number(b.subtypeId);
                      return ao - bo;
                    }
                  );

                  const canUseSubtypeAnchors = Boolean(
                    device.selectedModel?.id
                  );

                  return (
                    <div key={`mmgrp-${bucket.make}-${bucket.model}`}>
                      <p
                        className={styles.subtypeTitle}
                        style={{
                          fontSize: 16,
                          marginTop: 40,
                          marginBottom: 20,
                        }}
                      >
                        {bucket.make} • {bucket.model}
                      </p>

                      {subtypesArr.map((st) => (
                        <div
                          key={`mm-${bucket.make}-${bucket.model}-${st.subtypeId}`}
                          id={
                            canUseSubtypeAnchors
                              ? `subtype-${st.subtypeId}`
                              : `mm-${safeId(bucket.make)}-${safeId(
                                  bucket.model
                                )}-${st.subtypeId}`
                          }
                          className={styles.subtypeSection}
                        >
                          <p className={styles.subtypeTitle}>
                            {st.subtypeName}
                          </p>
                          <div className={styles.deviceGrid}>
                            {st.items.map((d) => (
                              <DeviceItem
                                key={d.id}
                                device={d}
                                onClick={onDeviceClick}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                });
              })()}
          </div>
        );
      })}

      <div className={styles.catalogBottomBanner}>
        <img src={catalogSuggestImg} alt="" className={styles.bannerImg} />

        <div className={styles.bannerOverlay}>
          <div className={styles.bannerTop}>
            <div className={styles.bannerTitle}>{ui.bannerTitle}</div>

            <div className={styles.bannerText}>{ui.bannerText}</div>
          </div>

          <button
            type="button"
            className={styles.bannerBtn}
            onClick={() => {}}
            title={ui.suggestBtn}
          >
            {ui.suggestBtn}
          </button>
        </div>
      </div>
    </div>
  );
});

export default DeviceList;
