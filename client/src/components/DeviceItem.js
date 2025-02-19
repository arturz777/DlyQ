import React, { useContext, useState, useEffect } from "react";
import { Card, Col, Button, Row } from "react-bootstrap";
import Image from "react-bootstrap/Image";
import star from "../assets/star.png";
import { useNavigate } from "react-router-dom";
import { DEVICE_ROUTE } from "../utils/consts";
import { Context } from "../index";
import { toast } from "react-toastify";
import styles from "./DeviceItem.module.css";

const DeviceItem = ({ device }) => {
  const { basket } = useContext(Context);
  const navigate = useNavigate();
  const [availableQuantity, setAvailableQuantity] = useState(
    device.quantity - (basket.items.find((item) => item.id === device.id)?.count || 0)
  );
  
  useEffect(() => {
    const itemInBasket = basket.items.find((item) => item.id === device.id);
    setAvailableQuantity(device.quantity - (itemInBasket?.count || 0));
  }, [basket.items, device.quantity]);

  const checkStock = async (deviceId, quantity) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}api/device/check-stock`, { // ✅ Убрана лишняя `/`
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ deviceId, quantity }), // ✅ Передаем `quantity`
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
  
    // Проверяем, есть ли товар в корзине и сколько его там
    const existingItem = basket.items.find((item) => item.id === device.id);
    const newCount = existingItem ? existingItem.count + 1 : 1;
  
    // Проверяем, хватает ли товара на складе
    const isAvailable = await checkStock(device.id, newCount);
  
    if (!isAvailable) {
      toast.error("❌ Недостаточно товара на складе!");
      return;
    }
  
    // Если товара хватает, добавляем в корзину
    basket.addItem(device);
    toast.success(`${device.name} добавлен в корзину!`);

    setAvailableQuantity((prev) => prev - 1);
  };

  const handleNavigate = () => {
    navigate(DEVICE_ROUTE + "/" + device.id);
  };

  return (
    <div
      onClick={() => navigate(DEVICE_ROUTE + "/" + device.id)}
    >
       <Card
      className={`${styles.card}`}
      onClick={handleNavigate}
    >
      <Image
        className={styles.image}
        src={`${process.env.REACT_APP_API_URL}${device.img}`}
      />
      <div className={styles.info}>
        <h5 className={styles.name}>{device.name}</h5>
        <p className={styles.price}>{device.price} €</p>
        <div className={styles.rating}>
          <span>{device.rating}</span>
          <Image src={star} className={styles.star} />
        </div>
      </div>
      <Button
  variant="success"
  className={styles.button}
  disabled={availableQuantity <= 0} // ✅ Теперь учитывается корзина
  onClick={handleAddToBasket}
>
  {availableQuantity <= 0 ? "Нет в наличии" : "В корзину"}
</Button>
    </Card>
    </div>
  );
};

export default DeviceItem;
