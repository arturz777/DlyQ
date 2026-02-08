import React, { useContext, useEffect, useState } from "react";
import { Context } from "../index";
import { fetchBrands, deleteBrand } from "../http/deviceAPI";
import CreateBrand from "./modals/CreateBrand";
import styles from "./AdminBrandsTab.module.css";

const AdminBrandsTab = () => {
  const { device } = useContext(Context);

  const [brands, setBrands] = useState([]);
  const [brandVisible, setBrandVisible] = useState(false);
  const [editableBrand, setEditableBrand] = useState(null);

  const load = () => fetchBrands().then(setBrands);

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const upsertBrand = (list, saved) => {
    if (!saved) return list;
    const idx = list.findIndex((b) => Number(b.id) === Number(saved.id));
    if (idx === -1) return [saved, ...list];
    const next = [...list];
    next[idx] = { ...next[idx], ...saved };
    return next;
  };

  const handleEdit = (brand) => {
    setEditableBrand(brand);
    setBrandVisible(true);
  };

  const handleDelete = async (id) => {
    await deleteBrand(id);
    setBrands((prev) => prev.filter((b) => b.id !== id));
    device.setBrands((device.brands || []).filter((b) => b.id !== id));
  };

  return (
    <>
      <div className={styles.actionButtons}>
        <button onClick={() => setBrandVisible(true)} className={styles.actionButton}>
          Добавить бренд
        </button>
      </div>

      <div className={styles.itemList}>
        {brands.map((brand) => (
          <div key={brand.id} className={styles.item}>
            <div className={styles.left}>
              <span>{brand.name}</span>
            </div>

            <div className={styles.buttons}>
              <button className={styles.editButton} onClick={() => handleEdit(brand)}>
                Редактировать
              </button>

              <button
                className={styles.deleteButton}
                onClick={() => {
                  const confirmed = window.confirm("Вы уверены, что хотите удалить этот бренд?");
                  if (confirmed) handleDelete(brand.id);
                }}
              >
                Удалить
              </button>
            </div>
          </div>
        ))}
      </div>

      <CreateBrand
        show={brandVisible}
        editableBrand={editableBrand}
        onHide={() => {
          setBrandVisible(false);
          setEditableBrand(null);
        }}
        onBrandSaved={(saved) => {
          setBrands((prev) => upsertBrand(prev, saved));
          device.setBrands(upsertBrand(device.brands || [], saved));
          setEditableBrand(null);
        }}
      />
    </>
  );
};

export default AdminBrandsTab;
