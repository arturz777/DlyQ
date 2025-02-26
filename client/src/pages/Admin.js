import React, { useState, useEffect, useContext  } from "react";
import { Context } from "../index";
import CreateBrand from "../components/modals/CreateBrand";
import CreateDevice from "../components/modals/CreateDevice";
import CreateType from "../components/modals/CreateType";
import CreateSubType from "../components/modals/CreateSubType";
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
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import "react-tabs/style/react-tabs.css";
import Image from "react-bootstrap/Image";
import styles from "./Admin.module.css";

const Admin = () => {
  const { device } = useContext(Context);
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

  useEffect(() => {
    fetchTypes().then(setTypes);
    fetchSubtypes().then(setSubtypes); // Получение подтипов
    fetchBrands().then(setBrands);
    fetchDevices().then((data) => setDevices(data.rows || []));
  }, []);

  const handleLoadMore = () => {
    const nextOffset = currentOffset + limit;
    const newDevices = filteredDevices.slice(nextOffset, nextOffset + limit);
    setVisibleDevices((prev) => [...prev, ...newDevices]);
    setCurrentOffset(nextOffset);
  };

  // Фильтрация и поиск
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
    // Обновляем видимые устройства, когда фильтры или сортировка изменяются
    setVisibleDevices(filteredDevices.slice(0, limit));
    setCurrentOffset(0); // Сбрасываем offset на начальную позицию
  }, [filteredDevices]);

  // Удаление типа
  const handleDeleteType = async (id) => {
    await deleteType(id);
    setTypes((prev) => prev.filter((type) => type.id !== id)); // Обновляем локально
  };

  const handleDeleteSubtype = async (id) => {
    await deleteSubtype(id);
    setSubtypes((prev) => prev.filter((subtype) => subtype.id !== id));
  };

  // Удаление бренда
  const handleDeleteBrand = async (id) => {
    await deleteBrand(id);
    setBrands((prev) => prev.filter((brand) => brand.id !== id)); // Обновляем локально
  };

  const handleEditDevice = (device) => {
    setEditableDevice(device);
    setDeviceVisible(true);
  };

  // Удаление устройства
  const handleDeleteDevice = async (id) => {
    await deleteDevice(id);
    setDevices((prev) => prev.filter((device) => device.id !== id)); // Обновляем локально
  };

  const handleEditType = (type) => {
    setEditableType(type); // Устанавливаем редактируемый тип
    setTypeVisible(true);
  };

  const handleEditSubtype = (subtype) => {
    setEditableSubtype(subtype);
    setSubtypeVisible(true);
  };

  const handleEditBrand = (brand) => {
    setEditableBrand(brand); // Устанавливаем редактируемый бренд
    setBrandVisible(true);
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
        </TabList>

        {/* Вкладка Устройства */}
        <TabPanel>
          <div className={styles.actionButtons}>
            <button
              onClick={() => setDeviceVisible(true)}
              className={styles.actionButton}
            >
              Добавить устройство
            </button>
          </div>

          {/* Фильтрация и сортировка */}
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
          {device.price} € |  
          <span className={styles.deviceQuantity}>
            {device.quantity === 0 ? (
              <span style={{ color: "red" }}>Нет в наличии</span>
            ) : (
              <span style={{ color: "green" }}>В наличии: {device.quantity}</span>
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
                                  src={
                                    process.env.REACT_APP_API_URL + device.img
                                  }
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
              <span style={{ color: "red" }}>Нет в наличии</span>
            ) : (
              <span style={{ color: "green" }}>В наличии: {device.quantity}</span>
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

        {/* Вкладка Типы */}
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
                  src={`${process.env.REACT_APP_API_URL}/${type.img}`}
                  alt={type.name}
                  className={styles.typeImage}
                />
                <span>{type.name}</span>

                <div className={styles.buttons}>
                  <button
                    className={styles.editButton}
                    onClick={() => handleEditType(type)} // Редактирование типа
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

        {/* Вкладка Бренды */}
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
                    onClick={() => handleEditBrand(brand)} // Редактирование бренда
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
      </Tabs>

      <CreateBrand
        show={brandVisible}
        onHide={() => {
          setBrandVisible(false);
          fetchBrands().then(setBrands);
        }}
        editableBrand={editableBrand} // Передача редактируемого бренда
      />
      <CreateDevice
        show={deviceVisible}
        onHide={() => {
          setDeviceVisible(false);
          fetchDevices().then((data) => setDevices(data.rows || []));
        }}
        editableDevice={editableDevice} // Передача в компонент
        onDeviceSaved={() => setEditableDevice(null)} // Очистка после сохранения
      />
      <CreateType
        show={typeVisible}
        onHide={() => {
          setTypeVisible(false);
          setEditableType(null); // Сбросить редактируемый тип
          fetchTypes().then(setTypes);
        }}
        editableType={editableType}
        onTypeSaved={() => setEditableType(null)} // Очистка после сохранения
      />
      <CreateSubType
        show={subtypeVisible}
        onHide={() => {
          setSubtypeVisible(false);
          setEditableSubtype(null); // Сброс редактируемого подтипа
        }}
        editableSubtype={editableSubtype}
        onSubtypeSaved={() => {
          fetchSubtypes().then(setSubtypes); // Обновляем подтипы
        }}
      />
    </div>
  );
};

export default Admin;
