import React, { useEffect, useState } from "react";
import Modal from "react-bootstrap/Modal";
import { Button, Form } from "react-bootstrap";
import { createModel, updateModel } from "../../http/deviceAPI";
import m from "./CreateModel.module.css";

const CreateModel = ({ show, onHide, editableModel, makes, onSaved }) => {
  const isEdit = Boolean(editableModel?.id);
  const [makeId, setMakeId] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    if (isEdit) {
      setMakeId(String(editableModel.makeId));
      setName(editableModel.name || "");
    } else {
      setMakeId(editableModel?.makeId ? String(editableModel.makeId) : "");
      setName("");
    }
  }, [isEdit, editableModel, show]);

  const handleSave = async () => {
    const payload = { name: name.trim(), makeId: Number(makeId) || null };
    if (!payload.name || !payload.makeId) return;

    if (isEdit) {
      await updateModel(editableModel.id, payload);
    } else {
      await createModel(payload);
    }

    onSaved?.({ makeId: payload.makeId });
    onHide?.();
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      dialogClassName={m.dialog}
      contentClassName={m.content}
      backdropClassName={m.backdrop}
    >
      <Modal.Header closeButton className={m.header}>
        <Modal.Title className={m.title}>
          {isEdit ? "Редактировать модель" : "Добавить модель"}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className={m.body}>
        <Form className={m.form}>
          <Form.Group className="mb-3">
            <Form.Label>Марка</Form.Label>
            <Form.Select
              value={makeId}
              onChange={(e) => setMakeId(e.target.value)}
            >
              <option value="">— выберите марку —</option>
              {(makes || []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group>
            <Form.Label>Название модели</Form.Label>
            <Form.Control
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Напр., Corolla"
            />
          </Form.Group>
        </Form>
      </Modal.Body>

      <Modal.Footer className={m.footer}>
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

export default CreateModel;
