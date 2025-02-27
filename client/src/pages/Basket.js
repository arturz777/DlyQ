// client/pages/Basket.js
import React, { useContext, useState, useEffect } from "react";
import { Context } from "../index";
import { observer } from "mobx-react-lite";
import { Container, Row, Col, Button, Image, Card } from "react-bootstrap";
import { toast } from "react-toastify";
import PaymentForm from "../components/PaymentForm"; // Импортируем форму оплаты
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { useNavigate } from "react-router-dom";
import styles from "./Basket.module.css";

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);

const Basket = observer(() => {
  const { basket } = useContext(Context);
  const navigate = useNavigate();
  const [deliveryCost, setDeliveryCost] = useState(0);
  const [availableQuantities, setAvailableQuantities] = useState({});

  const checkStock = async (deviceId, quantity) => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/device/check-stock`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ deviceId, quantity }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(data.message); // ❌ Показываем пользователю, что товара нет
        return false;
      }

      return data.quantity >= quantity; // ✅ Проверяем, хватает ли товара
    } catch (error) {
      console.error("Ошибка при проверке наличия товара:", error);
      return false;
    }
  };

  useEffect(() => {
    const fetchQuantities = async () => {
      const newQuantities = {};

      for (const item of basket.items) {
        try {
          const response = await fetch(
            `${process.env.REACT_APP_API_URL}/device/check-stock`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ deviceId: item.id }),
            }
          );

          const data = await response.json();

          if (response.ok) {
            newQuantities[item.uniqueKey] = data.quantity;
          } else {
            newQuantities[item.uniqueKey] = 0; // Если ошибка — товара нет
          }
        } catch (error) {
          console.error("Ошибка при проверке наличия товара:", error);
          newQuantities[item.uniqueKey] = 0;
        }
      }

      setAvailableQuantities(newQuantities);
    };

    fetchQuantities();
  }, [basket.items]); // ✅ Обновляем, когда изменяется корзина

  const handleIncrement = async (uniqueKey) => {
    const item = basket.items.find((i) => i.uniqueKey === uniqueKey);

    if (!item) return;

    const newCount = item.count + 1;

    const isAvailable = await checkStock(item.id, newCount);

    if (newCount > (availableQuantities[uniqueKey] || 0)) {
      // ✅ Проверяем, хватает ли товара
      toast.error("❌ Недостаточно товара на складе!");
      return;
    }

    basket.updateItemCount(uniqueKey, newCount);
  };

  const handleDecrement = (uniqueKey) => {
    const currentCount = basket.getItemCount(uniqueKey);
    if (currentCount > 1) {
      basket.updateItemCount(uniqueKey, currentCount - 1);
    }
  };

  const handleRemove = (uniqueKey) => {
    basket.removeItem(uniqueKey);
  };

  const handlePaymentSuccess = async (paymentMethod, formData) => {
    const dataToSend = {
      formData,
      paymentMethodId: paymentMethod.id,
      totalPrice: basket.getTotalPrice(),
      orderDetails: basket.items.map((item) => ({
        name: item.name,
        price: item.price,
        count: item.count,
        deviceId: item.id,
        image: item.img,
        selectedOptions: item.selectedOptions,
      })),
    };

    try {
      // Отправка данных на сервер
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/order/create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
          },
          body: JSON.stringify(dataToSend), // Отправляем все данные
        }
      );

      const data = await response.json();

      if (response.ok) {
        toast.success("✅ Ваш заказ успешно оформлен!");

        // ✅ Принудительно обновляем `OrderSidebar`
        window.dispatchEvent(new Event("orderUpdated"));
      } else {
        toast.error(data.message || "❌ Ошибка при оформлении заказа.");
        return;
      }

      if (basket.clearItems) {
        basket.clearItems();
      }

      navigate("/");
    } catch (error) {
      console.error("Ошибка при создании заказа:", error);
      toast.error("❌ Ошибка при оформлении заказа.");
    }
  };

  const handleOptionChange = (itemUniqueKey, optionName, selectedValue) => {
    const item = basket.items.find((i) => i.uniqueKey === itemUniqueKey);
    if (item) {
      // Находим выбранное значение опции
      const updatedOption = item.options
        ?.find((opt) => opt.name === optionName)
        ?.values.find((val) => val.value === selectedValue);

      if (updatedOption) {
        basket.updateSelectedOption(itemUniqueKey, optionName, updatedOption); // Обновляем опцию в store
      }
    }
  };

  return (
    <Container className={styles.container}>
      {basket.items.length === 0 ? (
        <h2 className={styles.basketEmpty}>Корзина пуста</h2>
      ) : (
        basket.items.map((item, index) => (
          <Card
            key={item.uniqueKey}
            className={`${styles.card} ${
              index === 0 ? styles.firstCard : styles.otherCards
            }`}
          >
            <div className={styles.cardContent}>
              {/* Изображение */}
              <Image
                className={styles.image}
                src={item.img}
              />

              {/* Название товара */}
              <div className={styles.title}>{item.name}</div>

              {item.selectedOptions &&
                Object.entries(item.selectedOptions).map(([key, option]) => (
                  <div
                    key={`${item.uniqueKey}-${key}`}
                    className={styles.optionSelector}
                  >
                    <label>{key}:</label>
                    <select
                      value={option.value}
                      onChange={(e) =>
                        handleOptionChange(item.uniqueKey, key, e.target.value)
                      }
                      className="form-select"
                    >
                      {item.options
                        .find((opt) => opt.name === key)
                        ?.values.map((valueObj, idx) => (
                          <option
                            key={`${key}-${valueObj.value}`}
                            value={valueObj.value}
                          >
                            {valueObj.value} (+€{valueObj.price})
                          </option>
                        ))}
                    </select>
                  </div>
                ))}

              {/* Управление количеством */}
              <div className={styles.counter}>
                <Button
                  className={styles.buttonPlus}
                  variant="outline-success"
                  onClick={() => handleDecrement(item.uniqueKey)}
                >
                  -
                </Button>
                <span className={styles.count}>
                  {basket.getItemCount(item.uniqueKey)}
                </span>
                <Button
                  className={styles.buttonPlus}
                  variant="outline-success"
                  onClick={() => handleIncrement(item.uniqueKey)}
                  disabled={
                    basket.getItemCount(item.uniqueKey) >=
                    (availableQuantities[item.uniqueKey] || 0)
                  } // ✅ Блокируем кнопку, если товара нет
                >
                  +
                </Button>
              </div>

              {/* Цена */}
              <div className={styles.price}>
                €
                {(item.price +
                  Object.values(item.selectedOptions || {}).reduce(
                    (sum, opt) => sum + (opt?.price || 0),
                    0
                  )) *
                  item.count}
              </div>

              {/* Удалить */}
              <Button
                className={styles.buttonDelete}
                variant="danger"
                onClick={() => handleRemove(item.uniqueKey)}
              >
                Удалить
              </Button>
            </div>
          </Card>
        ))
      )}

      {basket.items.length > 0 && (
        <>
          <h3 className={styles.totalDeliverPrice}>
            Доставка: {deliveryCost.toFixed(2)}€
          </h3>
          <h3 className={styles.totalPrice}>
            Всего: {(basket.getTotalPrice() + deliveryCost).toFixed(2)} €
          </h3>
        </>
      )}

      <Elements stripe={stripePromise}>
        <PaymentForm
          totalPrice={basket.getTotalPrice()}
          onPaymentSuccess={handlePaymentSuccess}
          onDeliveryCostChange={setDeliveryCost}
        />
      </Elements>
    </Container>
  );
});

export default Basket;
