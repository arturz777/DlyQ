import React, { useEffect, useState } from "react";
import { Modal, Button, Form } from "react-bootstrap";
import { createMenuCategory, updateMenuCategory } from "../../http/menuAPI";

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

  useEffect(() => {
    if (!show) return;

    if (isEdit) {
      setName(editableCategory?.name || "");
      setIsActive(editableCategory?.isActive ?? true);
    } else {
      setName("");
      setIsActive(true);
    }
  }, [show, isEdit, editableCategory]);

  const handleClose = () => {
    if (loading) return;
    onHide?.();
  };

  const handleSubmit = async () => {
    const sid = sellerId ?? editableCategory?.sellerId;
    if (!sid) {
      alert("sellerId не выбран");
      return;
    }
    if (!name.trim()) {
      alert("Введите название категории");
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("sellerId", String(sid));
      fd.append("name", name.trim());
      fd.append("isActive", String(!!isActive));

      let saved;
      if (isEdit) {
        saved = await updateMenuCategory(editableCategory.id, fd);
      } else {
        saved = await createMenuCategory(fd);
      }

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
            <Form.Label>Название</Form.Label>
            <Form.Control
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Супы"
            />
          </Form.Group>

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
