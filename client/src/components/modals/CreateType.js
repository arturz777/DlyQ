import React, { useState, useEffect } from "react";
import Modal from "react-bootstrap/Modal";
import { Form, Button } from "react-bootstrap";
import { createType, updateType } from "../../http/deviceAPI";

const CreateType = ({ show, onHide, editableType, onTypeSaved }) => {
  const [value, setValue] = useState("");
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    if (editableType) {
        setValue(editableType.name);
        setFile(null); // Или оставить старое изображение
    } else {
        setValue("");
        setFile(null);
    }
}, [editableType]);

  const selectFile = (e) => {
    setFile(e.target.files[0]);
  };

  const addType = () => {
    setIsSubmitted(true);

    if (!value) {
      setErrors({ name: "Введите название типа" });
      return;
    }

    const formData = new FormData();
    formData.append("name", value);
    if (file) formData.append("img", file);

    if (editableType) {
      // Если редактируем тип
      updateType(editableType.id, formData)
        .then((data) => {
          setErrors({});
          setIsSubmitted(false);
          setValue("");
          setFile(null);
          onHide();
          onTypeSaved(); // Оповещаем о сохранении
      })
      .catch((err) => {
        setIsSubmitted(false);
      });
  } else {
    // Если создаем новый тип
    createType(formData)
      .then((data) => {
        setErrors({});
        setIsSubmitted(false);
        setValue("");
        setFile(null);
        onHide();
      })
      .catch((err) => {
        setIsSubmitted(false);
      });
    }
    
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
    <Modal.Header closeButton>
    <Modal.Title id="contained-modal-title-vcenter">
          {editableType ? "Редактировать тип" : "Добавить тип"}
        </Modal.Title>
    </Modal.Header>
    <Modal.Body>
      <Form>
        <Form.Control
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Введите название типа"
        />
        {isSubmitted && !value && (
          <span style={{ color: "red", display: "block", marginTop: "5px" }}>
            Введите название типа
          </span>
        )}

        <Form.Control
          className="mt-3"
          type="file"
          onChange={selectFile}
        />
        {isSubmitted && !file && (
          <span style={{ color: "red", display: "block", marginTop: "5px" }}>
            Загрузите изображение
          </span>
        )}
      </Form>
    </Modal.Body>
    <Modal.Footer>
      <Button variant="outline-danger" onClick={onHide}>
        Закрыть
      </Button>
      <Button onClick={addType}>
          {editableType ? "Сохранить изменения" : "Добавить"}
        </Button>
    </Modal.Footer>
  </Modal>
  );
};

export default CreateType;
