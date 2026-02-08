import React, { useEffect, useState } from "react";
import { fetchTypes, fetchSubtypes, deleteSubtype } from "../http/deviceAPI";
import CreateSubType from "./modals/CreateSubType";
import styles from "./AdminSubtypesTab.module.css";

const AdminSubtypesTab = () => {
  const [types, setTypes] = useState([]);
  const [subtypes, setSubtypes] = useState([]);

  const [subtypeVisible, setSubtypeVisible] = useState(false);
  const [editableSubtype, setEditableSubtype] = useState(null);

  const [openTypeIds, setOpenTypeIds] = useState([]);

  const load = async () => {
    const [t, st] = await Promise.all([fetchTypes(), fetchSubtypes()]);
    setTypes(t || []);
    setSubtypes(st || []);
  };

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const toggleTypeOpen = (typeId) => {
    setOpenTypeIds((prev) =>
      prev.includes(typeId) ? prev.filter((id) => id !== typeId) : [...prev, typeId],
    );
  };

  const handleEditSubtype = (subtype) => {
    setEditableSubtype(subtype);
    setSubtypeVisible(true);
  };

  const handleDeleteSubtype = async (id) => {
    await deleteSubtype(id);
    setSubtypes((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <>
      <div className={styles.actionButtons}>
        <button onClick={() => setSubtypeVisible(true)} className={styles.actionButton}>
          Добавить подтип
        </button>
      </div>

      {types.map((type) => {
        const subtypesForType = subtypes.filter((s) => s.typeId === type.id);
        if (subtypesForType.length === 0) return null;

        const isOpen = openTypeIds.includes(type.id);

        return (
          <div key={type.id} className={styles.typeGroup}>
            <div className={styles.typeHeader} onClick={() => toggleTypeOpen(type.id)}>
              <h4 className={styles.typeTitle}>{type.name}</h4>
              <span>{isOpen ? "▲" : "▼"}</span>
            </div>

            {isOpen && (
              <div className={styles.itemList}>
                {subtypesForType.map((subtype) => (
                  <div key={subtype.id} className={styles.item}>
                    <span>{subtype.name}</span>

                    <div className={styles.buttons}>
                      <button className={styles.editButton} onClick={() => handleEditSubtype(subtype)}>
                        Редактировать
                      </button>

                      <button
                        className={styles.deleteButton}
                        onClick={() => {
                          const confirmed = window.confirm("Вы уверены, что хотите удалить этот подтип?");
                          if (confirmed) handleDeleteSubtype(subtype.id);
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
        );
      })}

      <CreateSubType
        show={subtypeVisible}
        onHide={() => {
          setSubtypeVisible(false);
          setEditableSubtype(null);
        }}
        editableSubtype={editableSubtype}
        onSubtypeSaved={() => {
          setEditableSubtype(null);
          fetchSubtypes().then(setSubtypes).catch(console.error);
        }}
      />
    </>
  );
};

export default AdminSubtypesTab;
