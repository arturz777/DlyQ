import React, { useEffect, useMemo, useState } from "react";
import { Modal, Button, Form, Tabs, Tab } from "react-bootstrap";
import { createMenuItem, updateMenuItem } from "../../http/menuAPI";

const TRANS_LANGS = [
  { code: "est", label: "EST" },
  { code: "en", label: "EN" },
];

const emptyLangMap = () =>
  TRANS_LANGS.reduce((acc, l) => {
    acc[l.code] = "";
    return acc;
  }, {});

const CreateMenuItem = ({
  show,
  onHide,
  editableItem = null,
  sellerId = null,
  categories = [],
  initialCategoryId = null,
  onSaved,
}) => {
  const isEdit = !!editableItem?.id;

  const activeCategories = useMemo(
    () => (categories || []).filter((c) => c?.isActive !== false),
    [categories]
  );

  const [activeTab, setActiveTab] = useState("ru");
  const [transTab, setTransTab] = useState("name");

  // ✅ RU
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // прочее
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [img, setImg] = useState(null);

  const [isAvailable, setIsAvailable] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);

  const [tName, setTName] = useState(emptyLangMap());
  const [tDescription, setTDescription] = useState(emptyLangMap());

  useEffect(() => {
    if (!show) return;

    setActiveTab("ru");
    setTransTab("name");

    if (isEdit) {
      setName(editableItem?.name || "");
      setDescription(editableItem?.description || "");
      setPrice(editableItem?.price != null ? String(editableItem.price) : "");
      setCategoryId(
        editableItem?.categoryId != null ? String(editableItem.categoryId) : ""
      );
      setImg(null);

      setIsAvailable(editableItem?.isAvailable ?? true);
      setIsActive(editableItem?.isActive ?? true);

      const t = editableItem?.translations || {};
      const nFromApi = t?.name || {};
      const dFromApi = t?.description || {};

      const nextN = emptyLangMap();
      const nextD = emptyLangMap();
      for (const { code } of TRANS_LANGS) {
        nextN[code] = nFromApi[code] || "";
        nextD[code] = dFromApi[code] || "";
      }
      setTName(nextN);
      setTDescription(nextD);
    } else {
      setName("");
      setDescription("");
      setPrice("");
      setCategoryId(
        initialCategoryId
          ? String(initialCategoryId)
          : activeCategories?.[0]?.id
          ? String(activeCategories[0].id)
          : ""
      );
      setImg(null);

      setIsAvailable(true);
      setIsActive(true);

      setTName(emptyLangMap());
      setTDescription(emptyLangMap());
    }
  }, [show, isEdit, editableItem, activeCategories]);

  const handleClose = () => {
    if (loading) return;
    onHide?.();
  };

  const handleSubmit = async () => {
    const sid = sellerId ?? editableItem?.sellerId;
    if (!sid) return alert("sellerId не выбран");

    if (!name.trim()) {
      setActiveTab("ru");
      return alert("Введите название блюда (RU)");
    }

    const p = Number(price);
    if (!Number.isFinite(p) || p <= 0) {
      setActiveTab("settings");
      return alert("Цена должна быть числом больше 0");
    }

    if (!categoryId) {
      setActiveTab("settings");
      return alert("Выберите категорию");
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("sellerId", String(sid));

      fd.append("name", name.trim());
      fd.append("description", description.trim());

      fd.append("price", String(p));
      fd.append("categoryId", String(categoryId));
      fd.append("isAvailable", String(!!isAvailable));
      fd.append("isActive", String(!!isActive));
      if (img) fd.append("img", img);

      fd.append(
        "translations",
        JSON.stringify({
          name: tName,
          description: tDescription,
        })
      );

      const saved = isEdit
        ? await updateMenuItem(editableItem.id, fd)
        : await createMenuItem(fd);

      onSaved?.(saved);
      onHide?.();
    } catch (e) {
      console.error(e);
      alert("Ошибка сохранения блюда");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={handleClose} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>
          {isEdit ? "Редактировать блюдо" : "Добавить блюдо"}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Tabs
          activeKey={activeTab}
          onSelect={(k) => k && setActiveTab(k)}
          className="mb-3"
          justify
          mountOnEnter
          unmountOnExit
        >
          <Tab eventKey="ru" title="RU">
            <Form.Group className="mb-3">
              <Form.Label>Название (RU) *</Form.Label>
              <Form.Control
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: Борщ"
              />
            </Form.Group>

            <Form.Group>
              <Form.Label>Описание (RU)</Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Короткое описание"
              />
            </Form.Group>
          </Tab>

          <Tab eventKey="translations" title="Переводы">
            <div className="small text-muted mb-2">
              Переводы не обязательны. RU берётся из основных полей.
            </div>

            <Tabs
              activeKey={transTab}
              onSelect={(k) => k && setTransTab(k)}
              className="mb-3"
              mountOnEnter
              unmountOnExit
            >
              <Tab eventKey="name" title="Название">
                {TRANS_LANGS.map((l) => (
                  <Form.Group className="mb-2" key={`tname-${l.code}`}>
                    <Form.Label>Название ({l.label})</Form.Label>
                    <Form.Control
                      value={tName[l.code]}
                      onChange={(e) =>
                        setTName((prev) => ({
                          ...prev,
                          [l.code]: e.target.value,
                        }))
                      }
                      placeholder={`Название (${l.label})`}
                    />
                  </Form.Group>
                ))}
              </Tab>

              <Tab eventKey="description" title="Описание">
                {TRANS_LANGS.map((l) => (
                  <Form.Group className="mb-2" key={`tdesc-${l.code}`}>
                    <Form.Label>Описание ({l.label})</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={tDescription[l.code]}
                      onChange={(e) =>
                        setTDescription((prev) => ({
                          ...prev,
                          [l.code]: e.target.value,
                        }))
                      }
                      placeholder={`Описание (${l.label})`}
                    />
                  </Form.Group>
                ))}
              </Tab>
            </Tabs>
          </Tab>

          <Tab eventKey="settings" title="Настройки">
            <Form.Group className="mb-3">
              <Form.Label>Категория</Form.Label>
              <Form.Select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">-- выберите --</option>
                {activeCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Цена (€)</Form.Label>
              <Form.Control
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Например: 6.90"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Фото (одно)</Form.Label>
              <Form.Control
                type="file"
                accept="image/*"
                onChange={(e) => setImg(e.target.files?.[0] || null)}
              />
            </Form.Group>

            <Form.Group className="mb-2">
              <Form.Check
                type="checkbox"
                label="Доступно для заказа"
                checked={!!isAvailable}
                onChange={(e) => setIsAvailable(e.target.checked)}
              />
            </Form.Group>

            <Form.Group>
              <Form.Check
                type="checkbox"
                label="Активно (не удалено)"
                checked={!!isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
            </Form.Group>
          </Tab>
        </Tabs>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Отмена
        </Button>
        <Button variant="primary" disabled={loading} onClick={handleSubmit}>
          {loading ? "Сохранение..." : "Сохранить"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default CreateMenuItem;
