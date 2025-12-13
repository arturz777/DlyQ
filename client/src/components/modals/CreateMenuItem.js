import React, { useEffect, useMemo, useState } from "react";
import { Modal, Button, Form } from "react-bootstrap";
import { createMenuItem, updateMenuItem } from "../../http/menuAPI";

const CreateMenuItem = ({
  show,
  onHide,
  editableItem = null,
  sellerId = null,
  categories = [],
  onSaved,
}) => {
  const isEdit = !!editableItem?.id;

  const activeCategories = useMemo(
    () => (categories || []).filter((c) => c?.isActive !== false),
    [categories]
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [img, setImg] = useState(null);

  const [isAvailable, setIsAvailable] = useState(true);
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!show) return;

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
    } else {
      setName("");
      setDescription("");
      setPrice("");
      setCategoryId(
        activeCategories?.[0]?.id ? String(activeCategories[0].id) : ""
      );
      setImg(null);
      setIsAvailable(true);
      setIsActive(true);
    }
  }, [show, isEdit, editableItem, activeCategories]);

  const handleClose = () => {
    if (loading) return;
    onHide?.();
  };

  const handleSubmit = async () => {
    const sid = sellerId ?? editableItem?.sellerId;
    if (!sid) {
      alert("sellerId не выбран");
      return;
    }

    if (!name.trim()) {
      alert("Введите название блюда");
      return;
    }

    const p = Number(price);
    if (!Number.isFinite(p) || p <= 0) {
      alert("Цена должна быть числом больше 0");
      return;
    }

    if (!categoryId) {
      alert("Выберите категорию");
      return;
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

      let saved;
      if (isEdit) {
        saved = await updateMenuItem(editableItem.id, fd);
      } else {
        saved = await createMenuItem(fd);
      }

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
        <Form>
          <div className="row">
            <div className="col-md-7">
              <Form.Group className="mb-3">
                <Form.Label>Название</Form.Label>
                <Form.Control
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Например: Борщ"
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Описание</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Короткое описание"
                />
              </Form.Group>
            </div>

            <div className="col-md-5">
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
            </div>
          </div>
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

export default CreateMenuItem;
