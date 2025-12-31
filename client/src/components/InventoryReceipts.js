import React, { useEffect, useMemo, useState } from "react";
import {
  createReceipt,
  createWriteoff,
  fetchReceipts,
  fetchReceipt,
  deleteReceipt,
} from "../http/inventoryAPI";
import styles from "./InventoryReceipts.module.css";

const parseMaybeJSON = (v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return [];
    }
  }
  return v || [];
};

const normVal = (x) =>
  x && typeof x === "object" && "value" in x ? x.value : x;

const formatSelectedLabel = (selected = {}) => {
  const entries = Object.entries(selected).map(
    ([k, v]) => `${k}: ${normVal(v)}`
  );
  return entries.length ? entries.join(", ") : "Вариант";
};

const formatMoney = (n) => {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString("et-EE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const toDateTimeLocalValue = (d) => {
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
};

const getImgSrc = (img) => {
  if (!img) return "";
  if (/^https?:\/\//i.test(img)) return img;

  const base = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");
  if (!base) return img;

  if (img.startsWith("/")) return `${base}${img}`;
  return `${base}/${img}`;
};

function DeviceDropdown({ value, devices = [], onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = React.useRef(null);

  const selected = useMemo(
    () => (devices || []).find((d) => Number(d.id) === Number(value)) || null,
    [devices, value]
  );

  const list = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return (devices || [])
      .slice()
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
      .filter((d) => !qq || (d.name || "").toLowerCase().includes(qq))
      .slice(0, 200);
  }, [devices, q]);

  useEffect(() => {
    const onDown = (e) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  return (
    <div className={styles.irDrop} ref={ref}>
      <button
        type="button"
        className={styles.irDropBtn}
        onClick={() => setOpen((v) => !v)}
      >
        <div className={styles.irDropThumb}>
          {selected?.img ? (
            <img src={getImgSrc(selected.img)} alt="" />
          ) : (
            <div className={styles.irDropThumbPh}>no</div>
          )}
        </div>

        <div className={styles.irDropText}>
          <div className={styles.irDropName}>
            {selected ? selected.name : "— выбери товар —"}
          </div>
          <div className={styles.irDropMeta}>
            {selected ? `id-${selected.id}` : "кликни чтобы выбрать"}
          </div>
        </div>

        <div className={styles.irDropCaret}>{open ? "▲" : "▼"}</div>
      </button>

      {open && (
        <div className={styles.irDropMenu}>
          <input
            className={styles.irInput}
            placeholder="Поиск товара..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />

          <div className={styles.irDropList}>
            {list.length === 0 ? (
              <div className={styles.irDropEmpty}>Ничего не найдено</div>
            ) : (
              list.map((d) => {
                const active = Number(d.id) === Number(value);
                return (
                  <button
                    key={d.id}
                    type="button"
                    className={`${styles.irDropItem} ${
                      active ? styles.irDropItemActive : ""
                    }`}
                    onClick={() => {
                      onChange(String(d.id));
                      setOpen(false);
                    }}
                  >
                    <div className={styles.irDropThumb}>
                      {d.img ? (
                        <img src={getImgSrc(d.img)} alt="" />
                      ) : (
                        <div className={styles.irDropThumbPh}>no</div>
                      )}
                    </div>

                    <div className={styles.irDropText}>
                      <div className={styles.irDropName}>{d.name}</div>
                      <div className={styles.irDropMeta}>id-{d.id}</div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const InventoryReceipts = ({ devices = [], onPatchDevices }) => {
  const [mode, setMode] = useState("IN");

  const [receiptAt, setReceiptAt] = useState(toDateTimeLocalValue(new Date()));
  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("");

  const [items, setItems] = useState([
    {
      deviceId: "",
      variantId: "",
      quantity: 1,
      purchasePrice: "",
      purchaseHasVAT: false,

      _priceTouched: false,
      _vatTouched: false,
    },
  ]);

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState("");

  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [selectedLoading, setSelectedLoading] = useState(false);

  const devicesById = useMemo(() => {
    const m = new Map();
    (devices || []).forEach((d) => m.set(Number(d.id), d));
    return m;
  }, [devices]);

  const getVariant = (deviceId, variantId) => {
    const d = devicesById.get(Number(deviceId));
    if (!d) return null;
    const vars = parseMaybeJSON(d.variants);
    return (vars || []).find((v) => Number(v.id) === Number(variantId)) || null;
  };

  const getDefaultsForRow = (deviceId, variantId) => {
    const d = devicesById.get(Number(deviceId));
    if (!d) return { purchasePrice: "", purchaseHasVAT: false };

    let pp = d.purchasePrice != null ? String(d.purchasePrice) : "";
    let vat = !!d.purchaseHasVAT;

    if (variantId) {
      const v = getVariant(deviceId, variantId);
      if (v) {
        if (v.purchasePrice != null && v.purchasePrice !== "") {
          pp = String(v.purchasePrice);
        }
        if (v.purchaseHasVAT != null) {
          vat = !!v.purchaseHasVAT;
        }
      }
    }

    return { purchasePrice: pp, purchaseHasVAT: vat };
  };

  const loadList = async () => {
    setLoading(true);
    try {
      const rows = await fetchReceipts({ limit: 200 });
      const safe = rows || [];
      setList(safe);

      if (!selectedId && safe[0]?.id) {
        setSelectedId(safe[0].id);
        setSelectedLoading(true);
        try {
          const full = await fetchReceipt(safe[0].id);
          setSelected(full);
        } finally {
          setSelectedLoading(false);
        }
      }
    } catch (e) {
      console.error(e);
      alert(e.message || "Не удалось загрузить приходы");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
  }, []);

  const selectReceipt = async (id) => {
    setSelectedId(id);
    setSelectedLoading(true);
    try {
      const full = await fetchReceipt(id);
      setSelected(full);
    } catch (e) {
      console.error(e);
      alert(e.message || "Не удалось открыть документ");
      setSelected(null);
    } finally {
      setSelectedLoading(false);
    }
  };

  const addRow = () => {
    setItems((p) => [
      ...p,
      {
        deviceId: "",
        variantId: "",
        quantity: 1,
        purchasePrice: "",
        purchaseHasVAT: false,
        _priceTouched: false,
        _vatTouched: false,
      },
    ]);
  };

  const removeRow = (idx) => {
    setItems((p) => p.filter((_, i) => i !== idx));
  };

  const updateRow = (idx, patch) => {
    setItems((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;

        const next = { ...row, ...patch };

        if ("purchasePrice" in patch) next._priceTouched = true;
        if ("purchaseHasVAT" in patch) next._vatTouched = true;

        const deviceChanged =
          "deviceId" in patch && patch.deviceId !== row.deviceId;
        const variantChanged =
          "variantId" in patch && patch.variantId !== row.variantId;

        if (deviceChanged && !("variantId" in patch)) {
          next.variantId = "";
        }

        const deviceId = next.deviceId;
        const variantId = next.variantId;

        if (deviceId) {
          const defs = getDefaultsForRow(deviceId, variantId);

          if (
            !next._priceTouched &&
            (next.purchasePrice === "" || deviceChanged || variantChanged)
          ) {
            next.purchasePrice = defs.purchasePrice;
          }

          if (!next._vatTouched && (deviceChanged || variantChanged)) {
            next.purchaseHasVAT = defs.purchaseHasVAT;
          }
        }

        return next;
      })
    );
  };

  const variantsForDevice = (deviceId) => {
    const d = devicesById.get(Number(deviceId));
    if (!d) return [];
    const vars = parseMaybeJSON(d.variants);
    return (vars || [])
      .filter((v) => v?.isActive ?? true)
      .map((v) => ({
        id: Number(v.id),
        label: `${formatSelectedLabel(parseMaybeJSON(v.selected || {}))}${
          v.sku ? ` (SKU: ${v.sku})` : ""
        }`,
      }));
  };

  const calcRowTotal = (row) => {
    const qn = Math.abs(Number(row.quantity || 0));
    const p = Number(row.purchasePrice || 0);
    if (!qn || !p) return 0;

    const sign = mode === "OUT" ? -1 : 1;
    return sign * qn * p;
  };

  const totalSum = useMemo(
    () => items.reduce((s, r) => s + calcRowTotal(r), 0),
    [items, mode]
  );

  const handleCreate = async () => {
    const clean = items
      .map((r) => ({
        deviceId: Number(r.deviceId || 0),
        variantId: r.variantId ? Number(r.variantId) : null,
        quantity: Math.abs(Number(r.quantity || 0)),
        purchasePrice: Number(r.purchasePrice || 0),
        purchaseHasVAT: !!r.purchaseHasVAT,
      }))
      .filter((x) => x.deviceId && x.quantity > 0);

    if (!clean.length)
      return alert("Добавь хотя бы одну позицию (товар + кол-во).");

    for (const x of clean) {
      if (!Number.isFinite(x.purchasePrice) || x.purchasePrice <= 0) {
        return alert(
          "Укажи корректную закупочную цену (> 0) для всех позиций."
        );
      }
    }

    const dayKey = receiptAt
      ? receiptAt.split("T")[0]
      : toDateTimeLocalValue(new Date()).split("T")[0];

    try {
      const payload = {
        kind: mode,
        dayKey,
        receiptAt: receiptAt
          ? new Date(receiptAt).toISOString()
          : new Date().toISOString(),
        supplier: supplier.trim() || null,
        note: note.trim() || null,
        items: clean,
      };

      const created =
        mode === "OUT"
          ? await createWriteoff(payload)
          : await createReceipt(payload);
      const patchRows = clean.map((x) => ({
        ...x,
        quantity: mode === "OUT" ? -Math.abs(x.quantity) : Math.abs(x.quantity),
      }));
      onPatchDevices?.(patchRows);

      setSupplier("");
      setNote("");
      setReceiptAt(toDateTimeLocalValue(new Date()));
      setItems([
        {
          deviceId: "",
          variantId: "",
          quantity: 1,
          purchasePrice: "",
          purchaseHasVAT: false,
          _priceTouched: false,
          _vatTouched: false,
        },
      ]);

      await loadList();

      if (created?.id) {
        await selectReceipt(created.id);
      }
    } catch (e) {
      console.error(e);
      alert(e.message || "Не удалось сохранить документ");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Удалить документ? Остатки будут откатаны назад."))
      return;
    try {
      await deleteReceipt(id);
      setSelectedId(null);
      setSelected(null);
      await loadList();
      alert("Удалено");
    } catch (e) {
      console.error(e);
      alert(e.message || "Не удалось удалить");
    }
  };

  const filteredList = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return list;

    return (list || []).filter((r) => {
      const dt = r.receiptAt
        ? new Date(r.receiptAt).toLocaleString("ru-RU")
        : "";
      return (
        String(r.id).includes(qq) ||
        String(r.supplier || "")
          .toLowerCase()
          .includes(qq) ||
        String(r.note || "")
          .toLowerCase()
          .includes(qq) ||
        dt.toLowerCase().includes(qq)
      );
    });
  }, [list, q]);

  const [openYears, setOpenYears] = useState(() => {
    const y = String(new Date().getFullYear());
    return new Set([y]);
  });

  const [openMonths, setOpenMonths] = useState(() => {
    const d = new Date();
    const y = String(d.getFullYear());
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return new Set([`${y}-${m}`]);
  });

  const getYearKey = (r) => {
    const dt = r?.receiptAt ? new Date(r.receiptAt) : null;
    return dt && !Number.isNaN(dt.getTime())
      ? String(dt.getFullYear())
      : "Без даты";
  };

  const getMonthKey = (r) => {
    const dt = r?.receiptAt ? new Date(r.receiptAt) : null;
    if (!dt || Number.isNaN(dt.getTime())) return "Без даты";
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`; // YYYY-MM
  };

  const monthLabel = (monthKey) => {
    if (monthKey === "Без даты") return "Без даты";
    const [y, m] = monthKey.split("-").map(Number);
    const d = new Date(y, (m || 1) - 1, 1);
    const txt = d.toLocaleString("ru-RU", { month: "long" });
    return txt.charAt(0).toUpperCase() + txt.slice(1);
  };

  const calcDocSum = (r) => {
    const kind = detectKind(r);
    const sign = kind === "OUT" ? -1 : 1;
    return (r.items || []).reduce((s, it) => {
      const qty = Math.abs(Number(it.quantity || 0));
      const pp = Number(it.purchasePrice || 0);
      return s + sign * qty * pp;
    }, 0);
  };

  const groupedByYearMonth = useMemo(() => {
    const byYear = new Map();
    for (const r of filteredList) {
      const y = getYearKey(r);
      const m = getMonthKey(r);

      if (!byYear.has(y)) byYear.set(y, new Map());
      const byMonth = byYear.get(y);

      if (!byMonth.has(m)) byMonth.set(m, []);
      byMonth.get(m).push(r);
    }

    return Array.from(byYear.entries()).map(([year, byMonth]) => [
      year,
      Array.from(byMonth.entries()),
    ]);
  }, [filteredList]);

  const toggleYear = (y) => {
    setOpenYears((prev) => {
      const next = new Set(prev);
      next.has(y) ? next.delete(y) : next.add(y);
      return next;
    });
  };

  const toggleMonth = (monthKey) => {
    setOpenMonths((prev) => {
      const next = new Set(prev);
      next.has(monthKey) ? next.delete(monthKey) : next.add(monthKey);
      return next;
    });
  };

  useEffect(() => {
    if (!selected?.receiptAt) return;
    const dt = new Date(selected.receiptAt);
    if (Number.isNaN(dt.getTime())) return;

    const y = String(dt.getFullYear());
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const mk = `${y}-${m}`;

    setOpenYears((prev) => (prev.has(y) ? prev : new Set([...prev, y])));
    setOpenMonths((prev) => (prev.has(mk) ? prev : new Set([...prev, mk])));
  }, [selected?.id]);

  const detectKind = (r) => {
    if (r?.kind === "OUT" || r?.type === "OUT") return "OUT";
    if (r?.kind === "IN" || r?.type === "IN") return "IN";
    const hasNeg = (r?.items || []).some((it) => Number(it.quantity || 0) < 0);
    return hasNeg ? "OUT" : "IN";
  };

  return (
    <div className={styles.irPage}>
      <div className={styles.irCard}>
        <div
          className={styles.irRow}
          style={{ justifyContent: "space-between", marginBottom: 10 }}
        >
          <div className={styles.irTitle}>📦 Складские документы</div>

          <div className={styles.irRow}>
            <button
              type="button"
              className={`${styles.irBtn} ${
                mode === "IN" ? styles.irBtnPrimary : ""
              }`}
              onClick={() => setMode("IN")}
              title="Приход (увеличить остатки)"
            >
              Приход
            </button>
            <button
              type="button"
              className={`${styles.irBtn} ${
                mode === "OUT" ? styles.irBtnDanger : ""
              }`}
              onClick={() => setMode("OUT")}
              title="Списание (уменьшить остатки)"
            >
              Списание
            </button>
          </div>
        </div>

        <div className={styles.irFormGrid}>
          <div>
            <div className={styles.irMuted} style={{ marginBottom: 4 }}>
              Дата/время
            </div>
            <input
              type="datetime-local"
              value={receiptAt}
              onChange={(e) => setReceiptAt(e.target.value)}
              className={styles.irInput}
            />
          </div>

          <div>
            <div className={styles.irMuted} style={{ marginBottom: 4 }}>
              {mode === "IN" ? "Поставщик (опц.)" : "Причина (опц.)"}
            </div>
            <input
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className={styles.irInput}
              placeholder={
                mode === "IN"
                  ? "Напр. Kaubamaja / Omniva / ..."
                  : "Напр. брак / просрочка / утеря"
              }
            />
          </div>

          <div>
            <div className={styles.irMuted} style={{ marginBottom: 4 }}>
              Комментарий (опц.)
            </div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={styles.irInput}
              placeholder="Любая заметка"
            />
          </div>
        </div>

        <div style={{ marginTop: 12, fontWeight: 700 }}>Позиции</div>

        <div className={styles.irItemsGrid}>
          {items.map((row, idx) => {
            const vars = row.deviceId ? variantsForDevice(row.deviceId) : [];
            return (
              <div key={idx} className={styles.irItemRow}>
                <DeviceDropdown
                  value={row.deviceId}
                  devices={devices}
                  onChange={(id) =>
                    updateRow(idx, { deviceId: id, variantId: "" })
                  }
                />

                <select
                  value={row.variantId}
                  onChange={(e) =>
                    updateRow(idx, { variantId: e.target.value })
                  }
                  disabled={!row.deviceId || vars.length === 0}
                  className={styles.irSelect}
                >
                  <option value="">
                    {vars.length ? "— без варианта —" : "— вариантов нет —"}
                  </option>
                  {vars.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  min="1"
                  value={row.quantity}
                  onChange={(e) => updateRow(idx, { quantity: e.target.value })}
                  className={styles.irInput}
                />

                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={row.purchasePrice}
                  onChange={(e) =>
                    updateRow(idx, { purchasePrice: e.target.value })
                  }
                  className={styles.irInput}
                  placeholder="Закуп. цена"
                />

                <label className={styles.irRow} style={{ fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={!!row.purchaseHasVAT}
                    onChange={(e) =>
                      updateRow(idx, { purchaseHasVAT: e.target.checked })
                    }
                  />
                  цена с НДС
                </label>

                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  disabled={items.length === 1}
                  className={styles.irBtn}
                  title="Удалить строку"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>

        <div
          className={styles.irRow}
          style={{ justifyContent: "space-between", marginTop: 12 }}
        >
          <button type="button" onClick={addRow} className={styles.irBtn}>
            ➕ Добавить позицию
          </button>

          <div className={styles.irRow}>
            <div style={{ fontWeight: 800 }}>
              Итого: {formatMoney(totalSum)} €
            </div>
            <button
              type="button"
              onClick={handleCreate}
              className={`${styles.irBtn} ${
                mode === "OUT" ? styles.irBtnDanger : styles.irBtnPrimary
              }`}
            >
              {mode === "OUT" ? "✅ Списать" : "✅ Сохранить приход"}
            </button>
          </div>
        </div>
      </div>

      <div className={styles.irSplit}>
        <div className={styles.irCard}>
          <div className={styles.irListHeader}>
            <div className={styles.irTitle}>🗓 История</div>
            <button type="button" onClick={loadList} className={styles.irBtn}>
              🔄
            </button>
          </div>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={styles.irInput}
            placeholder="Поиск: №, поставщик, заметка..."
            style={{ marginBottom: 10 }}
          />

          {loading ? (
            <div>Загрузка…</div>
          ) : filteredList.length === 0 ? (
            <div className={styles.irMuted}>Пока нет документов</div>
          ) : (
            <div className={styles.irListBody}>
              {groupedByYearMonth.map(([year, months]) => {
                const searchOn = !!q.trim();
                const yearOpened = searchOn ? true : openYears.has(year);

                const yearSum = months.reduce(
                  (ys, [, rows]) =>
                    ys + rows.reduce((s, r) => s + calcDocSum(r), 0),
                  0
                );
                const yearCount = months.reduce(
                  (c, [, rows]) => c + rows.length,
                  0
                );

                return (
                  <div key={year} className={styles.irYearBlock}>
                    <button
                      type="button"
                      className={styles.irYearHeader}
                      onClick={() => toggleYear(year)}
                    >
                      <div
                        className={styles.irRow}
                        style={{ justifyContent: "space-between" }}
                      >
                        <div style={{ fontWeight: 900 }}>
                          {yearOpened ? "▼" : "▶"} {year}
                          <span
                            className={styles.irMuted}
                            style={{ marginLeft: 8 }}
                          >
                            • документов: {yearCount}
                          </span>
                        </div>
                        <span className={styles.irBadge}>
                          {formatMoney(yearSum)} €
                        </span>
                      </div>
                    </button>

                    {yearOpened ? (
                      <div className={styles.irMonthWrap}>
                        {months.map(([monthKey, rows]) => {
                          const monthOpened = searchOn
                            ? true
                            : openMonths.has(monthKey);
                          const mSum = rows.reduce(
                            (s, r) => s + calcDocSum(r),
                            0
                          );

                          return (
                            <div key={monthKey} className={styles.irMonthBlock}>
                              <button
                                type="button"
                                className={styles.irMonthHeader}
                                onClick={() => toggleMonth(monthKey)}
                              >
                                <div
                                  className={styles.irRow}
                                  style={{ justifyContent: "space-between" }}
                                >
                                  <div style={{ fontWeight: 800 }}>
                                    {monthOpened ? "▼" : "▶"}{" "}
                                    {monthLabel(monthKey)}
                                    <span
                                      className={styles.irMuted}
                                      style={{ marginLeft: 8 }}
                                    >
                                      • документов: {rows.length}
                                    </span>
                                  </div>
                                  <span className={styles.irBadge}>
                                    {formatMoney(mSum)} €
                                  </span>
                                </div>
                              </button>

                              {monthOpened ? (
                                <div className={styles.irMonthList}>
                                  {rows.map((r) => {
                                    const dt = r.receiptAt
                                      ? new Date(r.receiptAt)
                                      : null;
                                    const title = dt
                                      ? dt.toLocaleString("ru-RU")
                                      : `id-${r.id}`;
                                    const count = (r.items || []).length;

                                    const kind = detectKind(r);
                                    const sum = calcDocSum(r);
                                    const active = selectedId === r.id;

                                    return (
                                      <button
                                        key={r.id}
                                        type="button"
                                        onClick={() => selectReceipt(r.id)}
                                        className={`${styles.irListItem} ${
                                          active ? styles.irListItemActive : ""
                                        }`}
                                      >
                                        <div
                                          className={styles.irRow}
                                          style={{
                                            justifyContent: "space-between",
                                          }}
                                        >
                                          <div style={{ fontWeight: 800 }}>
                                            № {r.id}{" "}
                                            <span
                                              className={styles.irMuted}
                                              style={{ marginLeft: 8 }}
                                            >
                                              {kind === "OUT"
                                                ? "списание"
                                                : "приход"}
                                            </span>
                                          </div>
                                          <div className={styles.irMuted}>
                                            {title}
                                          </div>
                                        </div>

                                        <div
                                          className={styles.irRow}
                                          style={{
                                            justifyContent: "space-between",
                                            marginTop: 6,
                                          }}
                                        >
                                          <div className={styles.irMuted}>
                                            {r.supplier ? r.supplier : "—"}
                                            {count
                                              ? ` • позиций: ${count}`
                                              : ""}
                                          </div>
                                          <span className={styles.irBadge}>
                                            {formatMoney(sum)} €
                                          </span>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={styles.irCard}>
          {!selectedId ? (
            <div className={styles.irMuted}>Выбери документ слева</div>
          ) : selectedLoading ? (
            <div>Загрузка…</div>
          ) : !selected ? (
            <div className={styles.irMuted}>Нет данных</div>
          ) : (
            <>
              {(() => {
                const kind = detectKind(selected);
                return (
                  <div
                    className={styles.irRow}
                    style={{ justifyContent: "space-between", marginBottom: 8 }}
                  >
                    <div>
                      <div className={styles.irTitle}>
                        📄 Документ № {selected.id}{" "}
                        <span
                          className={styles.irMuted}
                          style={{ marginLeft: 8 }}
                        >
                          ({kind === "OUT" ? "списание" : "приход"})
                        </span>
                      </div>
                      <div className={styles.irMuted} style={{ marginTop: 2 }}>
                        {selected.receiptAt
                          ? new Date(selected.receiptAt).toLocaleString("ru-RU")
                          : ""}
                        {selected.supplier ? ` • ${selected.supplier}` : ""}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(selected.id)}
                      className={`${styles.irBtn} ${styles.irBtnDanger}`}
                    >
                      Удалить
                    </button>
                  </div>
                );
              })()}

              {selected.note ? (
                <div style={{ marginBottom: 8 }}>📝 {selected.note}</div>
              ) : null}

              {(() => {
                const docKind = detectKind(selected);
                const docSign = docKind === "OUT" ? -1 : 1;

                const docTotal = (selected.items || []).reduce((s, it) => {
                  const qty = Math.abs(Number(it.quantity || 0));
                  const pp = Number(it.purchasePrice || 0);
                  return s + docSign * qty * pp;
                }, 0);

                return (
                  <table className={styles.irTable}>
                    <thead>
                      <tr>
                        <th>Товар</th>
                        <th>Вариант</th>
                        <th>Кол-во</th>
                        <th>Закупка</th>
                        <th>Сумма</th>
                      </tr>
                    </thead>

                    <tbody>
                      {(selected.items || []).map((it) => {
                        const devName =
                          it.device?.name || `deviceId ${it.deviceId}`;

                        const varLabel = it.variant?.selected
                          ? formatSelectedLabel(
                              parseMaybeJSON(it.variant.selected)
                            )
                          : it.variantId
                          ? `variantId ${it.variantId}`
                          : "—";

                        const qty =
                          docSign * Math.abs(Number(it.quantity || 0));
                        const pp = Number(it.purchasePrice || 0);
                        const line = Math.abs(qty) * pp;

                        return (
                          <tr key={it.id}>
                            <td>{devName}</td>
                            <td>{varLabel}</td>
                            <td>{qty}</td>
                            <td>
                              {formatMoney(pp)} €{" "}
                              {it.purchaseHasVAT ? "(НДС)" : ""}
                            </td>
                            <td>{formatMoney(line)} €</td>
                          </tr>
                        );
                      })}

                      <tr>
                        <td
                          colSpan={4}
                          style={{ textAlign: "right", fontWeight: 900 }}
                        >
                          Итого по документу:
                        </td>
                        <td style={{ fontWeight: 900 }}>
                          {formatMoney(docTotal)} €
                        </td>
                      </tr>
                    </tbody>
                  </table>
                );
              })()}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default InventoryReceipts;
