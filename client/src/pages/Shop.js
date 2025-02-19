import React, { useEffect, useState, useContext } from "react";
import ShopList from "../components/ShopList";
import { Context } from "../index";
import { fetchTypes, fetchSubtypes, fetchDevices } from "../http/deviceAPI";
import styles from "./Shop.module.css";

const Shop = () => {
  const { device } = useContext(Context);
  const [types, setTypes] = useState([]);
  const [subtypes, setSubtypes] = useState([]);
  const [devices, setDevices] = useState([]);

  useEffect(() => {
    // Загружаем данные
    const loadData = async () => {
      const fetchedTypes = await fetchTypes();
      const fetchedSubtypes = await fetchSubtypes();
      const fetchedDevices = await fetchDevices();
      setTypes(fetchedTypes);
      setSubtypes(fetchedSubtypes);
      setDevices(fetchedDevices.rows); // Только устройства
    };

    loadData();
  }, []);

  const totalPages = Math.ceil(devices.totalCount / device.limit);

  return (
    <div className={styles.shopWrapper}>
      <div className={styles.mainContent}>
        <div className={styles.deviceContainer}>
        <ShopList devices={devices} types={types} subtypes={subtypes} />
      </div>
      {totalPages > 1 && <Pages totalPages={totalPages} />}
    </div>
    </div>
  );
};

export default Shop;
