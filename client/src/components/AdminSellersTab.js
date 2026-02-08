import React, { useEffect, useState } from "react";
import { fetchSellers, deactivateSeller } from "../http/sellerAPI";
import CreateSeller from "./modals/CreateSeller";
import styles from "./AdminSellersTab.module.css";

const AdminSellersTab = ({ activeSellerId, onSelectSeller }) => {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sellerVisible, setSellerVisible] = useState(false);
  const [editableSeller, setEditableSeller] = useState(null);

  const loadSellers = async () => {
    setLoading(true);
    try {
      const data = await fetchSellers(false);
      setSellers(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSellers().catch(console.error);
  }, []);

  // авто-выбор первого активного (если ничего не выбрано)
  useEffect(() => {
    if (activeSellerId) return;
    if (!sellers.length) return;
    const firstActive = sellers.find((s) => s.isActive) || sellers[0];
    onSelectSeller?.(firstActive?.id ?? null);
  }, [sellers, activeSellerId, onSelectSeller]);

  const openCreateSellerModal = () => {
    setEditableSeller(null);
    setSellerVisible(true);
  };

  const handleEditSeller = (seller) => {
    setEditableSeller(seller);
    setSellerVisible(true);
  };

  const handleDeactivateSeller = async (id) => {
    const ok = window.confirm("Деактивировать магазин?");
    if (!ok) return;

    try {
      await deactivateSeller(id);
      await loadSellers();

      // если деактивировали выбранный — выбрать другой
      if (Number(activeSellerId) === Number(id)) {
        const next =
          sellers.find((s) => s.isActive && Number(s.id) !== Number(id)) ||
          sellers[0];
        onSelectSeller?.(next?.id ?? null);
      }
    } catch (e) {
      console.error(e);
      alert("Не удалось деактивировать магазин");
    }
  };

  if (loading)
    return <div className={styles.loading}>Загрузка магазинов...</div>;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <button onClick={openCreateSellerModal} className={styles.addBtn}>
          Добавить магазин
        </button>
      </div>

      <div className={styles.list}>
        {sellers.length === 0 ? (
          <p>Магазинов пока нет</p>
        ) : (
          sellers.map((s) => {
            const isSelected = Number(activeSellerId) === Number(s.id);

            return (
              <div
                key={s.id}
                className={`${styles.item} ${isSelected ? styles.itemSelected : ""}`}
                onClick={() => onSelectSeller?.(s.id)}
              >
                <div className={styles.nameLine}>
                  <strong>{s.name}</strong>
                  <span className={styles.slug}>
                    {s.slug ? `(${s.slug})` : ""}
                  </span>
                </div>

                <div
                  className={styles.controls}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span
                    className={`${styles.status} ${
                      s.isActive ? styles.statusActive : styles.statusInactive
                    }`}
                  >
                    {s.isActive ? "Активен" : "Неактивен"}
                  </span>

                  <button
                    className={styles.editBtn}
                    onClick={() => handleEditSeller(s)}
                    type="button"
                  >
                    Редактировать
                  </button>

                  {s.isActive && (
                    <button
                      className={styles.deactivateBtn}
                      onClick={() => handleDeactivateSeller(s.id)}
                      type="button"
                    >
                      Деактивировать
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <CreateSeller
        show={sellerVisible}
        editableSeller={editableSeller}
        onHide={() => {
          setSellerVisible(false);
          setEditableSeller(null);
          loadSellers().catch(console.error);
        }}
        onSaved={() => {
          loadSellers().catch(console.error);
        }}
      />
    </div>
  );
};

export default AdminSellersTab;
