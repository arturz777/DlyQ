import React, { useState, useEffect } from "react";
import Modal from "react-bootstrap/Modal";
import { Form, Button } from "react-bootstrap";
import { createBrand, updateBrand } from "../../http/deviceAPI";

const CreateBrand = ({ show, onHide, editableBrand, onBrandSaved, initialName = "" }) => {
  const [value, setValue] = useState("");
  const [errors, setErrors] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    if (editableBrand) setValue(editableBrand.name || "");
    else setValue(initialName || "");
    setErrors({});
    setIsSubmitted(false);
  }, [editableBrand, initialName, show]);

  const handleSave = () => {
    setIsSubmitted(true);

    const trimmed = value.trim();
    if (!trimmed) {
      setErrors({ name: "Введите название бренда" });
      return;
    }

    if (editableBrand) {
      updateBrand(editableBrand.id, { name: trimmed })
        .then((data) => {
          setErrors({});
          setValue("");
          onHide();
          onBrandSaved?.(data ?? { id: editableBrand.id, name: trimmed });
        })
        .catch((err) => console.error(err));
    } else {
      createBrand({ name: trimmed })
        .then((data) => {
          setErrors({});
          setValue("");
          onHide();
          onBrandSaved?.(data);
        })
        .catch((err) => console.error(err));
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          {editableBrand ? "Редактировать бренд" : "Добавить бренд"}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Form>
          <Form.Control
            placeholder="Введите название бренда"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          {isSubmitted && !value.trim() && (
            <span style={{ color: "red", display: "block", marginTop: 5 }}>
              {errors.name || "Введите название бренда"}
            </span>
          )}
        </Form>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="outline-danger" onClick={onHide}>
          Закрыть
        </Button>
        <Button variant="outline-success" onClick={handleSave}>
          {editableBrand ? "Сохранить изменения" : "Добавить"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default CreateBrand;
