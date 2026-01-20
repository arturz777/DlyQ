import React, { useEffect, useMemo, useState } from "react";
import Modal from "react-bootstrap/Modal";
import Accordion from "react-bootstrap/Accordion";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Badge from "react-bootstrap/Badge";
import {
  fetchMenuItemOptions,
  createOptionGroup,
  updateOptionGroup,
  deactivateOptionGroup,
  createOption,
  updateOption,
  deactivateOption,
} from "../../http/menuOptionsAPI";
import styles from "./MenuItemOptionsModal.module.css";

const toNumOrNull = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const MenuItemOptionsModal = ({ show, onHide, item }) => {
  const itemId = item?.id;
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState([]);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [gLangTab, setGLangTab] = useState("ru");
  const [oLangTab, setOLangTab] = useState("ru");
  const [gEditLangTab, setGEditLangTab] = useState("ru");
  const [gEditT, setGEditT] = useState({});
  const [oEditLangTab, setOEditLangTab] = useState("ru");
  const [oEditT, setOEditT] = useState({});
  const [gForm, setGForm] = useState({
    title: "",
    type: "single",
    isRequired: false,
    minSelect: "",
    maxSelect: "",
    displayOrder: 0,
    translations: { title: { ru: "", en: "", est: "" } },
  });
  const [newOptForGroup, setNewOptForGroup] = useState(null);
  const [oForm, setOForm] = useState({
    title: "",
    priceDelta: "0",
    displayOrder: 0,
    isDefault: false,
    translations: { title: { ru: "", en: "", est: "" } },
  });

  const reload = async () => {
    if (!itemId) return;
    setLoading(true);
    try {
      const g = await fetchMenuItemOptions(itemId);
      setGroups(g || []);
      const gmap = {};
      (g || []).forEach((gr) => {
        gmap[gr.id] = {
          en: gr.translations?.title?.en || "",
          est: gr.translations?.title?.est || "",
        };
      });
      setGEditT(gmap);
      const omap = {};
      (g || []).forEach((gr) => {
        (gr.options || []).forEach((o) => {
          omap[o.id] = {
            en: o.translations?.title?.en || "",
            est: o.translations?.title?.est || "",
          };
        });
      });
      setOEditT(omap);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!show) return;
    reload().catch(console.error);
  }, [show, itemId]);

  const defaultOpenKey = useMemo(() => {
    const first = (groups || [])[0];
    return first ? String(first.id) : undefined;
  }, [groups]);

  const onCreateGroup = async () => {
    if (!gForm.title.trim()) return;

    await createOptionGroup({
      menuItemId: itemId,
      title: gForm.title.trim(),
      type: gForm.type,
      isRequired: gForm.isRequired,
      minSelect: gForm.type === "multi" ? toNumOrNull(gForm.minSelect) : null,
      maxSelect: gForm.type === "multi" ? toNumOrNull(gForm.maxSelect) : null,
      displayOrder: Number(gForm.displayOrder) || 0,
      translations: gForm.translations,
    });

    setGForm({
      title: "",
      type: "single",
      isRequired: false,
      minSelect: "",
      maxSelect: "",
      displayOrder: 0,
      translations: { title: { ru: "", en: "", est: "" } },
    });

    setNewGroupOpen(false);
    await reload();
  };

  const onUpdateGroup = async (g, patch) => {
    await updateOptionGroup(g.id, patch);
    await reload();
  };

  const onDeactivateGroup = async (g) => {
    if (!window.confirm(`Deactivate group "${g.title}"?`)) return;
    await deactivateOptionGroup(g.id);
    await reload();
  };

  const onCreateOption = async (groupId) => {
    if (!oForm.title.trim()) return;

    await createOption({
      groupId,
      title: oForm.title.trim(),
      priceDelta: oForm.priceDelta,
      displayOrder: Number(oForm.displayOrder) || 0,
      isDefault: oForm.isDefault,
      translations: oForm.translations,
    });

    setOForm({
      title: "",
      priceDelta: "0",
      displayOrder: 0,
      isDefault: false,
      translations: { title: { ru: "", en: "", est: "" } },
    });

    setNewOptForGroup(null);
    await reload();
  };

  const onUpdateOption = async (opt, patch) => {
    await updateOption(opt.id, patch);
    await reload();
  };

  const onDeactivateOption = async (opt) => {
    if (!window.confirm(`Deactivate option "${opt.title}"?`)) return;
    await deactivateOption(opt.id);
    await reload();
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Дополнения: {item?.name}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {loading ? (
          <div className={styles.loading}>Загрузка...</div>
        ) : (
          <>
            <div className={styles.toolbar}>
              <div>
                <Badge bg="secondary">{groups.length} групп:</Badge>
              </div>
              <Button
                variant="primary"
                className={styles.primaryBtnCompact}
                onClick={() => setNewGroupOpen((v) => !v)}
              >
                + Группа
              </Button>
            </div>

            {newGroupOpen && (
              <div className={`${styles.box} ${styles.boxMb14}`}>
                <Form.Group className="mb-2">
                  <Form.Label>Название группы</Form.Label>

                  <div className={styles.langRow}>
                    <Button
                      type="button"
                      size="sm"
                      className={styles.primaryBtnCompact}
                      variant={
                        gLangTab === "ru" ? "primary" : "outline-secondary"
                      }
                      onClick={() => setGLangTab("ru")}
                    >
                      RU
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className={styles.primaryBtnCompact}
                      variant={
                        gLangTab === "en" ? "primary" : "outline-secondary"
                      }
                      onClick={() => setGLangTab("en")}
                    >
                      EN
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className={styles.primaryBtnCompact}
                      variant={
                        gLangTab === "est" ? "primary" : "outline-secondary"
                      }
                      onClick={() => setGLangTab("est")}
                    >
                      EST
                    </Button>
                  </div>

                  <Form.Control
                    className={styles.inputTopGap}
                    placeholder={
                      gLangTab === "ru"
                        ? "Название (RU)"
                        : gLangTab === "en"
                          ? "Название (EN)"
                          : "Название (EST)"
                    }
                    value={
                      gLangTab === "ru"
                        ? gForm.title || ""
                        : gForm.translations?.title?.[gLangTab] || ""
                    }
                    onChange={(e) => {
                      const v = e.target.value;

                      if (gLangTab === "ru") {
                        setGForm((p) => ({ ...p, title: v }));
                        return;
                      }

                      setGForm((p) => ({
                        ...p,
                        translations: {
                          ...(p.translations || {}),
                          title: {
                            ...((p.translations && p.translations.title) || {}),
                            [gLangTab]: v,
                          },
                        },
                      }));
                    }}
                  />
                </Form.Group>

                <div className={styles.rowWrap12}>
                  <Form.Group className={styles.fieldMin200}>
                    <Form.Label>Тип выбора</Form.Label>
                    <Form.Select
                      value={gForm.type}
                      onChange={(e) =>
                        setGForm((p) => ({ ...p, type: e.target.value }))
                      }
                    >
                      <option value="single">Один вариант</option>
                      <option value="multi">Несколько вариантов</option>
                    </Form.Select>
                  </Form.Group>

                  <Form.Group className={styles.fieldMin140}>
                    <Form.Label>Порядок</Form.Label>
                    <Form.Control
                      type="number"
                      value={gForm.displayOrder}
                      onChange={(e) =>
                        setGForm((p) => ({
                          ...p,
                          displayOrder: e.target.value,
                        }))
                      }
                    />
                  </Form.Group>

                  <Form.Group className={styles.switchAlign}>
                    <Form.Check
                      type="switch"
                      label="Обязательно"
                      checked={gForm.isRequired}
                      onChange={(e) =>
                        setGForm((p) => ({
                          ...p,
                          isRequired: e.target.checked,
                        }))
                      }
                    />
                  </Form.Group>
                </div>

                {gForm.type === "multi" && (
                  <div className={styles.footerRowTop10}>
                    <Form.Group className={styles.fieldMin140}>
                      <Form.Label>Мин. выбор</Form.Label>
                      <Form.Control
                        type="number"
                        value={gForm.minSelect}
                        onChange={(e) =>
                          setGForm((p) => ({ ...p, minSelect: e.target.value }))
                        }
                      />
                    </Form.Group>
                    <Form.Group className={styles.fieldMin140}>
                      <Form.Label>Макс. выбор</Form.Label>
                      <Form.Control
                        type="number"
                        value={gForm.maxSelect}
                        onChange={(e) =>
                          setGForm((p) => ({ ...p, maxSelect: e.target.value }))
                        }
                      />
                    </Form.Group>
                  </div>
                )}

                <div className={styles.footerRow}>
                  <Button onClick={onCreateGroup}>Сохранить группу</Button>
                  <Button
                    variant="outline-secondary"
                    className={styles.primaryBtnCompact}
                    onClick={() => setNewGroupOpen(false)}
                  >
                    Отмена
                  </Button>
                </div>
              </div>
            )}

            {groups.length === 0 ? (
              <div className={styles.muted}>Групп пока нет</div>
            ) : (
              <Accordion defaultActiveKey={defaultOpenKey}>
                {groups.map((g) => (
                  <Accordion.Item key={g.id} eventKey={String(g.id)}>
                    <Accordion.Header>
                      <div className={styles.rowWrap10Center}>
                        <b>{g.title}</b>
                        <Badge bg={g.type === "multi" ? "info" : "dark"}>
                          {g.type}
                        </Badge>
                        {g.isRequired && (
                          <Badge bg="warning" text="dark">
                            required
                          </Badge>
                        )}
                        <Badge bg="light" text="dark">
                          {(g.options || []).length} options
                        </Badge>
                      </div>
                    </Accordion.Header>

                    <Accordion.Body>
                      {/* Редактирование группы (одинаково как создание) */}
                      <div className={styles.editGrid}>
                        {/* Название + табы */}
                        <Form.Group className={styles.colTitle}>
                          <Form.Label>Название группы</Form.Label>

                          <div className={styles.langRow}>
                            <Button
                              type="button"
                              size="sm"
                              className={styles.primaryBtnCompact}
                              variant={
                                gEditLangTab === "ru"
                                  ? "primary"
                                  : "outline-secondary"
                              }
                              onClick={() => setGEditLangTab("ru")}
                            >
                              RU
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className={styles.primaryBtnCompact}
                              variant={
                                gEditLangTab === "en"
                                  ? "primary"
                                  : "outline-secondary"
                              }
                              onClick={() => setGEditLangTab("en")}
                            >
                              EN
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className={styles.primaryBtnCompact}
                              variant={
                                gEditLangTab === "est"
                                  ? "primary"
                                  : "outline-secondary"
                              }
                              onClick={() => setGEditLangTab("est")}
                            >
                              EST
                            </Button>
                          </div>

                          <Form.Control
                            className={styles.inputTopGap}
                            placeholder={
                              gEditLangTab === "ru"
                                ? "Название (RU)"
                                : gEditLangTab === "en"
                                  ? "Название (EN)"
                                  : "Название (EST)"
                            }
                            value={
                              gEditLangTab === "ru"
                                ? g.title || ""
                                : gEditT?.[g.id]?.[gEditLangTab] || ""
                            }
                            onChange={(e) => {
                              const v = e.target.value;

                              if (gEditLangTab === "ru") {
                                setGroups((prev) =>
                                  prev.map((x) =>
                                    x.id === g.id ? { ...x, title: v } : x,
                                  ),
                                );
                                return;
                              }

                              setGEditT((prev) => ({
                                ...prev,
                                [g.id]: {
                                  ...(prev[g.id] || {}),
                                  [gEditLangTab]: v,
                                },
                              }));
                            }}
                            onBlur={(e) => {
                              const v = e.target.value.trim();

                              if (gEditLangTab === "ru") {
                                if (v && v !== g.title)
                                  onUpdateGroup(g, { title: v });
                                return;
                              }

                              onUpdateGroup(g, {
                                translations: {
                                  title: { ...(gEditT[g.id] || {}) },
                                },
                              });
                            }}
                          />
                        </Form.Group>

                        {/* Тип выбора */}
                        <Form.Group className={styles.colType}>
                          <Form.Label>Тип выбора</Form.Label>
                          <Form.Select
                            value={g.type}
                            onChange={(e) =>
                              onUpdateGroup(g, { type: e.target.value })
                            }
                          >
                            <option value="single">Один вариант</option>
                            <option value="multi">Несколько вариантов</option>
                          </Form.Select>
                        </Form.Group>

                        {/* Обязательно */}
                        <Form.Group className={styles.colRequired}>
                          <Form.Label className={styles.labelGhost}>
                            .
                          </Form.Label>
                          <Form.Check
                            type="switch"
                            label="Обязательно"
                            defaultChecked={!!g.isRequired}
                            onChange={(e) =>
                              onUpdateGroup(g, { isRequired: e.target.checked })
                            }
                          />
                        </Form.Group>

                        {/* Мин/Макс только для multi */}
                        {g.type === "multi" && (
                          <>
                            <Form.Group className={styles.colMin}>
                              <Form.Label>Мин. выбор</Form.Label>
                              <Form.Control
                                type="number"
                                defaultValue={g.minSelect ?? ""}
                                onBlur={(e) =>
                                  onUpdateGroup(g, {
                                    minSelect: e.target.value,
                                  })
                                }
                              />
                            </Form.Group>

                            <Form.Group className={styles.colMax}>
                              <Form.Label>Макс. выбор</Form.Label>
                              <Form.Control
                                type="number"
                                defaultValue={g.maxSelect ?? ""}
                                onBlur={(e) =>
                                  onUpdateGroup(g, {
                                    maxSelect: e.target.value,
                                  })
                                }
                              />
                            </Form.Group>
                          </>
                        )}

                        {/* Порядок */}
                        <Form.Group className={styles.colOrder}>
                          <Form.Label>Порядок</Form.Label>
                          <Form.Control
                            type="number"
                            defaultValue={g.displayOrder ?? 0}
                            onBlur={(e) =>
                              onUpdateGroup(g, { displayOrder: e.target.value })
                            }
                          />
                        </Form.Group>

                        {/* Deactivate */}
                        <Form.Group className={styles.colActions}>
                          <Form.Label className={styles.labelGhost}>
                            .
                          </Form.Label>
                          <Button
                            variant="outline-danger"
                            className={styles.primaryBtnCompact}
                            onClick={() => onDeactivateGroup(g)}
                          >
                            Deactivate group
                          </Button>
                        </Form.Group>
                      </div>

                      {/* дальше у тебя остаётся блок Options без изменений */}

                      <div className={styles.sectionHeader}>
                        <b>Options</b>
                        <Button
                          size="sm"
                          className={styles.primaryBtnCompact}
                          onClick={() => {
                            setNewOptForGroup(g.id);
                            setOForm({
                              title: "",
                              priceDelta: "0",
                              displayOrder: 0,
                              isDefault: false,
                              translations: {
                                title: { ru: "", en: "", est: "" },
                              },
                            });
                          }}
                        >
                          + Option
                        </Button>
                      </div>

                      {newOptForGroup === g.id && (
                        <div className={`${styles.box} ${styles.boxMb12}`}>
                          <Form.Label>Название опции</Form.Label>

                          <div className={styles.rowWrap10Center}>
                            <Button
                              type="button"
                              size="sm"
                              className={styles.primaryBtnCompact}
                              variant={
                                oLangTab === "ru"
                                  ? "primary"
                                  : "outline-secondary"
                              }
                              onClick={() => setOLangTab("ru")}
                            >
                              RU
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className={styles.primaryBtnCompact}
                              variant={
                                oLangTab === "en"
                                  ? "primary"
                                  : "outline-secondary"
                              }
                              onClick={() => setOLangTab("en")}
                            >
                              EN
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className={styles.primaryBtnCompact}
                              variant={
                                oLangTab === "est"
                                  ? "primary"
                                  : "outline-secondary"
                              }
                              onClick={() => setOLangTab("est")}
                            >
                              EST
                            </Button>

                            <Form.Control
                              className={styles.titleInput}
                              placeholder={
                                oLangTab === "ru"
                                  ? "Название (RU)"
                                  : oLangTab === "en"
                                    ? "Название (EN)"
                                    : "Название (EST)"
                              }
                              value={
                                oLangTab === "ru"
                                  ? oForm.title || ""
                                  : oForm.translations?.title?.[oLangTab] || ""
                              }
                              onChange={(e) => {
                                const v = e.target.value;

                                if (oLangTab === "ru") {
                                  setOForm((p) => ({ ...p, title: v }));
                                  return;
                                }

                                setOForm((p) => ({
                                  ...p,
                                  translations: {
                                    ...(p.translations || {}),
                                    title: {
                                      ...((p.translations &&
                                        p.translations.title) ||
                                        {}),
                                      [oLangTab]: v,
                                    },
                                  },
                                }));
                              }}
                            />

                            <Form.Control
                              className={styles.fieldW140}
                              placeholder="price delta"
                              value={oForm.priceDelta}
                              onChange={(e) =>
                                setOForm((p) => ({
                                  ...p,
                                  priceDelta: e.target.value,
                                }))
                              }
                            />
                            <Form.Control
                              className={styles.fieldW120}
                              type="number"
                              placeholder="order"
                              value={oForm.displayOrder}
                              onChange={(e) =>
                                setOForm((p) => ({
                                  ...p,
                                  displayOrder: e.target.value,
                                }))
                              }
                            />
                            <Form.Check
                              type="switch"
                              label="Default"
                              checked={oForm.isDefault}
                              onChange={(e) =>
                                setOForm((p) => ({
                                  ...p,
                                  isDefault: e.target.checked,
                                }))
                              }
                            />
                          </div>

                          <div className={styles.footerRowTop10}>
                            <Button
                              size="sm"
                              className={styles.primaryBtnCompact}
                              onClick={() => onCreateOption(g.id)}
                            >
                              Save option
                            </Button>
                            <Button
                              size="sm"
                              className={styles.primaryBtnCompact}
                              variant="outline-secondary"
                              onClick={() => setNewOptForGroup(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}

                      {(g.options || []).length === 0 ? (
                        <div className={styles.muted}>No options</div>
                      ) : (
                        <div className={styles.stack10}>
                          {(g.options || []).map((o) => (
                            <div key={o.id} className={styles.card}>
                              <div className={styles.optGrid}>
                                {/* Название + табы */}
                                <Form.Group className={styles.colTitle}>
                                  <Form.Label>Название опции</Form.Label>

                                  <div className={styles.langRow}>
                                    <Button
                                      className={styles.primaryBtnCompact}
                                      type="button"
                                      size="sm"
                                      variant={
                                        oEditLangTab === "ru"
                                          ? "primary"
                                          : "outline-secondary"
                                      }
                                      onClick={() => setOEditLangTab("ru")}
                                    >
                                      RU
                                    </Button>
                                    <Button
                                      className={styles.primaryBtnCompact}
                                      type="button"
                                      size="sm"
                                      variant={
                                        oEditLangTab === "en"
                                          ? "primary"
                                          : "outline-secondary"
                                      }
                                      onClick={() => setOEditLangTab("en")}
                                    >
                                      EN
                                    </Button>
                                    <Button
                                      className={styles.primaryBtnCompact}
                                      type="button"
                                      size="sm"
                                      variant={
                                        oEditLangTab === "est"
                                          ? "primary"
                                          : "outline-secondary"
                                      }
                                      onClick={() => setOEditLangTab("est")}
                                    >
                                      EST
                                    </Button>
                                  </div>

                                  <Form.Control
                                    className={styles.inputTopGap}
                                    placeholder={
                                      oEditLangTab === "ru"
                                        ? "Название (RU)"
                                        : oEditLangTab === "en"
                                          ? "Название (EN)"
                                          : "Название (EST)"
                                    }
                                    value={
                                      oEditLangTab === "ru"
                                        ? o.title || ""
                                        : oEditT?.[o.id]?.[oEditLangTab] || ""
                                    }
                                    onChange={(e) => {
                                      const v = e.target.value;

                                      if (oEditLangTab === "ru") {
                                        setGroups((prev) =>
                                          prev.map((gr) =>
                                            gr.id !== g.id
                                              ? gr
                                              : {
                                                  ...gr,
                                                  options: (
                                                    gr.options || []
                                                  ).map((x) =>
                                                    x.id === o.id
                                                      ? { ...x, title: v }
                                                      : x,
                                                  ),
                                                },
                                          ),
                                        );
                                        return;
                                      }

                                      setOEditT((prev) => ({
                                        ...prev,
                                        [o.id]: {
                                          ...(prev[o.id] || {}),
                                          [oEditLangTab]: v,
                                        },
                                      }));
                                    }}
                                    onBlur={(e) => {
                                      const v = e.target.value.trim();

                                      if (oEditLangTab === "ru") {
                                        if (v && v !== o.title)
                                          onUpdateOption(o, { title: v });
                                        return;
                                      }

                                      onUpdateOption(o, {
                                        translations: {
                                          title: { ...(oEditT[o.id] || {}) },
                                        },
                                      });
                                    }}
                                  />
                                </Form.Group>

                                {/* Price delta */}
                                <Form.Group className={styles.colPrice}>
                                  <Form.Label>Price delta</Form.Label>
                                  <Form.Control
                                    defaultValue={o.priceDelta ?? 0}
                                    onBlur={(e) =>
                                      onUpdateOption(o, {
                                        priceDelta: e.target.value,
                                      })
                                    }
                                  />
                                </Form.Group>

                                {/* Порядок */}
                                <Form.Group className={styles.colOrder}>
                                  <Form.Label>Порядок</Form.Label>
                                  <Form.Control
                                    type="number"
                                    defaultValue={o.displayOrder ?? 0}
                                    onBlur={(e) =>
                                      onUpdateOption(o, {
                                        displayOrder: e.target.value,
                                      })
                                    }
                                  />
                                </Form.Group>

                                {/* Default */}
                                <Form.Group className={styles.colRequired}>
                                  <Form.Label className={styles.labelGhost}>
                                    .
                                  </Form.Label>
                                  <Form.Check
                                    type="switch"
                                    label="По умолчанию"
                                    defaultChecked={!!o.isDefault}
                                    onChange={(e) =>
                                      onUpdateOption(o, {
                                        isDefault: e.target.checked,
                                      })
                                    }
                                  />
                                </Form.Group>

                                {/* Deactivate */}
                                <Form.Group className={styles.colActions}>
                                  <Form.Label className={styles.labelGhost}>
                                    .
                                  </Form.Label>
                                  <Button
                                    size="sm"
                                    className={styles.primaryBtnCompact}
                                    variant="outline-danger"
                                    onClick={() => onDeactivateOption(o)}
                                  >
                                    Deactivate
                                  </Button>
                                </Form.Group>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </Accordion.Body>
                  </Accordion.Item>
                ))}
              </Accordion>
            )}
          </>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default MenuItemOptionsModal;
