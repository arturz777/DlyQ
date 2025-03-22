import React, { useEffect, useState } from "react";
import {
  fetchNewDevices,
  fetchDiscountedDevices,
  fetchRecommendedDevices,
  fetchTypes,
} from "../http/deviceAPI";
import DeviceItem from "../components/DeviceItem";
import styles from "./HomePage.module.css";
import { Link } from "react-router-dom";

const HomePage = () => {
  const [newDevices, setNewDevices] = useState([]);
  const [discountedDevices, setDiscountedDevices] = useState([]);
  const [recommendedDevices, setRecommendedDevices] = useState([]);
  const [types, setTypes] = useState([]);
  const [showAllTypes, setShowAllTypes] = useState(false);

  useEffect(() => {
    fetchNewDevices(10)
      .then((devices) => setNewDevices(devices || []))
      .catch((err) => console.error("❌ Ошибка загрузки новых товаров:", err));

    fetchDiscountedDevices(10).then((data) => setDiscountedDevices(data.rows));
    fetchRecommendedDevices(10).then((data) =>
      setRecommendedDevices(data.rows)
    );

    fetchTypes()
      .then((data) => {
        if (Array.isArray(data)) {
          setTypes(data);
        } else {
          console.error(
            "❌ Ошибка загрузки категорий: Получен неправильный формат данных"
          );
          setTypes([]);
        }
      })
      .catch((err) => console.error("❌ Ошибка загрузки категорий:", err));
  }, []);

  return (
    <div className={styles.homePage}>
      <div className={styles.banner}>
        <h1>🔥 Добро пожаловать в наш магазин!</h1>
        <p>Лучшая техника по отличным ценам</p>
      </div>

      <div className={styles.categories}>
  {types.length > 6 && window.innerWidth >= 1024 ? (
    <>
      {types.slice(0, 5).map((type) => (
        <Link key={type.id} to={`/catalog?typeId=${type.id}`} className={styles.category}>
          {type.img && <img src={type.img} alt={type.name} className={styles.categoryIcon} />}
          {type.name}
        </Link>
      ))}
      <div className={styles.dropdownContainer}>
        <div className={`${styles.category} ${styles.moreButton}`} onClick={() => setShowAllTypes(!showAllTypes)}>
          {showAllTypes ? "▲ Скрыть" : "▼ Ещё"}
        </div>

        {showAllTypes && (
          <div className={styles.dropdownMenu}>
            {types.slice(6).map((type) => (
              <Link key={type.id} to={`/catalog?typeId=${type.id}`} className={styles.dropdownItem}>
                {type.img && <img src={type.img} alt={type.name} className={styles.categoryIcon} />}
                {type.name}
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  ) : (
    types.map((type) => (
      <Link key={type.id} to={`/catalog?typeId=${type.id}`} className={styles.category}>
        {type.img && <img src={type.img} alt={type.name} className={styles.categoryIcon} />}
        {type.name}
      </Link>
    ))
  )}
</div>



      <section className={styles.section}>
        <h2>🌟 Новые поступления</h2>
        <div className={styles.deviceCarousel}>
          {newDevices && Array.isArray(newDevices) && newDevices.length > 0 ? (
            newDevices.map((device) => (
              <div key={device.id} className={styles.deviceItem}>
                <DeviceItem device={device} />
              </div>
            ))
          ) : (
            <p>Нет новых товаров</p>
          )}
        </div>
      </section>

      <section className={styles.section}>
        <h2>💰 Супер скидки</h2>
        <div className={styles.deviceCarousel}>
          {discountedDevices.map((device) => (
            <div key={device.id} className={styles.deviceItem}>
              <DeviceItem device={device} />
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>🎯 Рекомендуем вам</h2>
        <div className={styles.deviceCarousel}>
          {recommendedDevices.map((device) => (
            <div key={device.id} className={styles.deviceItem}>
              <DeviceItem device={device} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default HomePage;
