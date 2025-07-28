import React, { useEffect, useState, useContext } from "react";
import { useParams } from "react-router-dom";
import { fetchOneDevice, fetchRecommendedDevices } from "../http/deviceAPI";
import { Context } from "../index";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import DeviceItem from "../components/DeviceItem";
import { isShopOpenNow } from "../utils/workHours";
import styles from "./DevicePage.module.css";

const DevicePage = () => {
  const { basket } = useContext(Context);
  const [device, setDevice] = useState({
    info: [],
    options: [],
    thumbnails: [],
  });
  const [recommendedDevices, setRecommendedDevices] = useState([]);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [finalPrice, setFinalPrice] = useState(0);
  const { id } = useParams();
  const [activeIndex, setActiveIndex] = useState(0);
  const [availableQuantity, setAvailableQuantity] = useState(0);
  const [isPreorder, setIsPreorder] = useState(false);
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language || "en";
  const deviceName = device.translations?.name?.[currentLang] || device.name;
  const isStoreClosed = !isShopOpenNow();

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
    const fetchData = async () => {
      try {
        const deviceData = await fetchOneDevice(id);
        setDevice(deviceData);
        setFinalPrice(deviceData.price);
        setActiveIndex(0);

        const itemInBasket = basket.items.find(
          (item) => item.id === deviceData.id
        );
        const quantityInBasket = itemInBasket ? itemInBasket.count : 0;
        setAvailableQuantity(deviceData.quantity - quantityInBasket);

        const initialOptions = {};
        deviceData.options?.forEach((option) => {
          if (option.values.length > 0) {
            initialOptions[option.name] = option.values[0];
          }
        });

        setSelectedOptions({});

        const recommended = await fetchRecommendedDevices(deviceData.type);
        setRecommendedDevices(recommended);
      } catch (error) {
        toast.error("❌ Ошибка загрузки устройства");
        console.error(error);
      }
    };

    fetchData();
  }, [id, basket.items]);

  useEffect(() => {
    const additionalPrice = Object.values(selectedOptions).reduce(
      (total, option) => total + (option?.price || 0),
      0
    );
    setFinalPrice(device.price + additionalPrice);
  }, [selectedOptions, device.price]);

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
    values: option.values.filter((v) => v.quantity > 0),
  }));

  const handleAddToBasket = async () => {
    if (!isShopOpenNow() && !isPreorder) {
      toast.error(
        t("the shop is closed. Click again to add to the cart", {
          ns: "deviceItem",
        })
      );
      setIsPreorder(true);
      return;
    }

    const existingItem = basket.items.find(
      (item) =>
        item.id === device.id &&
        JSON.stringify(item.selectedOptions) === JSON.stringify(selectedOptions)
    );
    const newCount = (existingItem?.count || 0) + 1;

    if (
      device.options?.length > 0 &&
      Object.keys(selectedOptions).length === 0
    ) {
      toast.error(`❌ ${t("Select product options!", { ns: "devicePage" })}`);
      return;
    }

    const isAvailable = await checkStock(device.id, newCount, selectedOptions);
    const isThisPreorder = !isAvailable;

    if (basket.items.some((item) => item.isPreorder) && !isThisPreorder) {
      toast.error(`❌ ${t("you cannot add a regular item to the cart with a pre-order", { ns: "deviceItem" })}`);
      return;
    }

    if (basket.items.some((item) => !item.isPreorder) && isThisPreorder) {
      toast.error(`❌ ${t("you cannot add a pre-order to the cart with regular items", { ns: "deviceItem" })}`);
      return;
    }

    if (!isAvailable) {
      toast.error(
        `❗ ${t(
          "product is out of stock, but has been added to the cart as a pre-order",
          { ns: "deviceItem" }
        )}`
      );
    }

    const newItem = {
      ...device,
      selectedOptions,
      isPreorder: isThisPreorder,
      stockQuantity: device.quantity,
      isStoreClosed,
    };

    basket.addItem(newItem);
    toast.success(
      <>
        <strong className={styles.toastTitle}>{deviceName}</strong>
        <span className={styles.toastSubtitle}>
          {t("Added to cart!", { ns: "devicePage" })}
        </span>
      </>,
      {
        style: {
          maxWidth: "400px",
        },
      }
    );

    setAvailableQuantity((prev) => prev - 1);
  };

  if (!device) return <p>{t("Loading...", { ns: "devicePage" })}</p>;

