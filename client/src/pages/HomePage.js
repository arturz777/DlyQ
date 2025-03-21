import React, { useEffect, useState } from "react";
import { fetchNewDevices, fetchDiscountedDevices, fetchRecommendedDevices } from "../http/deviceAPI";
import DeviceItem from "../components/DeviceItem";
import styles from "./HomePage.module.css";

const HomePage = () => {
  const [newDevices, setNewDevices] = useState([]);
  const [discountedDevices, setDiscountedDevices] = useState([]);
  const [recommendedDevices, setRecommendedDevices] = useState([]);

  useEffect(() => {
    fetchNewDevices(10).then((data) => setNewDevices(data.rows));
    fetchDiscountedDevices(10).then((data) => setDiscountedDevices(data.rows));
    fetchRecommendedDevices(10).then((data) => setRecommendedDevices(data.rows));
  }, []);

  return (
    <div className={styles.homePage}>

      {/* 🔥 Баннер */}
      <div className={styles.banner}>
        <h1>🔥 Добро пожаловать в наш магазин!</h1>
        <p>Лучшая техника по отличным ценам</p>
      </div>

      {/* 🎉 Категории (Горизонтальная прокрутка) */}
      <div className={styles.categories}>
        <div className={styles.category}>📱 Смартфоны</div>
        <div className={styles.category}>💻 Ноутбуки</div>
        <div className={styles.category}>🎧 Аксессуары</div>
        <div className={styles.category}>📺 Телевизоры</div>
        <div className={styles.category}>🖥 Мониторы</div>
        <div className={styles.category}>📷 Камеры</div>
      </div>

      {/* 🌟 Новые товары */}
      <section className={styles.section}>
        <h2>🌟 Новые поступления</h2>
        <div className={styles.deviceCarousel}>
          {newDevices.map((device) => (
            <div key={device.id} className={styles.deviceItem}>
              <DeviceItem device={device} />
            </div>
          ))}
        </div>
      </section>

      {/* 💰 Скидки */}
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

      {/* 🎯 Рекомендуемые товары */}
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
