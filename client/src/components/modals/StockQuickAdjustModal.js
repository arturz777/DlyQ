import React, { useEffect, useMemo, useState } from "react";
import { adjustDeviceStock } from "../../http/deviceAPI";

export default function StockQuickAdjustModal({ show, onHide, devices = [], onUpdated }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [action, setAction] = useState("add");
  const [qty, setQty] = useState(1);

  const [optionName, setOptionName] = useState("");
  const [optionValue, setOptionValue] = useState("");

  useEffect(() => {
    if (!show) {
      setQuery("");
      setSelectedId(null);
      setSelectedDevice(null);
      setAction("add");
      setQty(1);
      setOptionName("");
      setOptionValue("");
    }
  }, [show]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = Array.isArray(devices) ? devices : [];
    if (!q) return list.slice(0, 200);
    return list.filter(d => (d.name || "").toLowerCase().includes(q)).slice(0, 200);
  }, [devices, query]);

  const normalizedOptions = useMemo(() => {
    if (!selectedDevice) return [];
    const raw = selectedDevice.options;
    let arr = [];
    if (Array.isArray(raw)) arr = raw;
    else if (typeof raw === "string") { try { arr = JSON.parse(raw) || []; } catch { arr = []; } }
    return Array.isArray(arr) ? arr : [];
  }, [selectedDevice]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedDevice(null);
      return;
    }
    const d = (devices || []).find(x => x.id === Number(selectedId));
    setSelectedDevice(d || null);

    setOptionName("");
    setOptionValue("");
  }, [selectedId, devices]);

  const hasOptions = normalizedOptions.length > 0;
  const currentOption = hasOptions ? normalizedOptions.find(o => o.name === optionName) : null;

  const submit = async () => {
    const n = parseInt(qty, 10);
    if (!Number.isInteger(n) || n <= 0) { alert("Количество должно быть целым > 0"); return; }
    if (!selectedDevice) { alert("Выберите товар"); return; }

    let delta = action === "add" ? n : -n;
    let selectedOptions;

    if (hasOptions) {
      if (!optionName) { alert("Выберите опцию"); return; }
      if (!optionValue) { alert("Выберите значение опции"); return; }
      selectedOptions = { [optionName]: optionValue };
    }

    try {
      const updated = await adjustDeviceStock(selectedDevice.id, delta, selectedOptions);
      onUpdated?.(updated);
      onHide?.();
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || "Не удалось изменить остаток");
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
            onChange={e => setQuery(e.target.value)}
            placeholder="Начните вводить имя…"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Товар</label>
          <select
            value={selectedId || ""}
            onChange={e => setSelectedId(e.target.value || null)}
            style={inputStyle}
          >
            <option value="">— выберите —</option>
            {filtered.map(d => (
              <option key={d.id} value={d.id}>
                #{d.id} · {d.name} {typeof d.quantity === "number" ? ` (в наличии: ${d.quantity})` : ""}
              </option>
            ))}
          </select>
        </div>

        {hasOptions && (
          <>
            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>Опция</label>
              <select
                value={optionName}
                onChange={e => { setOptionName(e.target.value); setOptionValue(""); }}
                style={inputStyle}
              >
                <option value="">— выберите опцию —</option>
                {normalizedOptions.map(o => (
                  <option key={o.name} value={o.name}>{o.name}</option>
                ))}
              </select>
            </div>

            {!!optionName && (
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Значение</label>
                <select
                  value={optionValue}
                  onChange={e => setOptionValue(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">— выберите значение —</option>
                  {(currentOption?.values || []).map(v => (
                    <option key={v.value} value={v.value}>
                      {v.value} {typeof v.quantity === "number" ? ` (остаток: ${v.quantity})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <label style={radioLabel}><input type="radio" name="act" checked={action==="add"} onChange={() => setAction("add")} /> Прибавить</label>
          <label style={radioLabel}><input type="radio" name="act" checked={action==="remove"} onChange={() => setAction("remove")} /> Списать</label>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Количество</label>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={e => setQty(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={submit} className="btn btn-primary">Сохранить</button>
          <button onClick={onHide} className="btn btn-secondary">Отмена</button>
        </div>
      </div>
    </div>
  );
}

const backdropStyle = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,.35)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
};
const modalStyle = { background: "#fff", borderRadius: 8, padding: 16, width: 520, maxWidth: "90vw" };
const labelStyle = { display: "block", fontSize: 13, color: "#444", marginBottom: 4 };
const inputStyle = { width: "100%", padding: "8px 10px", border: "1px solid #925151ff", borderRadius: 6 };
const radioLabel = { display: "flex", alignItems: "center", gap: 6 };
