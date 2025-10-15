import React, { useState, useEffect } from "react";
import {
  fetchWarehouseOrders,
  acceptWarehouseOrder,
  completeWarehouseOrder,
} from "../http/warehouseAPI";
import { io } from "socket.io-client";
import styles from "./Warehouse.module.css";

const socket = io("https://api.dlyq.ee");

const Warehouse = () => {
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [showTimeOptions, setShowTimeOptions] = useState(false);
  const [timers, setTimers] = useState({});

  const playNotificationSound = () => {
    const audio = document.getElementById("notificationSound");
    if (audio) {
      audio.currentTime = 0;
      audio
        .play()
        .catch((error) =>
          console.error("🔊 Ошибка воспроизведения звука:", error)
        );
    }
  };

  useEffect(() => {
    socket.on("newOrder", (newOrder) => {
      playNotificationSound();
      setOrders((prevOrders) => [...prevOrders, newOrder]);
      setTimeout(() => {
        loadOrders();
      }, 2000);
    });

    return () => {
      socket.off("newOrder");
    };
  }, []);

  const loadOrders = async () => {
    try {
      const data = await fetchWarehouseOrders();

      const ordersWithParsedDetails = data.map((order) => ({
        ...order,
        orderDetails:
          typeof order.orderDetails === "string"
            ? JSON.parse(order.orderDetails)
            : order.orderDetails,
      }));

      setOrders(ordersWithParsedDetails);

      const initialTimers = {};
      ordersWithParsedDetails.forEach((order) => {
        if (order.warehouseStatus === "processing" && order.processingTime) {
          const savedTime = localStorage.getItem(`timer_${order.id}`);
          if (savedTime) {
            initialTimers[order.id] = parseInt(savedTime, 10); // Используем сохраненное значение
          } else {
            const [minutes] = order.processingTime.split(" "); // Преобразуем "5 минут" в 5
            initialTimers[order.id] = parseInt(minutes, 10) * 60; // Сохраняем время в секундах
          }
        }
      });
      setTimers(initialTimers);
    } catch (error) {
      console.error("Ошибка загрузки заказов:", error);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimers((prevTimers) => {
        const updatedTimers = { ...prevTimers };
        Object.keys(updatedTimers).forEach((orderId) => {
          updatedTimers[orderId] -= 1; // Уменьшаем время
          localStorage.setItem(`timer_${orderId}`, updatedTimers[orderId]); // Сохраняем
        });
        return updatedTimers;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds) => {
    if (seconds <= 0) return "⏳ Время истекло";

    const days = Math.floor(seconds / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (days > 0) {
      return `${days} дн ${hours} ч ${mins} мин`;
    } else if (hours > 0) {
      return `${hours} ч ${mins} мин`;
    } else {
      return `${mins} мин ${secs} сек`;
    }
  };

  const handleAcceptOrder = async (orderId) => {
    setSelectedOrderId(orderId);
    setShowTimeOptions(true);
  };

  const handleSelectProcessingTime = async (orderId, processingTime) => {
    try {
      await acceptWarehouseOrder(orderId, processingTime);

      const [value, unit] = processingTime.split(" "); // Разделяем число и единицу измерения

      let timeInSeconds = 0;
      if (unit === "минут" || unit === "минуты") {
        timeInSeconds = parseInt(value, 10) * 60; // Преобразуем минуты в секунды
      } else if (unit === "дней" || unit === "день" || unit === "дня") {
        timeInSeconds = parseInt(value, 10) * 24 * 60 * 60; // Преобразуем дни в секунды
      }

      localStorage.setItem(`timer_${orderId}`, timeInSeconds);

      setShowTimeOptions(false);
      setSelectedOrderId(null);
      loadOrders();
    } catch (error) {
      console.error("Ошибка принятия заказа:", error);
    }
  };

  const handleCompleteOrder = async (orderId) => {
    try {
      await completeWarehouseOrder(orderId);
      loadOrders();
    } catch (error) {
      console.error("Ошибка завершения заказа:", error);
    }
  };

  return (
    <div className={styles.WarehouseContainer}>
      <h1>Склад</h1>
      {orders.length === 0 ? (
        <p>Нет новых заказов</p>
      ) : (
        <ul>
          {orders.map((order) => (
            <li key={order.id}>
              <p>
                <strong>Заказ #{order.id}</strong>
              </p>
              <p>Цена: {Number(order.totalPrice).toFixed(2)} €</p>
              <p>Статус: {order.warehouseStatus}</p>

              {Array.isArray(order.orderDetails) &&
                order.orderDetails.some((item) => item.isPreorder) && (
                  <p className={styles.preorderWarning}>
                    📦 <strong>Это предзаказ!</strong> Товар отсутствует на
                    складе.
                  </p>
                )}

              {order.preorderDate && order.preorderDate !== "null" && (
                <p className={styles.preorderInfo}>
                  📅 <strong>Предзаказ:</strong> Доставка запланирована на{" "}
                  <span>
                    {new Date(order.preorderDate).toLocaleString("ru-RU", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </p>
              )}

              {order.warehouseStatus === "processing" && (
                <p>
                  ⏳ Время до окончания: {formatTime(timers[order.id] || 0)}
                </p>
              )}

              <p>
                <strong>Товары:</strong>
              </p>
              {Array.isArray(order.orderDetails) &&
              order.orderDetails.length > 0 ? (
                <ul>
                  {order.orderDetails.map((item, index) => (
                    <li key={index}>
                      <img
                        src={item.image}
                        alt={item.name}
                        width="50"
                        height="50"
                      />
                      {item.name} (x{item.count}) — {item.price}€
                    </li>
                  ))}
                </ul>
              ) : (
                <p>❌ Ошибка: товары не найдены</p>
              )}

              {/* ✅ Кнопки принятия и завершения заказа */}
              {order.warehouseStatus === "pending" && (
                <>
                  <button onClick={() => handleAcceptOrder(order.id)}>
                    Принять заказ
                  </button>
                  {selectedOrderId === order.id && showTimeOptions && (
                    <div className={styles.TimeOptions}>
                      <p>Выберите время обработки:</p>
                      {[5, 10, 15, 25, 35, 45, 60].map((time) => (
                        <button
                          key={time}
                          onClick={() =>
                            handleSelectProcessingTime(
                              order.id,
                              `${time} минут`
                            )
                          }
                        >
                          {time} минут
                        </button>
                      ))}
                      {[1, 2, 3, 5, 10, 14, 18, 20, 25, 30].map((days) => (
                        <button
                          key={days}
                          onClick={() =>
                            handleSelectProcessingTime(order.id, `${days} дней`)
                          }
                        >
                          {days} {days === 1 ? "день" : "дня"}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
              {order.warehouseStatus === "processing" && (
                <>
                  <button onClick={() => handleCompleteOrder(order.id)}>
                    Готов к отправке
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Warehouse;

