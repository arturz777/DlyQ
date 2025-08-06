import React, { useContext, useState, useEffect } from "react";
import { Card, Col, Button, Row, Form } from "react-bootstrap";
import Image from "react-bootstrap/Image";
import { useNavigate } from "react-router-dom";
import { DEVICE_ROUTE } from "../utils/consts";
import { Context } from "../index";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import { isShopOpenNow } from "../utils/workHours";
import styles from "./DeviceItem.module.css";

const DeviceItem = ({ device, onClick }) => {
  const { basket } = useContext(Context);
  const navigate = useNavigate();
  const [availableQuantity, setAvailableQuantity] = useState(device.quantity);
  const [isPreorder, setIsPreorder] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language || "en";
  const deviceName = device.translations?.name?.[currentLang] || device.name;
  const oldPrice = Number(device.oldPrice) || 0;
const newPrice = Number(device.price) || 0;

const discountPercentage =
device.discount && device.oldPrice > device.price
  ? Math.round(((device.oldPrice - device.price) / device.oldPrice) * 100)
  : null;

  useEffect(() => {
    const itemsInBasket = basket.items.filter((item) => item.id === device.id);
    const totalInBasket = itemsInBasket.reduce(
      (sum, item) => sum + (item.count || 0),
      0
    );

    const newAvailable = Math.max(0, device.quantity - totalInBasket);

    setAvailableQuantity(newAvailable);
  }, [basket.items, device.quantity]);

  const checkStock = async (deviceId, quantity) => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/device/check-stock`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId, quantity }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Ошибка проверки наличия товара");
      }

      const data = await response.json();
      return data.quantity >= quantity;
    } catch (error) {
      console.error("Ошибка при проверке наличия товара:", error.message);
      return false;
    }
  };

  const handleAddToBasket = async (e) => {
    e.stopPropagation();

    if (!isShopOpenNow() && !isPreorder) {
      toast.error(
        t("the shop is closed. Click again to add to the cart", {
          ns: "deviceItem",
        })
      );
      setIsPreorder(true);
      return;
    }

    const itemsInBasket = basket.items.filter((item) => item.id === device.id);
    const totalInBasket = itemsInBasket.reduce(
      (sum, item) => sum + (item.count || 0),
      0
    );
    const newCount = totalInBasket + 1;

    const isAvailable = await checkStock(device.id, newCount);
    const isThisPreorder = !isAvailable;

    if (basket.items.some((item) => item.isPreorder) && !isThisPreorder) {
      toast.error(
        `❌ ${t("you cannot add a regular item to the cart with a pre-order", {
          ns: "deviceItem",
        })}`
      );
      return;
    }

    if (basket.items.some((item) => !item.isPreorder) && isThisPreorder) {
      toast.error(
        `❌ ${t("you cannot add a pre-order to the cart with regular items", {
          ns: "deviceItem",
        })}`
      );
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

    let defaultOptions = {};
    if (device.options?.length > 0) {
      device.options.forEach((option) => {
        defaultOptions[option.name] = {
          value: "__UNSELECTED__",
          price: 0,
        };
      });
    }

    basket.addItem({
      ...device,
      selectedOptions: defaultOptions,
      isPreorder: isThisPreorder || !isShopOpenNow(),
      stockQuantity: Math.max(0, device.quantity - totalInBasket),
    });
    toast.success(
      <>
        <strong className={styles.toastTitle}>{deviceName}</strong>
        <span className={styles.toastSubtitle}>
          {t("Added to cart!", { ns: "devicePage" })}
          {(!isShopOpenNow() || isPreorder) && (
            <div style={{ fontSize: "0.8em", marginTop: "5px" }}>
            </div>
          )}
        </span>
      </>,
      {
        style: {
          maxWidth: "400px",
        },
      }
    );

    setAvailableQuantity((prev) => Math.max(0, prev - 1));
  };

  return (
    <div onClick={() => onClick(device.id)}>
      <Card className={styles.card}>
        {discountPercentage && (
          <div className={styles.discountBadge}>-{discountPercentage}%</div>
        )}

        <div className={styles.imageWrapper}>
        <Image className={styles.image} src={device.img} />
         <div className={styles.addButton} onClick={handleAddToBasket}>+</div>
        </div>

        <div className={styles.info}>
          
          <div className={styles.priceBlock}>
            {device.discount && device.oldPrice > device.price ? (
              <>
                <span className={styles.oldPrice}>{device.oldPrice} €</span>
                <span className={styles.newPrice}>{device.price} €</span>
              </>
            ) : (
              <span className={styles.regularPrice}>{device.price} €</span>
            )}
          </div>
          <h5 className={styles.name}>{deviceName}</h5>
        </div>

        {availableQuantity <= 0 && (
          <p className={styles.preorderText}>
            {t("Pre-order available", { ns: "deviceItem" })}
          </p>
        )}
      </Card>
    </div>
  );
};

export default DeviceItem;
