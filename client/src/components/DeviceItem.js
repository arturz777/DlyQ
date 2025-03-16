import React, { useContext, useState, useEffect } from "react";
import { Card, Col, Button, Row, Form } from "react-bootstrap";
import Image from "react-bootstrap/Image";
import star from "../assets/star.png";
import { useNavigate } from "react-router-dom";
import { DEVICE_ROUTE } from "../utils/consts";
import { Context } from "../index";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import styles from "./DeviceItem.module.css";

const DeviceItem = ({ device }) => {
  const { basket } = useContext(Context);
  const navigate = useNavigate();
  const [availableQuantity, setAvailableQuantity] = useState(device.quantity);
  const [isPreorder, setIsPreorder] = useState(false);
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language || "en";
  const deviceName = device.translations?.name?.[currentLang] || device.name;


  useEffect(() => {
    const itemsInBasket = basket.items.filter((item) => item.id === device.id);
    const totalInBasket = itemsInBasket.reduce((sum, item) => sum + (item.count || 0), 0);
    
    const newAvailable = Math.max(0, device.quantity - totalInBasket);
    
    setAvailableQuantity(newAvailable);
  }, [basket.items, device.quantity]);

  const checkStock = async (deviceId, quantity) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/device/check-stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, quantity }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Ошибка проверки наличия товара");
      }

      const data = await response.json();
      return data.quantity >= quantity; // ✅ Проверяем, хватает ли товара
    } catch (error) {
      console.error("Ошибка при проверке наличия товара:", error.message);
      return false;
    }
  };

  const handleAddToBasket = async (e) => {
    e.stopPropagation();

    const itemsInBasket = basket.items.filter((item) => item.id === device.id);
    const totalInBasket = itemsInBasket.reduce((sum, item) => sum + (item.count || 0), 0);
    const newCount = totalInBasket + 1;

    const isAvailable = await checkStock(device.id, newCount);

    if (!isAvailable && !isPreorder) {
      toast.error(`❌ ${t("Product is out of stock!", { ns: "deviceItem" })}`);
      return;
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

    basket.addItem({ ...device, selectedOptions: defaultOptions });
    toast.success(
      `${deviceName} - ${t("Added to cart!", { ns: "devicePage" })}`
    );

    setAvailableQuantity((prev) => Math.max(0, prev - 1));
  };

  const handleNavigate = () => {
    navigate(DEVICE_ROUTE + "/" + device.id);
  };

  return (
    <div onClick={() => navigate(DEVICE_ROUTE + "/" + device.id)}>
      <Card className={`${styles.card}`} onClick={handleNavigate}>
        <Image className={styles.image} src={device.img} />
        <div className={styles.info}>
          <h5 className={styles.name}>{deviceName}</h5>
          <p className={styles.price}>{device.price} €</p>
        </div>
        <Button
          variant="success"
          className={styles.button}
          disabled={availableQuantity <= 0}
          onClick={handleAddToBasket}
        >
          {availableQuantity <= 0
            ? t("out_of_stock", { ns: "deviceItem" })
            : t("add_to_cart", { ns: "deviceItem" })}
        </Button>

        {availableQuantity <= 0 && (
          <p className={styles.preorderText}>{t("Pre-order available", { ns: "deviceItem" })}</p>
        )}
      </Card>
    </div>
  );
};

export default DeviceItem;
