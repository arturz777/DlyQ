import React, { useState, useEffect, useContext } from "react";
import { Context } from "../index";
import { fetchAllCouriers } from "../http/courierAPI";
import CreateBrand from "../components/modals/CreateBrand";
import CreateDevice from "../components/modals/CreateDevice";
import CreateType from "../components/modals/CreateType";
import CreateSubType from "../components/modals/CreateSubType";
import CourierMap from "../components/CourierMap";
import ChatBox from "../components/ChatBox";
import { assignCourierToOrder } from "../http/orderAPI";
import { fetchTranslations, updateTranslation } from "../http/translationAPI";
import {
  fetchTypes,
  fetchSubtypes,
  fetchBrands,
  fetchDevices,
  deleteType,
  deleteSubtype,
  deleteBrand,
  deleteDevice,
} from "../http/deviceAPI";
import {
  fetchAllOrdersForAdmin,
  adminUpdateOrderStatus,
} from "../http/orderAPI";
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

  const [editableDevice, setEditableDevice] = useState(null);
  const [editableType, setEditableType] = useState(null);
  const [editableSubtype, setEditableSubtype] = useState(null);
  const [editableBrand, setEditableBrand] = useState(null);

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
    fetchDevices().then((data) => setDevices(data.rows || []));
    fetchTranslations().then(setTranslations);
  }, []);

  useEffect(() => {
    fetchAllOrdersForAdmin().then(setAllOrders);
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
      console.log("✅ Статус/время обновлены");
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

      const devicesData = await fetchDevices();
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

    fetch(`${process.env.REACT_APP_API_URL}/chat/user/${user.user.id}`)
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
    const response = await fetch(`${process.env.REACT_APP_API_URL}/translations`, {
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

  return (
    <div className={styles.adminPanelContainer}>
      <Tabs>
        <TabList>
          <Tab>Устройства</Tab>
          <Tab>Типы</Tab>
          <Tab>Подтипы</Tab>
          <Tab>Бренды</Tab>
          <Tab>Переводы</Tab>
          <Tab>Заказы</Tab>
          <Tab>
            Чат поддержки{" "}
            {unreadChats.size > 0 && <span style={{ color: "red" }}>●</span>}
          </Tab>
        </TabList>

        <TabPanel>
          <div className={styles.actionButtons}>
            <button
              onClick={() => setDeviceVisible(true)}
              className={styles.actionButton}
            >
              Добавить устройство
            </button>
          </div>

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

            return (
              <div key={type.id} className={styles.typeGroup}>
                <h5 className={styles.typeTitle}>{type.name}</h5>

                {typeDevices.filter((device) => !device.subtypeId).length >
                  0 && (
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
                              onClick={() => handleDeleteDevice(device.id)}
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
                  return (
                    <div key={subtype.id} className={styles.typeGroup}>
                      <h5 className={styles.typeTitle}>{subtype.name}</h5>

                      <div className={styles.itemList}>
                        {subtypeDevices.length > 0 ? (
                          subtypeDevices.map((device) => (
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
                                  {device.price} € |
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
                                </div>

                                <button
                                  className={styles.editButton}
                                  onClick={() => handleEditDevice(device)}
                                >
                                  Редактировать
                                </button>
                                <button
                                  className={styles.deleteButton}
                                  onClick={() => handleDeleteDevice(device.id)}
                                >
                                  Удалить
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className={styles.emptyCategoryMessage}>
                            Нет доступных товаров в этом подтипе.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}

                {typeDevices.length === 0 && subtypesForType.length === 0 && (
                  <p className={styles.emptyCategoryMessage}>
                    У этого типа нет товаров.
                  </p>
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
              onClick={() => setTypeVisible(true)}
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
                    onClick={() => handleDeleteType(type.id)}
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
              onClick={() => setSubtypeVisible(true)}
              className={styles.actionButton}
            >
              Добавить подтип
            </button>
          </div>

          <div className={styles.itemList}>
            {subtypes.map((subtype) => (
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
                    onClick={() => handleDeleteSubtype(subtype.id)}
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
                    onClick={() => handleDeleteBrand(brand.id)}
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
          fetchDevices().then((data) => setDevices(data.rows || []));
        }}
        editableDevice={editableDevice}
        onDeviceSaved={() => setEditableDevice(null)}
      />
      <CreateType
        show={typeVisible}
        onHide={() => {
          setTypeVisible(false);
          setEditableType(null);
          fetchTypes().then(setTypes);
        }}
        editableType={editableType}
        onTypeSaved={() => setEditableType(null)}
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
    </div>
  );
};

export default Admin;
