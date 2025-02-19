import React, { useState, useEffect } from "react";
import Modal from "react-bootstrap/Modal";
import { Form, Button } from "react-bootstrap";
import { createBrand, updateBrand } from "../../http/deviceAPI";

const CreateBrand = ({ show, onHide, editableBrand, onBrandSaved }) => {
   const [value, setValue] = useState("");
   const [errors, setErrors] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    if (editableBrand) {
      setValue(editableBrand.name);
    } else {
      setValue("");
    }
  }, [editableBrand]);

  const handleSave = () => {
    setIsSubmitted(true);
    if (!value.trim()) {
      setErrors({ name: "Введите название бренда" });
      return;
    }

    if (editableBrand) {
      // Редактирование бренда
      updateBrand(editableBrand.id, { name: value })
        .then(() => {
          setErrors({});
          setValue("");
          onHide();
          onBrandSaved?.(); // Оповещаем о сохранении
        })
        .catch((err) => console.error(err));
    } else {
      // Создание нового бренда
      createBrand({ name: value })
        .then(() => {
          setErrors({});
          setValue("");
          onHide();
          onBrandSaved?.();
        })
        .catch((err) => console.error(err));
    }
  };
  
    const addBrand = () => {
      createBrand({ name: value }).then((data) => {
        setValue(""); 
        onHide()
      });
    };
  
  return (
<Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title id="contained-modal-title-vcenter">
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
          {isSubmitted && !value && (
            <span style={{ color: "red", display: "block", marginTop: "5px" }}>
              Введите название бренда
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
