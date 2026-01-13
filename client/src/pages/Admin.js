import React, { useState, useEffect, useContext, lazy, Suspense } from "react";
import { Context } from "../index";
import Accordion from "react-bootstrap/Accordion";
import Badge from "react-bootstrap/Badge";
import InputGroup from "react-bootstrap/InputGroup";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import { updateDeviceVisibility } from "../http/deviceAPI";
import { fetchAllCouriers } from "../http/courierAPI";
import { assignCourierToOrder } from "../http/orderAPI";
import { fetchTranslations, updateTranslation } from "../http/translationAPI";
import {
  fetchTypes,
  fetchSubtypes,
  fetchBrands,
  fetchDevices,
  fetchMakes,
  fetchModelsByMake,
  deleteType,
  deleteSubtype,
  deleteBrand,
  deleteDevice,
  deleteMake,
  deleteModel,
} from "../http/deviceAPI";
import {
  fetchAllOrdersForAdmin,
  adminUpdateOrderStatus,
} from "../http/orderAPI";
import {
  fetchSellers,
  createSeller,
  updateSeller,
  deactivateSeller,
} from "../http/sellerAPI";
import {
  fetchMenuCategories,
  fetchMenuItems,
  deactivateMenuCategory,
  deactivateMenuItem,
  toggleMenuItemAvailability,
} from "../http/menuAPI";
import { createReceipt, createWriteoff } from "../http/inventoryAPI";
import CreateMenuCategory from "../components/modals/CreateMenuCategory";
import CreateMenuItem from "../components/modals/CreateMenuItem";
import CreateSeller from "../components/modals/CreateSeller";
import CreateBrand from "../components/modals/CreateBrand";
import CreateDevice from "../components/modals/CreateDevice";
import CreateType from "../components/modals/CreateType";
import CreateSubType from "../components/modals/CreateSubType";
import CreateMake from "../components/modals/CreateMake";
import CreateModel from "../components/modals/CreateModel";
import CourierMap from "../components/CourierMap";
import ChatBox from "../components/ChatBox";
import AdminAccounting from "../components/AdminAccounting";
import { fetchMaintenance, updateMaintenance } from "../http/configAPI";
import appStore from "../store/appStore";
import StockQuickAdjustModal from "../components/modals/StockQuickAdjustModal";
import SlideModal from "../components/modals/SlideModal";
import { socket } from "../socket";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import "react-tabs/style/react-tabs.css";
import Image from "react-bootstrap/Image";
import styles from "./Admin.module.css";

const DevicePageLazy = lazy(() => import("../pages/DevicePage"));

const STATUS_LABELS_RU = {
  Pending: "В обработке",
  "Waiting for courier": "Ожидает курьера",
  "Ready for pickup": "Готов к выдаче",
  "Picked up": "Забран курьером",
  "Arrived at destination": "Курьер прибыл",
  Delivered: "Доставлен",
  Completed: "Завершён",
  Cancelled: "Отменён",
};

