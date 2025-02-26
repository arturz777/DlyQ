import React, { useContext, useEffect, useState } from "react";
import Modal from "react-bootstrap/Modal";
import { Button, Dropdown, Form, Row, Col } from "react-bootstrap";
import { Context } from "../../index";
import {
  createDevice,
  updateDevice,
  fetchBrands,
  fetchTypes,
  fetchSubtypesByType,
} from "../../http/deviceAPI";
import { observer } from "mobx-react-lite";
import styles from "./CreateDevice.module.css";

const CreateDevice = observer(({ index, show, onHide, editableDevice }) => {
  const { device } = useContext(Context);
  const [name, setName] = useState("");
  const [price, setPrice] = useState(null);
  const [mainImage, setMainImage] = useState(null);
  const [images, setImages] = useState(Array(5).fill(null));
  const [imagePreviews, setImagePreviews] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [info, setInfo] = useState([]);
  const [options, setOptions] = useState([]);
  const [subtypes, setSubtypes] = useState([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [quantity, setQuantity] = useState(0);

  useEffect(() => {
    // Инициализация значений для редактирования
    if (editableDevice) {
      setName(editableDevice.name);
      setPrice(editableDevice.price);
      setInfo(editableDevice.info || []);
      setOptions(editableDevice.options || []);
      setIsEditMode(true);
      setExistingImages([editableDevice.img, ...editableDevice.thumbnails]);
      setQuantity(editableDevice.quantity !== undefined ? editableDevice.quantity : 0);

      if (editableDevice.brandId) {
        const selectedBrand = device.brands.find((b) => b.id === editableDevice.brandId);
        if (selectedBrand) {
          device.setSelectedBrand(selectedBrand);
        }
      }
  
      if (editableDevice.typeId) {
        const selectedType = device.types.find((t) => t.id === editableDevice.typeId);
        if (selectedType) {
            device.setSelectedType(selectedType);
        }
    }

    // ✅ Загружаем подтипы, только если они не загружены
    if (editableDevice.typeId) {
        fetchSubtypesByType(editableDevice.typeId).then((data) => {
            device.setSubtypes(data);
            if (editableDevice.subtypeId) {
                const selectedSubType = data.find((st) => st.id === editableDevice.subtypeId);
                if (selectedSubType) {
                    device.setSelectedSubType(selectedSubType);
                }
            }
        });
    }
      
    const updatedImages = [...new Set([editableDevice.img, ...(editableDevice.thumbnails || [])])];
    setExistingImages(updatedImages);

    const updatedDisplayedImages = [...updatedImages, ...Array(5 - updatedImages.length).fill(null)];
    setImages(updatedDisplayedImages);
} else {
    resetFields();
}
}, [editableDevice, device.brands, device.types]);

  const resetFields = () => {
    setName("");
    setPrice("");
    setInfo([]);
    setOptions([]);
    setMainImage(null);
    setImages(Array(5).fill(null));
    setImagePreviews([]);
    setExistingImages([]);
    setIsEditMode(false);
    setQuantity("");
  };

  const handleImageChange = (index, e) => {
    const file = e.target.files[0];
    if (file) {
      const newImages = [...images];
      newImages[index] = file;
      setImages(newImages);
    }
  };

  const removeImage = (index) => {
    setImages((prev) => prev.map((img, i) => (i === index ? null : img)));

    // Если удаляем существующее изображение, удаляем его из existingImages
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
};

  const selectMainImage = (e) => {
    setMainImage(e.target.files[0]);
  };

  const selectThumbnails = (e) => {
    const files = Array.from(e.target.files);
    const previews = files.map((file) => URL.createObjectURL(file));

    setImages((prev) => [...prev, ...files]);
    setImagePreviews((prev) => [...prev, ...previews]);
  };

  useEffect(() => {
    // Загружаем бренды и типы при первой загрузке
    fetchTypes().then((data) => device.setTypes(data));
    fetchBrands().then((data) => device.setBrands(data));
}, []); // <-- Загружаем 1 раз при монтировании

useEffect(() => {
    if (device.selectedType?.id) {
        fetchSubtypesByType(device.selectedType.id).then((data) => {
            device.setSubtypes(data);
        });
    }
}, [device.selectedType]);

  const validateDevice = () => {
    const errors = {};
    if (!device.selectedBrand?.id) errors.brand = "Выберите бренд";
    if (!device.selectedType?.id) errors.type = "Выберите тип";
    if (!price || isNaN(price)) errors.price = "Введите цену";
    if (!name) errors.name = "Введите название устройства";
    if (!images.some(img => img) && !isEditMode) {
      errors.img = "Загрузите хотя бы одно изображение";
    }
    if (quantity === "" || quantity === null || quantity === undefined) {
        errors.quantity = "Введите количество товара"; // ✅ Проверяем, введено ли значение
    } else if (quantity < 0) {
        errors.quantity = "Количество не может быть отрицательным"; // ✅ Проверка на отрицательное число
    }
    return errors;
};

  const handleSave = () => {
    setIsSubmitted(true);

    const validationErrors = validateDevice();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const formData = new FormData();
    formData.append("name", name);
    formData.append("price", price);
    formData.append("quantity", quantity);

    if (images[0] && typeof images[0] !== "string") {
      formData.append("img", images[0]); // Главное фото
  }

  images.slice(1).forEach((image) => {
      if (image && typeof image !== "string") {
          formData.append("thumbnails", image); // Миниатюры
      }
  });

    formData.append("existingImages", JSON.stringify(existingImages));

    formData.append(
      "brandId",
      device.selectedBrand.id || editableDevice?.brandId
    );
    formData.append("typeId", device.selectedType.id || editableDevice?.typeId);

    if (device.selectedSubType?.id) {
      formData.append("subtypeId", device.selectedSubType.id);
    }

    formData.append("info", JSON.stringify(info));
    formData.append("options", JSON.stringify(options));

    const saveAction = isEditMode
      ? updateDevice(editableDevice.id, formData) // PUT для редактирования
      : createDevice(formData); // POST для нового устройства

    saveAction
      .then(() => {
        onHide();
        resetFields();
      })
      .catch((error) => {
        console.error(
          "Ошибка при отправке запроса:",
          error.response?.data || error.message
        );
      });
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
  
    const previews = files.map((file) => URL.createObjectURL(file));
  
    setImages((prevImages) => [...prevImages, ...files]); // Добавляем файлы
    setImagePreviews((prevPreviews) => [...prevPreviews, ...previews]); // Добавляем превью
  };

  const removeExistingImage = (index) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index)); // Удаляем старое фото
  };
  

  const addInfo = () => {
    setInfo([...info, { title: "", description: "", number: Date.now() }]);
  };

  const removeInfo = (number) => {
    setInfo(info.filter((i) => i.number !== number));
  };

  const changeInfo = (key, value, number) => {
    setInfo(
      info.map((i) => (i.number === number ? { ...i, [key]: value } : i))
    );
  };

  const addOption = () => {
    setOptions([...options, { name: "", values: [] }]);
  };

  const updateOptionName = (index, value) => {
    const updatedOptions = [...options];
    updatedOptions[index].name = value;
    setOptions(updatedOptions);
  };

  const addOptionValue = (optionIndex) => {
    const updatedOptions = [...options];
    updatedOptions[optionIndex].values.push({ value: "", price: 0 });
    setOptions(updatedOptions);
  };

  const updateOptionValue = (optionIndex, valueIndex, key, value) => {
    const updatedOptions = [...options];

    if (key === "price") {
      let sanitizedValue = value?.toString() || ""; // Преобразуем в строку, если value undefined/null
      sanitizedValue = sanitizedValue.replace(/[^0-9.]/g, ""); // Разрешаем только цифры и точку

      updatedOptions[optionIndex].values[valueIndex][key] = sanitizedValue;
    } else {
      updatedOptions[optionIndex].values[valueIndex][key] = value || "";
    }

    setOptions(updatedOptions);
  };

  const removeOptionValue = (optionIndex, valueIndex) => {
    const updatedOptions = [...options];
    updatedOptions[optionIndex].values.splice(valueIndex, 1);
    setOptions(updatedOptions);
  };

  const removeOption = (index) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>
          {isEditMode ? "Редактировать устройство" : "Добавить устройство"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Dropdown className="mt-2 mb-2">
            <Dropdown.Toggle>
              {device.selectedType.name || "Выберите тип"}
            </Dropdown.Toggle>
            {isSubmitted && !device.selectedType?.id && (
              <span
                style={{ color: "red", display: "block", marginTop: "5px" }}
              >
                {errors.type}
              </span>
            )}
            <Dropdown.Menu>
              {device.types.map((type) => (
                <Dropdown.Item
                  onClick={() => {
                    device.setSelectedType(type);
                    // Загружаем соответствующие подтипы для выбранного типа
                    fetchSubtypesByType(type.id).then((data) =>
                      device.setSubtypes(data)
                    );
                  }}
                  key={type.id}
                >
                  {type.name}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>

          <Dropdown className="mt-2 mb-2">
            <Dropdown.Toggle>
              {device.selectedSubType?.name ||
                "Выберите подтип (необязательно)"}
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Item onClick={() => device.setSelectedSubType(null)}>
                Не выбирать подтип
              </Dropdown.Item>
              {device.subtypes.map((subtype) => (
                <Dropdown.Item
                  onClick={() => device.setSelectedSubType(subtype)}
                  key={subtype.id}
                >
                  {subtype.name}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>

          <Dropdown className="mt-2 mb-2">
            <Dropdown.Toggle>
              {device.selectedBrand.name || "Выберите бренд"}
            </Dropdown.Toggle>
            {isSubmitted && !device.selectedBrand?.id && (
              <span
                style={{ color: "red", display: "block", marginTop: "5px" }}
              >
                {errors.brand}
              </span>
            )}
            <Dropdown.Menu>
              {device.brands.map((brand) => (
                <Dropdown.Item
                  onClick={() => device.setSelectedBrand(brand)}
                  key={brand.id}
                >
                  {brand.name}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>

          <Form.Control
            value={name || ""}
            onChange={(e) => setName(e.target.value)}
            className="mt-3"
            placeholder="Введите название устройства"
          />
          {isSubmitted && !name && (
            <span style={{ color: "red", display: "block", marginTop: "5px" }}>
              {errors.name}
            </span>
          )}

          <Form.Control
            value={price || ""}
            onChange={(e) => setPrice(Number(e.target.value))}
            className="mt-3"
            placeholder="Введите стоимость устройства"
            type="number"
          />
          {((isSubmitted && !price) || isNaN(price)) && (
            <span style={{ color: "red", display: "block", marginTop: "5px" }}>
              {errors.price}
            </span>
          )}

          {/* Ячейки для изображений */}
          <div className={styles.ImageGrid}>
            {images.map((img, index) => (
              <div key={index} className={styles.ImageCell} onClick={() => document.getElementById(`file-input-${index}`).click()}>
                {img ? (
                  <img 
                    src={typeof img === "string" ? img : URL.createObjectURL(img)}
                    alt={`img-${index}`} 
                    className={styles.UploadedImage} 
                  />
                ) : (
                  <div className={styles.EmptyCell}>+</div>
                )}
                <input type="file" id={`file-input-${index}`} onChange={(e) => handleImageChange(index, e)} hidden />
                {img && <button className={styles.DeleteButton} onClick={(e) => { e.stopPropagation(); removeImage(index); }}>✖</button>}
              </div>
            ))}
          </div>

          <div className="image-preview-container mt-3">
            {imagePreviews.map((preview, index) => (
              <img key={index} src={preview} alt={`preview-${index}`} width="100" />
            ))}
          </div>


          <hr />
          <Button variant="outline-dark" onClick={addOption}>
            Добавить опцию
          </Button>
          {options.map((option, index) => (
            <div key={index} className="mt-3">
              <Form.Control
                value={option.name}
                onChange={(e) =>
                  setOptions((prev) =>
                    prev.map((opt, i) =>
                      i === index ? { ...opt, name: e.target.value } : opt
                    )
                  )
                }
                placeholder="Название опции (например, Цвет)"
                className="mb-2"
              />
              {option.values.map((value, idx) => (
                <div key={idx} className="d-flex align-items-center mb-2">
                  <Form.Control
                    value={value.value}
                    onChange={(e) =>
                      updateOptionValue(index, idx, "value", e.target.value)
                    }
                    placeholder="Значение (например, Красный)"
                    className="me-2"
                  />
                  <Form.Control
                    type="number"
                    value={value.price}
                    onChange={(e) =>
                      updateOptionValue(
                        index,
                        idx,
                        "price",
                        parseFloat(e.target.value)
                      )
                    }
                    placeholder="Цена"
                    className="me-2"
                  />
                  <Button
                    variant="outline-danger"
                    onClick={() => removeOptionValue(index, idx)}
                  >
                    Удалить
                  </Button>
                </div>
              ))}
              <Button
                variant="outline-dark"
                onClick={() => addOptionValue(index)}
              >
                Добавить значение
              </Button>
              <Button
                variant="outline-danger"
                className="ms-2"
                onClick={() => removeOption(index)}
              >
                Удалить опцию
              </Button>
            </div>
          ))}

          <hr />
          <Button variant={"outline-dark"} onClick={addInfo}>
            Добавить новое свойство
          </Button>
          {info.map((i) => (
            <Row className="mt-4" key={i.number}>
              <Col md={4}>
                <Form.Control
                  value={i.title}
                  onChange={(e) =>
                    changeInfo("title", e.target.value, i.number)
                  }
                  placeholder="Введите название свойства"
                />
              </Col>
              <Col md={4}>
                <Form.Control
                  value={i.description}
                  onChange={(e) =>
                    changeInfo("description", e.target.value, i.number)
                  }
                  placeholder="Введите описание свойства"
                />
              </Col>
              <Col md={4}>
                <Button
                  onClick={() => removeInfo(i.number)}
                  variant={"outline-danger"}
                >
                  Удалить
                </Button>
              </Col>
            </Row>
          ))}
        </Form>
      </Modal.Body>

      <Form.Group>
            <Form.Label>Количество на складе</Form.Label>
            <Form.Control type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} min="0" />
            {errors.quantity && <p className="text-danger">{errors.quantity}</p>}
          </Form.Group>

      <Modal.Footer>
        <Button variant="outline-danger" onClick={onHide}>
          Закрыть
        </Button>
        <Button variant="outline-success" onClick={handleSave}>
          {isEditMode ? "Сохранить изменения" : "Добавить устройство"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
});

export default CreateDevice;
