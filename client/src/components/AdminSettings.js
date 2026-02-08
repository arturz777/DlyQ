import React, { useEffect, useMemo, useState } from "react";
import {
  fetchMaintenance,
  updateMaintenance,
  fetchShopConfig,
  updateShopConfig,
  fetchDeliveryPricing,
  updateDeliveryPricing,
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
};

const AdminSettings = () => {
  const tabs = useMemo(
    () => [
      { key: "general", label: "Общее" },
      { key: "shop", label: "Магазин" },
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
  const [delivery, setDelivery] = useState(DEFAULT_DELIVERY);
  const [deliverySaving, setDeliverySaving] = useState(false);
  const [deliverySaveState, setDeliverySaveState] = useState(null);

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
        setDelivery({ ...DEFAULT_DELIVERY, ...(v || {}) });
      })
      .catch(console.error);
  }, []);

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
    setDelivery((prev) => ({
      ...prev,
      [key]: val,
    }));
  };

  const saveDelivery = async () => {
    try {
      setDeliverySaving(true);
      setDeliverySaveState(null);

      const payload = {
        baseCost: Number(delivery.baseCost),
        perKm: Number(delivery.perKm),
        discountStepEur: Number(delivery.discountStepEur),
        discountAmount: Number(delivery.discountAmount),
        minCost: Number(delivery.minCost),
      };

      const saved = await updateDeliveryPricing(payload);
      setDelivery({ ...DEFAULT_DELIVERY, ...(saved || payload) });

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
            <div className={styles.cardTitle}>DlyQ Market</div>

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

        {activeTab === "delivery" && (
          <div className={styles.settingsCard}>
            <div className={styles.cardTitle}>Цены доставки</div>

            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>База (€)</span>
                <input
                  className={styles.textInput}
                  type="number"
                  step="0.01"
                  value={delivery.baseCost}
                  onChange={(e) => setDeliveryField("baseCost", e.target.value)}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>€/км</span>
                <input
                  className={styles.textInput}
                  type="number"
                  step="0.01"
                  value={delivery.perKm}
                  onChange={(e) => setDeliveryField("perKm", e.target.value)}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Шаг скидки (€)</span>
                <input
                  className={styles.textInput}
                  type="number"
                  step="1"
                  value={delivery.discountStepEur}
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
                  value={delivery.discountAmount}
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
                  value={delivery.minCost}
                  onChange={(e) => setDeliveryField("minCost", e.target.value)}
                />
              </label>
            </div>

            <div className={styles.saveRow}>
              <button
                className={styles.btnPrimary}
                onClick={saveDelivery}
                disabled={deliverySaving}
              >
                {deliverySaving && <span className={styles.spinner} />}
                {deliverySaving ? "Сохранение..." : "Сохранить цены доставки"}
              </button>

              {deliverySaveState === "ok" && (
                <span className={styles.saveOk}>Сохранено</span>
              )}
              {deliverySaveState === "error" && (
                <span className={styles.saveErr}>Ошибка сохранения</span>
              )}
            </div>

            <div className={styles.saveHint}>
              Формула: <b>baseCost + distanceKm * perKm</b>, затем минус скидка:{" "}
              <b>floor(total/discountStepEur) * discountAmount</b>, минимум =
              minCost.
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default AdminSettings;