return (
    <div className={styles.DevicePageContainer}>
      <div className={styles.DevicePageContent}>
        <div className={styles.DevicePageColImg}>
          <div className={styles.DevicePageImageWrapper}>
            {device.oldPrice && device.oldPrice > device.price && (
              <div className={styles.DevicePageDiscountBadge}>
                -
                {Math.round(
                  ((device.oldPrice - device.price) / device.oldPrice) * 100
                )}
                %
              </div>
            )}

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
            <h2 className={styles.DevicePageTitle}>
              {device.translations?.["name"]?.[currentLang] || device.name}
            </h2>
            {device.options?.map((option, optionIndex) => (
              <div key={optionIndex} className={styles.DevicePageOption}>
                <label>
                  {option.translations?.name?.[currentLang] || option.name}
                </label>

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
                    {t("Select", { ns: "devicePage" })}:{" "}
                    {option.translations?.name?.[currentLang] || option.name}
                  </option>
                  {option.values.map((valueObj, valueIndex) => (
                    <option key={valueIndex} value={valueObj.value}>
                      {option.translations?.values?.[valueIndex]?.[
                        currentLang
                      ] || valueObj.value}
                      {valueObj.quantity <= 0
                        ? ` (${t("out of stock (Pre-order)", {
                            ns: "devicePage",
                          })}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <div className={styles.DevicePagePriceBlock}>
              {device.oldPrice && device.oldPrice > device.price ? (
                <>
                  <span className={styles.DevicePageOldPrice}>
                    {device.oldPrice} €
                  </span>
                  <span className={styles.DevicePageNewPrice}>
                    {device.price} €
                  </span>
                </>
              ) : (
                <span className={styles.DevicePageRegularPrice}>
                  {device.price} €
                </span>
              )}
            </div>

            <button
              className={styles.DevicePageAddToCart}
              onClick={handleAddToBasket}
            >
              {availableQuantity <= 0
                ? t("out_of_stock", { ns: "devicePage" })
                : t("add_to_cart", { ns: "devicePage" })}
            </button>
          </div>
        </div>
      </div>

              <div className={styles.DevicePageInfo}>
<h2>Фотографии товаров приведены в ознакомительных целях. Возможны незначительные расхождения во внешнем виде.</h2>
</div>

      <div className={styles.DevicePageSpecs}>
        {(device.translations?.description?.[currentLang] ||
          device.description) && (
          <p className={styles.DevicePageDescription}>
            {device.translations?.description?.[currentLang] ||
              device.description}
          </p>
        )}
        <h3 className={styles.DevicePageSpecsTitle}>
          {t("Specifications", { ns: "devicePage" })}
        </h3>

        <div className={styles.DevicePageSpecsCard}>
          {device.info.map((info, index) => (
            <div
              key={info.id}
              className={`${styles.DevicePageSpecRow} ${
                index % 2 === 0 ? styles.DevicePageSpecRowEven : ""
              }`}
            >
              <span className={styles.DevicePageSpecText}>
                <strong>
                  {info.translations?.title?.[currentLang] || info.title}
                </strong>
                <span>
                  {info.translations?.description?.[currentLang] ||
                    info.description}
                </span>
              </span>
            </div>
          ))}
        </div>

        <section className={styles.section}>
          <h2>{t("recommended", { ns: "homePage" })}</h2>
          <div className={styles.deviceCarousel}>
            {Array.isArray(recommendedDevices) &&
            recommendedDevices.length > 0 ? (
              recommendedDevices.map((device) => (
                <div key={device.id} className={styles.deviceItem}>
                  <DeviceItem device={device} />
                </div>
              ))
            ) : (
              <p>{t("loading", { ns: "homePage" })}</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default DevicePage;
