import React, { useEffect, useState } from "react";
import { Modal, Button, Form } from "react-bootstrap";
import { createSeller, updateSeller } from "../../http/sellerAPI";

const CreateSeller = ({ show, onHide, editableSeller = null, onSaved }) => {
  const isEdit = !!editableSeller?.id;

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [kind, setKind] = useState("");
  const [img, setImg] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [ownerUserId, setOwnerUserId] = useState("");

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!show) return;

    if (isEdit) {
      setName(editableSeller?.name || "");
      setSlug(editableSeller?.slug || "");
      setKind(editableSeller?.kind || "");
      setImg(editableSeller?.img || "");
      setIsActive(
        editableSeller?.isActive === undefined
          ? true
          : !!editableSeller.isActive
      );

      setOwnerUserId("");
    } else {
      setName("");
      setSlug("");
      setKind("");
      setImg("");
      setIsActive(true);
      setOwnerUserId("");
    }
  }, [show, isEdit, editableSeller]);

  const handleClose = () => {
    if (loading) return;
    onHide?.();
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert("Введите название магазина");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        slug: slug.trim() || undefined,
        kind: kind.trim() || undefined,
        img: img.trim() || undefined,
        isActive,
      };

      const ownerIdNum = Number(ownerUserId);
      if (ownerUserId && !ownerIdNum) {
        alert("ownerUserId должен быть числом");
        setLoading(false);
        return;
      }

      if (ownerIdNum) {
        payload.ownerUserId = ownerIdNum;
      }

      let saved;
      if (isEdit) {
        saved = await updateSeller(editableSeller.id, payload);
      } else {
        saved = await createSeller(payload);
      }

      onSaved?.(saved);
      onHide?.();
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || "Ошибка сохранения магазина");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={handleClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>
          {isEdit ? "Редактировать магазин" : "Добавить магазин"}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Form>
          <Form.Group className="mb-3">
            <Form.Label>Название магазина</Form.Label>
            <Form.Control
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Pizza Boom"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Slug (опционально)</Form.Label>
            <Form.Control
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="pizzaboom (если пусто — сгенерируется из названия)"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Тип / описание (kind, опционально)</Form.Label>
            <Form.Control
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              placeholder="Например: Пиццерия, Суши, Веган и т.п."
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Картинка (URL, опционально)</Form.Label>
            <Form.Control
              value={img}
              onChange={(e) => setImg(e.target.value)}
              placeholder="https://... или пусто"
            />
            <Form.Text>
              Позже можно будет сделать загрузку файла, пока достаточно URL.
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>ownerUserId (ID владельца, опционально)</Form.Label>
            <Form.Control
              value={ownerUserId}
              onChange={(e) => setOwnerUserId(e.target.value)}
              placeholder={
                isEdit
                  ? "ID пользователя, которого сделать (или добавить как) владельца магазина"
                  : "ID пользователя, который будет владельцем магазина"
              }
            />
            <Form.Text>
              Если поле пустое — владелец не изменится (при редактировании) / не
              будет назначен (при создании).
              <ul style={{ marginBottom: 0 }}>
                <li>
                  При указании корректного userId создаётся запись в SellerUser
                  с ролью owner
                </li>
                <li>
                  Пользователю автоматически присваивается роль SELLER (если он
                  не ADMIN)
                </li>
              </ul>
            </Form.Text>
          </Form.Group>

          <Form.Group>
            <Form.Check
              type="checkbox"
              label="Магазин активен"
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

export default CreateSeller;
