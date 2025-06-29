import React, { useState, useEffect } from "react";
import Modal from "react-bootstrap/Modal";
import { Form, Button } from "react-bootstrap";
import { createType, updateType } from "../../http/deviceAPI";

const CreateType = ({ show, onHide, editableType, onTypeSaved, types }) => {
  const [displayOrder, setDisplayOrder] = useState(0);
  const [value, setValue] = useState("");
  const [file, setFile] = useState(null);
  const [existingImage, setExistingImage] = useState(null);
  const [errors, setErrors] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [translations, setTranslations] = useState({
    en: "",
    ru: "",
    est: "",
  });

  const isEditMode = !!editableType;

  useEffect(() => {
    if (editableType) {
      setValue(editableType.name);
      setExistingImage(editableType.img);
      setFile(null);
      setTranslations(
        editableType.translations?.name || { en: "", ru: "", est: "" }
      );
      setDisplayOrder(editableType.displayOrder?.toString() || "");
    } else {
      resetFields();
      const maxOrder =
        types.length > 0
          ? Math.max(...types.map((t) => t.displayOrder || 0))
          : 0;
      setDisplayOrder((maxOrder + 1).toString());
    }
  }, [editableType, types]);

  const resetFields = () => {
    setValue("");
    setFile(null);
    setExistingImage(null);
    setErrors({});
    setIsSubmitted(false);
    setTranslations({ en: "", ru: "", est: "" });
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

    const formData = new FormData();
    formData.append("displayOrder", displayOrder);

    formData.append("name", value);

    formData.append("translations", JSON.stringify({ name: translations }));

    if (file) {
      formData.append("img", file);
    }

    if (!isEditMode && !file) {
      setErrors({ img: "Загрузите изображение" });
      return;
    }

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

          <h5 className="mt-3">Переводы:</h5>
          <Form.Group>
            <Form.Label>Английский (EN)</Form.Label>
            <Form.Control
              value={translations.en || ""}
              onChange={(e) =>
                setTranslations((prev) => ({ ...prev, en: e.target.value }))
              }
              placeholder="Название на английском"
            />
          </Form.Group>

          <Form.Group>
            <Form.Label>Русский (RU)</Form.Label>
            <Form.Control
              value={translations.ru || ""}
              onChange={(e) =>
                setTranslations((prev) => ({ ...prev, ru: e.target.value }))
              }
              placeholder="Название на русском"
            />
          </Form.Group>

          <Form.Group>
            <Form.Label>Эстонский (EST)</Form.Label>
            <Form.Control
              value={translations.est || ""}
              onChange={(e) =>
                setTranslations((prev) => ({ ...prev, est: e.target.value }))
              }
              placeholder="Название на эстонском"
            />
          </Form.Group>

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
          {isSubmitted && !file && !isEditMode && (
            <span style={{ color: "red", display: "block", marginTop: "5px" }}>
              Загрузите изображение
            </span>
          )}
        </Form>
      </Modal.Body>

      <Form.Group className="mt-3">
        <Form.Label>Порядок отображения</Form.Label>
        <Form.Control
          type="text"
          value={displayOrder}
          onChange={(e) => {
            const val = e.target.value;
            if (/^\d*$/.test(val)) {
              setDisplayOrder(val);
            }
          }}
          placeholder="Например: 1, 2, 3"
          inputMode="numeric"
          autoComplete="off"
        />
      </Form.Group>

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
