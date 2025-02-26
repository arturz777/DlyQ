import React, { useState, useEffect } from "react";
import Modal from "react-bootstrap/Modal";
import { Form, Button } from "react-bootstrap";
import { createType, updateType } from "../../http/deviceAPI";

const CreateType = ({ show, onHide, editableType, onTypeSaved }) => {
  const [value, setValue] = useState("");
  const [file, setFile] = useState(null);
  const [existingImage, setExistingImage] = useState(null);
  const [errors, setErrors] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    if (editableType) {
      setValue(editableType.name);
      setExistingImage(editableType.img);
      setFile(null);
    } else {
      resetFields();
    }
  }, [editableType]);

  const resetFields = () => {
    setValue("");
    setFile(null);
    setExistingImage(null);
    setErrors({});
    setIsSubmitted(false);
  };

  const selectFile = (e) => {
    setFile(e.target.files[0]);
  };

  const addType = () => {
    setIsSubmitted(true);

    if (!value) {
      setErrors({ name: "Введите название типа" });
      return;
    }

    if (!file && !existingImage) {
      setErrors({ img: "Загрузите изображение" });
      return;
    }

    const formData = new FormData();
    formData.append("name", value);
    if (file) formData.append("img", file);

    const saveAction = editableType
      ? updateType(editableType.id, formData)
      : createType(formData);

    saveAction
      .then(() => {
        onHide();
        onTypeSaved();
        resetFields();
      })
      .catch((err) => {
        console.error("Ошибка при сохранении типа:", err);
      });
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

          <Form.Control type="file" onChange={selectFile} />
          {existingImage && !file && (
            <div className="mt-2">
               <img
                  src={existingImage}
                  alt="Текущее изображение"
                  style={{
                    width: "100px",
                    borderRadius: "5px",
                    objectFit: "cover",
                    border: "1px solid #ddd",
                    padding: "5px",
                  }}
                />
            </div>
          )}
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
