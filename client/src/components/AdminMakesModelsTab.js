import React, { useEffect, useState } from "react";
import {
  fetchMakes,
  fetchModelsByMake,
  deleteMake,
  deleteModel,
} from "../http/deviceAPI";
import CreateMake from "../components/modals/CreateMake";
import CreateModel from "../components/modals/CreateModel";
import styles from "./AdminMakesModelsTab.module.css";

const AdminMakesModelsTab = () => {
  const [makes, setMakes] = useState([]);
  const [modelsByMake, setModelsByMake] = useState({});
  const [openMakeIds, setOpenMakeIds] = useState([]);

  const [makeVisible, setMakeVisible] = useState(false);
  const [modelVisible, setModelVisible] = useState(false);

  const [editableMake, setEditableMake] = useState(null);
  const [editableModel, setEditableModel] = useState(null);

  useEffect(() => {
    fetchMakes()
      .then((data) => setMakes(data || []))
      .catch(console.error);
  }, []);

  const loadModelsForMake = async (makeId) => {
    const list = await fetchModelsByMake(makeId);
    setModelsByMake((prev) => ({ ...prev, [makeId]: list || [] }));
  };

  const toggleMakeOpen = (makeId) => {
    setOpenMakeIds((prev) =>
      prev.includes(makeId) ? prev.filter((id) => id !== makeId) : [...prev, makeId],
    );

    if (!modelsByMake[makeId]) {
      loadModelsForMake(makeId).catch(console.error);
    }
  };

  const handleDeleteMake = async (makeId) => {
    if (!window.confirm("Удалить эту марку?")) return;

    try {
      await deleteMake(makeId);

	  notifyMakesChanged();

      setMakes((prev) => prev.filter((m) => Number(m.id) !== Number(makeId)));

      setModelsByMake((prev) => {
        const copy = { ...prev };
        delete copy[makeId];
        return copy;
      });

      setOpenMakeIds((prev) => prev.filter((id) => id !== makeId));
    } catch (e) {
      console.error(e);
      alert("Не удалось удалить марку");
    }
  };

  const handleDeleteModel = async (model) => {
    if (!window.confirm(`Удалить модель "${model.name}"?`)) return;

    try {
      await deleteModel(model.id);
      await loadModelsForMake(model.makeId);
    } catch (e) {
      console.error(e);
      alert("Не удалось удалить модель");
    }
  };

  const notifyMakesChanged = () => {
  window.dispatchEvent(new Event("admin:makes-changed"));
};

  useEffect(() => {
    setOpenMakeIds((prev) =>
      prev.filter((id) => makes.some((m) => Number(m.id) === Number(id))),
    );
  }, [makes]);

  useEffect(() => {
  const onMakesChanged = () => {
    fetchMakes().then(setMakes).catch(console.error);
  };

  window.addEventListener("admin:makes-changed", onMakesChanged);
  return () => window.removeEventListener("admin:makes-changed", onMakesChanged);
}, []);

  const sortedMakes = (makes || [])
    .slice()
    .sort((a, b) =>
      (a.displayOrder ?? 0) === (b.displayOrder ?? 0)
        ? Number(a.id) - Number(b.id)
        : (a.displayOrder ?? 0) - (b.displayOrder ?? 0),
    );

  return (
    <div>
      <div className={styles.actionButtons}>
        <button
          onClick={() => {
            setEditableMake(null);
            setMakeVisible(true);
          }}
          className={styles.actionButton}
          type="button"
        >
          Добавить марку
        </button>

        <button
          onClick={() => {
            setEditableModel(null);
            setModelVisible(true);
          }}
          className={styles.actionButton}
          type="button"
        >
          Добавить модель
        </button>
      </div>

      {!makes || makes.length === 0 ? (
        <p>Марок нет</p>
      ) : (
        <div className={styles.itemList}>
          {sortedMakes.map((make) => {
            const isOpen = openMakeIds.includes(make.id);
            const models = modelsByMake[make.id] || [];

            return (
              <div key={make.id} className={styles.item}>
                <div className={styles.makeTop}>
                  <button
                    onClick={() => toggleMakeOpen(make.id)}
                    className={styles.editButton}
                    style={{ minWidth: 34 }}
                    title={isOpen ? "Свернуть" : "Развернуть"}
                    type="button"
                  >
                    {isOpen ? "▲" : "▼"}
                  </button>

                  <strong>{make.name}</strong>

                  <span className={styles.orderHint}>
                    (order: {make.displayOrder ?? 0})
                  </span>
                </div>

                <div className={styles.buttons}>
                  <button
                    className={styles.editButton}
                    type="button"
                    onClick={() => {
                      setEditableMake(make);
                      setMakeVisible(true);
                    }}
                  >
                    Редактировать
                  </button>

                  <button
                    className={styles.deleteButton}
                    type="button"
                    onClick={() => handleDeleteMake(make.id)}
                  >
                    Удалить
                  </button>

                  <button
                    className={styles.actionButton}
                    type="button"
                    onClick={() => {
                      setEditableModel({ makeId: make.id });
                      setModelVisible(true);
                    }}
                  >
                    + Модель к марке
                  </button>
                </div>

                {isOpen && (
                  <div className={styles.modelsWrap}>
                    {models.length === 0 ? (
                      <div className={styles.emptyModels}>Моделей нет</div>
                    ) : (
                      <div className={styles.itemList}>
                        {models.map((m) => (
                          <div key={m.id} className={styles.item}>
                            <span>
                              {m.name}{" "}
                              <span className={styles.idHint}>id-{m.id}</span>
                            </span>

                            <div className={styles.buttons}>
                              <button
                                className={styles.editButton}
                                type="button"
                                onClick={() => {
                                  setEditableModel(m);
                                  setModelVisible(true);
                                }}
                              >
                                Редактировать
                              </button>

                              <button
                                className={styles.deleteButton}
                                type="button"
                                onClick={() => handleDeleteModel(m)}
                              >
                                Удалить
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <CreateMake
        show={makeVisible}
        editableMake={editableMake}
        onHide={() => {
          setMakeVisible(false);
          setEditableMake(null);
        }}
        onSaved={(saved) => {
          setMakes((prev) => {
            if (!saved?.id) return prev;
            const idx = prev.findIndex((m) => Number(m.id) === Number(saved.id));
            if (idx === -1) return [saved, ...prev];
            const next = [...prev];
            next[idx] = { ...next[idx], ...saved };
            return next;
          });

		  notifyMakesChanged();

          if (saved?.id) {
            setOpenMakeIds((prev) => [...new Set([...prev, saved.id])]);
            loadModelsForMake(saved.id).catch(console.error);
          }
        }}
      />

      <CreateModel
        show={modelVisible}
        editableModel={editableModel}
        makes={makes}
        onHide={() => {
          setModelVisible(false);
          setEditableModel(null);
        }}
        onSaved={(saved) => {
          const makeId = saved?.makeId ?? editableModel?.makeId;
          if (makeId) {
            setOpenMakeIds((prev) => [...new Set([...prev, makeId])]);
            loadModelsForMake(makeId).catch(console.error);
          }
        }}
      />
    </div>
  );
};

export default AdminMakesModelsTab;
