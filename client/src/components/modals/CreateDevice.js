import React, { useContext, useEffect, useState } from "react";
import Modal from "react-bootstrap/Modal";
import { Button, Dropdown, Form, Row, Col, Tab, Tabs } from "react-bootstrap";
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
  const [isNew, setIsNew] = useState(false);
  const [discount, setDiscount] = useState(false);
  const [oldPrice, setOldPrice] = useState("");
  const [recommended, setRecommended] = useState(false);
  const { device } = useContext(Context);
  const [name, setName] = useState("");
  const [price, setPrice] = useState(null);
  const [mainImage, setMainImage] = useState(null);
  const [images, setImages] = useState(Array(5).fill(null));
  const [imagePreviews, setImagePreviews] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [info, setInfo] = useState([]);
  const [options, setOptions] = useState([]);
  const [description, setDescription] = useState("");
  const [subtypes, setSubtypes] = useState([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [quantity, setQuantity] = useState(0);
  const [optionErrors, setOptionErrors] = useState({});
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseHasVAT, setPurchaseHasVAT] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bulkInfoText, setBulkInfoText] = useState("");
  const [bulkInfoTextEN, setBulkInfoTextEN] = useState("");
  const [bulkInfoTextEST, setBulkInfoTextEST] = useState("");
  const [activeInfoLang, setActiveInfoLang] = useState("ru");
  const [activeOptionsLang, setActiveOptionsLang] = useState("ru");
  const [activeDescLang, setActiveDescLang] = useState("ru");
  const [expiryKind, setExpiryKind] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [snoozeUntil, setSnoozeUntil] = useState("");
  const [translations, setTranslations] = useState({
    name: { en: "", ru: "", est: "" },
    options: [],
    info: [],
  });
  const [openSections, setOpenSections] = useState({
    basic: true,
    price: false,
    images: false,
    options: false,
    description: false,
    info: false,
  });

  const toggleSection = (key) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    if (editableDevice) {
      setPurchasePrice(
        editableDevice.purchasePrice !== undefined &&
          editableDevice.purchasePrice !== null
          ? String(editableDevice.purchasePrice)
          : ""
      );
      setPurchaseHasVAT(Boolean(editableDevice.purchaseHasVAT));
    } else {
      setPurchasePrice("");
      setPurchaseHasVAT(false);
    }
  }, [editableDevice]);

  useEffect(() => {
    if (editableDevice) {
      setName(editableDevice.name);
      setPrice(editableDevice.price);
      setOldPrice(editableDevice.oldPrice || "");
      setDescription(editableDevice.description || "");
      setExpiryKind(editableDevice.expiryKind || "");
      setExpiryDate(editableDevice.expiryDate || "");
      setSnoozeUntil(editableDevice.snoozeUntil || "");
      setDiscount(editableDevice.discount || false);
      setRecommended(editableDevice.recommended || false);
      setInfo(editableDevice.info || []);
      setOptions(editableDevice.options || []);
      setIsEditMode(true);
      setExistingImages([editableDevice.img, ...editableDevice.thumbnails]);
      setQuantity(
        editableDevice.quantity !== undefined ? editableDevice.quantity : 0
      );
      setTranslations({
        name: editableDevice.translations?.name || { en: "", ru: "", est: "" },

        description: editableDevice.translations?.description || {
          en: "",
          ru: "",
          est: "",
        },

        options: Array.isArray(editableDevice.translations?.options)
          ? editableDevice.translations.options
          : [],
        info: Array.isArray(editableDevice.translations?.info)
          ? editableDevice.translations.info
          : [],
      });

      if (editableDevice.brandId) {
        const selectedBrand = device.brands.find(
          (b) => b.id === editableDevice.brandId
        );
        if (selectedBrand) {
          device.setSelectedBrand(selectedBrand);
        }
      }

      if (editableDevice.typeId) {
        const selectedType = device.types.find(
          (t) => t.id === editableDevice.typeId
        );
        if (selectedType) {
          device.setSelectedType(selectedType);
        }
      }

      if (editableDevice.typeId) {
        fetchSubtypesByType(editableDevice.typeId).then((data) => {
          device.setSubtypes(data);
          if (editableDevice.subtypeId) {
            const selectedSubType = data.find(
              (st) => st.id === editableDevice.subtypeId
            );
            if (selectedSubType) {
              device.setSelectedSubType(selectedSubType);
            }
          }
        });
      }

      const updatedImages = [
        ...new Set([editableDevice.img, ...(editableDevice.thumbnails || [])]),
      ];
      setExistingImages(updatedImages);

      const updatedDisplayedImages = [
        ...updatedImages,
        ...Array(5 - updatedImages.length).fill(null),
      ];
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
    fetchTypes().then((data) => device.setTypes(data));
    fetchBrands().then((data) => device.setBrands(data));
  }, []);

  useEffect(() => {
    if (device.selectedType?.id) {
      fetchSubtypesByType(device.selectedType.id).then((data) => {
        device.setSubtypes(data);
      });
    }
  }, [device.selectedType]);

  useEffect(() => {
    if (isEditMode && editableDevice?.subtypeId && device.subtypes.length > 0) {
      const matchedSubtype = device.subtypes.find(
        (st) => String(st.id) === String(editableDevice.subtypeId)
      );

      if (matchedSubtype) {
        device.setSelectedSubType(matchedSubtype);
      }
    }
  }, [device.subtypes, editableDevice?.subtypeId, isEditMode]);

  useEffect(() => {
    const ready =
      editableDevice &&
      device.types.length > 0 &&
      device.brands.length > 0 &&
      (!device.selectedType?.id || device.subtypes.length > 0);

    if (ready) {
      if (editableDevice.brandId && !device.selectedBrand?.id) {
        const selectedBrand = device.brands.find(
          (b) => b.id === editableDevice.brandId
        );
        if (selectedBrand) device.setSelectedBrand(selectedBrand);
      }

      if (editableDevice.typeId && !device.selectedType?.id) {
        const selectedType = device.types.find(
          (t) => t.id === editableDevice.typeId
        );
        if (selectedType) device.setSelectedType(selectedType);
      }

      if (
        editableDevice.subtypeId &&
        device.selectedType?.id &&
        device.subtypes.length > 0 &&
        !device.selectedSubType?.id
      ) {
        const selectedSubType = device.subtypes.find(
          (st) => st.id === editableDevice.subtypeId
        );
        if (selectedSubType) device.setSelectedSubType(selectedSubType);
      }
    }
  }, [
    editableDevice,
    device.types,
    device.brands,
    device.subtypes,
    device.selectedType?.id,
    device.selectedBrand?.id,
    device.selectedSubType?.id,
  ]);

  const parseBulkInfo = (text) => {
    const lines = text.split(/\r?\n/);
    const result = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      const match = line.match(/^\s*([^:\-—]+)\s*[:\-—]\s*(.+)\s*$/);
      if (match) {
        const title = match[1].trim();
        const description = match[2].trim();
        result.push({
          title,
          description,
          number: Date.now() + Math.random(),
          translations: { title: {}, description: {} },
        });
      } else {
        result.push({
          title: line,
          description: "",
          number: Date.now() + Math.random(),
          translations: { title: {}, description: {} },
        });
      }
    }
    return result;
  };

  const applyBulkInfo = () => {
    const parsed = parseBulkInfo(bulkInfoText);
    if (parsed.length === 0) return;
    setInfo(parsed);
  };

  const applyBulkInfoWithTranslations = () => {
    const ru = parseBulkInfo(bulkInfoText);
    const en = parseBulkInfo(bulkInfoTextEN);
    const est = parseBulkInfo(bulkInfoTextEST);

    setInfo(ru);

    setTranslations((prev) => {
      const t = { ...prev };
      const maxLen = ru.length;

      if (!Array.isArray(t.info)) t.info = [];

      const ensureInfo = (idx) => {
        if (!t.info[idx]) t.info[idx] = { title: {}, description: {} };
        if (!t.info[idx].title) t.info[idx].title = {};
        if (!t.info[idx].description) t.info[idx].description = {};
      };

      for (let i = 0; i < maxLen; i++) {
        ensureInfo(i);

        if (ru[i]) {
          if (ru[i].title) t.info[i].title.ru = ru[i].title;
          if (ru[i].description) t.info[i].description.ru = ru[i].description;
        }

        if (en[i]) {
          if (en[i].title) t.info[i].title.en = en[i].title;
          if (en[i].description) t.info[i].description.en = en[i].description;
        }

        if (est[i]) {
          if (est[i].title) t.info[i].title.est = est[i].title;
          if (est[i].description)
            t.info[i].description.est = est[i].description;
        }
      }

      return t;
    });
  };

  const fillBulkFromInfoAll = () => {
    const toLines = (arr) =>
      (arr || [])
        .map((i) => {
          const t = (i.title ?? "").toString().trim();
          const d = (i.description ?? "").toString().trim();
          return d ? `${t}: ${d}` : t;
        })
        .join("\n");

    setBulkInfoText(toLines(info));

    const enArr = (translations.info || []).map((i) => ({
      title: i?.title?.en || "",
      description: i?.description?.en || "",
    }));
    const estArr = (translations.info || []).map((i) => ({
      title: i?.title?.est || "",
      description: i?.description?.est || "",
    }));

    const toLinesFromPairs = (arr) =>
      (arr || [])
        .map((i) => {
          const t = (i.title ?? "").toString().trim();
          const d = (i.description ?? "").toString().trim();
          return t || d ? (d ? `${t}: ${d}` : t) : "";
        })
        .filter(Boolean)
        .join("\n");

    setBulkInfoTextEN(toLinesFromPairs(enArr));
    setBulkInfoTextEST(toLinesFromPairs(estArr));
  };

  const fillBulkFromInfo = () => {
    const text = (info || [])
      .map((i) => {
        const t = (i.title ?? "").toString().trim();
        const d = (i.description ?? "").toString().trim();
        return d ? `${t}: ${d}` : t;
      })
      .join("\n");
    setBulkInfoText(text);
  };

  const getBulkByLang = (lang) =>
    lang === "ru"
      ? bulkInfoText
      : lang === "en"
      ? bulkInfoTextEN
      : bulkInfoTextEST;

  const setBulkByLang = (lang, v) => {
    if (lang === "ru") setBulkInfoText(v);
    else if (lang === "en") setBulkInfoTextEN(v);
    else setBulkInfoTextEST(v);
  };

  const getInfoValue = (index, key) => {
    if (activeInfoLang === "ru") return info?.[index]?.[key] ?? "";
    return translations.info?.[index]?.[key]?.[activeInfoLang] ?? "";
  };

  const updateInfoField = (index, key, value) => {
    if (activeInfoLang === "ru") {
      changeInfo(key, value, info[index].number);
      setTranslations((prev) => {
        const t = { ...prev };
        if (!Array.isArray(t.info)) t.info = [];
        if (!t.info[index]) t.info[index] = { title: {}, description: {} };
        t.info[index][key].ru = value;
        return t;
      });
    } else {
      setTranslations((prev) => {
        const t = { ...prev };
        if (!Array.isArray(t.info)) t.info = [];
        if (!t.info[index]) t.info[index] = { title: {}, description: {} };
        t.info[index][key][activeInfoLang] = value;
        return t;
      });
    }
  };

  const applyBulkForActiveLang = () => {
    const parsed = parseBulkInfo(getBulkByLang(activeInfoLang));
    if (activeInfoLang === "ru") {
      setInfo(parsed);
      setTranslations((prev) => {
        const t = { ...prev };
        t.info = parsed.map((p) => ({
          title: { ru: p.title || "" },
          description: { ru: p.description || "" },
        }));
        return t;
      });
    } else {
      setTranslations((prev) => {
        const t = { ...prev };
        if (!Array.isArray(t.info)) t.info = [];
        for (let i = 0; i < parsed.length; i++) {
          if (!t.info[i]) t.info[i] = { title: {}, description: {} };
          if (parsed[i].title)
            t.info[i].title[activeInfoLang] = parsed[i].title;
          if (parsed[i].description)
            t.info[i].description[activeInfoLang] = parsed[i].description;
        }
        return t;
      });
    }
  };

  const fillBulkFromActive = () => {
    const toLines = (pairs) =>
      pairs
        .map(({ title = "", description = "" }) =>
          title || description
            ? description
              ? `${title}: ${description}`
              : title
            : ""
        )
        .filter(Boolean)
        .join("\n");

    if (activeInfoLang === "ru") {
      setBulkByLang("ru", toLines(info || []));
    } else {
      const arr = (translations.info || []).map((i) => ({
        title: i?.title?.[activeInfoLang] || "",
        description: i?.description?.[activeInfoLang] || "",
      }));
      setBulkByLang(activeInfoLang, toLines(arr));
    }
  };

  const [activeNameLang, setActiveNameLang] = useState("ru");

  const getNameValue = () =>
    activeNameLang === "ru"
      ? name || ""
      : translations.name?.[activeNameLang] || "";

  const updateNameValue = (v) => {
    if (activeNameLang === "ru") {
      setName(v);
      setTranslations((prev) => ({
        ...prev,
        name: { ...(prev.name || {}), ru: v },
      }));
    } else {
      setTranslations((prev) => ({
        ...prev,
        name: { ...(prev.name || {}), [activeNameLang]: v },
      }));
    }
  };

  const ensureOptionTrans = (t, optionIndex) => {
    if (!Array.isArray(t.options)) t.options = [];
    if (!t.options[optionIndex])
      t.options[optionIndex] = { name: {}, values: [] };
    if (!Array.isArray(t.options[optionIndex].values))
      t.options[optionIndex].values = [];
  };

  const ensureOptionValueTrans = (t, optionIndex, valueIndex) => {
    ensureOptionTrans(t, optionIndex);
    if (!t.options[optionIndex].values[valueIndex])
      t.options[optionIndex].values[valueIndex] = {};
  };

  const getOptionNameByLang = (optionIndex) => {
    if (activeOptionsLang === "ru") return options?.[optionIndex]?.name ?? "";
    return translations.options?.[optionIndex]?.name?.[activeOptionsLang] ?? "";
  };

  const updateOptionNameByLang = (optionIndex, value) => {
    if (activeOptionsLang === "ru") {
      updateOptionName(optionIndex, value);
      setTranslations((prev) => {
        const t = { ...prev };
        ensureOptionTrans(t, optionIndex);
        t.options[optionIndex].name.ru = value;
        return t;
      });
    } else {
      setTranslations((prev) => {
        const t = { ...prev };
        ensureOptionTrans(t, optionIndex);
        t.options[optionIndex].name[activeOptionsLang] = value;
        return t;
      });
    }
  };

  const getOptionValueLabelByLang = (optionIndex, valueIndex) => {
    if (activeOptionsLang === "ru") {
      return options?.[optionIndex]?.values?.[valueIndex]?.value ?? "";
    }
    return (
      translations.options?.[optionIndex]?.values?.[valueIndex]?.[
        activeOptionsLang
      ] ?? ""
    );
  };

  const updateOptionValueLabelByLang = (optionIndex, valueIndex, text) => {
    if (activeOptionsLang === "ru") {
      updateOptionValue(optionIndex, valueIndex, "value", text);
      setTranslations((prev) => {
        const t = { ...prev };
        ensureOptionValueTrans(t, optionIndex, valueIndex);
        t.options[optionIndex].values[valueIndex].ru = text;
        return t;
      });
    } else {
      setTranslations((prev) => {
        const t = { ...prev };
        ensureOptionValueTrans(t, optionIndex, valueIndex);
        t.options[optionIndex].values[valueIndex][activeOptionsLang] = text;
        return t;
      });
    }
  };

  const getDescValue = () =>
    activeDescLang === "ru"
      ? description || ""
      : translations.description?.[activeDescLang] || "";

  const updateDescValue = (v) => {
    if (activeDescLang === "ru") {
      setDescription(v);
      setTranslations((prev) => ({
        ...prev,
        description: { ...(prev.description || {}), ru: v },
      }));
    } else {
      setTranslations((prev) => ({
        ...prev,
        description: { ...(prev.description || {}), [activeDescLang]: v },
      }));
    }
  };

  const validateDevice = () => {
    const errors = {};

    if (expiryKind && !expiryDate) {
      errors.expiryDate = "Укажите дату годности";
    }
    if (expiryKind === "use_by" && expiryDate) {
      const today = new Date().toISOString().slice(0, 10);
      if (expiryDate < today)
        errors.expiryDate = "Для use_by дата не может быть в прошлом";
    }

    if (!device.selectedType?.id) errors.type = "Выберите тип";
    if (!price || isNaN(price)) errors.price = "Введите цену";
    if (discount && (!oldPrice || isNaN(oldPrice))) {
      errors.oldPrice = "Введите цену со скидкой";
    }
    if (!name) errors.name = "Введите название устройства";
    if (!images.some((img) => img) && !isEditMode) {
      errors.img = "Загрузите хотя бы одно изображение";
    }
    if (quantity === "" || quantity === null || quantity === undefined) {
      errors.quantity = "Введите количество товара";
    } else if (quantity < 0) {
      errors.quantity = "Количество не может быть отрицательным";
    }

    options.forEach((option, index) => {
      if (!option.name.trim()) {
        errors[`option_${index}`] = `Введите название для опции ${index + 1}`;
      }
      if (option.values.length === 0) {
        errors[
          `option_values_${index}`
        ] = `Добавьте хотя бы одно значение для опции ${
          option.name || index + 1
        }`;
      }
    });

    return errors;
  };

  const handleSave = () => {
    setLoading(true);
    setIsSubmitted(true);
    const validationErrors = validateDevice();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setOptionErrors(validationErrors);
      return;
    }

    setErrors({});
    setOptionErrors({});

    const formData = new FormData();
    formData.append("isNew", isNew);
    formData.append("discount", discount);
    formData.append("recommended", recommended);
    formData.append("name", name);
    formData.append("price", price);
    formData.append(
      "purchasePrice",
      purchasePrice === "" ? "" : String(purchasePrice)
    );
    formData.append("purchaseHasVAT", purchaseHasVAT);
    formData.append("quantity", quantity);
    formData.append("description", description || "");

    if (discount) {
      formData.append("oldPrice", oldPrice);
    } else {
      formData.append("oldPrice", "");
    }

    if (images[0] && typeof images[0] !== "string") {
      formData.append("img", images[0]);
    }

    images.slice(1).forEach((image) => {
      if (image && typeof image !== "string") {
        formData.append("thumbnails", image);
      }
    });

    formData.append("existingImages", JSON.stringify(existingImages));

    formData.append(
      "brandId",
      device.selectedBrand?.id || editableDevice?.brandId || ""
    );
    formData.append(
      "typeId",
      device.selectedType?.id || editableDevice?.typeId || ""
    );

    if (device.selectedSubType?.id) {
      formData.append("subtypeId", device.selectedSubType.id);
    }

    formData.append("info", JSON.stringify(info));
    formData.append("options", JSON.stringify(options));
    formData.append("translations", JSON.stringify(translations));
    formData.append("expiryKind", expiryKind || "");
    formData.append("expiryDate", expiryDate || "");
    formData.append("snoozeUntil", snoozeUntil || "");

    const saveAction = isEditMode
      ? updateDevice(editableDevice.id, formData)
      : createDevice(formData);

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
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const updateOptionTranslation = (optionIndex, lang, value) => {
    setTranslations((prev) => {
      const updatedTranslations = { ...prev };

      if (!Array.isArray(updatedTranslations.options)) {
        updatedTranslations.options = [];
      }

      if (!updatedTranslations.options[optionIndex]) {
        updatedTranslations.options[optionIndex] = { name: {}, values: [] };
      }

      if (!updatedTranslations.options[optionIndex].name) {
        updatedTranslations.options[optionIndex].name = {};
      }

      updatedTranslations.options[optionIndex].name[lang] = value;

      return updatedTranslations;
    });
  };

  const updateOptionValueTranslation = (
    optionIndex,
    valueIndex,
    lang,
    value
  ) => {
    setTranslations((prev) => {
      const updatedTranslations = { ...prev };

      if (!Array.isArray(updatedTranslations.options)) {
        updatedTranslations.options = [];
      }

      if (!updatedTranslations.options[optionIndex]) {
        updatedTranslations.options[optionIndex] = { name: {}, values: [] };
      }

      if (!Array.isArray(updatedTranslations.options[optionIndex].values)) {
        updatedTranslations.options[optionIndex].values = [];
      }

      if (!updatedTranslations.options[optionIndex].values[valueIndex]) {
        updatedTranslations.options[optionIndex].values[valueIndex] = {};
      }

      updatedTranslations.options[optionIndex].values[valueIndex][lang] = value;

      return updatedTranslations;
    });
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const previews = files.map((file) => URL.createObjectURL(file));

    setImages((prevImages) => [...prevImages, ...files]);
    setImagePreviews((prevPreviews) => [...prevPreviews, ...previews]);
  };

  const removeExistingImage = (index) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const addInfo = () => {
    setInfo([
      ...info,
      {
        title: "",
        description: "",
        number: Date.now(),
        translations: { title: {}, description: {} },
      },
    ]);
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
    updatedOptions[optionIndex].values.push({
      value: "",
      price: 0,
      quantity: 0,
    });
    setOptions(updatedOptions);
  };

  const updateOptionValue = (optionIndex, valueIndex, key, value) => {
    const updatedOptions = [...options];
    updatedOptions[optionIndex].values[valueIndex][key] = value;

    setOptions(updatedOptions);

    if (key === "quantity") {
      const totalQuantity = updatedOptions.reduce((sum, option) => {
        return (
          sum +
          option.values.reduce(
            (optSum, v) => optSum + (Number(v.quantity) || 0),
            0
          )
        );
      }, 0);

      setQuantity(totalQuantity);
    }
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

      <Form.Group controlId="formIsNew">
        <Form.Check
          className={styles.newProduct}
          type="checkbox"
          label="Новый товар"
          checked={isNew}
          onChange={(e) => setIsNew(e.target.checked)}
        />
      </Form.Group>

      <Form.Group controlId="formRecommended">
        <Form.Check
          className={styles.recommendProduct}
          type="checkbox"
          label="Рекомендованный товар"
          checked={recommended}
          onChange={(e) => setRecommended(e.target.checked)}
        />
      </Form.Group>

      <Modal.Body>
        <Form>
          <div className="mb-4">
            <h5
              onClick={() => toggleSection("basic")}
              style={{ cursor: "pointer" }}
            >
              🧾 Основная информация {openSections.basic ? "▲" : "▼"}
            </h5>
            {openSections.basic && (
              <>
                <Dropdown className="mt-2 mb-2">
                  <Dropdown.Toggle>
                    {device.selectedType.name || "Выберите тип"}
                  </Dropdown.Toggle>
                  {isSubmitted && !device.selectedType?.id && (
                    <span
                      style={{
                        color: "red",
                        display: "block",
                        marginTop: "5px",
                      }}
                    >
                      {errors.type}
                    </span>
                  )}
                  <Dropdown.Menu className={styles.scrollableDropdownMenu}>
                    {device.types.map((type) => (
                      <Dropdown.Item
                        onClick={() => {
                          device.setSelectedType(type);
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

                <Dropdown>
                  <Dropdown.Toggle>
                    {device.selectedSubType?.name ||
                      "Выберите подтип (необязательно)"}
                  </Dropdown.Toggle>
                  <Dropdown.Menu className={styles.scrollableDropdownMenu}>
                    <Dropdown.Item
                      onClick={() => device.setSelectedSubType(null)}
                    >
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
                      style={{
                        color: "red",
                        display: "block",
                        marginTop: "5px",
                      }}
                    >
                      {errors.brand}
                    </span>
                  )}
                  <Dropdown.Menu className={styles.scrollableDropdownMenu}>
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

                <Form.Label>Название устройства</Form.Label>

                <Tabs
                  id="name-lang-tabs"
                  activeKey={activeNameLang}
                  onSelect={(k) => {
                    if (k) setActiveNameLang(k);
                  }}
                  className="mb-2"
                >
                  <Tab eventKey="ru" title="RU" />
                  <Tab eventKey="en" title="EN" />
                  <Tab eventKey="est" title="EST" />
                </Tabs>

                {isSubmitted && !name && (
                  <span
                    style={{ color: "red", display: "block", marginTop: "5px" }}
                  >
                    {errors.name}
                  </span>
                )}

                <Form.Control
                  value={getNameValue()}
                  onChange={(e) => updateNameValue(e.target.value)}
                  className="option-container border p-3 rounded mb-2"
                  placeholder={
                    activeNameLang === "ru"
                      ? "Введите название устройства (RU)"
                      : activeNameLang === "en"
                      ? "Enter device name (EN)"
                      : "Sisesta seadme nimi (EST)"
                  }
                />
              </>
            )}
          </div>

          {isSubmitted && !name && (
            <span style={{ color: "red", display: "block", marginTop: "5px" }}>
              {errors.name}
            </span>
          )}

          <div className="mb-4">
            <h5
              onClick={() => toggleSection("price")}
              style={{ cursor: "pointer" }}
            >
              💰 Цены и скидки {openSections.price ? "▲" : "▼"}
            </h5>
            {openSections.price && (
              <>
                <Form.Group className="mt-2">
                  <Form.Check
                    type="checkbox"
                    label="Цена включает НДС (24%)"
                    checked={purchaseHasVAT}
                    onChange={(e) => setPurchaseHasVAT(e.target.checked)}
                  />
                </Form.Group>

                <Form.Group className="mt-3">
                  <Form.Label>Закупочная цена (за единицу)</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    placeholder="Например, 5.50"
                  />
                </Form.Group>

                <Form.Group className="mt-3">
                  <Form.Check
                    type="checkbox"
                    label="💰 Цена со скидкой"
                    checked={discount}
                    onChange={(e) => {
                      setDiscount(e.target.checked);
                      if (!e.target.checked) {
                        setOldPrice("");
                        setPrice("");
                      }
                    }}
                  />
                </Form.Group>

                {discount && (
                  <Form.Group className="mt-3">
                    <Form.Label>Старая цена (до скидки)</Form.Label>
                    <Form.Control
                      type="number"
                      value={oldPrice}
                      onChange={(e) => setOldPrice(e.target.value)}
                      placeholder="Старая цена (до скидки)"
                    />
                    {isSubmitted &&
                      discount &&
                      (!oldPrice || isNaN(oldPrice)) && (
                        <span
                          style={{
                            color: "red",
                            display: "block",
                            marginTop: "5px",
                          }}
                        >
                          {errors.oldPrice}
                        </span>
                      )}
                  </Form.Group>
                )}

                <Form.Group className="mt-3">
                  <Form.Label>Новая цена (со скидкой)</Form.Label>
                  <Form.Control
                    type="number"
                    value={price || ""}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    placeholder="Новая цена (со скидкой)"
                  />
                  {((isSubmitted && !price) || isNaN(price)) && (
                    <span
                      style={{
                        color: "red",
                        display: "block",
                        marginTop: "5px",
                      }}
                    >
                      {errors.price}
                    </span>
                  )}
                </Form.Group>
              </>
            )}
          </div>
          <div className="mb-4">
            <h5
              onClick={() => toggleSection("images")}
              style={{ cursor: "pointer" }}
            >
              🖼 Изображения {openSections.images ? "▲" : "▼"}
            </h5>
            {openSections.images && (
              <div className={styles.ImageGrid}>
                {images.map((img, index) => (
                  <div
                    key={index}
                    className={styles.ImageCell}
                    onClick={() =>
                      document.getElementById(`file-input-${index}`).click()
                    }
                  >
                    {img ? (
                      <img
                        src={
                          typeof img === "string"
                            ? img
                            : URL.createObjectURL(img)
                        }
                        alt={`img-${index}`}
                        className={styles.UploadedImage}
                      />
                    ) : (
                      <div className={styles.EmptyCell}>+</div>
                    )}
                    <input
                      type="file"
                      id={`file-input-${index}`}
                      onChange={(e) => handleImageChange(index, e)}
                      hidden
                    />
                    {img && (
                      <button
                        className={styles.DeleteButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage(index);
                        }}
                      >
                        ✖
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="image-preview-container mt-3">
            {imagePreviews.map((preview, index) => (
              <img
                key={index}
                src={preview}
                alt={`preview-${index}`}
                width="100"
              />
            ))}
          </div>
          <div className="mb-4">
            <h5
              onClick={() => toggleSection("options")}
              style={{ cursor: "pointer" }}
            >
              🧩 Опции {openSections.options ? "▲" : "▼"}
            </h5>
            {openSections.options && (
              <>
                <hr />
                <Button variant="outline-dark" onClick={addOption}>
                  Добавить опцию
                </Button>

                <Tabs
                  id="options-lang-tabs"
                  activeKey={activeOptionsLang}
                  onSelect={(k) => {
                    if (k) setActiveOptionsLang(k);
                  }}
                  className="mb-3"
                >
                  <Tab eventKey="ru" title="RU" />
                  <Tab eventKey="en" title="EN" />
                  <Tab eventKey="est" title="EST" />
                </Tabs>

                {options.map((option, optionIndex) => (
                  <div
                    key={optionIndex}
                    className="option-container border p-3 rounded mb-3"
                  >
                    <Form.Control
                      value={getOptionNameByLang(optionIndex)}
                      onChange={(e) =>
                        updateOptionNameByLang(optionIndex, e.target.value)
                      }
                      placeholder={
                        activeOptionsLang === "ru"
                          ? "Название опции (например, Цвет)"
                          : activeOptionsLang === "en"
                          ? "Option name (e.g., Color)"
                          : "Valiku nimi (nt Värv)"
                      }
                      className="mb-2"
                    />
                    {optionErrors[`option_${optionIndex}`] && (
                      <span style={{ color: "red", fontSize: "12px" }}>
                        {optionErrors[`option_${optionIndex}`]}
                      </span>
                    )}

                    {option.values.map((value, valueIndex) => (
                      <div
                        key={valueIndex}
                        className="option-container border p-3 rounded mb-3"
                      >
                        <Form.Control
                          value={getOptionValueLabelByLang(
                            optionIndex,
                            valueIndex
                          )}
                          onChange={(e) =>
                            updateOptionValueLabelByLang(
                              optionIndex,
                              valueIndex,
                              e.target.value
                            )
                          }
                          placeholder={
                            activeOptionsLang === "ru"
                              ? "Значение (например, Красный)"
                              : activeOptionsLang === "en"
                              ? "Value (e.g., Red)"
                              : "Väärtus (nt Punane)"
                          }
                          className="me-2 mb-2"
                        />
                        <p>Цена</p>
                        <Form.Control
                          type="number"
                          value={value.price}
                          onChange={(e) =>
                            updateOptionValue(
                              optionIndex,
                              valueIndex,
                              "price",
                              parseFloat(e.target.value)
                            )
                          }
                          placeholder="Цена"
                          className="me-2 mb-2"
                        />
                        <p>Количество</p>
                        <Form.Control
                          type="number"
                          value={value.quantity}
                          onChange={(e) => {
                            const newValue =
                              e.target.value === ""
                                ? ""
                                : parseInt(e.target.value, 10);
                            updateOptionValue(
                              optionIndex,
                              valueIndex,
                              "quantity",
                              newValue
                            );
                          }}
                          placeholder="Количество"
                          className="me-2 mb-2"
                        />

                        <Button
                          variant="outline-danger"
                          onClick={() =>
                            removeOptionValue(optionIndex, valueIndex)
                          }
                        >
                          Удалить
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline-dark"
                      onClick={() => addOptionValue(optionIndex)}
                    >
                      Добавить значение
                    </Button>
                    <Button
                      variant="outline-danger"
                      className="ms-2"
                      onClick={() => removeOption(optionIndex)}
                    >
                      Удалить опцию
                    </Button>
                  </div>
                ))}
              </>
            )}
          </div>

          <div className="mb-4">
            <h5
              onClick={() => toggleSection("description")}
              style={{ cursor: "pointer" }}
            >
              📄 Описание {openSections.description ? "▲" : "▼"}
            </h5>

            {openSections.description && (
              <div>
                <Tabs
                  id="description-lang-tabs"
                  activeKey={activeDescLang}
                  onSelect={(k) => {
                    if (k) setActiveDescLang(k);
                  }}
                  className="mb-2"
                >
                  <Tab eventKey="ru" title="RU" />
                  <Tab eventKey="en" title="EN" />
                  <Tab eventKey="est" title="EST" />
                </Tabs>

                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    {activeDescLang === "ru"
                      ? "Описание (RU)"
                      : activeDescLang === "en"
                      ? "Description (EN)"
                      : "Kirjeldus (EST)"}
                  </label>

                  <textarea
                    className={styles.textarea}
                    rows={3}
                    value={getDescValue()}
                    onChange={(e) => updateDescValue(e.target.value)}
                    placeholder={
                      activeDescLang === "ru"
                        ? "Введите описание девайса RU (необязательно)"
                        : activeDescLang === "en"
                        ? "Enter device description EN (optional)"
                        : "Sisesta seadme kirjeldus EST (valikuline)"
                    }
                  />

                  {isSubmitted &&
                    getDescValue() &&
                    getDescValue().trim().length < 5 && (
                      <span className={styles.errorText}>
                        {activeDescLang === "ru"
                          ? "Описание должно быть не менее 5 символов"
                          : activeDescLang === "en"
                          ? "Description must be at least 5 characters"
                          : "Kirjeldus peab olema vähemalt 5 tähemärki"}
                      </span>
                    )}
                </div>
              </div>
            )}
          </div>

          <div className="mb-4">
            <h5
              onClick={() => toggleSection("info")}
              style={{ cursor: "pointer" }}
            >
              ⚙️ Характеристики {openSections.info ? "▲" : "▼"}
            </h5>

            {openSections.info && (
              <>
                <div className="mb-3">
                  <Form.Label>Массовый ввод характеристик</Form.Label>

                  <Tabs
                    activeKey={activeInfoLang}
                    onSelect={(k) => setActiveInfoLang(k)}
                    className="mb-2"
                  >
                    <Tab eventKey="ru" title="RU" />
                    <Tab eventKey="en" title="EN" />
                    <Tab eventKey="est" title="EST" />
                  </Tabs>

                  <Form.Control
                    as="textarea"
                    rows={4}
                    value={getBulkByLang(activeInfoLang)}
                    onChange={(e) =>
                      setBulkByLang(activeInfoLang, e.target.value)
                    }
                    placeholder={
                      activeInfoLang === "ru"
                        ? `RU: по одной характеристике в строке.\nМатериал: нержавеющая сталь\nДлина кабеля — 1.2 м\nВес - 350 г`
                        : activeInfoLang === "en"
                        ? `EN (optional):\nMaterial: Stainless steel\nCable length — 1.2 m\nWeight - 350 g`
                        : `EST (valikuline):\nMaterjal: roostevaba teras\nKaabli pikkus — 1.2 m\nKaal - 350 g`
                    }
                  />

                  <div className="mt-2 d-flex flex-wrap gap-2">
                    <Button
                      variant="outline-dark"
                      onClick={applyBulkForActiveLang}
                    >
                      Преобразовать для текущего языка
                    </Button>
                    <Button
                      variant="outline-secondary"
                      onClick={fillBulkFromActive}
                    >
                      Заполнить из текущих
                    </Button>
                  </div>
                </div>

                <hr />
                <Button variant="outline-dark" onClick={addInfo}>
                  Добавить новое свойство
                </Button>

                {info.map((i, index) => (
                  <Row className="mt-3" key={`info-${index}`}>
                    <Col md={8}>
                      <div>
                        <Form.Control
                          className="mt-2"
                          value={getInfoValue(index, "title")}
                          onChange={(e) =>
                            updateInfoField(index, "title", e.target.value)
                          }
                          placeholder={
                            activeInfoLang === "ru"
                              ? "Название (RU)"
                              : activeInfoLang === "en"
                              ? "Title (EN)"
                              : "Nimetus (EST)"
                          }
                        />
                        <Form.Control
                          className="mt-2"
                          value={getInfoValue(index, "description")}
                          onChange={(e) =>
                            updateInfoField(
                              index,
                              "description",
                              e.target.value
                            )
                          }
                          placeholder={
                            activeInfoLang === "ru"
                              ? "Описание (RU)"
                              : activeInfoLang === "en"
                              ? "Description (EN)"
                              : "Kirjeldus (EST)"
                          }
                        />
                      </div>
                    </Col>

                    <Col
                      md={4}
                      className="d-flex align-items-start justify-content-end"
                    >
                      <Button
                        onClick={() => removeInfo(i.number)}
                        variant="outline-danger"
                      >
                        Удалить
                      </Button>
                    </Col>
                  </Row>
                ))}
              </>
            )}
          </div>
        </Form>

        <div className="mt-3 mb-2">
          <h6>🧪 Срок годности</h6>
          <div className="d-flex gap-2 flex-wrap">
            <Form.Select
              value={expiryKind}
              onChange={(e) => setExpiryKind(e.target.value)}
              style={{ maxWidth: 260 }}
            >
              <option value="">— тип срока —</option>
              <option value="use_by">Годен до (use_by)</option>
              <option value="best_before">
                Лучше употребить до (best_before)
              </option>
            </Form.Select>

            <Form.Control
              type="date"
              value={expiryDate || ""}
              onChange={(e) => setExpiryDate(e.target.value)}
              style={{ maxWidth: 200 }}
              placeholder="Дата годности"
            />

            <Form.Control
              type="date"
              value={snoozeUntil || ""}
              onChange={(e) => setSnoozeUntil(e.target.value)}
              style={{ maxWidth: 200 }}
              placeholder="Snooze до (необязательно)"
            />
          </div>
          {isSubmitted && errors.expiryDate && (
            <span style={{ color: "red" }}>{errors.expiryDate}</span>
          )}
        </div>
      </Modal.Body>

      <Form.Group>
        <Form.Label>Количество на складе</Form.Label>
        <Form.Control
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          min="0"
        />
        {errors.quantity && <p className="text-danger">{errors.quantity}</p>}
      </Form.Group>

      <Modal.Footer>
        <Button variant="outline-danger" onClick={onHide}>
          Закрыть
        </Button>
        <Button
          variant="outline-success"
          onClick={handleSave}
          disabled={loading}
        >
          {loading
            ? isEditMode
              ? "Сохраняется..."
              : "Добавляется..."
            : isEditMode
            ? "Сохранить изменения"
            : "Добавить устройство"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
});

export default CreateDevice;
