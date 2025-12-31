import React, { useEffect, useMemo, useState } from "react";
import { createReceipt, createWriteoff } from "../../http/inventoryAPI";

export default function StockQuickAdjustModal({
  show,
  onHide,
  devices = [],
  onUpdated,
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [action, setAction] = useState("add");
  const [qty, setQty] = useState(1);

  const [optionName, setOptionName] = useState("");
  const [optionValue, setOptionValue] = useState("");
  const [selectedVariantIndex, setSelectedVariantIndex] = useState("");

  useEffect(() => {
    if (!show) {
      setQuery("");
      setSelectedId(null);
      setSelectedDevice(null);
      setAction("add");
      setQty(1);
      setOptionName("");
      setOptionValue("");
      setSelectedVariantIndex("");
    }
  }, [show]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = Array.isArray(devices) ? devices : [];
    if (!q) return list.slice(0, 200);
    return list
      .filter((d) => (d.name || "").toLowerCase().includes(q))
      .slice(0, 200);
  }, [devices, query]);

  const normalizedOptions = useMemo(() => {
    if (!selectedDevice) return [];
    const raw = selectedDevice.options;
    let arr = [];
    if (Array.isArray(raw)) arr = raw;
    else if (typeof raw === "string") {
      try {
        arr = JSON.parse(raw) || [];
      } catch {
        arr = [];
      }
    }
    return Array.isArray(arr) ? arr : [];
  }, [selectedDevice]);

  const normalizedVariants = useMemo(() => {
    if (!selectedDevice) return [];
    let raw = selectedDevice.variants;
    if (!raw) return [];
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw) || [];
      } catch {
        raw = [];
      }
    }
    return Array.isArray(raw) ? raw : [];
  }, [selectedDevice]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedDevice(null);
      setOptionName("");
      setOptionValue("");
      setSelectedVariantIndex("");
      return;
    }
    const d = (devices || []).find((x) => x.id === Number(selectedId));
    setSelectedDevice(d || null);

    setOptionName("");
    setOptionValue("");
    setSelectedVariantIndex("");
  }, [selectedId, devices]);

  const hasOptions = normalizedOptions.length > 0;
  const hasVariants = normalizedVariants.length > 0;

  const currentOption = hasOptions
    ? normalizedOptions.find((o) => o.name === optionName)
    : null;

  const normVal = (x) =>
    x && typeof x === "object" && "value" in x ? x.value : x;

  const formatVariantLabel = (v, idx) => {
    if (v?.selected && typeof v.selected === "object") {
      const parts = Object.entries(v.selected).map(
        ([k, val]) => `${k}: ${normVal(val)}`
      );
      if (parts.length) return parts.join(", ");
    }
    return v?.sku || `Вариант #${idx + 1}`;
  };

  const getPurchaseDefaults = (device, variant) => {
    const price =
      variant?.purchasePrice ??
      device?.purchasePrice ??
      device?.purchase_price ??
      "";
    const hasVAT =
      variant?.purchaseHasVAT ??
      device?.purchaseHasVAT ??
      device?.purchase_has_vat ??
      false;

    return {
      purchasePrice: Number(price) || 0,
      purchaseHasVAT: !!hasVAT,
    };
  };

  const submit = async () => {
    const n = parseInt(qty, 10);
    if (!Number.isInteger(n) || n <= 0) {
      alert("Количество должно быть целым > 0");
      return;
    }
    if (!selectedDevice) {
      alert("Выберите товар");
      return;
    }

    const delta = action === "add" ? n : -n;

    let selectedOptions;
    let updatedDevice = { ...selectedDevice };

    let usedVariantId = null;
    let usedVariant = null;

    if (hasVariants) {
      if (selectedVariantIndex === "" || selectedVariantIndex === null) {
        alert("Выберите вариант");
        return;
      }
      const vIdx = Number(selectedVariantIndex);
      const variant = normalizedVariants[vIdx];
      if (!variant) {
        alert("Вариант не найден");
        return;
      }

      usedVariant = variant;
      usedVariantId = variant?.id ? Number(variant.id) : null;

      selectedOptions = variant.selected || {};

      const variantsCopy = normalizedVariants.map((v) => ({ ...v }));
      const vCopy = { ...variantsCopy[vIdx] };
      vCopy.quantity = (Number(vCopy.quantity) || 0) + delta;
      variantsCopy[vIdx] = vCopy;
      updatedDevice.variants = variantsCopy;
    } else if (hasOptions) {
      if (!optionName) {
        alert("Выберите опцию");
        return;
      }
      if (!optionValue) {
        alert("Выберите значение опции");
        return;
      }
      selectedOptions = { [optionName]: optionValue };

      const optionsCopy = normalizedOptions.map((o) => ({
        ...o,
        values: (o.values || []).map((v) => ({ ...v })),
      }));

      const optIdx = optionsCopy.findIndex((o) => o.name === optionName);
      const valIdx =
        optIdx >= 0
          ? optionsCopy[optIdx].values.findIndex((v) => v.value === optionValue)
          : -1;

      if (optIdx >= 0 && valIdx >= 0) {
        const cur = Number(optionsCopy[optIdx].values[valIdx].quantity) || 0;
        optionsCopy[optIdx].values[valIdx].quantity = cur + delta;
      }

      updatedDevice.options = optionsCopy;
    }

    const baseQ = Number(updatedDevice.quantity ?? 0) || 0;
    updatedDevice.quantity = baseQ + delta;

    try {
      const { purchasePrice, purchaseHasVAT } = getPurchaseDefaults(
        selectedDevice,
        usedVariant
      );

      const payload = {
        kind: delta > 0 ? "IN" : "OUT",
        receiptAt: new Date().toISOString(),
        supplier: "Admin quick adjust",
        note: `Корректировка остатков из админки (${
          delta > 0 ? "+" : ""
        }${delta})`,
        items: [
          {
            deviceId: Number(selectedDevice.id),
            variantId: usedVariantId,
            quantity: Math.abs(delta),
            purchasePrice: purchasePrice,
            purchaseHasVAT: purchaseHasVAT,
          },
        ],
      };

      if (delta > 0) await createReceipt(payload);
      else await createWriteoff(payload);

      onUpdated?.(updatedDevice);
      setSelectedDevice(updatedDevice);
    } catch (e) {
      console.error(e);
      alert(
        e?.response?.data?.message ||
          e?.message ||
          "Не удалось изменить остаток"
      );
    }
  };

  if (!show) return null;

  return (
    <div style={backdropStyle}>
      <div style={modalStyle}>
        <h3 style={{ marginTop: 0 }}>Изменить остаток</h3>

        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Поиск товара</label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Начните вводить имя…"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Товар</label>
          <div style={deviceListStyle}>
            {filtered.length === 0 && (
              <div style={{ padding: 8, fontSize: 13, color: "#666" }}>
                Ничего не найдено
              </div>
            )}

            {filtered.map((d) => {
              const isActive = Number(selectedId) === Number(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelectedId(d.id)}
                  style={{
                    ...deviceRowStyle,
                    backgroundColor: isActive ? "#e4f0ff" : "#fff",
                    borderColor: isActive ? "#4a90e2" : "#ddd",
                  }}
                >
                  <div style={thumbWrapStyle}>
                    {d.img ? (
                      <img
                        src={d.img}
                        alt={d.name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    ) : (
                      <div style={thumbPlaceholderStyle}>no img</div>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{ fontSize: 12, color: "#666", marginBottom: 2 }}
                    >
                      #{d.id}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {d.name}
                    </div>
                    <div style={{ fontSize: 12, color: "#333" }}>
                      В наличии: <strong>{d.quantity ?? 0}</strong>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {normalizedVariants.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Вариант</label>
            <select
              value={selectedVariantIndex}
              onChange={(e) => setSelectedVariantIndex(e.target.value)}
              style={inputStyle}
            >
              <option value="">— выберите вариант —</option>
              {normalizedVariants.map((v, idx) => (
                <option key={v.key || idx} value={idx}>
                  {formatVariantLabel(v, idx)}
                  {typeof v.quantity === "number"
                    ? ` (остаток: ${v.quantity})`
                    : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {normalizedVariants.length === 0 && normalizedOptions.length > 0 && (
          <>
            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>Опция</label>
              <select
                value={optionName}
                onChange={(e) => {
                  setOptionName(e.target.value);
                  setOptionValue("");
                }}
                style={inputStyle}
              >
                <option value="">— выберите опцию —</option>
                {normalizedOptions.map((o) => (
                  <option key={o.name} value={o.name}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            {!!optionName && (
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Значение</label>
                <select
                  value={optionValue}
                  onChange={(e) => setOptionValue(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">— выберите значение —</option>
                  {(currentOption?.values || []).map((v) => (
                    <option key={v.value} value={v.value}>
                      {v.value}{" "}
                      {typeof v.quantity === "number"
                        ? ` (остаток: ${v.quantity})`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <label style={radioLabel}>
            <input
              type="radio"
              name="act"
              checked={action === "add"}
              onChange={() => setAction("add")}
            />{" "}
            Прибавить
          </label>
          <label style={radioLabel}>
            <input
              type="radio"
              name="act"
              checked={action === "remove"}
              onChange={() => setAction("remove")}
            />{" "}
            Списать
          </label>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Количество</label>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={submit} className="btn btn-primary">
            Сохранить
          </button>
          <button onClick={onHide} className="btn btn-secondary">
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

const backdropStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.35)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};
const modalStyle = {
  background: "#fff",
  borderRadius: 8,
  padding: 16,
  width: 520,
  maxWidth: "90vw",
};
const labelStyle = {
  display: "block",
  fontSize: 13,
  color: "#444",
  marginBottom: 4,
};
const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #925151ff",
  borderRadius: 6,
};
const radioLabel = { display: "flex", alignItems: "center", gap: 6 };

const deviceListStyle = {
  border: "1px solid #925151ff",
  borderRadius: 6,
  maxHeight: 260,
  overflowY: "auto",
  background: "#fff",
};

const deviceRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  textAlign: "left",
  padding: 6,
  borderBottom: "1px solid #eee",
  borderRadius: 0,
  borderLeft: "none",
  borderRight: "none",
  borderTop: "none",
  cursor: "pointer",
  outline: "none",
};

const thumbWrapStyle = {
  width: 44,
  height: 44,
  borderRadius: 6,
  overflow: "hidden",
  border: "1px solid #ddd",
  flexShrink: 0,
};

const thumbPlaceholderStyle = {
  width: "100%",
  height: "100%",
  fontSize: 10,
  color: "#999",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#f5f5f5",
};
