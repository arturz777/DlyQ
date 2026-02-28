import React, { useEffect, useMemo, useState, lazy, Suspense } from "react";
import Image from "react-bootstrap/Image";
import {
  fetchDevices,
  fetchTypes,
  fetchSubtypes,
  fetchMakes,
  fetchModelsByMake,
  updateDeviceVisibility,
  deleteDevice,
} from "../http/deviceAPI";
import StockQuickAdjustModal from "./modals/StockQuickAdjustModal";
import SlideModal from "./modals/SlideModal";
import CreateDevice from "./modals/CreateDevice";
import styles from "./AdminDevicesTab.module.css";

const DevicePageLazy = lazy(() => import("../pages/DevicePage"));

const AdminDevicesTab = () => {
  const [types, setTypes] = useState([]);
  const [subtypes, setSubtypes] = useState([]);
  const [makes, setMakes] = useState([]);
  const [devices, setDevices] = useState([]);

  const [deviceVisible, setDeviceVisible] = useState(false);
  const [editableDevice, setEditableDevice] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState("priceAsc");

  const [openDeviceTypeIds, setOpenDeviceTypeIds] = useState([]);

  const [modelsByMake, setModelsByMake] = useState({});
  const [openMakeInType, setOpenMakeInType] = useState(new Set());
  const [openModelInMakeType, setOpenModelInMakeType] = useState(new Set());

  const [outOfOpen, setOutOfOpen] = useState(false);
  const [expireOpen, setExpireOpen] = useState(false);

  const [quickAdjustVisible, setQuickAdjustVisible] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);

  const getSkus = (d) => {
    const vars = Array.isArray(d.variants)
      ? d.variants
      : parseMaybeJSON(d.variants) || [];

    const skus = vars.map((v) => (v?.sku || "").trim()).filter(Boolean);

    if (skus.length === 0 && d?.sku) skus.push(String(d.sku).trim());

    return [...new Set(skus.filter(Boolean))];
  };

  const getLocations = (d) => {
    const vars = Array.isArray(d.variants)
      ? d.variants
      : parseMaybeJSON(d.variants) || [];

    const locs = vars
      .map((v) => (v?.warehouseLocation || "").trim())
      .filter(Boolean);

    if (locs.length === 0 && (d?.warehouseLocation || "").trim()) {
      locs.push(String(d.warehouseLocation).trim());
    }

    return [...new Set(locs)];
  };

  const getWeights = (d) => {
    const vars = Array.isArray(d.variants)
      ? d.variants
      : parseMaybeJSON(d.variants) || [];

    const ws = vars.map((v) => Number(v?.weightGrams)).filter((x) => x > 0);

    if (ws.length === 0 && Number(d?.weightGrams) > 0)
      ws.push(Number(d.weightGrams));

    return [...new Set(ws)];
  };

  const getDims = (d) => {
    const vars = Array.isArray(d.variants)
      ? d.variants
      : parseMaybeJSON(d.variants) || [];

    const fmt = (L, W, H) => (L && W && H ? `${L}×${W}×${H} мм` : "");

    const dims = vars
      .map((v) => fmt(v?.lengthMm, v?.widthMm, v?.heightMm))
      .filter(Boolean);

    const deviceDims = fmt(d?.lengthMm, d?.widthMm, d?.heightMm);
    if (dims.length === 0 && deviceDims) dims.push(deviceDims);

    return [...new Set(dims)];
  };

  const loadDevices = async () => {
    const data = await fetchDevices(undefined, undefined, undefined, 1, 1000);
    setDevices(data?.rows || data || []);
  };

  const loadAll = async () => {
    const [t, st, mk] = await Promise.all([
      fetchTypes(),
      fetchSubtypes(),
      fetchMakes(),
    ]);
    setTypes(t || []);
    setSubtypes(st || []);
    setMakes(mk || []);
    await loadDevices();
  };

  useEffect(() => {
    loadAll().catch(console.error);
  }, []);

  const handleEditDevice = (d) => {
    setEditableDevice(d);
    setDeviceVisible(true);
  };

  const handleCreateDevice = () => {
    setEditableDevice(null);
    setDeviceVisible(true);
  };

  const handleDeleteDevice = async (id) => {
    await deleteDevice(id);
    setDevices((prev) => prev.filter((x) => x.id !== id));
  };

  const handleToggleVisibility = async (id, next) => {
    const prev = devices;
    setDevices((p) =>
      p.map((d) => (d.id === id ? { ...d, isVisible: next } : d)),
    );
    try {
      await updateDeviceVisibility(id, next);
    } catch (e) {
      console.error(e);
      setDevices(prev);
      alert("Не удалось обновить видимость");
    }
  };

  const parseMaybeJSON = (v) => {
    if (typeof v === "string") {
      try {
        return JSON.parse(v);
      } catch {
        return v;
      }
    }
    return v;
  };

  const normVal = (x) =>
    x && typeof x === "object" && "value" in x ? x.value : x;

  const formatSelectedLabel = (selected = {}) => {
    const entries = Object.entries(selected).map(
      ([k, v]) => `${k}: ${normVal(v)}`,
    );
    return entries.length ? entries.join(", ") : "Вариант";
  };

  const getZeroVariants = (d) => {
    const vars = Array.isArray(d.variants)
      ? d.variants
      : parseMaybeJSON(d.variants) || [];
    return vars
      .filter((v) => (v?.isActive ?? true) && (Number(v?.quantity) || 0) <= 0)
      .map((v) => ({
        kind: "variant",
        label: formatSelectedLabel(parseMaybeJSON(v.selected)),
        raw: v,
      }));
  };

  const getCompatList = (d) => {
    if (!d) return [];
    if (Array.isArray(d.compat)) return d.compat;
    if (Array.isArray(d.compatibility)) return d.compatibility;
    if (Array.isArray(d.carCompat)) return d.carCompat;
    return [];
  };

  const loadModelsForMake = async (makeId) => {
    const list = await fetchModelsByMake(makeId);
    setModelsByMake((prev) => ({ ...prev, [makeId]: list }));
  };

  useEffect(() => {
    if (!devices?.length) return;

    const needMakeIds = new Set();
    for (const d of devices) {
      const compat = getCompatList(d);
      for (const c of compat) {
        const maybeMakeId =
          c?.makeId ?? c?.make?.id ?? c?.model?.makeId ?? null;
        if (maybeMakeId) needMakeIds.add(Number(maybeMakeId));
      }
    }

    [...needMakeIds].forEach((makeId) => {
      if (!modelsByMake[makeId]) {
        fetchModelsByMake(makeId)
          .then((list) =>
            setModelsByMake((prev) => ({ ...prev, [makeId]: list })),
          )
          .catch(console.error);
      }
    });
  }, [devices]);

  const getMakeName = (id) =>
    makes.find((m) => Number(m.id) === Number(id))?.name || `id-${id}`;

  const getModelName = (makeId, modelId) =>
    (modelsByMake[makeId] || []).find((mm) => Number(mm.id) === Number(modelId))
      ?.name || `id-${modelId}`;

  const getModelNameAny = (modelId) => {
    for (const arr of Object.values(modelsByMake)) {
      const hit = (arr || []).find((mm) => Number(mm.id) === Number(modelId));
      if (hit) return hit.name;
    }
    return `id-${modelId}`;
  };

  const makeKey = (typeId, makeId) => `t${typeId}-m${makeId}`;
  const modelKey = (typeId, makeId, modelId) =>
    `t${typeId}-m${makeId}-md${modelId ?? "none"}`;

  const isMakeOpen = (typeId, makeId) =>
    openMakeInType.has(makeKey(typeId, makeId));
  const isModelOpen = (typeId, makeId, modelId) =>
    openModelInMakeType.has(modelKey(typeId, makeId, modelId));

  const toggleMakeInType = (typeId, makeId) => {
    setOpenMakeInType((prev) => {
      const k = makeKey(typeId, makeId);
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

    if (!modelsByMake[makeId]) loadModelsForMake(makeId).catch(console.error);
  };

  const toggleModelInMakeType = (typeId, makeId, modelId) => {
    setOpenModelInMakeType((prev) => {
      const k = modelKey(typeId, makeId, modelId);
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  };

  const getDeviceTypeIds = (d) => {
    const ids = new Set();
    if (d.typeId) ids.add(Number(d.typeId));
    if (d.type?.id) ids.add(Number(d.type.id));
    if (Array.isArray(d.types))
      d.types.forEach((t) => t?.id && ids.add(Number(t.id)));
    return ids;
  };

  const getDeviceSubtypeIds = (d) => {
    const ids = new Set();
    if (d.subtypeId) ids.add(Number(d.subtypeId));
    if (d.subtype?.id) ids.add(Number(d.subtype.id));
    if (Array.isArray(d.subtypes))
      d.subtypes.forEach((s) => s?.id && ids.add(Number(s.id)));
    return ids;
  };

  const autoTypeId = useMemo(
    () => types.find((t) => /автотовары/i.test(t.name))?.id ?? null,
    [types],
  );

  const toggleDeviceType = (typeId) => {
    setOpenDeviceTypeIds((prev) =>
      prev.includes(typeId)
        ? prev.filter((id) => id !== typeId)
        : [...prev, typeId],
    );
  };

  const filteredDevices = useMemo(() => {
    return (devices || [])
      .filter((d) =>
        (d?.name || "").toLowerCase().includes(searchQuery.toLowerCase()),
      )
      .sort((a, b) => {
        if (sortOption === "priceAsc") return a.price - b.price;
        if (sortOption === "priceDesc") return b.price - a.price;
        if (sortOption === "nameAsc") return a.name.localeCompare(b.name);
        if (sortOption === "nameDesc") return b.name.localeCompare(a.name);
        return 0;
      });
  }, [devices, searchQuery, sortOption]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dayStart = (dateStr) => {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const isSnoozed = (d) => d.snoozeUntil && dayStart(d.snoozeUntil) >= today;
  const isExpired = (d) => d.expiryDate && dayStart(d.expiryDate) < today;

  const twoMonthsFromToday = new Date(today);
  twoMonthsFromToday.setMonth(twoMonthsFromToday.getMonth() + 2);

  const isExpiringWithin2Months = (d) => {
    if (!d.expiryDate) return false;
    const ed = dayStart(d.expiryDate);
    return ed >= today && ed <= twoMonthsFromToday;
  };

  const daysToExpire = (d) => {
    if (!d.expiryDate) return null;
    return Math.floor((dayStart(d.expiryDate) - today) / 86400000);
  };

  const expiryBadge = (d) => {
    const days = daysToExpire(d);
    if (days === null) return null;
    if (days < 0) return "просрочено";
    if (days === 0) return "истекает сегодня";
    return `${days} дн.`;
  };

  const attentionDevices = filteredDevices
    .filter(
      (d) => !isSnoozed(d) && (isExpired(d) || isExpiringWithin2Months(d)),
    )
    .sort((a, b) => (daysToExpire(a) ?? 9e9) - (daysToExpire(b) ?? 9e9));

  const outOfStockDevices = filteredDevices
    .map((d) => {
      const zeros = getZeroVariants(d);

      const rawVariants = Array.isArray(d.variants)
        ? d.variants
        : parseMaybeJSON(d.variants) || [];
      const activeVariants = rawVariants.filter((v) => v?.isActive ?? true);

      let completelyOut = false;
      if (activeVariants.length)
        completelyOut = activeVariants.every(
          (v) => (Number(v?.quantity) || 0) <= 0,
        );
      else completelyOut = (Number(d.quantity) || 0) <= 0;

      const show = !isSnoozed(d) && (completelyOut || zeros.length > 0);
      return show ? { device: d, zeros } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.device.name.localeCompare(b.device.name));

  const renderCompat = (d) => {
    const compat = getCompatList(d);
    if (!compat.length) return null;

    const makeIdFrom = (c) =>
      c?.makeId ?? c?.make?.id ?? c?.model?.makeId ?? null;
    const modelIdFrom = (c) => c?.modelId ?? c?.model?.id ?? null;

    const isUniversal = compat.some((c) => c?.isUniversal);
    if (isUniversal) {
      return (
        <div className={styles.compatRow}>
          <div className={styles.compatChips}>
            <span className={`${styles.compatChip} ${styles.compatUniversal}`}>
              Универсальный
            </span>
          </div>
        </div>
      );
    }

    return (
      <div className={styles.compatRow}>
        <div className={styles.compatChips}>
          {compat.map((c, i) => {
            const makeId = makeIdFrom(c);
            const modelId = modelIdFrom(c);

            const mk = c?.make?.name || (makeId ? getMakeName(makeId) : "");
            const md =
              c?.model?.name ||
              (modelId
                ? makeId
                  ? getModelName(makeId, modelId)
                  : getModelNameAny(modelId)
                : "");

            const years =
              c?.yearFrom || c?.yearTo
                ? ` (${c.yearFrom || "…"}–${c.yearTo || "…"})`
                : "";

            const label = [mk, md].filter(Boolean).join(" ");
            if (!label && !years) return null;

            return (
              <span key={i} className={styles.compatChip}>
                {label}
                {years}
              </span>
            );
          })}
        </div>
      </div>
    );
  };

  const DeviceRow = ({ d, onOpen }) => {
    const skus = getSkus(d);
    const locs = getLocations(d);
    const weights = getWeights(d);
    const dims = getDims(d);

    return (
      <div
        key={d.id}
        className={styles.item}
        onClick={() => onOpen?.(d.id)}
        style={{ cursor: "pointer" }}
      >
        <div>
          <span className={styles.idCell}>{d.id}</span>
          <Image
            className={styles.adminDeviceImg}
            width={50}
            height={50}
            src={d.img}
          />
        </div>
        <div className={styles.metaGrid}>
          {skus.length > 0 ? (
            <div className={styles.metaCell}>
              <b>SKU:</b> {skus.slice(0, 3).join(", ")}
              {skus.length > 3 ? ` …(+${skus.length - 3})` : ""}
            </div>
          ) : (
            <div className={`${styles.metaCell} ${styles.metaLineDanger}`}>
              SKU не назначен
            </div>
          )}

          {weights.length > 0 ? (
            <div className={styles.metaCell}>
              <b>Вес:</b>{" "}
              {weights.length === 1
                ? `${weights[0]} г`
                : `${Math.min(...weights)}–${Math.max(...weights)} г`}
            </div>
          ) : (
            <div className={`${styles.metaCell} ${styles.metaLineDanger}`}>
              <span className={styles.metaLineDanger}>Вес не назначен</span>
            </div>
          )}

          <div className={styles.metaCell}>
            <b>Локация:</b>{" "}
            {locs.length > 0 ? (
              <>
                {locs.slice(0, 3).join(", ")}
                {locs.length > 3 ? ` …(+${locs.length - 3})` : ""}
              </>
            ) : (
              <span className={styles.metaLineDanger}>не задана</span>
            )}
          </div>

          {dims.length > 0 && (
            <div className={styles.metaCell}>
              <b>Габариты:</b> {dims[0]}
              {dims.length > 1 ? ` …(+${dims.length - 1})` : ""}
            </div>
          )}
        </div>

        <span className={styles.adminDeviceName}>{d.name}</span>
        {renderCompat(d)}

        <div className={styles.buttons}>
          <div className={styles.adminDevicePrice}>
            {d.discount ? (
              <>
                <span className={styles.discountedPrice}>{d.price} €</span>
                <span className={styles.oldPrice}>{d.oldPrice} €</span>
              </>
            ) : (
              <span>{d.price} €</span>
            )}
          </div>

          <span className={styles.deviceQuantity}>
            {d.quantity === 0 ? (
              <span style={{ color: "red" }}>Нет в наличии</span>
            ) : (
              <span style={{ color: "green" }}>В наличии: {d.quantity}</span>
            )}
          </span>

          <button
            className={styles.editButton}
            onClick={(e) => {
              e.stopPropagation();
              handleEditDevice(d);
            }}
          >
            Редактировать
          </button>

          <button
            className={styles.deleteButton}
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm("Удалить этот товар?"))
                handleDeleteDevice(d.id);
            }}
          >
            Удалить
          </button>

          <label
            className={styles.toggleWrap}
            title="Показывать на витрине"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={!!d.isVisible}
              onChange={(e) => handleToggleVisibility(d.id, e.target.checked)}
            />
            <span className={styles.toggleSlider} />
          </label>
        </div>
      </div>
    );
  };
  return (
    <>
      <div className={styles.actionButtons}>
        <button onClick={handleCreateDevice} className={styles.actionButton}>
          Добавить устройство
        </button>

        <button
          onClick={() => setQuickAdjustVisible(true)}
          className={styles.actionButton}
          style={{ background: "#033977ff", borderColor: "#c8e1ff" }}
        >
          Остаток ±
        </button>
      </div>

      {attentionDevices.length > 0 && (
        <div className={styles.expBlock}>
          <div
            className={`${styles.typeHeader} ${styles.expHeader}`}
            onClick={() => setExpireOpen((v) => !v)}
            title="Показать/скрыть"
          >
            <h3
              className={styles.typeTitle}
              style={{ margin: 0, color: "#b45309" }}
            >
              Просрочено / истечёт ≤ 2 мес.
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className={styles.expCount}>{attentionDevices.length}</span>
              <span>{expireOpen ? "▲" : "▼"}</span>
            </div>
          </div>

          {expireOpen && (
            <div className={styles.itemList}>
              {attentionDevices.map((d) => (
                <div
                  key={d.id}
                  className={styles.item}
                  style={{ background: "#fff7ed", cursor: "pointer" }}
                  onClick={() => setSelectedDeviceId(d.id)}
                >
                  <div>
                    id-{d.id}
                    <Image
                      className={styles.adminDeviceImg}
                      width={50}
                      height={50}
                      src={d.img}
                    />
                  </div>

                  <span className={styles.adminDeviceName}>{d.name}</span>

                  <div className={styles.buttons}>
                    <span
                      style={{
                        color: "#b45309",
                        fontWeight: 600,
                        marginRight: 8,
                      }}
                    >
                      {expiryBadge(d)}
                    </span>

                    {d.expiryDate && (
                      <span style={{ color: "#666", marginRight: 12 }}>
                        до {new Date(d.expiryDate).toLocaleDateString("ru-RU")}
                      </span>
                    )}

                    <button
                      className={styles.editButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditDevice(d);
                      }}
                    >
                      Редактировать
                    </button>

                    <button
                      className={styles.deleteButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm("Удалить этот товар?"))
                          handleDeleteDevice(d.id);
                      }}
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {outOfStockDevices.length > 0 && (
        <div className={styles.outBlock}>
          <div
            className={`${styles.typeHeader} ${styles.outHeader}`}
            onClick={() => setOutOfOpen((v) => !v)}
            title="Показать/скрыть"
          >
            <h3
              className={styles.typeTitle}
              style={{ margin: 0, color: "#b91c1c" }}
            >
              Нет в наличии
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className={styles.outCount}>
                {outOfStockDevices.length}
              </span>
              <span>{outOfOpen ? "▲" : "▼"}</span>
            </div>
          </div>

          {outOfOpen && (
            <div className={styles.itemList}>
              {outOfStockDevices.map(({ device: d, zeros }) => (
                <div
                  key={d.id}
                  className={styles.item}
                  style={{ background: "#ffe5e5", cursor: "pointer" }}
                  onClick={() => setSelectedDeviceId(d.id)}
                >
                  <div>
                    id-{d.id}
                    <Image
                      className={styles.adminDeviceImg}
                      width={50}
                      height={50}
                      src={d.img}
                    />
                  </div>

                  <span className={styles.adminDeviceName}>{d.name}</span>
                  {renderCompat(d)}

                  {zeros.length > 0 && (
                    <div className={styles.zerosBlock}>
                      <div className={styles.zerosTitle}>Закончились:</div>
                      <div className={styles.zerosChips}>
                        {zeros.slice(0, 10).map((z, i) => (
                          <span key={i} className={styles.zeroChip}>
                            {z.label}
                          </span>
                        ))}
                        {zeros.length > 10 && (
                          <span className={styles.zerosMore}>
                            …и ещё {zeros.length - 10}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className={styles.buttons}>
                    <span
                      style={{ color: "red", fontWeight: 600, marginRight: 12 }}
                    >
                      нет в наличии
                    </span>

                    <div
                      className={styles.adminDevicePrice}
                      style={{ marginRight: 12 }}
                    >
                      {d.discount ? (
                        <>
                          <span className={styles.discountedPrice}>
                            {d.price} €
                          </span>
                          <span className={styles.oldPrice}>
                            {d.oldPrice} €
                          </span>
                        </>
                      ) : (
                        <span>{d.price} €</span>
                      )}
                    </div>

                    <label
                      className={styles.toggleWrap}
                      title="Показывать на витрине"
                      style={{ marginRight: 12 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        className={styles.toggleInput}
                        checked={!!d.isVisible}
                        onChange={(e) =>
                          handleToggleVisibility(d.id, e.target.checked)
                        }
                      />
                      <span className={styles.toggleSlider} />
                      <span className={styles.toggleLabel}>
                        {d.isVisible ? "Витрина: вкл" : "Витрина: выкл"}
                      </span>
                    </label>

                    <button
                      className={styles.editButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditDevice(d);
                      }}
                    >
                      Редактировать
                    </button>

                    <button
                      className={styles.deleteButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm("Удалить этот товар?"))
                          handleDeleteDevice(d.id);
                      }}
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className={styles.filterContainer}>
        <input
          type="text"
          placeholder="Поиск по названию..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <select
          onChange={(e) => setSortOption(e.target.value)}
          value={sortOption}
        >
          <option value="priceAsc">Цена (по возрастанию)</option>
          <option value="priceDesc">Цена (по убыванию)</option>
          <option value="nameAsc">Имя (А-Я)</option>
          <option value="nameDesc">Имя (Я-А)</option>
        </select>
      </div>

      {types.map((type) => {
        const subtypesForType = subtypes.filter((s) => s.typeId === type.id);
        const subtypeIdsOfType = new Set(
          subtypesForType.map((s) => Number(s.id)),
        );

        const typeDevices = filteredDevices.filter((d) => {
          const tIds = getDeviceTypeIds(d);
          const sIds = getDeviceSubtypeIds(d);
          const viaType = tIds.has(Number(type.id));
          const viaSubtype = [...sIds].some((id) => subtypeIdsOfType.has(id));
          return viaType || viaSubtype;
        });

        const isOpenType = openDeviceTypeIds.includes(type.id);
        const isAuto = Number(type.id) === Number(autoTypeId);

        const devicesWithoutSubtypeInThisType = !isAuto
          ? typeDevices.filter((d) => {
              const sIds = getDeviceSubtypeIds(d);
              const hasSubtypeOfThisType = [...sIds].some((id) =>
                subtypeIdsOfType.has(id),
              );
              const belongsViaType = getDeviceTypeIds(d).has(Number(type.id));
              return belongsViaType && !hasSubtypeOfThisType;
            })
          : [];

        const makesMap = new Map();
        const universalNoSubtype = [];
        const universalWithSubtype = [];

        const makeIdFrom = (c) =>
          c?.makeId ?? c?.make?.id ?? c?.model?.makeId ?? null;
        const modelIdFrom = (c) => c?.modelId ?? c?.model?.id ?? null;

        const hasSubtypeOfThisType = (d) => {
          const sIds = getDeviceSubtypeIds(d);
          for (const id of sIds)
            if (subtypeIdsOfType.has(Number(id))) return true;
          return false;
        };

        const pushUniversal = (d) => {
          if (hasSubtypeOfThisType(d)) universalWithSubtype.push(d);
          else universalNoSubtype.push(d);
        };

        if (isAuto) {
          for (const d of typeDevices) {
            const compat = getCompatList(d);

            if (!compat.length) {
              pushUniversal(d);
              continue;
            }

            let placed = false;

            for (const c of compat) {
              if (c?.isUniversal) {
                pushUniversal(d);
                placed = true;
                continue;
              }

              const mk = makeIdFrom(c);
              const mdMaybe = modelIdFrom(c);

              if (!mk && !mdMaybe) {
                pushUniversal(d);
                placed = true;
                continue;
              }

              if (!mk) continue;
              const md = mdMaybe ?? "__none__";
              if (!makesMap.has(mk)) makesMap.set(mk, new Map());
              const byModel = makesMap.get(mk);
              if (!byModel.has(md)) byModel.set(md, []);
              byModel.get(md).push(d);
              placed = true;
            }

            if (!placed) pushUniversal(d);
          }
        }

        const uniqueById = (arr) => {
          const seen = new Set();
          const out = [];
          for (const x of arr) {
            if (!seen.has(x.id)) {
              seen.add(x.id);
              out.push(x);
            }
          }
          return out;
        };

        const groupBySubtypeWithinType = (list) => {
          const m = new Map();
          for (const d of uniqueById(list)) {
            const sIds = getDeviceSubtypeIds(d);
            const idsOfThisType = [...sIds].filter((id) =>
              subtypeIdsOfType.has(Number(id)),
            );
            if (idsOfThisType.length === 0) {
              if (!m.has("__none__")) m.set("__none__", []);
              m.get("__none__").push(d);
            } else {
              for (const sid of idsOfThisType) {
                if (!m.has(sid)) m.set(sid, []);
                m.get(sid).push(d);
              }
            }
          }
          return m;
        };

        return (
          <div key={type.id} className={styles.typeGroup}>
            <div
              className={`${styles.typeHeader} ${styles.typeHeaderType}`}
              onClick={() => toggleDeviceType(type.id)}
              style={{
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                background: "#e8f0fe",
                padding: "10px",
                borderRadius: "5px",
                marginBottom: "5px",
              }}
            >
              <h5 className={styles.typeTitle}>{type.name}</h5>
              <span>{isOpenType ? "▲" : "▼"}</span>
            </div>

            {isOpenType && (
              <>
                {!isAuto && (
                  <>
                    {devicesWithoutSubtypeInThisType.length > 0 && (
                      <div className={styles.itemList}>
                        {devicesWithoutSubtypeInThisType.map((d) => (
                          <DeviceRow
                            key={d.id}
                            d={d}
                            onOpen={setSelectedDeviceId}
                          />
                        ))}
                      </div>
                    )}

                    {subtypesForType.map((subtype) => {
                      const subtypeDevices = typeDevices.filter((d) =>
                        getDeviceSubtypeIds(d).has(Number(subtype.id)),
                      );
                      if (!subtypeDevices.length) return null;

                      return (
                        <div key={subtype.id} className={styles.typeGroup}>
                          <h5 className={styles.subtypeTitle}>
                            {subtype.name}
                          </h5>
                          <div className={styles.itemList}>
                            {subtypeDevices.map((d) => (
                              <DeviceRow
                                key={d.id}
                                d={d}
                                onOpen={setSelectedDeviceId}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

                {isAuto && (
                  <>
                    {uniqueById(universalNoSubtype).length > 0 && (
                      <div
                        className={styles.typeGroup}
                        style={{ marginTop: 8 }}
                      >
                        <h5 className={styles.typeTitle}>Без подтипа</h5>
                        <div className={styles.itemList}>
                          {uniqueById(universalNoSubtype).map((d) => (
                            <DeviceRow
                              key={d.id}
                              d={d}
                              onOpen={setSelectedDeviceId}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {uniqueById(universalWithSubtype).length > 0 && (
                      <div
                        className={styles.typeGroup}
                        style={{ marginTop: 8 }}
                      >
                        <h5 className={styles.typeTitle}>Без марки/модели</h5>
                        {[
                          ...groupBySubtypeWithinType(
                            uniqueById(universalWithSubtype),
                          ),
                        ]
                          .filter(([key]) => key !== "__none__")
                          .map(([key, list]) => {
                            const title =
                              subtypesForType.find((s) => s.id === Number(key))
                                ?.name || `Подтип ${key}`;
                            return (
                              <div
                                key={`u-${String(key)}`}
                                style={{ marginBottom: 6 }}
                              >
                                <div className={styles.subtypeTitle}>
                                  {title}
                                </div>
                                <div className={styles.itemList}>
                                  {list.map((d) => (
                                    <DeviceRow
                                      key={d.id}
                                      d={d}
                                      onOpen={setSelectedDeviceId}
                                    />
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}

                    {[...makesMap.entries()].map(([makeId, byModel]) => {
                      const mkOpen = isMakeOpen(type.id, makeId);
                      const makeName = getMakeName(makeId);

                      return (
                        <div
                          key={`mk-${makeId}`}
                          className={styles.typeGroup}
                          style={{ marginTop: 10 }}
                        >
                          <div
                            className={`${styles.typeHeader} ${styles.typeHeaderMake}`}
                            onClick={() => toggleMakeInType(type.id, makeId)}
                            style={{
                              cursor: "pointer",
                              display: "flex",
                              justifyContent: "space-between",
                              background: "#f5f7ff",
                              padding: 10,
                              borderRadius: 5,
                            }}
                          >
                            <h5 className={styles.typeTitle}>{makeName}</h5>
                            <span>{mkOpen ? "▲" : "▼"}</span>
                          </div>

                          {mkOpen && (
                            <>
                              {[...byModel.entries()].map(
                                ([modelKeyId, list]) => {
                                  const modelId =
                                    modelKeyId === "__none__"
                                      ? null
                                      : Number(modelKeyId);
                                  const mdOpen = isModelOpen(
                                    type.id,
                                    makeId,
                                    modelId,
                                  );
                                  const modelName =
                                    modelId == null
                                      ? "Без модели"
                                      : getModelName(makeId, modelId);

                                  return (
                                    <div
                                      key={`md-${makeId}-${modelKeyId}`}
                                      className={styles.subtypeTitle}
                                      style={{ marginTop: 6 }}
                                    >
                                      <div
                                        className={`${styles.typeHeader} ${styles.typeHeaderModel}`}
                                        onClick={() =>
                                          toggleModelInMakeType(
                                            type.id,
                                            makeId,
                                            modelId,
                                          )
                                        }
                                        style={{
                                          cursor: "pointer",
                                          display: "flex",
                                          justifyContent: "space-between",
                                          background: "#eef2ff",
                                          padding: 8,
                                          borderRadius: 5,
                                        }}
                                      >
                                        <h6
                                          className={styles.typeTitle}
                                          style={{ margin: 0 }}
                                        >
                                          {modelName}
                                        </h6>
                                        <span>{mdOpen ? "▲" : "▼"}</span>
                                      </div>

                                      {mdOpen && (
                                        <div style={{ marginTop: 6 }}>
                                          {[
                                            ...groupBySubtypeWithinType(list),
                                          ].map(([key, items]) => {
                                            const title =
                                              key === "__none__"
                                                ? "Без подтипа"
                                                : subtypesForType.find(
                                                    (s) => s.id === Number(key),
                                                  )?.name || `Подтип ${key}`;

                                            return (
                                              <div
                                                key={`sg-${modelKeyId}-${String(key)}`}
                                                style={{ marginBottom: 6 }}
                                              >
                                                <div
                                                  style={{
                                                    fontWeight: 600,
                                                    margin: "6px 0",
                                                  }}
                                                >
                                                  {title}
                                                </div>
                                                <div
                                                  className={styles.itemList}
                                                >
                                                  {items.map((d) => (
                                                    <DeviceRow
                                                      key={d.id}
                                                      d={d}
                                                      onOpen={
                                                        setSelectedDeviceId
                                                      }
                                                    />
                                                  ))}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                },
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
              </>
            )}
          </div>
        );
      })}

      <StockQuickAdjustModal
        show={quickAdjustVisible}
        onHide={() => setQuickAdjustVisible(false)}
        devices={devices}
        onUpdated={(updated) => {
          setDevices((prev) =>
            prev.map((d) => (d.id === updated.id ? updated : d)),
          );
        }}
      />

      {selectedDeviceId && (
        <SlideModal onClose={() => setSelectedDeviceId(null)}>
          <Suspense fallback={<div style={{ padding: 16 }}>Загрузка…</div>}>
            <DevicePageLazy id={selectedDeviceId} />
          </Suspense>
        </SlideModal>
      )}

      <CreateDevice
        show={deviceVisible}
        onHide={() => {
          setDeviceVisible(false);
          loadDevices().catch(console.error);
        }}
        editableDevice={editableDevice}
        onDeviceSaved={() => {
          setEditableDevice(null);
        }}
      />
    </>
  );
};

export default AdminDevicesTab;
