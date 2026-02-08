import React, { useEffect, useMemo, useState } from "react";
import { fetchSellers } from "../http/sellerAPI";
import styles from "./AdminSellerPicker.module.css";

export default function SellerPicker({ value, onChange, onlyActive = false }) {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchSellers(false);
      setSellers(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const items = useMemo(() => {
    return onlyActive ? sellers.filter((s) => s.isActive) : sellers;
  }, [sellers, onlyActive]);

  useEffect(() => {
    if (value) return;
    if (!items.length) return;
    const first = items.find((s) => s.isActive) || items[0];
    onChange?.(first?.id ?? null);
  }, [items, value, onChange]);

  return (
    <div className={styles.wrap}>
      <div className={styles.label}>Ресторан:</div>

      <select
        className={styles.select}
        value={value ?? ""}
        onChange={(e) => onChange?.(Number(e.target.value) || null)}
        disabled={loading || items.length === 0}
      >
        {items.length === 0 ? (
          <option value="">{loading ? "Загрузка..." : "Нет магазинов"}</option>
        ) : (
          <>
            <option value="">— выберите —</option>
            {items.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.slug ? `(${s.slug})` : ""}{" "}
                {!s.isActive ? "• off" : ""}
              </option>
            ))}
          </>
        )}
      </select>

      <button
        type="button"
        className={styles.refreshBtn}
        onClick={load}
        disabled={loading}
        title="Обновить список"
      >
        {loading ? "..." : "↻"}
      </button>
    </div>
  );
}
