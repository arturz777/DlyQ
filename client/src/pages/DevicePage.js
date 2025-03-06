import React, { useEffect, useState, useContext } from "react";
import star from "../assets/bigStar.png";
import { useParams } from "react-router-dom";
import { fetchOneDevice } from "../http/deviceAPI";
import { Context } from "../index";
import { toast } from "react-toastify"; // Для уведомлений

import { motion, AnimatePresence } from "framer-motion";
import styles from "./DevicePage.module.css";

const DevicePage = () => {
  const { basket } = useContext(Context);
  const [device, setDevice] = useState({
    info: [],
    options: [],
    thumbnails: [],
  });
  const [selectedOptions, setSelectedOptions] = useState({});
  const [finalPrice, setFinalPrice] = useState(0);
  const { id } = useParams();
  const [activeIndex, setActiveIndex] = useState(0);
  const [availableQuantity, setAvailableQuantity] = useState(0);
  const [isPreorder, setIsPreorder] = useState(false);

  const checkStock = async (deviceId, quantity, selectedOptions) => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/device/check-stock`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ deviceId, quantity, selectedOptions }),
        }
      );

      const data = await response.json();

      if (data.status === "error") {
        // ✅ Теперь проверяем статус, а не response.ok
        toast.error(`❌ ${data.message}`);
        return false;
      }

      return data.quantity >= quantity;
    } catch (error) {
      console.error("Ошибка при проверке наличия товара:", error);
      return false;
    }
  };

  useEffect(() => {
    fetchOneDevice(id).then((data) => {
      setDevice(data);
      setFinalPrice(data.price);
      setActiveIndex(0);

      const itemInBasket = basket.items.find((item) => item.id === data.id);
      const quantityInBasket = itemInBasket ? itemInBasket.count : 0;
      setAvailableQuantity(data.quantity - quantityInBasket);

      const initialOptions = {};
      data.options?.forEach((option) => {
        if (option.values.length > 0) {
          initialOptions[option.name] = option.values[0]; // Устанавливаем первое значение
        }
      });
      setSelectedOptions({});
    });
  }, [id, basket.items]);

  useEffect(() => {
    const additionalPrice = Object.values(selectedOptions).reduce(
      (total, option) => total + (option?.price || 0),
      0
    );
    setFinalPrice(device.price + additionalPrice);
  }, [selectedOptions, device.price]);

  if (!device) return <p>Загрузка...</p>;

  const images = [device.img, ...(device.thumbnails || [])];

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % images.length);
  };

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleOptionChange = (optionName, selectedValue) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [optionName]: selectedValue,
    }));
  };

  const availableOptions = device.options.map((option) => ({
    ...option,
    values: option.values.filter((v) => v.quantity > 0), // Показываем только доступные
  }));

  const handleAddToBasket = async () => {
    const existingItem = basket.items.find(
      (item) =>
        item.id === device.id &&
        JSON.stringify(item.selectedOptions) === JSON.stringify(selectedOptions)
    );
    const newCount = (existingItem?.count || 0) + 1;

    // ✅ Проверяем, выбраны ли все параметры товара
    if (!selectedOptions || Object.keys(selectedOptions).length === 0) {
      toast.error("Выберите параметры товара!");
      return;
    }

    const isAvailable = await checkStock(device.id, newCount, selectedOptions);

    if (!isAvailable && !isPreorder) {
      // Если товара нет и предзаказ выключен
      toast.error("❌ Товара нет в наличии!");
      return;
    }

    const newItem = {
      ...device,
      selectedOptions,
      isPreorder, // ✅ Добавляем флаг предзаказа
    };


    // ✅ Добавляем товар в корзину
    basket.addItem(newItem);
    toast.success(`${device.name} добавлен в корзину!`);

    // ✅ Обновляем доступное количество
    setAvailableQuantity((prev) => prev - 1);
  };

  return (
    <div className={styles.DevicePageContainer}>
      <div className={styles.DevicePageContent}>
        <div className={styles.DevicePageColImg}>
          <div className={styles.DevicePageImageWrapper}>
            <div className={styles.ImageContainer}>
              <AnimatePresence mode="wait">
                {images.map(
                  (img, index) =>
                    index === activeIndex && (
                      <motion.img
                        key={`${img}-${index}`}
                        src={img}
                        alt={device.name}
                        className={styles.DevicePageMainImage}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      />
                    )
                )}
              </AnimatePresence>
            </div>
            {images.length > 1 && (
              <div className={styles.ArrowButtons}>
                <button onClick={handlePrev} className={styles.PrevButton}>
                  ‹
                </button>
                <button onClick={handleNext} className={styles.NextButton}>
                  ›
                </button>
              </div>
            )}
          </div>
          <div className={styles.DevicePageThumbnailContainer}>
            {images.map((thumb, index) => (
              <img
                key={index}
                src={thumb}
                className={`${styles.DevicePageThumbnail} ${
                  index === activeIndex ? styles.ActiveThumbnail : ""
                }`}
                onClick={() => setActiveIndex(index)}
              />
            ))}
          </div>
        </div>
        <div className={styles.DevicePageDetails}>
          <div className={styles.DevicePageCard}>
            <h2 className={styles.DevicePageTitle}>{device.name}</h2>
            {device.options?.map((option, optionIndex) => (
              <div key={optionIndex} className={styles.DevicePageOption}>
                <label>{option.name}</label>
                <select
                  value={selectedOptions[option.name]?.value || ""}
                  onChange={(e) => {
                    const selectedValue = option.values.find(
                      (v) => v.value === e.target.value
                    );
                    handleOptionChange(option.name, selectedValue);
                  }}
                  className={styles.DevicePageSelect}
                >
                  <option value="" disabled hidden>
                    {`Выберите: ${option.name}`}
                  </option>
                  {option.values.map((valueObj, valueIndex) => (
                    <option
                      key={valueIndex}
                      value={valueObj.value}
                      disabled={valueObj.quantity <= 0}
                    >
                      {valueObj.value}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <p className={styles.DevicePagePrice}>Всего: {finalPrice}€</p>
            <div className={styles.DevicePageRating}>
              <span className={styles.DevicePageRatingValue}>
                {device.rating}
              </span>
              <img
                src={star}
                alt="rating"
                className={styles.DevicePageRatingIcon}
              />
              <span className={styles.DevicePageRatingText}>(42 отзывов)</span>
            </div>

            <button
              className={styles.DevicePageAddToCart}
              onClick={handleAddToBasket}
              disabled={!isPreorder && availableQuantity <= 0}
            >
              {availableQuantity <= 0 ? "Нет в наличии" : "Добавить в корзину"}
            </button>
            {availableQuantity <= 0 && (
            <div className={styles.preorderSection}>
              <label>
                <input
                  type="checkbox"
                  checked={isPreorder}
                  onChange={() => setIsPreorder(!isPreorder)}
                />
                Оформить предзаказ
              </label>
            </div>
            )}
          </div>
        </div>
      </div>

      {/* Секция характеристик */}
      <div className={styles.DevicePageSpecs}>
        <h3 className={styles.DevicePageSpecsTitle}>Характеристики</h3>
        <div className={styles.DevicePageSpecsCard}>
          {device.info.map((info, index) => (
            <div
              key={info.id}
              className={`${styles.DevicePageSpecRow} ${
                index % 2 === 0 ? styles.DevicePageSpecRowEven : ""
              }`}
            >
              <span className={styles.DevicePageSpecText}>
                <strong>{info.title}:</strong> {info.description}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DevicePage;
