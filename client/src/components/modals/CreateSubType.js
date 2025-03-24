import React, { useState, useEffect } from "react";
import Modal from "react-bootstrap/Modal";
import { Form, Button } from "react-bootstrap";
import { createSubtype, fetchTypes, updateSubType } from "../../http/deviceAPI";

const CreateSubType = ({ show, onHide, editableSubtype, onSubtypeSaved }) => {
  const [value, setValue] = useState("");
  const [typeId, setTypeId] = useState("");
  const [types, setTypes] = useState([]);
  const [errors, setErrors] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [translations, setTranslations] = useState({
    en: "",
    ru: "",
    est: "",
  });

  useEffect(() => {
    fetchTypes().then((data) => {
      setTypes(data || []);
    });
  }, []);

  useEffect(() => {
    if (editableSubtype) {
      setValue(editableSubtype.name || "");
      setTypeId(editableSubtype.typeId || "");
      setTranslations(editableSubtype.translations || { en: "", ru: "", est: "" });
    } else {
      setValue("");
      setTypeId("");
      setTranslations({ en: "", ru: "", est: "" });
    }
  }, [editableSubtype]);

  const addSubType = () => {
    const errors = {};
    if (!value) errors.name = "Введите название подтипа";
    if (!typeId) errors.typeId = "Выберите тип";
    setErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    const data = { 
      name: value, 
      typeId: Number(typeId),
      translations: JSON.stringify({ name: translations }), 
    };

    if (editableSubtype) {
      updateSubType(editableSubtype.id, data)
        .then(() => {
          onSubtypeSaved();
          setValue("");
          setTypeId("");
          onHide();
        })
        .catch((err) => {
          console.error("Ошибка при обновлении подтипа:", err);
        });
    } else {
      createSubtype(data)
        .then(() => {
          onSubtypeSaved();
          setValue("");
          setTypeId("");
          onHide();
        })
        .catch((err) => {
          console.error("Ошибка при создании подтипа:", err);
        });
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title id="contained-modal-title-vcenter">
          {editableSubtype ? "Редактировать подтип" : "Добавить подтип"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Control
            value={value || ""}
            onChange={(e) => {
              setValue(e.target.value);
              if (errors.name) setErrors((prev) => ({ ...prev, name: null }));
            }}
            placeholder="Введите название подтипа"
          />
          {isSubmitted && !value && (
            <span style={{ color: "red", display: "block", marginTop: "5px" }}>
              Введите название подтипа
            </span>
          )}

          <Form.Select
            className="mt-3"
            value={typeId || ""}
            onChange={(e) => {
              setTypeId(e.target.value);
              if (errors.typeId)
                setErrors((prev) => ({ ...prev, typeId: null }));
            }}
          >
            <option value="">Выберите тип</option>
            {types.map((type) => (
              <option key={type.id} value={String(type.id)}>
                {type.name}
              </option>
            ))}
          </Form.Select>

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
          
          {isSubmitted && !typeId && (
            <span style={{ color: "red", display: "block", marginTop: "5px" }}>
              Выберите тип
            </span>
          )}
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-danger" onClick={onHide}>
          Закрыть
        </Button>
        <Button onClick={addSubType}>
          {editableSubtype ? "Сохранить изменения" : "Добавить"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default CreateSubType;
