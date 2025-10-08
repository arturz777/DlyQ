import React, { useContext, useEffect, useState } from "react";
import Modal from "react-bootstrap/Modal";
import {
  Button,
  Dropdown,
  Form,
  Row,
  Col,
  Tab,
  Tabs,
  InputGroup,
} from "react-bootstrap";
import { Context } from "../../index";
import {
  createDevice,
  updateDevice,
  fetchBrands,
  fetchTypes,
  fetchSubtypesByType,
  fetchMakes,
  fetchModelsByMake,
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
  const [variants, setVariants] = useState([]);
  const [description, setDescription] = useState("");
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
  const [isUniversal, setIsUniversal] = useState(true);
  const [compatRows, setCompatRows] = useState([]);
  const [makes, setMakes] = useState([]);
  const [extraTypeIds, setExtraTypeIds] = useState(new Set());
  const [extraSubtypeIds, setExtraSubtypeIds] = useState(new Set());
  const [visibleSubtypes, setVisibleSubtypes] = useState([]);
  const [pickerOpenFor, setPickerOpenFor] = useState(null);
  const [newValueText, setNewValueText] = useState({});

  const addValueQuick = (optionIndex) => {
    const text = (newValueText[optionIndex] || "").trim();
    if (!text) return;
    const nextIndex = options?.[optionIndex]?.values?.length || 0;
    setOptions((prev) => {
      const next = [...prev];
      if (!Array.isArray(next[optionIndex].values))
        next[optionIndex].values = [];
      next[optionIndex].values.push({
        value: activeOptionsLang === "ru" ? text : "",
      });
      return next;
    });
    setTranslations((prev) => {
      const t = { ...prev };
      ensureOptionValueTrans(t, optionIndex, nextIndex);
      t.options[optionIndex].values[nextIndex][activeOptionsLang] = text;
      return t;
    });
    setNewValueText((p) => ({ ...p, [optionIndex]: "" }));
  };

  const galleryItems = () => {
    return images
      .map((slot, idx) => ({ slot, idx }))
      .filter(({ slot }) => !!slot)
      .map(({ slot, idx }) => {
        const isMain = idx === 0;
        const token = isMain ? "gallery:main" : `gallery:thumb:${idx - 1}`;
        const url = typeof slot === "string" ? slot : URL.createObjectURL(slot);
        return { token, url, isMain, idx };
      });
  };

  const applyVariantImageToken = (variantIdx, tokenOrUrl) => {
    setVariants((prev) => {
      const next = [...prev];
      if (!next[variantIdx]) return prev;
      next[variantIdx].image = tokenOrUrl;
      return next;
    });
    setPickerOpenFor(null);
  };

  const getVal = (x) =>
    x && typeof x === "object" && "value" in x ? x.value : x;
  const makeVariantKey = (selected = {}) =>
    Object.keys(selected)
      .sort()
      .map((k) => `${k}:${String(getVal(selected[k]))}`)
      .join("|");

  const cartesian = (arrays) =>
    arrays.reduce(
      (acc, arr) => acc.flatMap((a) => arr.map((b) => [...a, b])),
      [[]]
    );

  const generateVariantsFromOptions = (options) => {
    if (!Array.isArray(options) || options.length === 0) return [];

    const clean = (options || [])
      .map((o) => ({
        name: (o.name || "").trim(),
        values: (o.values || []).map((v) => v.value).filter(Boolean),
      }))
      .filter((o) => o.name && o.values.length);

    if (!clean.length) return [];

    const names = clean.map((o) => o.name);
    const lists = clean.map((o) => o.values);

    const combos = cartesian(lists);

    return combos.map((combo) => {
      const selected = {};
      names.forEach((n, i) => {
        selected[n] = combo[i];
      });
      return {
        selected,
        sku: "",
        price: "",
        oldPrice: "",
        quantity: 0,
        image: "",
        isActive: true,
        key: makeVariantKey(selected),
      };
    });
  };

  const [translations, setTranslations] = useState({
    name: { en: "", ru: "", est: "" },
    options: [],
    info: [],
  });
  const [openSections, setOpenSections] = useState({
    basic: true,
    price: false,
    images: false,
    description: false,
    info: false,
    optsAndVars: true,
  });

  const regenerateVariantsWithMerge = () => {
    const fresh = generateVariantsFromOptions(options);
    const prevByKey = new Map(variants.map((v) => [v.key, v]));
    const merged = fresh.map((f) => {
      const keep = prevByKey.get(f.key);
      return keep ? { ...keep, selected: f.selected, key: f.key } : f;
    });
    setVariants(merged);
  };

  const currentYear = new Date().getFullYear();
  const YEARS = Array.from(
    { length: currentYear - 1949 },
    (_, i) => currentYear - i
  );
  const yearOptions = YEARS;

  const toggleSection = (key) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    if (variants.length) {
      const total = variants.reduce((s, v) => s + (Number(v.quantity) || 0), 0);
      setQuantity(total);
    }
  }, [variants]);

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
    if (editableDevice?.types) {
      const primaryType = Number(
        editableDevice.typeId ?? editableDevice.type?.id ?? NaN
      );
      const extras = editableDevice.types
        .map((t) => Number(t.id))
        .filter((n) => Number.isFinite(n) && n !== primaryType);
      setExtraTypeIds(new Set(extras));
    } else {
      setExtraTypeIds(new Set());
    }
  }, [editableDevice]);

  useEffect(() => {
    const initPrimary = Number(editableDevice?.typeId ?? 0);
    const currentPrimary = Number(device.selectedType?.id ?? 0);

    if (!editableDevice) {
      setExtraTypeIds(new Set());
      return;
    }

    if (initPrimary && currentPrimary && currentPrimary !== initPrimary) {
      setExtraTypeIds(new Set());
    }
  }, [device.selectedType?.id, editableDevice?.typeId]);

  useEffect(() => {
    const allowed = new Set(visibleSubtypes.map((st) => Number(st.id)));
    const current = Number(device.selectedSubType?.id ?? 0);
    if (current && !allowed.has(current)) {
      device.setSelectedSubType(null);
    }
  }, [visibleSubtypes]);

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

      setVariants(
        Array.isArray(editableDevice.variants)
          ? editableDevice.variants.map((v) => ({
              selected: v.selected || {},
              sku: v.sku || "",
              price: (v.price ?? "") === null ? "" : v.price ?? "",
              oldPrice: (v.oldPrice ?? "") === null ? "" : v.oldPrice ?? "",
              quantity: Number(v.quantity) || 0,
              image: v.image || "",
              isActive: v.isActive !== false,
              key: v.key || makeVariantKey(v.selected || {}),
            }))
          : []
      );

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

      if (
        Array.isArray(editableDevice.compat) &&
        editableDevice.compat.length
      ) {
        if (editableDevice.compat.some((c) => c.isUniversal)) {
          setIsUniversal(true);
          setCompatRows([]);
        } else {
          setIsUniversal(false);
          const baseRows = editableDevice.compat.map((c) => ({
            makeId: c.makeId || "",
            modelId: c.modelId || "",
            yearFrom: c.yearFrom || "",
            yearTo: c.yearTo || "",
            models: [],
          }));
          setCompatRows(baseRows);

          baseRows.forEach((row, idx) => {
            if (row.makeId) {
              fetchModelsByMake(row.makeId)
                .then((models) => {
                  setCompatRows((prev) => {
                    const next = [...prev];
                    if (next[idx]) next[idx].models = models;
                    return next;
                  });
                })
                .catch((e) => console.error("Ошибка загрузки моделей:", e));
            }
          });
        }
      } else {
        setIsUniversal(true);
        setCompatRows([]);
      }
    } else {
      resetFields();
      setIsUniversal(true);
      setCompatRows([]);
    }
  }, [editableDevice, device.brands, device.types]);

  useEffect(() => {
    const primaryTypeId =
      Number(device.selectedType?.id ?? editableDevice?.typeId ?? 0) || null;
    const allTypeIds = new Set();
    if (primaryTypeId) allTypeIds.add(primaryTypeId);
    for (const tid of extraTypeIds) allTypeIds.add(Number(tid));

    if (allTypeIds.size === 0) {
      setVisibleSubtypes([]);
      return;
    }

    Promise.all([...allTypeIds].map((tid) => fetchSubtypesByType(tid)))
      .then((lists) => {
        const seen = new Set();
        const merged = [];
        lists.forEach((arr) => {
          arr.forEach((st) => {
            const id = Number(st.id);
            if (!seen.has(id)) {
              seen.add(id);
              merged.push(st);
            }
          });
        });
        merged.sort((a, b) => {
          const ao = Number(a.displayOrder ?? 0);
          const bo = Number(b.displayOrder ?? 0);
          return ao === bo ? a.id - b.id : ao - bo;
        });
        setVisibleSubtypes(merged);
      })
      .catch(console.error);
  }, [device.selectedType?.id, editableDevice?.typeId, extraTypeIds]);

  useEffect(() => {
    if (!editableDevice) return;
    if (!visibleSubtypes || visibleSubtypes.length === 0) return;

    const allowed = new Set(visibleSubtypes.map((s) => Number(s.id)));

    const currentPrimary = Number(
      device.selectedSubType?.id ??
        editableDevice.subtypeId ??
        editableDevice.subtype?.id ??
        0
    );

    const existing = (editableDevice.subtypes || [])
      .map((s) => Number(s.id))
      .filter(Boolean);

    const extras = existing.filter(
      (id) => id !== currentPrimary && allowed.has(id)
    );

    setExtraSubtypeIds(new Set(extras));
  }, [editableDevice, visibleSubtypes, device.selectedSubType?.id]);

  useEffect(() => {
    const allowed = new Set(visibleSubtypes.map((st) => Number(st.id)));
    const current = Number(device.selectedSubType?.id ?? 0);
    if (current && !allowed.has(current)) device.setSelectedSubType(null);
  }, [visibleSubtypes]);

  useEffect(() => {
    if (show) {
      fetchMakes().then(setMakes).catch(console.error);
    }
  }, [show]);

  const resetFields = () => {
    setName("");
    setPrice("");
    setInfo([]);
    setOptions([]);
    setVariants([]);
    setMainImage(null);
    setImages(Array(5).fill(null));
    setImagePreviews([]);
    setExistingImages([]);
    setIsEditMode(false);
    setQuantity("");
    device.setSelectedBrand(null);
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
    setImages((prev) => {
      const target = prev[index];
      if (typeof target === "string") {
        setExistingImages((old) => old.filter((url) => url !== target));
      }
      const next = [...prev];
      next[index] = null;
      return next;
    });
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

  const addCompatRow = () =>
    setCompatRows((prev) => [
      ...prev,
      { makeId: "", modelId: "", yearFrom: "", yearTo: "", models: [] },
    ]);

  const removeCompatRow = (idx) =>
    setCompatRows((prev) => prev.filter((_, i) => i !== idx));

  const onCompatChange = async (idx, field, value) => {
    setCompatRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      if (field === "makeId") {
        next[idx].modelId = "";
        next[idx].models = [];
      }
      return next;
    });

    if (field === "makeId" && value) {
      try {
        const models = await fetchModelsByMake(value);
        setCompatRows((prev) => {
          const next = [...prev];
          if (next[idx]) next[idx].models = models;
          return next;
        });
      } catch (e) {
        console.error("Ошибка загрузки моделей:", e);
      }
    }
  };

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

    if (variants.length === 0) {
      if (quantity === "" || quantity === null || quantity === undefined) {
        errors.quantity = "Введите количество товара";
      } else if (Number(quantity) < 0) {
        errors.quantity = "Количество не может быть отрицательным";
      }
    }

    if (options.length >= 1 && variants.length === 0) {
      errors.variants = "Сгенерируйте варианты для комбинаций опций";
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
    setErrors({});
    setOptionErrors({});

    const validationErrors = validateDevice();

    if (!isUniversal) {
      if (compatRows.length === 0) {
        validationErrors.compat =
          "Добавьте хотя бы одну строку совместимости или включите «универсальный товар».";
      } else if (
        compatRows.some(
          (r) => !r.makeId && !r.modelId && !r.yearFrom && !r.yearTo
        )
      ) {
        validationErrors.compat =
          "Есть пустая строка совместимости — удалите её или заполните.";
      }
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setOptionErrors(validationErrors);
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append("isNew", String(isNew));
    formData.append("discount", String(discount));
    formData.append("recommended", String(recommended));
    formData.append("name", name);
    formData.append("price", price);
    formData.append(
      "purchasePrice",
      purchasePrice === "" ? "" : String(purchasePrice)
    );
    formData.append("purchaseHasVAT", String(purchaseHasVAT));
    formData.append("quantity", quantity);
    formData.append("description", description || "");
    formData.append("isUniversal", isUniversal ? "true" : "false");

    if (!isUniversal) {
      const payload = compatRows
        .filter((r) => r.makeId || r.modelId || r.yearFrom || r.yearTo)
        .map((r) => ({
          makeId: r.makeId ? Number(r.makeId) : null,
          modelId: r.modelId ? Number(r.modelId) : null,
          yearFrom: r.yearFrom ? Number(r.yearFrom) : null,
          yearTo: r.yearTo ? Number(r.yearTo) : null,
        }));

      formData.append("compat", JSON.stringify(payload));
    }

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

    formData.append("brandId", device.selectedBrand?.id ?? "");

    const primarySubtypeId =
      Number(device.selectedSubType?.id ?? editableDevice?.subtypeId ?? 0) ||
      null;
    const subtypeIdsArray = Array.from(
      new Set([
        ...(primarySubtypeId ? [primarySubtypeId] : []),
        ...Array.from(extraSubtypeIds).map(Number),
      ])
    );

    const primaryTypeId =
      Number(device.selectedType?.id ?? editableDevice?.typeId ?? 0) || null;
    const cleanExtraTypeIds = Array.from(extraTypeIds)
      .map(Number)
      .filter((id) => id && id !== primaryTypeId);

    formData.append("typeId", primaryTypeId ?? "");
    formData.append("typeIds", JSON.stringify(cleanExtraTypeIds));
    formData.append("subtypeId", primarySubtypeId ?? "");
    formData.append("subtypeIds", JSON.stringify(subtypeIdsArray));

    formData.append("info", JSON.stringify(info));
    formData.append("options", JSON.stringify(options));

    const normVariants = (variants || []).map((v) => {
      const selected = Object.fromEntries(
        Object.entries(v.selected || {}).map(([k, val]) => [
          k,
          val && typeof val === "object" && "value" in val ? val.value : val,
        ])
      );

      const toNumOrNull = (x) =>
        x === "" || x === null || x === undefined ? null : Number(x);

      return {
        selected,
        sku: v.sku || null,
        price: toNumOrNull(v.price),
        oldPrice: toNumOrNull(v.oldPrice),
        quantity: Number(v.quantity) || 0,
        image: v.image || null,
        isActive: v.isActive !== false,
        key: v.key || makeVariantKey(selected),
      };
    });

    formData.append("variants", JSON.stringify(normVariants));
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

  const updateOptionName = (index, value) => {
    const updatedOptions = [...options];
    updatedOptions[index].name = value;
    setOptions(updatedOptions);
  };

  const addOptionValue = (optionIndex) => {
    const updatedOptions = [...options];
    updatedOptions[optionIndex].values.push({ value: "" });
    setOptions(updatedOptions);
  };

  const updateOptionValue = (optionIndex, valueIndex, _key, value) => {
    const updatedOptions = [...options];
    updatedOptions[optionIndex].values[valueIndex].value = value;
    setOptions(updatedOptions);
  };

  const removeOptionValue = (optionIndex, valueIndex) => {
    setOptions((prev) => {
      const next = [...prev];
      next[optionIndex].values.splice(valueIndex, 1);
      return next;
    });
    setTranslations((prev) => {
      const t = { ...prev };
      if (Array.isArray(t.options?.[optionIndex]?.values)) {
        t.options[optionIndex].values.splice(valueIndex, 1);
      }
      return t;
    });
  };

  const removeOption = (index) => {
    setOptions((prev) => prev.filter((_, i) => i !== index));
    setTranslations((prev) => {
      const t = { ...prev };
      if (Array.isArray(t.options)) t.options.splice(index, 1);
      return t;
    });
  };

  const addOption = () => {
    setOptions((prev) => [...prev, { name: "", values: [] }]);
    setTranslations((prev) => {
      const t = { ...prev };
      if (!Array.isArray(t.options)) t.options = [];
      t.options.push({ name: {}, values: [] });
      return t;
    });
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      size="lg"
      dialogClassName={styles.wideModal}
    >
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

      <Modal.Body className={styles.modalBodyScrollable}>
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
                    {device.selectedType?.name || "Выберите тип"}
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
                          device.clearSelectedSubType();
                          setExtraSubtypeIds(new Set());
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

                {device.types.length > 0 && (
                  <div className="mt-2">
                    <div className="mb-1">Доп. типы (кроме выбранного):</div>
                    {device.types
                      .filter(
                        (t) =>
                          t.id !==
                          (device.selectedType?.id ?? editableDevice?.typeId)
                      )
                      .map((t) => (
                        <Form.Check
                          key={t.id}
                          type="checkbox"
                          id={`extra-type-${t.id}`}
                          label={t.name}
                          checked={extraTypeIds.has(Number(t.id))}
                          onChange={(e) => {
                            const id = Number(t.id);
                            setExtraTypeIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(id);
                              else next.delete(id);
                              return next;
                            });
                          }}
                        />
                      ))}
                  </div>
                )}

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

                {visibleSubtypes.length > 0 && (
                  <div className="mt-2">
                    <div className="mb-1">
                      Доп. разделы (помимо выбранного):
                    </div>
                    {visibleSubtypes.map((st) => {
                      const stId = Number(st.id);
                      const primaryIdNum = Number(
                        device.selectedSubType?.id ?? editableDevice?.subtypeId
                      );
                      return (
                        <Form.Check
                          key={stId}
                          type="checkbox"
                          id={`extra-st-${stId}`}
                          label={st.name}
                          checked={extraSubtypeIds.has(stId)}
                          disabled={primaryIdNum === stId}
                          onChange={(e) => {
                            setExtraSubtypeIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(stId);
                              else next.delete(stId);
                              return next;
                            });
                          }}
                        />
                      );
                    })}
                  </div>
                )}

                <div className={styles.compatSection}>
                  <h5 className={styles.compatHeader}>🚗 Совместимость авто</h5>

                  <Form.Check
                    type="checkbox"
                    id="compat-enabled"
                    label="Указать совместимость (марка/модель/годы)"
                    checked={!isUniversal}
                    onChange={(e) => {
                      const enable = e.target.checked;
                      setIsUniversal(!enable);
                      if (enable && compatRows.length === 0) {
                        addCompatRow();
                      }
                    }}
                    className={styles.compatCheck}
                  />

                  {!isUniversal && (
                    <>
                      {compatRows.map((row, idx) => (
                        <div key={idx} className={styles.compatRow}>
                          <Form.Select
                            className={styles.compatSelect}
                            value={row.makeId || ""}
                            onChange={(e) =>
                              onCompatChange(
                                idx,
                                "makeId",
                                e.target.value ? Number(e.target.value) : ""
                              )
                            }
                          >
                            <option value="">Марка...</option>
                            {makes.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </Form.Select>

                          <Form.Select
                            className={styles.compatSelect}
                            value={row.modelId || ""}
                            onChange={(e) =>
                              onCompatChange(
                                idx,
                                "modelId",
                                e.target.value ? Number(e.target.value) : ""
                              )
                            }
                            disabled={!row.makeId}
                          >
                            <option value="">Модель...</option>
                            {(row.models || []).map((mm) => (
                              <option key={mm.id} value={mm.id}>
                                {mm.name}
                              </option>
                            ))}
                          </Form.Select>

                          <Form.Select
                            className={styles.yearSelect}
                            value={row.yearFrom ?? ""}
                            onChange={(e) =>
                              onCompatChange(
                                idx,
                                "yearFrom",
                                e.target.value ? Number(e.target.value) : ""
                              )
                            }
                          >
                            <option value="">Год от</option>
                            {yearOptions.map((y) => (
                              <option key={y} value={y}>
                                {y}
                              </option>
                            ))}
                          </Form.Select>

                          <Form.Select
                            className={styles.yearSelect}
                            value={row.yearTo ?? ""}
                            onChange={(e) =>
                              onCompatChange(
                                idx,
                                "yearTo",
                                e.target.value ? Number(e.target.value) : ""
                              )
                            }
                          >
                            <option value="">Год до</option>
                            {yearOptions.map((y) => (
                              <option key={y} value={y}>
                                {y}
                              </option>
                            ))}
                          </Form.Select>

                          <Button
                            variant="outline-danger"
                            className={styles.compatDeleteBtn}
                            onClick={() => removeCompatRow(idx)}
                          >
                            Удалить
                          </Button>
                        </div>
                      ))}

                      <Button
                        variant="outline-dark"
                        className={styles.addCompatBtn}
                        onClick={addCompatRow}
                      >
                        + Добавить строку совместимости
                      </Button>
                    </>
                  )}
                </div>

                {isSubmitted && errors.compat && (
                  <div className="text-danger mt-2">{errors.compat}</div>
                )}

                <Dropdown className="mt-2 mb-2">
                  <Dropdown.Toggle>
                    {device.selectedBrand?.name ||
                      "Выберите бренд (необязательно)"}
                  </Dropdown.Toggle>
                  <Dropdown.Menu className={styles.scrollableDropdownMenu}>
                    <Dropdown.Item
                      onClick={() => device.setSelectedBrand(null)}
                    >
                      Без бренда
                    </Dropdown.Item>
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
                  <Form.Label>
                    {discount ? "Новая цена (со скидкой)" : "Цена"}
                  </Form.Label>
                  <Form.Control
                    type="number"
                    value={price || ""}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    placeholder={discount ? "Новая цена (со скидкой)" : "Цена"}
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
              style={{ cursor: "pointer" }}
              onClick={() => toggleSection("optsAndVars")}
            >
              🧩 Опции и варианты {openSections.optsAndVars ? "▲" : "▼"}
            </h5>

            {openSections.optsAndVars && (
              <Row className="g-3">
                <Col md={5}>
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <Button variant="outline-dark" onClick={addOption}>
                      + Добавить опцию
                    </Button>

                    <div className="btn-group">
                      {["ru", "en", "est"].map((l) => (
                        <button
                          key={l}
                          type="button"
                          className={`btn btn-sm ${
                            activeOptionsLang === l
                              ? "btn-dark"
                              : "btn-outline-dark"
                          }`}
                          onClick={() => setActiveOptionsLang(l)}
                        >
                          {l.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {options.length === 0 ? (
                    <div className="text-muted">
                      Опций пока нет — добавьте первую.
                    </div>
                  ) : (
                    <div className={styles.optionsBox}>
                      {options.map((option, optionIndex) => (
                        <div key={optionIndex} className="mb-3">
                          <div className={styles.optionHeader}>
                            <Form.Control
                              value={getOptionNameByLang(optionIndex)}
                              onChange={(e) =>
                                updateOptionNameByLang(
                                  optionIndex,
                                  e.target.value
                                )
                              }
                              placeholder={
                                activeOptionsLang === "ru"
                                  ? "Название опции (напр. Цвет)"
                                  : activeOptionsLang === "en"
                                  ? "Option name (e.g. Color)"
                                  : "Valiku nimi (nt Värv)"
                              }
                            />
                            <Button
                              variant="outline-danger"
                              size="sm"
                              className={styles.iconBtn}
                              onClick={() => removeOption(optionIndex)}
                              title="Удалить опцию"
                            >
                              ✖
                            </Button>
                          </div>
                          {optionErrors[`option_${optionIndex}`] && (
                            <div className="text-danger small mt-1">
                              {optionErrors[`option_${optionIndex}`]}
                            </div>
                          )}

                          <div className={styles.valuesCompact}>
                            <InputGroup size="sm" className={styles.valueAdder}>
                              <Form.Control
                                value={newValueText[optionIndex] || ""}
                                onChange={(e) =>
                                  setNewValueText((p) => ({
                                    ...p,
                                    [optionIndex]: e.target.value,
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    addValueQuick(optionIndex);
                                  }
                                }}
                                placeholder={
                                  activeOptionsLang === "ru"
                                    ? "Добавить значение и Enter"
                                    : activeOptionsLang === "en"
                                    ? "Add value & Enter"
                                    : "Lisa väärtus ja Enter"
                                }
                              />
                              <Button
                                variant="outline-dark"
                                onClick={() => addValueQuick(optionIndex)}
                                title="Добавить значение"
                              >
                                ＋
                              </Button>
                            </InputGroup>

                            <div className={styles.pillsWrap}>
                              {(option.values || []).map((_, valueIndex) => (
                                <span className={styles.pill} key={valueIndex}>
                                  <span className={styles.pillText}>
                                    {getOptionValueLabelByLang(
                                      optionIndex,
                                      valueIndex
                                    )}
                                  </span>
                                  <button
                                    type="button"
                                    className={styles.pillDel}
                                    onClick={() =>
                                      removeOptionValue(optionIndex, valueIndex)
                                    }
                                    title="Удалить"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          </div>

                          <Button
                            variant="outline-dark"
                            size="sm"
                            onClick={() => addOptionValue(optionIndex)}
                          >
                            + Добавить значение
                          </Button>
                          {optionErrors[`option_values_${optionIndex}`] && (
                            <div className="text-danger small mt-1">
                              {optionErrors[`option_values_${optionIndex}`]}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="d-flex gap-2 mt-3">
                    <Button
                      variant="dark"
                      onClick={regenerateVariantsWithMerge}
                    >
                      🔁 Сгенерировать/обновить варианты
                    </Button>
                    <Button
                      variant="outline-secondary"
                      onClick={() => setVariants([])}
                    >
                      Очистить варианты
                    </Button>
                  </div>

                  {optionErrors.variants && (
                    <div className="text-danger mt-2">
                      {optionErrors.variants}
                    </div>
                  )}
                </Col>

                <Col md={7}>
                  {variants.length === 0 ? (
                    <div className="text-muted">
                      Вариантов пока нет. Нажмите «Сгенерировать/обновить
                      варианты».
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-sm align-middle">
                        <thead>
                          <tr>
                            {options.map((o, i) => (
                              <th key={`h-opt-${i}`}>
                                {o.name || `Опция ${i + 1}`}
                              </th>
                            ))}
                            <th>SKU</th>
                            <th>Цена (override)</th>
                            <th>Старая цена</th>
                            <th>Кол-во</th>
                            <th>Активен</th>
                            <th>Изобр. URL</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {variants.map((v, idx) => (
                            <tr key={v.key}>
                              {options.map((o, i) => (
                                <td key={`v-${idx}-${i}`}>
                                  {v.selected[o.name] ?? "-"}
                                </td>
                              ))}
                              <td style={{ minWidth: 120 }}>
                                <Form.Control
                                  value={v.sku || ""}
                                  onChange={(e) => {
                                    const next = [...variants];
                                    next[idx].sku = e.target.value;
                                    setVariants(next);
                                  }}
                                  placeholder="SKU"
                                />
                              </td>
                              <td style={{ minWidth: 140 }}>
                                <Form.Control
                                  type="number"
                                  step="0.01"
                                  value={v.price ?? ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const next = [...variants];
                                    next[idx].price =
                                      val === "" ? "" : Number(val);
                                    setVariants(next);
                                  }}
                                  placeholder="пусто = базовая"
                                />
                              </td>
                              <td style={{ minWidth: 140 }}>
                                <Form.Control
                                  type="number"
                                  step="0.01"
                                  value={v.oldPrice ?? ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const next = [...variants];
                                    next[idx].oldPrice =
                                      val === "" ? "" : Number(val);
                                    setVariants(next);
                                  }}
                                />
                              </td>
                              <td style={{ minWidth: 110 }}>
                                <Form.Control
                                  type="number"
                                  value={v.quantity}
                                  onChange={(e) => {
                                    const n =
                                      e.target.value === ""
                                        ? ""
                                        : parseInt(e.target.value, 10);
                                    const next = [...variants];
                                    next[idx].quantity = isNaN(n) ? 0 : n;
                                    setVariants(next);
                                  }}
                                />
                              </td>
                              <td>
                                <Form.Check
                                  type="checkbox"
                                  checked={v.isActive !== false}
                                  onChange={(e) => {
                                    const next = [...variants];
                                    next[idx].isActive = e.target.checked;
                                    setVariants(next);
                                  }}
                                />
                              </td>
                              <td style={{ minWidth: 240 }}>
                                <div className="d-flex align-items-center gap-2">
                                  {v.image ? (
                                    <img
                                      src={
                                        v.image.startsWith("gallery:")
                                          ? galleryItems().find(
                                              (g) => g.token === v.image
                                            )?.url || ""
                                          : v.image
                                      }
                                      alt=""
                                      style={{
                                        width: 36,
                                        height: 36,
                                        objectFit: "cover",
                                        borderRadius: 6,
                                        border: "1px solid #ddd",
                                      }}
                                    />
                                  ) : (
                                    <div
                                      style={{
                                        width: 36,
                                        height: 36,
                                        border: "1px dashed #bbb",
                                        borderRadius: 6,
                                      }}
                                    />
                                  )}
                                  <Form.Control
                                    value={v.image || ""}
                                    onChange={(e) => {
                                      const next = [...variants];
                                      next[idx].image = e.target.value;
                                      setVariants(next);
                                    }}
                                    placeholder="gallery:main / gallery:thumb:0 / https://..."
                                  />
                                  <Button
                                    variant="outline-dark"
                                    size="sm"
                                    onClick={() => setPickerOpenFor(idx)}
                                    title="Выбрать из галереи товара"
                                  >
                                    🖼
                                  </Button>
                                </div>
                              </td>
                              <td>
                                <Button
                                  variant="outline-danger"
                                  size="sm"
                                  onClick={() => {
                                    const next = variants.filter(
                                      (_, i) => i !== idx
                                    );
                                    setVariants(next);
                                  }}
                                >
                                  ✖
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      <div className="mt-2">
                        Сумма остатков по вариантам:&nbsp;
                        <strong>
                          {variants.reduce(
                            (s, v) => s + (Number(v.quantity) || 0),
                            0
                          )}
                        </strong>
                      </div>
                    </div>
                  )}
                </Col>
              </Row>
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
          disabled={variants.length > 0}
        />
        {variants.length > 0 && (
          <div className="form-text">
            Количество считается автоматически как сумма по вариантам.
          </div>
        )}
        {errors.quantity && variants.length === 0 && (
          <p className="text-danger">{errors.quantity}</p>
        )}
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
      <Modal
        show={pickerOpenFor !== null}
        onHide={() => setPickerOpenFor(null)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Выбрать фото из галереи товара</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {galleryItems().length === 0 ? (
            <div className="text-muted">
              Сначала загрузите изображения товара во вкладке «🖼 Изображения».
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, 120px)",
                gap: 12,
              }}
            >
              {galleryItems().map((g) => (
                <button
                  key={g.token}
                  type="button"
                  onClick={() => applyVariantImageToken(pickerOpenFor, g.token)}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    padding: 6,
                    background: "#fff",
                    cursor: "pointer",
                  }}
                  title={g.isMain ? "Главное фото" : g.token}
                >
                  <img
                    src={g.url}
                    alt=""
                    style={{
                      width: "100%",
                      height: 90,
                      objectFit: "cover",
                      borderRadius: 6,
                    }}
                  />
                  <div
                    style={{ fontSize: 12, marginTop: 6, textAlign: "center" }}
                  >
                    {g.isMain
                      ? "Главное"
                      : g.token.replace("gallery:thumb:", "thumb:")}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={() => setPickerOpenFor(null)}
          >
            Отмена
          </Button>
        </Modal.Footer>
      </Modal>
    </Modal>
  );
});

export default CreateDevice;
