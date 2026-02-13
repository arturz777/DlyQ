import React, { useEffect, useMemo, useState } from "react";
import {
  fetchMaintenance,
  updateMaintenance,
  fetchShopConfig,
  updateShopConfig,
  fetchDeliveryPricing,
  updateDeliveryPricing,
  fetchCourierConfig,
  updateCourierConfig,
} from "../http/configAPI";
import appStore from "../store/appStore";
import styles from "./AdminSettings.module.css";

const DEFAULT_SHOP_HOURS = {
  weekdays: { start: "10:00", end: "22:00" },
  saturday: { start: "10:00", end: "22:00" },
  sunday: { start: "10:00", end: "14:00" },
};

const DEFAULT_DELIVERY = {
  baseCost: 2,
  perKm: 0.5,
  discountStepEur: 30,
  discountAmount: 2,
  minCost: 0,

  peakWindows: [
    {
      id: "lunch",
      enabled: true,
      start: "12:00",
      end: "15:00",
      multiplier: 1.2,
    },
    {
      id: "dinner",
      enabled: true,
      start: "17:00",
      end: "21:00",
      multiplier: 1.3,
    },
    {
      id: "special",
      enabled: false,
      start: "00:00",
      end: "23:59",
      multiplier: 1.0,
      note: "праздник",
    },
  ],
};

