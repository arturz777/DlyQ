import React, { useEffect, useState } from "react";
import { fetchTypes, deleteType } from "../http/deviceAPI";
import CreateType from "./modals/CreateType";
import styles from "./AdminTypesTab.module.css";

const AdminTypesTab = () => {
  const [types, setTypes] = useState([]);
  const [typeVisible, setTypeVisible] = useState(false);
  const [editableType, setEditableType] = useState(null);

  const load = () => fetchTypes().then(setTypes);

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const openCreate = () => {
    setEditableType(null);
    setTypeVisible(true);
  };

  const handleEdit = (type) => {
    setEditableType(type);
    setTypeVisible(true);
  };

  const handleDelete = async (id) => {
    await deleteType(id);
    setTypes((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <>
      <div className={styles.actionButtons}>
        <button onClick={openCreate} className={styles.actionButton}>
          Добавить тип
        </button>
      </div>

      <div className={styles.itemList}>
        {types.map((type) => (
          <div key={type.id} className={styles.item}>
            <div className={styles.left}>
              <img
                width={50}
                height={50}
                src={type.img}
                alt={type.name}
                className={styles.typeImage}
              />
              <span>{type.name}</span>
            </div>

            <div className={styles.buttons}>
              <button className={styles.editButton} onClick={() => handleEdit(type)}>
                Редактировать
              </button>

              <button
                className={styles.deleteButton}
                onClick={() => {
                  const confirmed = window.confirm("Вы уверены, что хотите удалить этот тип?");
                  if (confirmed) handleDelete(type.id);
                }}
              >
                Удалить
              </button>
            </div>
          </div>
        ))}
      </div>

      <CreateType
        show={typeVisible}
        onHide={() => {
          setTypeVisible(false);
          setEditableType(null);
        }}
        editableType={editableType}
        onTypeSaved={() => {
          setEditableType(null);
          load().catch(console.error);
        }}
        types={types}
      />
    </>
  );
};

export default AdminTypesTab;
