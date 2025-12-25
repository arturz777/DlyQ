import React, { useEffect, useState } from "react";
import { Modal, Button, Form } from "react-bootstrap";
import { createMenuCategory, updateMenuCategory } from "../../http/menuAPI";

const TRANS_LANGS = [
  { code: "est", label: "EST" },
  { code: "en", label: "EN" },
];

const emptyLangMap = () =>
  TRANS_LANGS.reduce((acc, l) => {
    acc[l.code] = "";
    return acc;
  }, {});

const CreateMenuCategory = ({
  show,
  onHide,
  editableCategory = null,
  sellerId = null,
  onSaved,
}) => {
  const isEdit = !!editableCategory?.id;

  const [name, setName] = useState("");

  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);

  const [tName, setTName] = useState(emptyLangMap());

  useEffect(() => {
    if (!show) return;

    if (isEdit) {
      setName(editableCategory?.name || "");
      setIsActive(editableCategory?.isActive ?? true);

      const fromApi = editableCategory?.translations?.name || {};
      const next = emptyLangMap();
      for (const { code } of TRANS_LANGS) next[code] = fromApi[code] || "";
      setTName(next);
    } else {
      setName("");
      setIsActive(true);
      setTName(emptyLangMap());
    }
  }, [show, isEdit, editableCategory]);

  const handleClose = () => {
    if (loading) return;
    onHide?.();
  };

  const handleSubmit = async () => {
    const sid = sellerId ?? editableCategory?.sellerId;
    if (!sid) return alert("sellerId не выбран");
    if (!name.trim()) return alert("Введите название категории (RU)");

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("sellerId", String(sid));

      fd.append("name", name.trim());

      fd.append("isActive", String(!!isActive));

      fd.append(
        "translations",
        JSON.stringify({
          name: tName,
        })
      );

      const saved = isEdit
        ? await updateMenuCategory(editableCategory.id, fd)
        : await createMenuCategory(fd);

      onSaved?.(saved);
      onHide?.();
    } catch (e) {
      console.error(e);
      alert("Ошибка сохранения категории");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={handleClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>
          {isEdit ? "Редактировать категорию" : "Добавить категорию"}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Form>
          <Form.Group className="mb-3">
            <Form.Label>Название (RU) *</Form.Label>
            <Form.Control
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Супы"
            />
          </Form.Group>

          <div className="mb-3">
            <div className="fw-bold mb-2">Переводы названия</div>
            {TRANS_LANGS.map((l) => (
              <Form.Group className="mb-2" key={l.code}>
                <Form.Label>{l.label}</Form.Label>
                <Form.Control
                  value={tName[l.code]}
                  onChange={(e) =>
                    setTName((prev) => ({ ...prev, [l.code]: e.target.value }))
                  }
                  placeholder={`Название (${l.label})`}
                />
              </Form.Group>
            ))}
          </div>

          <Form.Group>
            <Form.Check
              type="checkbox"
              label="Активна"
              checked={!!isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
          </Form.Group>
        </Form>
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

export default CreateMenuCategory;