const AdminSettings = () => {
  const tabs = useMemo(
    () => [
      { key: "general", label: "Общее" },
      { key: "shop", label: "Магазин" },
      { key: "courier", label: "Курьеры" },
      { key: "delivery", label: "Доставка" },
    ],
    [],
  );

  const [activeTab, setActiveTab] = useState("general");
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(
    appStore.maintenance.enabled,
  );
  const [shopForceClosed, setShopForceClosed] = useState(false);
  const [shopHours, setShopHours] = useState(DEFAULT_SHOP_HOURS);
  const [shopSaving, setShopSaving] = useState(false);
  const [shopSaveState, setShopSaveState] = useState(null);
  const [deliverySaving, setDeliverySaving] = useState(false);
  const [deliverySaveState, setDeliverySaveState] = useState(null);
  const [deliverySaved, setDeliverySaved] = useState(DEFAULT_DELIVERY);
  const [deliveryDraft, setDeliveryDraft] = useState(DEFAULT_DELIVERY);
  const [courierSaving, setCourierSaving] = useState(false);
  const [courierSaveState, setCourierSaveState] = useState(null);
  const [courierCfg, setCourierCfg] = useState({
    shopCommissionPercent: 10,
    parcelCommissionPercent: 20,
  });

  const deliveryDirty =
    JSON.stringify(deliveryDraft) !== JSON.stringify(deliverySaved);

  useEffect(() => {
    fetchCourierConfig()
      .then((v) => {
        const shop = Number(v?.shopCommissionPercent ?? 10);
        const parcel = Number(v?.parcelCommissionPercent ?? 20);

        setCourierCfg({
          shopCommissionPercent: Number.isFinite(shop) ? shop : 10,
          parcelCommissionPercent: Number.isFinite(parcel) ? parcel : 20,
        });
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetchMaintenance()
      .then((v) => {
        setMaintenanceEnabled(!!v.enabled);
        appStore.setMaintenance(v);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetchShopConfig()
      .then((v) => {
        setShopForceClosed(!!v.forceClosed);
        if (v.workHours) setShopHours(v.workHours);
        appStore.setShopConfig?.(v);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetchDeliveryPricing()
      .then((v) => {
        const merged = { ...DEFAULT_DELIVERY, ...(v || {}) };
        setDeliverySaved(merged);
        setDeliveryDraft(merged);
      })
      .catch(console.error);
  }, []);

  const setCourierField = (key, val) => {
    setCourierCfg((prev) => ({ ...prev, [key]: val }));
  };

  const saveCourier = async () => {
    try {
      setCourierSaving(true);
      setCourierSaveState(null);

      const payload = {
        shopCommissionPercent: Number(
          String(courierCfg.shopCommissionPercent).replace(",", "."),
        ),
        parcelCommissionPercent: Number(
          String(courierCfg.parcelCommissionPercent).replace(",", "."),
        ),
      };

      const saved = await updateCourierConfig(payload);
      const flat = Number(
        saved?.shopCommissionFlat ?? payload.shopCommissionFlat,
      );

      setCourierCfg({ shopCommissionFlat: Number.isFinite(flat) ? flat : 0.3 });

      setCourierSaveState("ok");
      setTimeout(() => setCourierSaveState(null), 1800);
    } catch (e) {
      console.error(e);
      setCourierSaveState("error");
      setTimeout(() => setCourierSaveState(null), 2500);
    } finally {
      setCourierSaving(false);
    }
  };

  const toggleMaintenance = async (next) => {
    try {
      setMaintenanceEnabled(next);
      const saved = await updateMaintenance(next);
      appStore.setMaintenance(saved);
    } catch (e) {
      console.error(e);
      setMaintenanceEnabled(!next);
    }
  };

  const setHour = (dayKey, field, val) => {
    setShopHours((prev) => ({
      ...prev,
      [dayKey]: { ...(prev[dayKey] || {}), [field]: val },
    }));
  };

  const saveShop = async () => {
    try {
      setShopSaving(true);
      setShopSaveState(null);

      const saved = await updateShopConfig({
        forceClosed: shopForceClosed,
        workHours: shopHours,
      });

      appStore.setShopConfig?.(
        saved || { forceClosed: shopForceClosed, workHours: shopHours },
      ); // ✅

      setShopSaveState("ok");
      setTimeout(() => setShopSaveState(null), 1800);
    } catch (e) {
      console.error(e);
      setShopSaveState("error");
      setTimeout(() => setShopSaveState(null), 2500);
    } finally {
      setShopSaving(false);
    }
  };

  const setDeliveryField = (key, val) => {
    setDeliveryDraft((prev) => ({ ...prev, [key]: val }));
  };

  const setPeakField = (id, key, val) => {
    setDeliveryDraft((prev) => ({
      ...prev,
      peakWindows: (prev.peakWindows || []).map((w) =>
        w.id === id ? { ...w, [key]: val } : w,
      ),
    }));
  };

  const resetDelivery = () => {
    setDeliveryDraft(deliverySaved);
  };

  const saveDelivery = async () => {
    try {
      setDeliverySaving(true);
      setDeliverySaveState(null);

      const d = deliveryDraft;

      const payload = {
        baseCost: Number(String(d.baseCost).replace(",", ".")),
        perKm: Number(String(d.perKm).replace(",", ".")),
        discountStepEur: Number(String(d.discountStepEur).replace(",", ".")),
        discountAmount: Number(String(d.discountAmount).replace(",", ".")),
        minCost: Number(String(d.minCost).replace(",", ".")),
        peakWindows: (d.peakWindows || []).map((w) => ({
          id: w.id,
          enabled: !!w.enabled,
          start: w.start,
          end: w.end,
          multiplier: Number(String(w.multiplier).replace(",", ".")) || 1,
          note: w.note || "",
        })),
      };

      const saved = await updateDeliveryPricing(payload);

      const merged = { ...DEFAULT_DELIVERY, ...(saved ?? payload) };

      const mergedSafe = {
        ...DEFAULT_DELIVERY,
        ...(saved ?? payload),
        peakWindows:
          saved?.peakWindows ??
          payload.peakWindows ??
          DEFAULT_DELIVERY.peakWindows,
      };

      setDeliverySaved(mergedSafe);
      setDeliveryDraft(mergedSafe);

      setDeliverySaveState("ok");
      setTimeout(() => setDeliverySaveState(null), 1800);
    } catch (e) {
      console.error(e);
      setDeliverySaveState("error");
      setTimeout(() => setDeliverySaveState(null), 2500);
    } finally {
      setDeliverySaving(false);
    }
  };

  return (
    <>
      <h3 className={styles.settingsTitle}>Настройки</h3>

      <div className={styles.tabs}>
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`${styles.tabBtn} ${activeTab === t.key ? styles.tabActive : ""}`}
            type="button"
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.settingsPanel}>
        {activeTab === "general" && (
          <div className={styles.settingsCard}>
            <label className={styles.toggleWrap} title="Режим обслуживания">
              <input
                type="checkbox"
                className={styles.toggleInput}
                checked={maintenanceEnabled}
                onChange={(e) => toggleMaintenance(e.target.checked)}
              />
              <span className={styles.toggleLabel}>Режим обслуживания</span>
            </label>
          </div>
        )}

        {activeTab === "shop" && (
          <div className={styles.settingsCard}>
            <div className={styles.cardTitle}>Время работы DlyQ Market</div>

            <div className={styles.settingsRow}>
              <label className={styles.toggleWrap}>
                <input
                  type="checkbox"
                  className={styles.toggleInput}
                  checked={shopForceClosed}
                  onChange={(e) => setShopForceClosed(e.target.checked)}
                />
                <span className={styles.toggleLabel}>Принудительно закрыт</span>
              </label>

              <div className={styles.saveHint}>
                {shopForceClosed
                  ? "Заказы будут недоступны"
                  : "Работает по расписанию"}
              </div>
            </div>

            <div className={styles.hoursGrid}>
              <div className={styles.hoursRow}>
                <div className={styles.dayLabel}>Будни</div>
                <input
                  className={styles.timeInput}
                  type="time"
                  value={shopHours.weekdays?.start || "10:00"}
                  onChange={(e) => setHour("weekdays", "start", e.target.value)}
                />
                <div className={styles.dash}>—</div>
                <input
                  className={styles.timeInput}
                  type="time"
                  value={shopHours.weekdays?.end || "22:00"}
                  onChange={(e) => setHour("weekdays", "end", e.target.value)}
                />
              </div>

              <div className={styles.hoursRow}>
                <div className={styles.dayLabel}>Суббота</div>
                <input
                  className={styles.timeInput}
                  type="time"
                  value={shopHours.saturday?.start || "10:00"}
                  onChange={(e) => setHour("saturday", "start", e.target.value)}
                />
                <div className={styles.dash}>—</div>
                <input
                  className={styles.timeInput}
                  type="time"
                  value={shopHours.saturday?.end || "22:00"}
                  onChange={(e) => setHour("saturday", "end", e.target.value)}
                />
              </div>

              <div className={styles.hoursRow}>
                <div className={styles.dayLabel}>Воскресенье</div>
                <input
                  className={styles.timeInput}
                  type="time"
                  value={shopHours.sunday?.start || "10:00"}
                  onChange={(e) => setHour("sunday", "start", e.target.value)}
                />
                <div className={styles.dash}>—</div>
                <input
                  className={styles.timeInput}
                  type="time"
                  value={shopHours.sunday?.end || "14:00"}
                  onChange={(e) => setHour("sunday", "end", e.target.value)}
                />
              </div>

              <div className={styles.saveRow}>
                <button
                  className={styles.btnPrimary}
                  onClick={saveShop}
                  disabled={shopSaving}
                >
                  {shopSaving && <span className={styles.spinner} />}
                  {shopSaving ? "Сохранение..." : "Сохранить расписание"}
                </button>

                {shopSaveState === "ok" && (
                  <span className={styles.saveOk}>Сохранено</span>
                )}
                {shopSaveState === "error" && (
                  <span className={styles.saveErr}>Ошибка сохранения</span>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "courier" && (
          <div className={styles.settingsCard}>
            <div className={styles.cardTitle}>Комиссия у курьеров</div>

            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Комиссия shop (%)</span>
                <input
                  className={styles.textInput}
                  type="number"
                  step="0.1"
                  value={courierCfg.shopCommissionPercent}
                  onChange={(e) =>
                    setCourierField("shopCommissionPercent", e.target.value)
                  }
                />
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Комиссия parcel (%)</span>
                <input
                  className={styles.textInput}
                  type="number"
                  step="0.1"
                  value={courierCfg.parcelCommissionPercent}
                  onChange={(e) =>
                    setCourierField("parcelCommissionPercent", e.target.value)
                  }
                />
              </label>
            </div>

            <div className={styles.saveRow}>
              <button
                className={styles.btnPrimary}
                onClick={saveCourier}
                disabled={courierSaving}
              >
                {courierSaving && <span className={styles.spinner} />}
                {courierSaving ? "Сохранение..." : "Сохранить"}
              </button>

              {courierSaveState === "ok" && (
                <span className={styles.saveOk}>Сохранено</span>
              )}
              {courierSaveState === "error" && (
                <span className={styles.saveErr}>Ошибка сохранения</span>
              )}
            </div>

            <div className={styles.saveHint}>
              Эта сумма используется вместо “жёстких 0.30€” в расчётах.
            </div>
          </div>
        )}

        {activeTab === "delivery" && (
          <div className={styles.deliveryGrid4}>
            <div className={`${styles.settingsCard} ${styles.deliveryCard}`}>
              <div className={styles.cardTitle}>Цены доставки</div>

              <div className={styles.deliveryTopGrid}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>База (€)</span>
                  <input
                    className={styles.textInput}
                    type="number"
                    step="0.01"
                    value={deliveryDraft.baseCost}
                    onChange={(e) =>
                      setDeliveryField("baseCost", e.target.value)
                    }
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>€/км</span>
                  <input
                    className={styles.textInput}
                    type="number"
                    step="0.01"
                    value={deliveryDraft.perKm}
                    onChange={(e) => setDeliveryField("perKm", e.target.value)}
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Шаг скидки (€)</span>
                  <input
                    className={styles.textInput}
                    type="number"
                    step="1"
                    value={deliveryDraft.discountStepEur}
                    onChange={(e) =>
                      setDeliveryField("discountStepEur", e.target.value)
                    }
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Скидка (€)</span>
                  <input
                    className={styles.textInput}
                    type="number"
                    step="0.01"
                    value={deliveryDraft.discountAmount}
                    onChange={(e) =>
                      setDeliveryField("discountAmount", e.target.value)
                    }
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Мин. цена (€)</span>
                  <input
                    className={styles.textInput}
                    type="number"
                    step="0.01"
                    value={deliveryDraft.minCost}
                    onChange={(e) =>
                      setDeliveryField("minCost", e.target.value)
                    }
                  />
                </label>
              </div>

              <div className={styles.saveRow}>
                <button
                  className={styles.btnPrimary}
                  onClick={saveDelivery}
                  disabled={deliverySaving || !deliveryDirty}
                >
                  {deliverySaving && <span className={styles.spinner} />}
                  {deliverySaving ? "Сохранение..." : "Сохранить"}
                </button>

                {deliverySaveState === "ok" && (
                  <span className={styles.saveOk}>Сохранено</span>
                )}
                {deliverySaveState === "error" && (
                  <span className={styles.saveErr}>Ошибка</span>
                )}
              </div>

              {deliveryDirty && !deliverySaving && (
                <div className={styles.unsavedHint}>
                  Есть несохранённые изменения
                </div>
              )}
            </div>

            {(deliveryDraft.peakWindows || []).map((w) => (
              <div
                key={w.id}
                className={`${styles.settingsCard} ${styles.peakCard}`}
              >
                <div className={styles.peakRowHeader}>
                  <div className={styles.peakTitle}>
                    {w.id === "lunch"
                      ? "Обед"
                      : w.id === "dinner"
                        ? "Ужин"
                        : "Спец"}
                  </div>

                  <label className={styles.toggleWrap}>
                    <input
                      type="checkbox"
                      className={styles.toggleInput}
                      checked={!!w.enabled}
                      onChange={(e) =>
                        setPeakField(w.id, "enabled", e.target.checked)
                      }
                    />
                    <span className={styles.toggleLabel}>Включено</span>
                  </label>
                </div>

                <div className={styles.peakInlineTop}>
                  <label className={styles.peakInlineField}>
                    <span className={styles.peakInlineLabel}>Множитель</span>
                    <input
                      className={styles.peakMultiplierInput}
                      type="number"
                      step="0.01"
                      value={w.multiplier ?? 1}
                      onChange={(e) =>
                        setPeakField(w.id, "multiplier", e.target.value)
                      }
                    />
                  </label>
                </div>

                <div className={styles.peakGrid}>
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Start</span>
                    <input
                      className={styles.timeInput}
                      type="time"
                      value={w.start || "00:00"}
                      onChange={(e) =>
                        setPeakField(w.id, "start", e.target.value)
                      }
                    />
                  </label>

                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>End</span>
                    <input
                      className={styles.timeInput}
                      type="time"
                      value={w.end || "23:59"}
                      onChange={(e) =>
                        setPeakField(w.id, "end", e.target.value)
                      }
                    />
                  </label>

                  {w.id === "special" && (
                    <label className={`${styles.field} ${styles.peakNoteFull}`}>
                      <span className={styles.fieldLabel}>Примечание</span>
                      <input
                        className={styles.textInput}
                        value={w.note || ""}
                        onChange={(e) =>
                          setPeakField(w.id, "note", e.target.value)
                        }
                      />
                    </label>
                  )}
                </div>
              </div>
            ))}

            <div className={styles.deliveryActions}>
              <button
                className={styles.btnPrimary}
                onClick={saveDelivery}
                disabled={deliverySaving || !deliveryDirty}
              >
                {deliverySaving && <span className={styles.spinner} />}
                {deliverySaving ? "Сохранение..." : "Сохранить всё"}
              </button>

              <button
                className={styles.btnSecondary}
                type="button"
                onClick={resetDelivery}
                disabled={deliverySaving || !deliveryDirty}
              >
                Отменить
              </button>

              {deliverySaveState === "ok" && (
                <span className={styles.saveOk}>Сохранено</span>
              )}
              {deliverySaveState === "error" && (
                <span className={styles.saveErr}>Ошибка</span>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default AdminSettings;