const Admin = () => {
  const { device, user } = useContext(Context);
  const [types, setTypes] = useState([]);
  const [subtypes, setSubtypes] = useState([]);
  const [brands, setBrands] = useState([]);
  const [devices, setDevices] = useState([]);

  const [brandVisible, setBrandVisible] = useState(false);
  const [typeVisible, setTypeVisible] = useState(false);
  const [subtypeVisible, setSubtypeVisible] = useState(false);
  const [deviceVisible, setDeviceVisible] = useState(false);
  const [makeVisible, setMakeVisible] = useState(false);
  const [modelVisible, setModelVisible] = useState(false);

  const [editableDevice, setEditableDevice] = useState(null);
  const [editableType, setEditableType] = useState(null);
  const [editableSubtype, setEditableSubtype] = useState(null);
  const [editableBrand, setEditableBrand] = useState(null);
  const [editableMake, setEditableMake] = useState(null);
  const [editableModel, setEditableModel] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState("priceAsc");

  const [sellers, setSellers] = useState([]);
  const [activeSellerId, setActiveSellerId] = useState(null);
  const [menuCategories, setMenuCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [menuCategoryVisible, setMenuCategoryVisible] = useState(false);
  const [menuItemVisible, setMenuItemVisible] = useState(false);
  const [editableMenuCategory, setEditableMenuCategory] = useState(null);
  const [editableMenuItem, setEditableMenuItem] = useState(null);

  const [sellerVisible, setSellerVisible] = useState(false);
  const [editableSeller, setEditableSeller] = useState(null);
  const [translations, setTranslations] = useState([]);
  const [editKey, setEditKey] = useState(null);
  const [editLang, setEditLang] = useState(null);
  const [editText, setEditText] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newLang, setNewLang] = useState("en");
  const [newText, setNewText] = useState("");
  const [allOrders, setAllOrders] = useState([]);
  const [couriers, setCouriers] = useState([]);
  const [unreadChats, setUnreadChats] = useState(new Set());
  const [openTypeIds, setOpenTypeIds] = useState([]);
  const [openDeviceTypeIds, setOpenDeviceTypeIds] = useState([]);
  const [quickAdjustVisible, setQuickAdjustVisible] = useState(false);
  const [makes, setMakes] = useState([]);
  const [modelsByMake, setModelsByMake] = useState({});
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [openMakeIds, setOpenMakeIds] = useState([]);
  const [openMakeInType, setOpenMakeInType] = useState(new Set());
  const [openModelInMakeType, setOpenModelInMakeType] = useState(new Set());
  const [outOfOpen, setOutOfOpen] = useState(false);
  const [expireOpen, setExpireOpen] = useState(false);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(
    appStore.maintenance.enabled
  );
  const [maintMessage, setMaintMessage] = useState(
    appStore.maintenance.message
  );
  const [menuSearch, setMenuSearch] = useState("");
  const [prefillMenuCategoryId, setPrefillMenuCategoryId] = useState(null);

  const upsertBrand = (list, saved) => {
    if (!saved) return list;
    const idx = list.findIndex((b) => Number(b.id) === Number(saved.id));
    if (idx === -1) return [saved, ...list];
    const next = [...list];
    next[idx] = { ...next[idx], ...saved };
    return next;
  };

  const reloadMenu = async (sellerId = activeSellerId) => {
    if (!sellerId) return;
    const [cats, items] = await Promise.all([
      fetchMenuCategories(sellerId),
      fetchMenuItems(sellerId),
    ]);
    setMenuCategories(cats || []);
    setMenuItems(items || []);
  };

  const openCreateMenuItem = (categoryId = null) => {
    setEditableMenuItem(null);
    setPrefillMenuCategoryId(categoryId ? Number(categoryId) : null);
    setMenuItemVisible(true);
  };

  const sortedMenuCategories = React.useMemo(() => {
    return [...(menuCategories || [])].sort(
      (a, b) =>
        (a.displayOrder ?? 0) - (b.displayOrder ?? 0) ||
        (a.id ?? 0) - (b.id ?? 0)
    );
  }, [menuCategories]);

  const menuItemsByCategory = React.useMemo(() => {
    const q = menuSearch.trim().toLowerCase();
    const map = new Map();
    sortedMenuCategories.forEach((c) => map.set(c.id, []));
    map.set("no", []);

    (menuItems || []).forEach((it) => {
      if (!it) return;

      if (q) {
        const hay = `${it.name || ""} ${it.description || ""}`.toLowerCase();
        if (!hay.includes(q)) return;
      }

      const key = it.categoryId || "no";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    });

    for (const [k, arr] of map.entries()) {
      map.set(
        k,
        [...arr].sort(
          (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.id - b.id
        )
      );
    }

    return map;
  }, [menuItems, sortedMenuCategories, menuSearch]);

  const visibleMenuCategories = React.useMemo(() => {
    const q = menuSearch.trim();
    if (!q) return sortedMenuCategories;
    return sortedMenuCategories.filter(
      (c) => (menuItemsByCategory.get(c.id) || []).length > 0
    );
  }, [sortedMenuCategories, menuItemsByCategory, menuSearch]);

  useEffect(() => {
  const onLoc = ({ courierId, lat, lng }) => {
    setCouriers((prev) =>
      prev.map((c) =>
        c.id === courierId ? { ...c, currentLat: lat, currentLng: lng } : c
      )
    );
  };

  const onStatus = ({ courierId, status }) => {
    setCouriers((prev) =>
      prev.map((c) => (c.id === courierId ? { ...c, status } : c))
    );
  };

  socket.on("courierLocationUpdate", onLoc);
  socket.on("courierStatusUpdate", onStatus);

  return () => {
    socket.off("courierLocationUpdate", onLoc);
    socket.off("courierStatusUpdate", onStatus);
  };
}, []);

  useEffect(() => {
    fetchMaintenance()
      .then((v) => {
        setMaintenanceEnabled(!!v.enabled);
        appStore.setMaintenance(v);
      })
      .catch(console.error);
  }, []);

  const toggleMaintenance = async (next) => {
    try {
      setMaintenanceEnabled(next);
      const saved = await updateMaintenance(next);
      appStore.setMaintenance(saved);
    } catch (e) {
      console.error(e);
      setMaintenanceEnabled(!next);
    }
  };

  useEffect(() => {
    fetchTypes().then(setTypes);
    fetchSubtypes().then(setSubtypes);
    fetchBrands().then(setBrands);
    fetchDevices(undefined, undefined, undefined, 1, 1000).then((data) =>
      setDevices(data.rows || data)
    );
    fetchTranslations().then(setTranslations);
    fetchSellers(false).then(setSellers).catch(console.error);
  }, []);

  useEffect(() => {
    fetchAllOrdersForAdmin().then(setAllOrders);
    fetchMakes().then(setMakes).catch(console.error);
  }, []);

  useEffect(() => {
    if (!activeSellerId && sellers?.length) {
      const firstActive = sellers.find((s) => s.isActive) || sellers[0];
      setActiveSellerId(firstActive?.id ?? null);
    }
  }, [sellers, activeSellerId]);

  useEffect(() => {
    if (!activeSellerId) return;

    fetchMenuCategories(activeSellerId)
      .then(setMenuCategories)
      .catch(console.error);

    fetchMenuItems(activeSellerId).then(setMenuItems).catch(console.error);
  }, [activeSellerId]);

  const openCreateSellerModal = () => {
    setEditableSeller(null);
    setSellerVisible(true);
  };

  const handleEditSeller = (seller) => {
    setEditableSeller(seller);
    setSellerVisible(true);
  };

  const handleDeactivateSeller = async (id) => {
    const ok = window.confirm("Деактивировать магазин?");
    if (!ok) return;

    try {
      await deactivateSeller(id);
      const next = await fetchSellers(false);
      setSellers(next);
    } catch (e) {
      console.error(e);
      alert("Не удалось деактивировать магазин");
    }
  };

  const handleStatusChange = async (
    orderId,
    status,
    processingTime,
    estimatedTime
  ) => {
    try {
      await adminUpdateOrderStatus(
        orderId,
        status,
        processingTime,
        estimatedTime
      );
    } catch (err) {
      console.error("Ошибка при обновлении:", err);
    }
  };

  useEffect(() => {
    fetchAllCouriers().then(setCouriers).catch(console.error);
  }, []);

  useEffect(() => {
  if (!couriers?.length) return;
  couriers.forEach((c) => {
    socket.emit("joinCourierRoom", { courierId: c.id });
  });
}, [couriers]);

  const filteredDevices = React.useMemo(() => {
    return devices
      .filter((d) => d.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        if (sortOption === "priceAsc") return a.price - b.price;
        if (sortOption === "priceDesc") return b.price - a.price;
        if (sortOption === "nameAsc") return a.name.localeCompare(b.name);
        if (sortOption === "nameDesc") return b.name.localeCompare(a.name);
        return 0;
      });
  }, [devices, searchQuery, sortOption]);

  useEffect(() => {
    if (!devices?.length) return;

    const needMakeIds = new Set();

    for (const d of devices) {
      const compat = getCompatList(d);
      for (const c of compat) {
        const maybeMakeId =
          c?.makeId ?? c?.make?.id ?? c?.model?.makeId ?? null;
        if (maybeMakeId) needMakeIds.add(Number(maybeMakeId));
      }
    }

    [...needMakeIds].forEach((makeId) => {
      if (!modelsByMake[makeId]) {
        fetchModelsByMake(makeId)
          .then((list) =>
            setModelsByMake((prev) => ({ ...prev, [makeId]: list }))
          )
          .catch(console.error);
      }
    });
  }, [devices]);

  useEffect(() => {
    const fetchData = async () => {
      const typesData = await fetchTypes();
      setTypes(typesData);

      const subtypesData = await fetchSubtypes();
      setSubtypes(subtypesData);

      const brandsData = await fetchBrands();
      setBrands(brandsData);

      const devicesData = await fetchDevices(
        undefined,
        undefined,
        undefined,
        1,
        1000
      );
      setDevices(devicesData.rows || devicesData);
    };

    fetchData();
  }, []);

  const getMenuImgSrc = (img) => {
    if (!img) return null;
    const base = process.env.REACT_APP_API_URL;
    if (/^https?:\/\//i.test(img)) return img;
    if (img.startsWith("/")) return `${base}${img}`;
    return `${base}/${img}`;
  };

  const handleEditMenuItem = (item) => {
    setEditableMenuItem(item);
    setMenuItemVisible(true);
  };

  const handleToggleMenuItemAvailability = async (item) => {
    try {
      await toggleMenuItemAvailability(
        item.id,
        activeSellerId,
        !item.isAvailable
      );
      setMenuItems((prev) =>
        prev.map((x) =>
          x.id === item.id ? { ...x, isAvailable: !item.isAvailable } : x
        )
      );
    } catch (e) {
      console.error(e);
      alert("Не удалось изменить доступность блюда");
    }
  };

  const handleDeactivateMenuItem = async (item) => {
    if (!window.confirm("Деактивировать блюдо?")) return;
    try {
      await deactivateMenuItem(item.id, activeSellerId);
      await reloadMenu();
    } catch (e) {
      console.error(e);
      alert("Не удалось деактивировать блюдо");
    }
  };

  const handleDeactivateMenuCategory = async (cat) => {
    if (!window.confirm("Деактивировать категорию?")) return;
    try {
      await deactivateMenuCategory(cat.id, activeSellerId);
      await reloadMenu();
    } catch (e) {
      console.error(e);
      alert("Не удалось деактивировать категорию");
    }
  };

  const handleToggleVisibility = async (id, next) => {
    const prev = devices;
    setDevices((p) =>
      p.map((d) => (d.id === id ? { ...d, isVisible: next } : d))
    );
    try {
      await updateDeviceVisibility(id, next);
    } catch (e) {
      console.error(e);
      setDevices(prev);
      alert("Не удалось обновить видимость");
    }
  };

  const handleAssignCourier = async (orderId, courierId) => {
    if (!courierId) {
      setAllOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, courierId: null } : o))
      );
      return;
    }

    try {
      await assignCourierToOrder(orderId, courierId);
      setAllOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, courierId } : o))
      );
    } catch (err) {
      console.error("Ошибка при назначении курьера:", err);
    }
  };

 useEffect(() => {
    if (!user?.user?.id) return;

    const base = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");
    const url = `${base}/api/chat/user/${user.user.id}`;

    fetch(url, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(
            `fetch chats failed ${res.status}: ${text.slice(0, 120)}`
          );
        }
        return res.json();
      })
      .then((data) => {
        const unread = new Set();
        (data || []).forEach((chat) => {
          const hasUnread = chat.messages?.some(
            (msg) => !msg.isRead && msg.senderId !== user.user.id
          );
          if (hasUnread) unread.add(chat.id);
        });
        setUnreadChats(unread);
      })
      .catch((e) => console.error("fetch chats error:", e));
  }, [user?.user?.id]);

  useEffect(() => {
  const role = String(user?.user?.role || "").toUpperCase();
  if (role !== "ADMIN") return;

  const join = () => {
    socket.emit("joinAdminNotifications");
    console.log("🔔 Админ подключен к admin_notifications");
  };

  join();
  socket.on("connect", join);

  return () => {
    socket.off("connect", join);
  };
}, [user?.user?.role]);

  const reloadMakes = async () => {
    const m = await fetchMakes();
    setMakes(m);
  };

  const parseMaybeJSON = (v) => {
    if (typeof v === "string") {
      try {
        return JSON.parse(v);
      } catch {
        return v;
      }
    }
    return v;
  };

  const normVal = (x) =>
    x && typeof x === "object" && "value" in x ? x.value : x;

  const asPlain = (x) =>
    x && typeof x === "object" ? x.ru || x.en || Object.values(x)[0] || "" : x;

  const formatSelectedLabel = (selected = {}) => {
    const entries = Object.entries(selected).map(([k, v]) => {
      const val = normVal(v);
      return `${k}: ${val}`;
    });
    return entries.length ? entries.join(", ") : "Вариант";
  };

  const getZeroVariants = (d) => {
    const vars = Array.isArray(d.variants)
      ? d.variants
      : parseMaybeJSON(d.variants) || [];
    return vars
      .filter((v) => (v?.isActive ?? true) && (Number(v?.quantity) || 0) <= 0)
      .map((v) => ({
        kind: "variant",
        label: formatSelectedLabel(parseMaybeJSON(v.selected)),
        raw: v,
      }));
  };

  const loadModelsForMake = async (makeId) => {
    const list = await fetchModelsByMake(makeId);
    setModelsByMake((prev) => ({ ...prev, [makeId]: list }));
  };

  const toggleMakeOpen = (makeId) => {
    setOpenMakeIds((prev) =>
      prev.includes(makeId)
        ? prev.filter((id) => id !== makeId)
        : [...prev, makeId]
    );

    if (!modelsByMake[makeId]) {
      loadModelsForMake(makeId).catch(console.error);
    }
  };

  const handleDeleteMake = async (makeId) => {
    if (!window.confirm("Удалить эту марку?")) return;
    await deleteMake(makeId);
    await reloadMakes();
    setModelsByMake((prev) => {
      const copy = { ...prev };
      delete copy[makeId];
      return copy;
    });
    setOpenMakeIds((prev) => prev.filter((id) => id !== makeId));
  };

  const handleDeleteModel = async (model) => {
    if (!window.confirm(`Удалить модель "${model.name}"?`)) return;
    await deleteModel(model.id);
    await loadModelsForMake(model.makeId);
  };

  const makeKey = (typeId, makeId) => `t${typeId}-m${makeId}`;
  const modelKey = (typeId, makeId, modelId) =>
    `t${typeId}-m${makeId}-md${modelId ?? "none"}`;

  const isMakeOpen = (typeId, makeId) =>
    openMakeInType.has(makeKey(typeId, makeId));
  const isModelOpen = (typeId, makeId, modelId) =>
    openModelInMakeType.has(modelKey(typeId, makeId, modelId));

  const toggleMakeInType = (typeId, makeId) => {
    setOpenMakeInType((prev) => {
      const k = makeKey(typeId, makeId);
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  };

  const toggleModelInMakeType = (typeId, makeId, modelId) => {
    setOpenModelInMakeType((prev) => {
      const k = modelKey(typeId, makeId, modelId);
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  };

  const getMakeName = (id) =>
    makes.find((m) => Number(m.id) === Number(id))?.name || `id-${id}`;

  const getModelName = (makeId, modelId) =>
    (modelsByMake[makeId] || []).find((mm) => Number(mm.id) === Number(modelId))
      ?.name || `id-${modelId}`;

  const getModelNameAny = (modelId) => {
    for (const arr of Object.values(modelsByMake)) {
      const hit = (arr || []).find((mm) => Number(mm.id) === Number(modelId));
      if (hit) return hit.name;
    }
    return `id-${modelId}`;
  };

  const autoTypeId = React.useMemo(() => {
    return types.find((t) => /автотовары/i.test(t.name))?.id ?? null;
  }, [types]);

  const toggleDeviceType = (typeId) => {
    setOpenDeviceTypeIds((prev) =>
      prev.includes(typeId)
        ? prev.filter((id) => id !== typeId)
        : [...prev, typeId]
    );
  };

  const toggleTypeOpen = (typeId) => {
    setOpenTypeIds((prev) =>
      prev.includes(typeId)
        ? prev.filter((id) => id !== typeId)
        : [...prev, typeId]
    );
  };

  const openCreateTypeModal = () => {
    fetchTypes().then((fetchedTypes) => {
      setTypes(fetchedTypes);
      setEditableType(null);
      setTypeVisible(true);
    });
  };

  const handleDeleteType = async (id) => {
    await deleteType(id);
    setTypes((prev) => prev.filter((type) => type.id !== id));
  };

  const handleDeleteSubtype = async (id) => {
    await deleteSubtype(id);
    setSubtypes((prev) => prev.filter((subtype) => subtype.id !== id));
  };

  const handleDeleteBrand = async (id) => {
    await deleteBrand(id);
    setBrands((prev) => prev.filter((brand) => brand.id !== id));
  };

  const handleEditDevice = (device) => {
    setEditableDevice(device);
    setDeviceVisible(true);
  };

  const handleDeleteDevice = async (id) => {
    await deleteDevice(id);
    setDevices((prev) => prev.filter((device) => device.id !== id));
  };

  const handleEditType = (type) => {
    setEditableType(type);
    setTypeVisible(true);
  };

  const handleEditSubtype = (subtype) => {
    setEditableSubtype(subtype);
    setSubtypeVisible(true);
  };

  const handleEditBrand = (brand) => {
    setEditableBrand(brand);
    setBrandVisible(true);
  };

  const handleEdit = (key, lang, text) => {
    setEditKey(key);
    setEditLang(lang);
    setEditText(text);
  };

  const handleSave = async () => {
    await updateTranslation(editKey, editLang, editText);
    setTranslations((prev) =>
      prev.map((t) =>
        t.key === editKey && t.lang === editLang ? { ...t, text: editText } : t
      )
    );
    setEditKey(null);
  };

  const handleAddTranslation = async () => {
    if (!newKey || !newLang || !newText) {
      alert("Заполните все поля!");
      return;
    }
    const response = await fetch(`https://dlyq-backend-staging.onrender.com/translations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: newKey, lang: newLang, text: newText }),
    });

    if (response.ok) {
      const newTranslation = await response.json();
      setTranslations([...translations, newTranslation]);
      setShowAddForm(false);
      setNewKey("");
      setNewLang("en");
      setNewText("");
    } else {
      alert("Ошибка добавления перевода");
    }
  };

  const typesMap = new Map(types.map((type) => [type.id, type]));
  const subtypesMap = new Map(subtypes.map((subtype) => [subtype.id, subtype]));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dayStart = (dateStr) => {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const isSnoozed = (d) => d.snoozeUntil && dayStart(d.snoozeUntil) >= today;

  const isExpired = (d) => d.expiryDate && dayStart(d.expiryDate) < today;

  const twoMonthsFromToday = new Date(today);
  twoMonthsFromToday.setMonth(twoMonthsFromToday.getMonth() + 2);

  const getDeviceTypeIds = (d) => {
    const ids = new Set();
    if (d.typeId) ids.add(Number(d.typeId));
    if (d.type?.id) ids.add(Number(d.type.id));
    if (Array.isArray(d.types)) {
      d.types.forEach((t) => t?.id && ids.add(Number(t.id)));
    }
    return ids;
  };

  const getDeviceSubtypeIds = (d) => {
    const ids = new Set();
    if (d.subtypeId) ids.add(Number(d.subtypeId));
    if (d.subtype?.id) ids.add(Number(d.subtype.id));
    if (Array.isArray(d.subtypes)) {
      d.subtypes.forEach((s) => s?.id && ids.add(Number(s.id)));
    }
    return ids;
  };

  const isExpiringWithin2Months = (d) => {
    if (!d.expiryDate) return false;
    const ed = dayStart(d.expiryDate);
    return ed >= today && ed <= twoMonthsFromToday;
  };

  const daysToExpire = (d) => {
    if (!d.expiryDate) return null;
    return Math.floor((dayStart(d.expiryDate) - today) / 86400000);
  };

  const expiryBadge = (d) => {
    const days = daysToExpire(d);
    if (days === null) return null;
    if (days < 0) return "просрочено";
    if (days === 0) return "истекает сегодня";
    return `${days} дн.`;
  };

  const attentionDevices = filteredDevices
    .filter(
      (d) => !isSnoozed(d) && (isExpired(d) || isExpiringWithin2Months(d))
    )
    .sort((a, b) => (daysToExpire(a) ?? 9e9) - (daysToExpire(b) ?? 9e9));

  const outOfStockDevices = filteredDevices
  .map((d) => {
    const zeros = getZeroVariants(d);

    const rawVariants = Array.isArray(d.variants)
      ? d.variants
      : parseMaybeJSON(d.variants) || [];

    const activeVariants = rawVariants.filter((v) => v?.isActive ?? true);

    let completelyOut = false;
    if (activeVariants.length) {
      completelyOut = activeVariants.every(
        (v) => (Number(v?.quantity) || 0) <= 0
      );
    } else {
      completelyOut = (Number(d.quantity) || 0) <= 0;
    }

    const show = !isSnoozed(d) && (completelyOut || zeros.length > 0);
    return show ? { device: d, zeros } : null;
  })
  .filter(Boolean)
  .sort((a, b) => a.device.name.localeCompare(b.device.name));

  const getCompatList = (d) => {
    if (!d) return [];
    if (Array.isArray(d.compat)) return d.compat;
    if (Array.isArray(d.compatibility)) return d.compatibility;
    if (Array.isArray(d.carCompat)) return d.carCompat;
    return [];
  };

  const renderCompat = (d) => {
    const compat = getCompatList(d);
    if (!compat.length) return null;

    const makeIdFrom = (c) =>
      c?.makeId ?? c?.make?.id ?? c?.model?.makeId ?? null;
    const modelIdFrom = (c) => c?.modelId ?? c?.model?.id ?? null;

    const isUniversal = compat.some((c) => c?.isUniversal);
    if (isUniversal) {
      return (
        <div className={styles.compatRow}>
          <div className={styles.compatChips}>
            <span className={`${styles.compatChip} ${styles.compatUniversal}`}>
              Универсальный
            </span>
          </div>
        </div>
      );
    }

    return (
      <div className={styles.compatRow}>
        <div className={styles.compatChips}>
          {compat.map((c, i) => {
            const makeId = makeIdFrom(c);
            const modelId = modelIdFrom(c);
            const mk = c?.make?.name || (makeId ? getMakeName(makeId) : "");
            const md =
              c?.model?.name ||
              (modelId
                ? makeId
                  ? getModelName(makeId, modelId)
                  : getModelNameAny(modelId)
                : "");

            const years =
              c?.yearFrom || c?.yearTo
                ? ` (${c.yearFrom || "…"}–${c.yearTo || "…"})`
                : "";

            const label = [mk, md].filter(Boolean).join(" ");
            if (!label && !years) return null;

            return (
              <span key={i} className={styles.compatChip}>
                {label}
                {years}
              </span>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.adminPanelContainer}>
      <Tabs>
        <TabList>
          <Tab>Устройства</Tab>
          <Tab>Типы</Tab>
          <Tab>Марки/Модели</Tab>
          <Tab>Подтипы</Tab>
          <Tab>Бренды</Tab>
          <Tab>Переводы</Tab>
          <Tab>Заказы</Tab>
          <Tab>
            Чат поддержки{" "}
            {unreadChats.size > 0 && <span style={{ color: "red" }}>●</span>}
          </Tab>
          <Tab>Бухгалтерия</Tab>
          <Tab>Настройки</Tab>
          <Tab>Магазины</Tab>
          <Tab>Меню</Tab>
        </TabList>

        <TabPanel>
          <div className={styles.actionButtons}>
            <button
              onClick={() => setDeviceVisible(true)}
              className={styles.actionButton}
            >
              Добавить устройство
            </button>

            <button
              onClick={() => setQuickAdjustVisible(true)}
              className={styles.actionButton}
              style={{ background: "#033977ff", borderColor: "#c8e1ff" }}
            >
              Остаток ±
            </button>
          </div>

          {attentionDevices.length > 0 && (
            <div className={styles.expBlock}>
              <div
                className={`${styles.typeHeader} ${styles.expHeader}`}
                onClick={() => setExpireOpen((v) => !v)}
                title="Показать/скрыть"
              >
                <h3
                  className={styles.typeTitle}
                  style={{ margin: 0, color: "#b45309" }}
                >
                  Просрочено / истечёт ≤ 2 мес.
                </h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className={styles.expCount}>
                    {attentionDevices.length}
                  </span>
                  <span>{expireOpen ? "▲" : "▼"}</span>
                </div>
              </div>

              {expireOpen && (
                <div className={styles.itemList}>
                  {attentionDevices.map((device) => (
                    <div
                      key={device.id}
                      className={styles.item}
                      style={{ background: "#fff7ed", cursor: "pointer" }}
                      onClick={() => setSelectedDeviceId(device.id)}
                    >
                      <div>
                        id-{device.id}
                        <Image
                          className={styles.adminDeviceImg}
                          width={50}
                          height={50}
                          src={device.img}
                        />
                      </div>

                      <span className={styles.adminDeviceName}>
                        {device.name}
                      </span>

                      <div className={styles.buttons}>
                        <span
                          style={{
                            color: "#b45309",
                            fontWeight: 600,
                            marginRight: 8,
                          }}
                        >
                          {expiryBadge(device)}
                        </span>
                        {device.expiryDate && (
                          <span style={{ color: "#666", marginRight: 12 }}>
                            до{" "}
                            {new Date(device.expiryDate).toLocaleDateString(
                              "ru-RU"
                            )}
                          </span>
                        )}

                        <button
                          className={styles.editButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditDevice(device);
                          }}
                        >
                          Редактировать
                        </button>
                        <button
                          className={styles.deleteButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm("Удалить этот товар?")) {
                              handleDeleteDevice(device.id);
                            }
                          }}
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {outOfStockDevices.length > 0 && (
            <div className={styles.outBlock}>
              <div
                className={`${styles.typeHeader} ${styles.outHeader}`}
                onClick={() => setOutOfOpen((v) => !v)}
                title="Показать/скрыть"
              >
                <h3
                  className={styles.typeTitle}
                  style={{ margin: 0, color: "#b91c1c" }}
                >
                  Нет в наличии
                </h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className={styles.outCount}>
                    {outOfStockDevices.length}
                  </span>
                  <span>{outOfOpen ? "▲" : "▼"}</span>
                </div>
              </div>

              {outOfOpen && (
                <div className={styles.itemList}>
                  {outOfStockDevices.map(({ device, zeros }) => (
                    <div
                      key={device.id}
                      className={styles.item}
                      style={{ background: "#ffe5e5", cursor: "pointer" }}
                      onClick={() => setSelectedDeviceId(device.id)}
                    >
                      <div>
                        id-{device.id}
                        <Image
                          className={styles.adminDeviceImg}
                          width={50}
                          height={50}
                          src={device.img}
                        />
                      </div>

                      <span className={styles.adminDeviceName}>
                        {device.name}
                      </span>
                      {renderCompat(device)}
                      {zeros.length > 0 && (
                        <div className={styles.zerosBlock}>
                          <div className={styles.zerosTitle}>Закончились:</div>
                          <div className={styles.zerosChips}>
                            {zeros.slice(0, 10).map((z, i) => (
                              <span
                                key={i}
                                className={styles.zeroChip}
                                title={
                                  z.kind === "variant" ? "Вариант" : "Опция"
                                }
                              >
                                {z.label}
                              </span>
                            ))}
                            {zeros.length > 10 && (
                              <span className={styles.zerosMore}>
                                …и ещё {zeros.length - 10}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      <div className={styles.buttons}>
                        <span
                          style={{
                            color: "red",
                            fontWeight: 600,
                            marginRight: 12,
                          }}
                        >
                          нет в наличии
                        </span>
                        <div
                          className={styles.adminDevicePrice}
                          style={{ marginRight: 12 }}
                        >
                          {device.discount ? (
                            <>
                              <span className={styles.discountedPrice}>
                                {device.price} €
                              </span>
                              <span className={styles.oldPrice}>
                                {device.oldPrice} €
                              </span>
                            </>
                          ) : (
                            <span>{device.price} €</span>
                          )}
                        </div>
                        <label
                          className={styles.toggleWrap}
                          title="Показывать на витрине"
                          style={{ marginRight: 12 }}
                        >
                          <input
                            type="checkbox"
                            className={styles.toggleInput}
                            checked={!!device.isVisible}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              handleToggleVisibility(
                                device.id,
                                e.target.checked
                              )
                            }
                          />
                          <span className={styles.toggleSlider} />
                          <span className={styles.toggleLabel}>
                            {device.isVisible
                              ? "Витрина: вкл"
                              : "Витрина: выкл"}
                          </span>
                        </label>
                        <button
                          className={styles.editButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditDevice(device);
                          }}
                        >
                          Редактировать
                        </button>
                        <button
                          className={styles.deleteButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm("Удалить этот товар?"))
                              handleDeleteDevice(device.id);
                          }}
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className={styles.filterContainer}>
            <input
              type="text"
              placeholder="Поиск по названию..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select onChange={(e) => setSortOption(e.target.value)}>
              <option value="priceAsc">Цена (по возрастанию)</option>
              <option value="priceDesc">Цена (по убыванию)</option>
              <option value="nameAsc">Имя (А-Я)</option>
              <option value="nameDesc">Имя (Я-А)</option>
            </select>
          </div>

          {types.map((type) => {
            const subtypesForType = subtypes.filter(
              (s) => s.typeId === type.id
            );
            const subtypeIdsOfType = new Set(
              subtypesForType.map((s) => Number(s.id))
            );

            const typeDevices = filteredDevices.filter((d) => {
              const tIds = getDeviceTypeIds(d);
              const sIds = getDeviceSubtypeIds(d);
              const viaType = tIds.has(Number(type.id));
              const viaSubtype = [...sIds].some((id) =>
                subtypeIdsOfType.has(id)
              );
              return viaType || viaSubtype;
            });

            const isOpenType = openDeviceTypeIds.includes(type.id);
            const isAuto = Number(type.id) === Number(autoTypeId);

            const devicesWithoutSubtypeInThisType = !isAuto
              ? typeDevices.filter((d) => {
                  const sIds = getDeviceSubtypeIds(d);
                  const hasSubtypeOfThisType = [...sIds].some((id) =>
                    subtypeIdsOfType.has(id)
                  );
                  const belongsViaType = getDeviceTypeIds(d).has(
                    Number(type.id)
                  );
                  return belongsViaType && !hasSubtypeOfThisType;
                })
              : [];
            const makesMap = new Map();

            const universalNoSubtype = [];
            const universalWithSubtype = [];

            const makeIdFrom = (c) =>
              c?.makeId ?? c?.make?.id ?? c?.model?.makeId ?? null;
            const modelIdFrom = (c) => c?.modelId ?? c?.model?.id ?? null;

            const hasSubtypeOfThisType = (d) => {
              const sIds = getDeviceSubtypeIds(d);
              for (const id of sIds)
                if (subtypeIdsOfType.has(Number(id))) return true;
              return false;
            };

            const pushUniversal = (d) => {
              if (hasSubtypeOfThisType(d)) universalWithSubtype.push(d);
              else universalNoSubtype.push(d);
            };

            if (isAuto) {
              for (const d of typeDevices) {
                const compat = getCompatList(d);

                if (!compat.length) {
                  pushUniversal(d);
                  continue;
                }

                let placed = false;

                for (const c of compat) {
                  if (c?.isUniversal) {
                    pushUniversal(d);
                    placed = true;
                    continue;
                  }

                  const mk = makeIdFrom(c);
                  const mdMaybe = modelIdFrom(c);

                  if (!mk && !mdMaybe) {
                    pushUniversal(d);
                    placed = true;
                    continue;
                  }

                  if (!mk) continue;
                  const md = mdMaybe ?? "__none__";
                  if (!makesMap.has(mk)) makesMap.set(mk, new Map());
                  const byModel = makesMap.get(mk);
                  if (!byModel.has(md)) byModel.set(md, []);
                  byModel.get(md).push(d);
                  placed = true;
                }

                if (!placed) pushUniversal(d);
              }
            }

            const uniqueById = (arr) => {
              const seen = new Set();
              const out = [];
              for (const x of arr)
                if (!seen.has(x.id)) {
                  seen.add(x.id);
                  out.push(x);
                }
              return out;
            };

            const groupBySubtypeWithinType = (list) => {
              const m = new Map();
              for (const d of uniqueById(list)) {
                const sIds = getDeviceSubtypeIds(d);
                const idsOfThisType = [...sIds].filter((id) =>
                  subtypeIdsOfType.has(Number(id))
                );
                if (idsOfThisType.length === 0) {
                  if (!m.has("__none__")) m.set("__none__", []);
                  m.get("__none__").push(d);
                } else {
                  for (const sid of idsOfThisType) {
                    if (!m.has(sid)) m.set(sid, []);
                    m.get(sid).push(d);
                  }
                }
              }
              return m;
            };

            const DeviceRow = ({ d, onOpen }) => (
              <div
                key={d.id}
                className={styles.item}
                onClick={() => onOpen?.(d.id)}
                style={{ cursor: "pointer" }}
              >
                <div>
                  id-{d.id}
                  <Image
                    className={styles.adminDeviceImg}
                    width={50}
                    height={50}
                    src={d.img}
                  />
                </div>
                <span className={styles.adminDeviceName}>{d.name}</span>
                {renderCompat(d)}
                <div className={styles.buttons}>
                  <div className={styles.adminDevicePrice}>
                    {d.discount ? (
                      <>
                        <span className={styles.discountedPrice}>
                          {d.price} €
                        </span>
                        <span className={styles.oldPrice}>{d.oldPrice} €</span>
                      </>
                    ) : (
                      <span>{d.price} €</span>
                    )}
                  </div>
                  <span className={styles.deviceQuantity}>
                    {d.quantity === 0 ? (
                      <span style={{ color: "red" }}>Нет в наличии</span>
                    ) : (
                      <span style={{ color: "green" }}>
                        В наличии: {d.quantity}
                      </span>
                    )}
                  </span>
                  <button
                    className={styles.editButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditDevice(d);
                    }}
                  >
                    Редактировать
                  </button>
                  <button
                    className={styles.deleteButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm("Удалить этот девайс?")) {
                        handleDeleteDevice(d.id);
                      }
                    }}
                  >
                    Удалить
                  </button>
                  <label
                    className={styles.toggleWrap}
                    title="Показывать на витрине"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      className={styles.toggleInput}
                      checked={!!d.isVisible}
                      onChange={(e) =>
                        handleToggleVisibility(d.id, e.target.checked)
                      }
                    />
                    <span className={styles.toggleSlider} />
                    <span className={styles.toggleLabel}>
                      {d.isVisible ? "Витрина: вкл" : "Витрина: выкл"}
                    </span>
                  </label>
                </div>
              </div>
            );

            return (
              <div key={type.id} className={styles.typeGroup}>
                <div
                  className={`${styles.typeHeader} ${styles.typeHeaderType}`}
                  onClick={() => toggleDeviceType(type.id)}
                  style={{
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    background: "#e8f0fe",
                    padding: "10px",
                    borderRadius: "5px",
                    marginBottom: "5px",
                  }}
                >
                  <h5 className={styles.typeTitle}>{type.name}</h5>
                  <span>{isOpenType ? "▲" : "▼"}</span>
                </div>

                {isOpenType && (
                  <>
                    {!isAuto && (
                      <>
                        {devicesWithoutSubtypeInThisType.length > 0 && (
                          <div className={styles.itemList}>
                            {devicesWithoutSubtypeInThisType.map((d) => (
                              <DeviceRow
                                key={d.id}
                                d={d}
                                onOpen={setSelectedDeviceId}
                              />
                            ))}
                          </div>
                        )}

                        {subtypesForType.map((subtype) => {
                          const subtypeDevices = typeDevices.filter((d) =>
                            getDeviceSubtypeIds(d).has(Number(subtype.id))
                          );
                          if (!subtypeDevices.length) return null;
                          return (
                            <div key={subtype.id} className={styles.typeGroup}>
                              <h5 className={styles.subtypeTitle}>
                                {subtype.name}
                              </h5>
                              <div className={styles.itemList}>
                                {subtypeDevices.map((d) => (
                                  <DeviceRow
                                    key={d.id}
                                    d={d}
                                    onOpen={setSelectedDeviceId}
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}

                    {isAuto && (
                      <>
                        {uniqueById(universalNoSubtype).length > 0 && (
                          <div
                            className={styles.typeGroup}
                            style={{ marginTop: 8 }}
                          >
                            <h5 className={styles.typeTitle}>Без подтипа</h5>
                            <div className={styles.itemList}>
                              {uniqueById(universalNoSubtype).map((d) => (
                                <DeviceRow
                                  key={d.id}
                                  d={d}
                                  onOpen={setSelectedDeviceId}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {uniqueById(universalWithSubtype).length > 0 && (
                          <div
                            className={styles.typeGroup}
                            style={{ marginTop: 8 }}
                          >
                            <h5 className={styles.typeTitle}>
                              Без марки/модели
                            </h5>
                            {[
                              ...groupBySubtypeWithinType(
                                uniqueById(universalWithSubtype)
                              ),
                            ]
                              .filter(([key]) => key !== "__none__")
                              .map(([key, list]) => {
                                const title =
                                  subtypesForType.find(
                                    (s) => s.id === Number(key)
                                  )?.name || `Подтип ${key}`;
                                return (
                                  <div
                                    key={`u-${String(key)}`}
                                    style={{ marginBottom: 6 }}
                                  >
                                    <div className={styles.subtypeTitle}>
                                      {title}
                                    </div>
                                    <div className={styles.itemList}>
                                      {list.map((d) => (
                                        <DeviceRow
                                          key={d.id}
                                          d={d}
                                          onOpen={setSelectedDeviceId}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}

                        {[...makesMap.entries()].map(([makeId, byModel]) => {
                          const mkOpen = isMakeOpen(type.id, makeId);
                          const makeName = getMakeName(makeId);
                          return (
                            <div
                              key={`mk-${makeId}`}
                              className={styles.typeGroup}
                              style={{ marginTop: 10 }}
                            >
                              <div
                                className={`${styles.typeHeader} ${styles.typeHeaderMake}`}
                                onClick={() =>
                                  toggleMakeInType(type.id, makeId)
                                }
                                style={{
                                  cursor: "pointer",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  background: "#f5f7ff",
                                  padding: 10,
                                  borderRadius: 5,
                                }}
                              >
                                <h5 className={styles.typeTitle}>{makeName}</h5>
                                <span>{mkOpen ? "▲" : "▼"}</span>
                              </div>

                              {mkOpen && (
                                <>
                                  {[...byModel.entries()].map(
                                    ([modelKeyId, list]) => {
                                      const modelId =
                                        modelKeyId === "__none__"
                                          ? null
                                          : Number(modelKeyId);
                                      const mdOpen = isModelOpen(
                                        type.id,
                                        makeId,
                                        modelId
                                      );
                                      const modelName =
                                        modelId == null
                                          ? "Без модели"
                                          : getModelName(makeId, modelId);
                                      return (
                                        <div
                                          key={`md-${makeId}-${modelKeyId}`}
                                          className={styles.subtypeTitle}
                                          style={{ marginTop: 6 }}
                                        >
                                          <div
                                            className={`${styles.typeHeader} ${styles.typeHeaderModel}`}
                                            onClick={() =>
                                              toggleModelInMakeType(
                                                type.id,
                                                makeId,
                                                modelId
                                              )
                                            }
                                            style={{
                                              cursor: "pointer",
                                              display: "flex",
                                              justifyContent: "space-between",
                                              background: "#eef2ff",
                                              padding: 8,
                                              borderRadius: 5,
                                            }}
                                          >
                                            <h6
                                              className={styles.typeTitle}
                                              style={{ margin: 0 }}
                                            >
                                              {modelName}
                                            </h6>
                                            <span>{mdOpen ? "▲" : "▼"}</span>
                                          </div>

                                          {mdOpen && (
                                            <div style={{ marginTop: 6 }}>
                                              {[
                                                ...groupBySubtypeWithinType(
                                                  list
                                                ),
                                              ].map(([key, items]) => {
                                                const title =
                                                  key === "__none__"
                                                    ? "Без подтипа"
                                                    : subtypesForType.find(
                                                        (s) =>
                                                          s.id === Number(key)
                                                      )?.name ||
                                                      `Подтип ${key}`;
                                                return (
                                                  <div
                                                    key={`sg-${modelKeyId}-${String(
                                                      key
                                                    )}`}
                                                    style={{ marginBottom: 6 }}
                                                  >
                                                    <div
                                                      style={{
                                                        fontWeight: 600,
                                                        margin: "6px 0",
                                                      }}
                                                    >
                                                      {title}
                                                    </div>
                                                    <div
                                                      className={
                                                        styles.itemList
                                                      }
                                                    >
                                                      {items.map((d) => (
                                                        <DeviceRow
                                                          key={d.id}
                                                          d={d}
                                                        />
                                                      ))}
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    }
                                  )}
                                </>
                              )}
                            </div>
                          );
                        })}
                      </>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </TabPanel>

        <TabPanel>
          <div className={styles.actionButtons}>
            <button
              onClick={openCreateTypeModal}
              className={styles.actionButton}
            >
              Добавить тип
            </button>
          </div>

          <div className={styles.itemList}>
            {types.map((type) => (
              <div key={type.id} className={styles.item}>
                <img
                  width={50}
                  height={50}
                  src={type.img}
                  alt={type.name}
                  className={styles.typeImage}
                />
                <span>{type.name}</span>

                <div className={styles.buttons}>
                  <button
                    className={styles.editButton}
                    onClick={() => handleEditType(type)}
                  >
                    Редактировать
                  </button>
                  <button
                    className={styles.deleteButton}
                    onClick={() => {
                      const confirmed = window.confirm(
                        "Вы уверены, что хотите удалить этот тип?"
                      );
                      if (confirmed) {
                        handleDeleteType(type.id);
                      }
                    }}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        </TabPanel>

        <TabPanel>
          <div className={styles.actionButtons}>
            <button
              onClick={() => {
                setEditableMake(null);
                setMakeVisible(true);
              }}
              className={styles.actionButton}
            >
              Добавить марку
            </button>

            <button
              onClick={() => {
                setEditableModel(null);
                setModelVisible(true);
              }}
              className={styles.actionButton}
            >
              Добавить модель
            </button>
          </div>

          {makes.length === 0 ? (
            <p>Марок нет</p>
          ) : (
            <div className={styles.itemList}>
              {makes
                .slice()
                .sort((a, b) =>
                  (a.displayOrder ?? 0) === (b.displayOrder ?? 0)
                    ? a.id - b.id
                    : (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
                )
                .map((make) => {
                  const isOpen = openMakeIds.includes(make.id);
                  const models = modelsByMake[make.id] || [];
                  return (
                    <div key={make.id} className={styles.item}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <button
                          onClick={() => toggleMakeOpen(make.id)}
                          className={styles.editButton}
                          style={{ minWidth: 34 }}
                          title={isOpen ? "Свернуть" : "Развернуть"}
                        >
                          {isOpen ? "▲" : "▼"}
                        </button>
                        <strong>{make.name}</strong>
                        <span style={{ color: "#666" }}>
                          (order: {make.displayOrder ?? 0})
                        </span>
                      </div>

                      <div className={styles.buttons}>
                        <button
                          className={styles.editButton}
                          onClick={() => {
                            setEditableMake(make);
                            setMakeVisible(true);
                          }}
                        >
                          Редактировать
                        </button>
                        <button
                          className={styles.deleteButton}
                          onClick={() => handleDeleteMake(make.id)}
                        >
                          Удалить
                        </button>
                        <button
                          className={styles.actionButton}
                          onClick={() => {
                            setEditableModel({ makeId: make.id });
                            setModelVisible(true);
                          }}
                        >
                          + Модель к марке
                        </button>
                      </div>

                      {isOpen && (
                        <div style={{ marginTop: 10, paddingLeft: 44 }}>
                          {models.length === 0 ? (
                            <div style={{ color: "#666" }}>Моделей нет</div>
                          ) : (
                            <div className={styles.itemList}>
                              {models.map((m) => (
                                <div key={m.id} className={styles.item}>
                                  <span>
                                    {m.name}{" "}
                                    <span style={{ color: "#999" }}>
                                      id-{m.id}
                                    </span>
                                  </span>
                                  <div className={styles.buttons}>
                                    <button
                                      className={styles.editButton}
                                      onClick={() => {
                                        setEditableModel(m);
                                        setModelVisible(true);
                                      }}
                                    >
                                      Редактировать
                                    </button>
                                    <button
                                      className={styles.deleteButton}
                                      onClick={() => handleDeleteModel(m)}
                                    >
                                      Удалить
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </TabPanel>

        <TabPanel>
          <div className={styles.actionButtons}>
            <button
              onClick={() => setSubtypeVisible(true)}
              className={styles.actionButton}
            >
              Добавить подтип
            </button>
          </div>

          {types.map((type) => {
            const subtypesForType = subtypes.filter(
              (s) => s.typeId === type.id
            );
            if (subtypesForType.length === 0) return null;

            const isOpen = openTypeIds.includes(type.id);

            return (
              <div key={type.id} className={styles.typeGroup}>
                <div
                  className={styles.typeHeader}
                  onClick={() => toggleTypeOpen(type.id)}
                  style={{
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    background: "#f2f2f2",
                    padding: "10px",
                    borderRadius: "5px",
                    marginBottom: "5px",
                  }}
                >
                  <h4 className={styles.typeTitle}>{type.name}</h4>
                  <span>{isOpen ? "▲" : "▼"}</span>
                </div>
                {isOpen && (
                  <div className={styles.itemList}>
                    {subtypesForType.map((subtype) => (
                      <div key={subtype.id} className={styles.item}>
                        <span>{subtype.name}</span>
                        <div className={styles.buttons}>
                          <button
                            className={styles.editButton}
                            onClick={() => handleEditSubtype(subtype)}
                          >
                            Редактировать
                          </button>
                          <button
                            className={styles.deleteButton}
                            onClick={() => {
                              const confirmed = window.confirm(
                                "Вы уверены, что хотите удалить этот подтип?"
                              );
                              if (confirmed) {
                                handleDeleteSubtype(subtype.id);
                              }
                            }}
                          >
                            Удалить
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </TabPanel>

        <TabPanel>
          <div className={styles.actionButtons}>
            <button
              onClick={() => setBrandVisible(true)}
              className={styles.actionButton}
            >
              Добавить бренд
            </button>
          </div>

          <div className={styles.itemList}>
            {brands.map((brand) => (
              <div key={brand.id} className={styles.item}>
                <span>{brand.name}</span>

                <div className={styles.buttons}>
                  <button
                    className={styles.editButton}
                    onClick={() => handleEditBrand(brand)}
                  >
                    Редактировать
                  </button>
                  <button
                    className={styles.deleteButton}
                    onClick={() => {
                      const confirmed = window.confirm(
                        "Вы уверены, что хотите удалить этот бренд?"
                      );
                      if (confirmed) {
                        handleDeleteBrand(brand.id);
                      }
                    }}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        </TabPanel>

        <TabPanel>
          <h2 className={styles.translationsTitle}>Переводы</h2>

          <button
            className={styles.addTranslationButton}
            onClick={() => setShowAddForm(true)}
          >
            ➕ Добавить перевод
          </button>

          {showAddForm && (
            <div className={styles.translationForm}>
              <input
                type="text"
                placeholder="Ключ (например, device_123.title)"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                className={styles.inputField}
              />
              <select
                value={newLang}
                onChange={(e) => setNewLang(e.target.value)}
                className={styles.selectField}
              >
                <option value="en">English</option>
                <option value="ru">Русский</option>
                <option value="est">Eesti</option>
              </select>
              <input
                type="text"
                placeholder="Перевод"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                className={styles.inputField}
              />
              <button
                onClick={handleAddTranslation}
                className={styles.saveButton}
              >
                ✅ Добавить
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className={styles.cancelButton}
              >
                ❌ Отмена
              </button>
            </div>
          )}

          <table className={styles.translationTable}>
            <thead>
              <tr>
                <th>Ключ</th>
                <th>Язык</th>
                <th>Перевод</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {translations.map((t) => (
                <tr key={`${t.key}-${t.lang}`}>
                  <td>{t.key}</td>
                  <td>{t.lang}</td>
                  <td>
                    {editKey === t.key && editLang === t.lang ? (
                      <input
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className={styles.inputField}
                      />
                    ) : (
                      t.text
                    )}
                  </td>
                  <td>
                    {editKey === t.key && editLang === t.lang ? (
                      <button
                        onClick={handleSave}
                        className={styles.saveButton}
                      >
                        💾
                      </button>
                    ) : (
                      <button
                        onClick={() => handleEdit(t.key, t.lang, t.text)}
                        className={styles.editButton}
                      >
                        ✏️
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabPanel>

        <TabPanel>
          <h3>Курьеры на карте</h3>
          <CourierMap couriers={couriers} />

          <h2>Все заказы</h2>
          <div className={styles.ordersTable}>
            {allOrders.length === 0 ? (
              <p>Нет заказов</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Пользователь</th>
                    <th>Статус</th>
                    <th>Время готовки</th>
                    <th>Время доставки</th>
                    <th>Адрес</th>
                    <th>Сумма</th>
                    <th>Дата</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {allOrders.map((order) => (
                    <tr key={order.id}>
                      <td>{order.id}</td>
                      <td>
                        <select
                          value={order.courierId || ""}
                          onChange={(e) =>
                            handleAssignCourier(order.id, e.target.value)
                          }
                        >
                          <option value="">Не назначен</option>
                          {couriers.map((courier) => (
                            <option key={courier.id} value={courier.id}>
                              {courier.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td>
                        <select
                          value={order.status}
                          onChange={(e) =>
                            setAllOrders((prev) =>
                              prev.map((o) =>
                                o.id === order.id
                                  ? { ...o, status: e.target.value }
                                  : o
                              )
                            )
                          }
                        >
                          {Object.entries(STATUS_LABELS_RU).map(
                            ([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            )
                          )}
                        </select>
                      </td>

                      <td>
                        {order.status === "Waiting for courier" && (
                          <select
                            value={order.processingTime || ""}
                            onChange={(e) =>
                              setAllOrders((prev) =>
                                prev.map((o) =>
                                  o.id === order.id
                                    ? { ...o, processingTime: e.target.value }
                                    : o
                                )
                              )
                            }
                            style={{ width: "120px" }}
                          >
                            <option value="">-- выберите --</option>
                            <option value="5 минут">5 минут</option>
                            <option value="10 минут">10 минут</option>
                            <option value="15 минут">15 минут</option>
                            <option value="20 минут">20 минут</option>
                            <option value="30 минут">30 минут</option>
                            <option value="60 минут">60 минут</option>
                            <option value="720 минут">1 день</option>
                          </select>
                        )}
                      </td>
                      <td>
                        {order.status === "Picked up" && (
                          <select
                            value={order.estimatedTime || ""}
                            onChange={(e) =>
                              setAllOrders((prev) =>
                                prev.map((o) =>
                                  o.id === order.id
                                    ? {
                                        ...o,
                                        estimatedTime: parseInt(
                                          e.target.value,
                                          10
                                        ),
                                      }
                                    : o
                                )
                              )
                            }
                            style={{ width: "120px" }}
                          >
                            <option value="">-- выберите --</option>
                            <option value="300">5 минут</option>
                            <option value="600">10 минут</option>
                            <option value="900">15 минут</option>
                            <option value="1200">20 минут</option>
                            <option value="1800">30 минут</option>
                            <option value="3600">1 час</option>
                          </select>
                        )}
                      </td>
                      <td>{order.deliveryAddress}</td>
                      <td>{order.totalPrice} €</td>
                      <td>
                        {new Date(order.createdAt).toLocaleString("ru-RU")}
                      </td>
                      <td style={{ display: "flex", gap: "5px" }}>
                        <button
                          className={styles.saveButton}
                          onClick={() =>
                            handleStatusChange(
                              order.id,
                              order.status,
                              order.processingTime,
                              order.estimatedTime
                            )
                          }
                        >
                          💾
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabPanel>

        <TabPanel>
          <h2>Чат с клиентами</h2>
          <ChatBox
            userId={user.user.id}
            userRole="admin"
            onUnreadChange={(set) => setUnreadChats(set)}
          />
        </TabPanel>

        <TabPanel>
          <AdminAccounting devices={devices} />
        </TabPanel>

        <TabPanel>
          <h3>Настройки</h3>
          <label
            className={styles.toggleWrap}
            title="Режим обслуживания"
            style={{ gap: 12, marginTop: 6, marginBottom: 12 }}
          >
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={maintenanceEnabled}
              onChange={(e) => toggleMaintenance(e.target.checked)}
            />
            <span className={styles.toggleSlider} />
            <span className={styles.toggleLabel}>Режим обслуживания</span>
          </label>
        </TabPanel>

        <TabPanel>
          <div className={styles.actionButtons}>
            <button
              onClick={openCreateSellerModal}
              className={styles.actionButton}
            >
              Добавить магазин
            </button>
          </div>

          <div className={styles.itemList}>
            {sellers.length === 0 ? (
              <p>Магазинов пока нет</p>
            ) : (
              sellers.map((s) => (
                <div key={s.id} className={styles.item}>
                  <span>
                    <strong>{s.name}</strong>{" "}
                    <span style={{ color: "#777" }}>
                      {s.slug ? `(${s.slug})` : ""}
                    </span>
                  </span>

                  <div className={styles.buttons}>
                    <span
                      style={{
                        marginRight: 12,
                        color: s.isActive ? "green" : "red",
                      }}
                    >
                      {s.isActive ? "Активен" : "Неактивен"}
                    </span>

                    <button
                      className={styles.editButton}
                      onClick={() => handleEditSeller(s)}
                    >
                      Редактировать
                    </button>

                    {s.isActive && (
                      <button
                        className={styles.deleteButton}
                        onClick={() => handleDeactivateSeller(s.id)}
                      >
                        Деактивировать
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </TabPanel>

        <TabPanel>
          <div className={styles.menuPanel}>
            <div className={styles.menuTopRow}>
              <div className={styles.menuLeft}>
                <select
                  value={activeSellerId || ""}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setActiveSellerId(id);
                    setMenuSearch("");
                  }}
                  className={styles.select}
                >
                  <option value="" disabled>
                    Выберите ресторан
                  </option>
                  {sellers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.isActive ? "" : "(неактивен)"}
                    </option>
                  ))}
                </select>

                {activeSellerId ? (
                  <div className={styles.menuStats}>
                    <span>
                      Категорий: <b>{menuCategories?.length || 0}</b>
                    </span>
                    <span className={styles.menuDot}>•</span>
                    <span>
                      Блюд: <b>{menuItems?.length || 0}</b>
                    </span>
                  </div>
                ) : null}
              </div>

              <div className={styles.actionButtons}>
                <button
                  className={styles.actionButton}
                  disabled={!activeSellerId}
                  onClick={() => {
                    setEditableMenuCategory(null);
                    setMenuCategoryVisible(true);
                  }}
                >
                  + Категория
                </button>

                <button
                  className={styles.actionButton}
                  disabled={!activeSellerId}
                  onClick={() => openCreateMenuItem(null)}
                >
                  + Блюдо
                </button>
              </div>
            </div>

            {!activeSellerId ? (
              <div className={styles.menuHint}>Выберите ресторан</div>
            ) : (
              <>
                <div className={styles.menuSearchRow}>
                  <InputGroup>
                    <Form.Control
                      value={menuSearch}
                      onChange={(e) => setMenuSearch(e.target.value)}
                      placeholder="Поиск блюда по названию/описанию..."
                    />
                    {menuSearch.trim() ? (
                      <Button
                        variant="outline-secondary"
                        onClick={() => setMenuSearch("")}
                      >
                        ✕
                      </Button>
                    ) : null}
                  </InputGroup>
                </div>

                <Accordion
                  alwaysOpen
                  defaultActiveKey={
                    visibleMenuCategories?.[0]?.id
                      ? String(visibleMenuCategories[0].id)
                      : "no"
                  }
                >
                  {visibleMenuCategories.map((cat) => {
                    const list = menuItemsByCategory.get(cat.id) || [];
                    return (
                      <Accordion.Item key={cat.id} eventKey={String(cat.id)}>
                        <div className={styles.menuAccHeaderRow}>
                          <Accordion.Header>
                            <div className={styles.menuCatTitleWrap}>
                              <span className={styles.menuCatTitle}>
                                {cat.name}
                              </span>

                              <Badge
                                bg={cat.isActive ? "success" : "secondary"}
                                className={styles.menuBadge}
                              >
                                {cat.isActive ? "active" : "off"}
                              </Badge>

                              <Badge
                                bg="light"
                                text="dark"
                                className={styles.menuBadge}
                              >
                                {list.length}
                              </Badge>
                            </div>
                          </Accordion.Header>

                          {/* ВАЖНО: кнопки теперь СНАРУЖИ Accordion.Header */}
                          <div className={styles.menuCatActions}>
                            <button
                              type="button"
                              className={styles.menuSmallButton}
                              onClick={() => openCreateMenuItem(cat.id)}
                            >
                              + Блюдо
                            </button>

                            <button
                              type="button"
                              className={styles.menuSmallButton}
                              onClick={() => {
                                setEditableMenuCategory(cat);
                                setMenuCategoryVisible(true);
                              }}
                            >
                              Редактировать
                            </button>

                            <button
                              type="button"
                              className={styles.menuSmallDanger}
                              onClick={() => handleDeactivateMenuCategory(cat)}
                            >
                              Деактивировать
                            </button>
                          </div>
                        </div>

                        <Accordion.Body>
                          {list.length === 0 ? (
                            <div className={styles.menuEmpty}>
                              <div className={styles.menuEmptyText}>
                                Нет блюд
                              </div>
                              <button
                                className={styles.actionButton}
                                onClick={() => openCreateMenuItem(cat.id)}
                              >
                                + Блюдо
                              </button>
                            </div>
                          ) : (
                            <div className={styles.menuItemList}>
                              {list.map((item) => {
                                const src = getMenuImgSrc(item.img);

                                return (
                                  <div
                                    key={item.id}
                                    className={styles.menuItemCard}
                                  >
                                    <div className={styles.menuItemLeft}>
                                      {src && (
                                        <Image
                                          src={src}
                                          alt={item.name}
                                          className={styles.menuItemImg}
                                          onError={(e) =>
                                            (e.currentTarget.style.display =
                                              "none")
                                          }
                                        />
                                      )}

                                      <div className={styles.menuItemText}>
                                        <div className={styles.menuItemTitle}>
                                          {item.name}{" "}
                                          <span className={styles.menuDot}>
                                            •
                                          </span>{" "}
                                          {item.price} €
                                        </div>
                                        {item.description ? (
                                          <div className={styles.menuItemDesc}>
                                            {item.description}
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>

                                    <div className={styles.menuItemRight}>
                                      <Form.Check
                                        type="switch"
                                        id={`menu-av-${item.id}`}
                                        className={styles.menuSwitch}
                                        label={
                                          item.isAvailable
                                            ? "Доступно"
                                            : "Недоступно"
                                        }
                                        checked={!!item.isAvailable}
                                        onChange={() =>
                                          handleToggleMenuItemAvailability(item)
                                        }
                                      />

                                      <div className={styles.buttons}>
                                        <button
                                          className={styles.editButton}
                                          onClick={() => {
                                            setEditableMenuItem(item);
                                            setMenuItemVisible(true);
                                          }}
                                        >
                                          Редактировать
                                        </button>

                                        <button
                                          className={styles.deleteButton}
                                          onClick={() =>
                                            handleDeactivateMenuItem(item)
                                          }
                                        >
                                          Деактивировать
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </Accordion.Body>
                      </Accordion.Item>
                    );
                  })}

                  {(() => {
                    const unc = menuItemsByCategory.get("no") || [];
                    if (menuSearch.trim() && unc.length === 0) return null;

                    return (
                      <Accordion.Item eventKey="no">
                        <Accordion.Header>
                          <div className={styles.menuCatHeader}>
                            <div className={styles.menuCatTitleWrap}>
                              <span className={styles.menuCatTitle}>
                                Без категории
                              </span>
                              <Badge
                                bg="light"
                                text="dark"
                                className={styles.menuBadge}
                              >
                                {unc.length}
                              </Badge>
                            </div>
                          </div>
                        </Accordion.Header>
                        <Accordion.Body>
                          {unc.length === 0 ? (
                            <div className={styles.menuEmptyText}>Пусто</div>
                          ) : (
                            <div className={styles.menuItemList}>
                              {unc.map((item) => (
                                <div
                                  key={item.id}
                                  className={styles.menuItemCard}
                                >
                                  <div className={styles.menuItemLeft}>
                                    {getMenuImgSrc(item.img) && (
                                      <Image
                                        src={getMenuImgSrc(item.img)}
                                        alt={item.name}
                                        className={styles.menuItemImg}
                                        onError={(e) =>
                                          (e.currentTarget.style.display =
                                            "none")
                                        }
                                      />
                                    )}
                                    <div className={styles.menuItemText}>
                                      <div className={styles.menuItemTitle}>
                                        {item.name}{" "}
                                        <span className={styles.menuDot}>
                                          •
                                        </span>{" "}
                                        {item.price} €
                                      </div>
                                      {item.description ? (
                                        <div className={styles.menuItemDesc}>
                                          {item.description}
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>

                                  <div className={styles.menuItemRight}>
                                    <Form.Check
                                      type="switch"
                                      id={`menu-av-no-${item.id}`}
                                      className={styles.menuSwitch}
                                      label={
                                        item.isAvailable
                                          ? "Доступно"
                                          : "Недоступно"
                                      }
                                      checked={!!item.isAvailable}
                                      onChange={() =>
                                        handleToggleMenuItemAvailability(item)
                                      }
                                    />
                                    <div className={styles.buttons}>
                                      <button
                                        className={styles.editButton}
                                        onClick={() => {
                                          setEditableMenuItem(item);
                                          setMenuItemVisible(true);
                                        }}
                                      >
                                        Редактировать
                                      </button>
                                      <button
                                        className={styles.deleteButton}
                                        onClick={() =>
                                          handleDeactivateMenuItem(item)
                                        }
                                      >
                                        Деактивировать
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </Accordion.Body>
                      </Accordion.Item>
                    );
                  })()}
                </Accordion>
              </>
            )}
          </div>
        </TabPanel>
      </Tabs>

      <CreateBrand
        show={brandVisible}
        editableBrand={editableBrand}
        onHide={() => {
          setBrandVisible(false);
          setEditableBrand(null);
        }}
        onBrandSaved={(saved) => {
          setBrands((prev) => upsertBrand(prev, saved));
          device.setBrands(upsertBrand(device.brands || [], saved));
          setEditableBrand(null);
        }}
      />

      <CreateDevice
        show={deviceVisible}
        onHide={() => {
          setDeviceVisible(false);
          fetchDevices(undefined, undefined, undefined, 1, 1000).then((data) =>
            setDevices(data.rows || data)
          );
        }}
        editableDevice={editableDevice}
        onDeviceSaved={() => setEditableDevice(null)}
      />
      <CreateType
        show={typeVisible}
        onHide={() => {
          setTypeVisible(false);
          setEditableType(null);
        }}
        editableType={editableType}
        onTypeSaved={() => {
          setEditableType(null);
          fetchTypes().then(setTypes);
        }}
        types={types}
      />

      <CreateMake
        show={makeVisible}
        editableMake={editableMake}
        onHide={() => {
          setMakeVisible(false);
          setEditableMake(null);
          reloadMakes();
        }}
        onSaved={(saved) => {
          reloadMakes().then(() => {
            if (saved?.id) {
              setOpenMakeIds((prev) => [...new Set([...prev, saved.id])]);
              loadModelsForMake(saved.id);
            }
          });
        }}
      />

      <CreateModel
        show={modelVisible}
        editableModel={editableModel}
        makes={makes}
        onHide={() => {
          setModelVisible(false);
          openMakeIds.forEach((id) => loadModelsForMake(id));
          setEditableModel(null);
        }}
        onSaved={(saved) => {
          const makeId = saved?.makeId ?? editableModel?.makeId;
          if (makeId) {
            setOpenMakeIds((prev) => [...new Set([...prev, makeId])]);
            loadModelsForMake(makeId);
          }
        }}
      />

      <CreateSubType
        show={subtypeVisible}
        onHide={() => {
          setSubtypeVisible(false);
          setEditableSubtype(null);
        }}
        editableSubtype={editableSubtype}
        onSubtypeSaved={() => {
          fetchSubtypes().then(setSubtypes);
        }}
      />
      <CreateSeller
        show={sellerVisible}
        editableSeller={editableSeller}
        onHide={() => {
          setSellerVisible(false);
          setEditableSeller(null);
          fetchSellers(false).then(setSellers);
        }}
        onSaved={() => {
          fetchSellers(false).then(setSellers);
        }}
      />

      <CreateMenuCategory
        show={menuCategoryVisible}
        sellerId={activeSellerId}
        editableCategory={editableMenuCategory}
        onHide={() => {
          setMenuCategoryVisible(false);
          setEditableMenuCategory(null);
        }}
        onSaved={async () => {
          await reloadMenu();
        }}
      />

      <CreateMenuItem
        show={menuItemVisible}
        sellerId={activeSellerId}
        editableItem={editableMenuItem}
        categories={menuCategories}
        initialCategoryId={prefillMenuCategoryId}
        onHide={() => {
          setMenuItemVisible(false);
          setEditableMenuItem(null);
          setPrefillMenuCategoryId(null);
        }}
        onSaved={async () => {
          await reloadMenu();
        }}
      />

      <StockQuickAdjustModal
        show={quickAdjustVisible}
        onHide={() => setQuickAdjustVisible(false)}
        devices={devices}
        onUpdated={(updated) => {
          setDevices((prev) =>
            prev.map((d) => (d.id === updated.id ? updated : d))
          );
        }}
      />
      {selectedDeviceId && (
        <SlideModal onClose={() => setSelectedDeviceId(null)}>
          <Suspense fallback={<div style={{ padding: 16 }}>Загрузка…</div>}>
            <DevicePageLazy id={selectedDeviceId} />
          </Suspense>
        </SlideModal>
      )}
    </div>
  );
};

export default Admin;




