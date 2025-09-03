import React, { useEffect, useState } from "react";
import Modal from "react-bootstrap/Modal";
import { Button, Form } from "react-bootstrap";
import { createMake, updateMake } from "../../http/deviceAPI";

const CreateMake = ({ show, onHide, editableMake, onSaved }) => {
  const isEdit = Boolean(editableMake?.id);
  const [name, setName] = useState("");
  const [displayOrder, setDisplayOrder] = useState("");

  useEffect(() => {
    if (isEdit) {
      setName(editableMake.name || "");
      setDisplayOrder(
        editableMake.displayOrder !== undefined
          ? String(editableMake.displayOrder)
          : ""
      );
    } else {
      setName("");
      setDisplayOrder("");
    }
  }, [isEdit, editableMake, show]);

  const handleSave = async () => {
    const payload = {
      name: name.trim(),
      displayOrder: displayOrder === "" ? null : Number(displayOrder),
    };
    if (!payload.name) return;

    if (isEdit) {
      await updateMake(editableMake.id, payload);
    } else {
      await createMake(payload);
    }

    onSaved?.();
    onHide?.();
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>
          {isEdit ? "Редактировать марку" : "Добавить марку"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group className="mb-3">
            <Form.Label>Название</Form.Label>
            <Form.Control
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Напр., Toyota"
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Порядок отображения (необязательно)</Form.Label>
            <Form.Control
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
              placeholder="0"
            />
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide}>
          Отмена
        </Button>
        <Button variant="primary" onClick={handleSave}>
          Сохранить
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default CreateMake;
