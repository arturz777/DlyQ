import React, { useState, useEffect, useContext } from "react";
import { Context } from "../index";
import { fetchAllCouriers } from "../http/courierAPI";
import CreateBrand from "../components/modals/CreateBrand";
import CreateDevice from "../components/modals/CreateDevice";
import CreateType from "../components/modals/CreateType";
import CreateSubType from "../components/modals/CreateSubType";
import CreateMake from "../components/modals/CreateMake";
import CreateModel from "../components/modals/CreateModel";
import CourierMap from "../components/CourierMap";
import ChatBox from "../components/ChatBox";
import AdminAccounting from "../components/AdminAccounting";
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
import StockQuickAdjustModal from "../components/modals/StockQuickAdjustModal";
import { io } from "socket.io-client";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import "react-tabs/style/react-tabs.css";
import Image from "react-bootstrap/Image";
import styles from "./Admin.module.css";

const Admin = () => {
  const { device, user } = useContext(Context);
  const [types, setTypes] = useState([]);
  const [subtypes, setSubtypes] = useState([]);
  const [brands, setBrands] = useState([]);
  const [devices, setDevices] = useState([]);
  const [visibleDevices, setVisibleDevices] = useState([]);
  const [currentOffset, setCurrentOffset] = useState(0);
  const limit = 10; // Количество товаров для загрузки за раз

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
  const [openMakeIds, setOpenMakeIds] = useState([]);

  useEffect(() => {
    const socket = io(`https://zang-4.onrender.com`);
  
    socket.on("courierLocationUpdate", ({ courierId, lat, lng }) => {
      setCouriers((prev) =>
        prev.map((c) =>
          c.id === courierId ? { ...c, currentLat: lat, currentLng: lng } : c
        )
      );
    });
  
    socket.on("courierStatusUpdate", ({ courierId, status }) => {
      setCouriers((prev) =>
        prev.map((c) => (c.id === courierId ? { ...c, status } : c))
      );
    });
  
    return () => socket.disconnect();
  }, []);
  
  useEffect(() => {
    fetchTypes().then(setTypes);
    fetchSubtypes().then(setSubtypes);
    fetchBrands().then(setBrands);
    fetchDevices(undefined, undefined, undefined, 1, 1000).then((data) =>
      setDevices(data.rows || data)
    );
    fetchTranslations().then(setTranslations);
  }, []);

  useEffect(() => {
    fetchAllOrdersForAdmin().then(setAllOrders);
    fetchMakes().then(setMakes).catch(console.error);
  }, []);

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

  const handleLoadMore = () => {
    const nextOffset = currentOffset + limit;
    const newDevices = filteredDevices.slice(nextOffset, nextOffset + limit);
    setVisibleDevices((prev) => [...prev, ...newDevices]);
    setCurrentOffset(nextOffset);
  };

  const filteredDevices = React.useMemo(() => {
    return devices
      .filter((device) =>
        device.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => {
        if (sortOption === "priceAsc") return a.price - b.price;
        if (sortOption === "priceDesc") return b.price - a.price;
        if (sortOption === "nameAsc") return a.name.localeCompare(b.name);
        if (sortOption === "nameDesc") return b.name.localeCompare(a.name);
        return 0;
      });
  }, [devices, searchQuery, sortOption]);

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
      setVisibleDevices((devicesData.rows || devicesData).slice(0, limit));
    };

    fetchData();
  }, []);

  useEffect(() => {
    setVisibleDevices(filteredDevices.slice(0, limit));
    setCurrentOffset(0);
  }, [filteredDevices]);

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

    fetch(`https://zang-4.onrender.com/api/chat/user/${user.user.id}`)
      .then((res) => res.json())
      .then((data) => {
        const unread = new Set();
        data.forEach((chat) => {
          const hasUnread = chat.messages?.some(
            (msg) => !msg.isRead && msg.senderId !== user.user.id
          );
          if (hasUnread) unread.add(chat.id);
        });

        setUnreadChats(unread);
      })
      .catch(console.error);
  }, [user?.user?.id]);

  useEffect(() => {
    const socket = io(`https://zang-4.onrender.com`);

    if (user?.user?.role === "ADMIN" || user?.user?.role === "admin") {
      socket.emit("joinAdminNotifications");
      console.log("🔔 Админ подключен к admin_notifications");
    }

    return () => {
      socket.disconnect();
    };
  }, [user]);

   const reloadMakes = async () => {
    const m = await fetchMakes();
    setMakes(m);
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
    const response = await fetch(`https://zang-4.onrender.com/api/translations`, {
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
    .filter((d) => (d.quantity ?? 0) <= 0 && !isSnoozed(d))
    .sort((a, b) => a.name.localeCompare(b.name));

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
            <div
              style={{ border: "2px solid red", padding: 10, marginBottom: 15 }}
            >
              <h3 style={{ color: "red", marginTop: 0 }}>
                Товары с истёкшим или истекающим сроком (в ближайшие 2 месяца)
              </h3>

              <div className={styles.itemList}>
                {attentionDevices.map((device) => (
                  <div
                    key={device.id}
                    className={styles.item}
                    style={{ background: "#ffe5e5" }}
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
                          color: "red",
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
                        onClick={() => handleEditDevice(device)}
                      >
                        Редактировать
                      </button>
                      <button
                        className={styles.deleteButton}
                        onClick={() => {
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
            </div>
          )}

          {outOfStockDevices.length > 0 && (
            <div
              style={{
                border: "2px solid red",
                padding: 10,
                marginBottom: 15,
                background: "#ffe5e5",
              }}
            >
              <h3 style={{ color: "red", marginTop: 0 }}>Нет в наличии</h3>

              <div className={styles.itemList}>
                {outOfStockDevices.map((device) => (
                  <div
                    key={device.id}
                    className={styles.item}
                    style={{ background: "#ffe5e5" }}
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

                      <button
                        className={styles.editButton}
                        onClick={() => handleEditDevice(device)}
                      >
                        Редактировать
                      </button>
                      <button
                        className={styles.deleteButton}
                        onClick={() => {
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
            const typeDevices = filteredDevices.filter(
              (device) => device.typeId === type.id
            );
            const subtypesForType = subtypes.filter(
              (subtype) => subtype.typeId === type.id
            );

            if (typeDevices.length === 0 && subtypesForType.length === 0)
              return null;

            const isOpen = openDeviceTypeIds.includes(type.id);

            return (
              <div key={type.id} className={styles.typeGroup}>
                <div
                  className={styles.typeHeader}
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
                  <span>{isOpen ? "▲" : "▼"}</span>
                </div>
                {isOpen && (
                  <>
                    {typeDevices.filter((d) => !d.subtypeId).length > 0 && (
                      <div className={styles.itemList}>
                        {typeDevices
                          .filter((device) => !device.subtypeId)
                          .map((device) => (
                            <div key={device.id} className={styles.item}>
                              <div>
                                id-
                                {device.id}
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
                                <div className={styles.adminDevicePrice}>
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
                                <span className={styles.deviceQuantity}>
                                  {device.quantity === 0 ? (
                                    <span style={{ color: "red" }}>
                                      Нет в наличии
                                    </span>
                                  ) : (
                                    <span style={{ color: "green" }}>
                                      В наличии: {device.quantity}
                                    </span>
                                  )}
                                </span>

                                <button
                                  className={styles.editButton}
                                  onClick={() => handleEditDevice(device)}
                                >
                                  Редактировать
                                </button>
                                <button
                                  className={styles.deleteButton}
                                  onClick={() => {
                                    const confirmed = window.confirm(
                                      "Вы уверены, что хотите удалить этот девайс?"
                                    );
                                    if (confirmed) {
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

                    {subtypesForType.map((subtype) => {
                      const subtypeDevices = typeDevices.filter(
                        (device) => device.subtypeId === subtype.id
                      );
                      if (subtypeDevices.length === 0) return null;
                      return (
                        <div key={subtype.id} className={styles.typeGroup}>
                          <h5 className={styles.typeTitle}>{subtype.name}</h5>
                          <div className={styles.itemList}>
                            {subtypeDevices.map((device) => (
                              <div key={device.id} className={styles.item}>
                                <div>
                                  id-
                                  {device.id}
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
                                  <div className={styles.adminDevicePrice}>
                                    {device.price} €
                                  </div>
                                  <span className={styles.deviceQuantity}>
                                    {device.quantity === 0 ? (
                                      <span style={{ color: "red" }}>
                                        Нет в наличии
                                      </span>
                                    ) : (
                                      <span style={{ color: "green" }}>
                                        В наличии: {device.quantity}
                                      </span>
                                    )}
                                  </span>

                                  <button
                                    className={styles.editButton}
                                    onClick={() => handleEditDevice(device)}
                                  >
                                    Редактировать
                                  </button>
                                  <button
                                    className={styles.deleteButton}
                                    onClick={() => {
                                      const confirmed = window.confirm(
                                        "Вы уверены, что хотите удалить этот девайс?"
                                      );
                                      if (confirmed) {
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
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            );
          })}

          {visibleDevices.length < filteredDevices.length ? (
            <button onClick={handleLoadMore} className={styles.loadMoreButton}>
              Еще
            </button>
          ) : (
            <p className={styles.emptyCategoryMessage}>Все товары загружены.</p>
          )}
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
                        <span>
                          {subtype.name} (Тип:{" "}
                          {typesMap.get(subtype.typeId)?.name || "N/A"})
                        </span>
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
                          <option value="Pending">Pending</option>
                          <option value="Waiting for courier">
                            Waiting for courier
                          </option>
                          <option value="Ready for pickup">
                            Ready for pickup
                          </option>
                          <option value="Picked up">Picked up</option>
                          <option value="Arrived at destination">
                            Arrived at destination
                          </option>
                          <option value="Delivered">Delivered</option>
                          <option value="Completed">Completed</option>
                          <option value="Cancelled">Cancelled</option>
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
      </Tabs>

      <CreateBrand
        show={brandVisible}
        onHide={() => {
          setBrandVisible(false);
          fetchBrands().then(setBrands);
        }}
        editableBrand={editableBrand}
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
    </div>
  );
};

export default Admin;
