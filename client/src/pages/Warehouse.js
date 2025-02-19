import React, { useState, useEffect } from "react";
import { fetchWarehouseOrders, acceptWarehouseOrder, completeWarehouseOrder } from "../http/warehouseAPI";
import { io } from "socket.io-client";
import styles from "./Warehouse.module.css";

const socket = io("http://localhost:5000");

const Warehouse = () => {
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null); // ID выбранного заказа
  const [showTimeOptions, setShowTimeOptions] = useState(false);
  const [timers, setTimers] = useState({}); 

  const playNotificationSound = () => {
    const audio = document.getElementById("notificationSound");
    if (audio) {
        audio.currentTime = 0; // Сброс воспроизведения
        audio.play().catch((error) => console.error("🔊 Ошибка воспроизведения звука:", error));
    }
};
  

  useEffect(() => {
    console.log("🔌 Подключение к WebSocket...");

    socket.on("newOrder", (newOrder) => {
      playNotificationSound();
      setOrders((prevOrders) => [...prevOrders, newOrder]);
      setTimeout(() => {
        loadOrders();
      }, 2000); // Через 2 секунды подгружаем актуальные данные
    });

    return () => {
      socket.off("newOrder"); // ✅ Отписка при размонтировании компонента
    };
  }, []);

  const loadOrders = async () => {
    try {
      const data = await fetchWarehouseOrders();
  
      // Преобразуем orderDetails в массив (если оно в виде строки)
      const ordersWithParsedDetails = data.map((order) => ({
        ...order,
        orderDetails: typeof order.orderDetails === "string" ? JSON.parse(order.orderDetails) : order.orderDetails,
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
    const absSeconds = Math.abs(seconds);
    const mins = Math.floor(absSeconds / 60);
    const secs = absSeconds % 60;
    return `${seconds < 0 ? "-" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const handleAcceptOrder = async (orderId) => {
    setSelectedOrderId(orderId); // Сохраняем ID текущего заказа
    setShowTimeOptions(true); // Показываем выбор времени
  };

  const handleSelectProcessingTime = async (orderId, processingTime) => {
    try {
      await acceptWarehouseOrder(orderId, processingTime);
      
      const [minutes] = processingTime.split(" ");
      localStorage.setItem(`timer_${orderId}`, parseInt(minutes, 10) * 60);

      setShowTimeOptions(false); // Скрываем выбор времени
      setSelectedOrderId(null); // Сбрасываем выбранный заказ
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
            <p><strong>Заказ #{order.id}</strong></p>
            <p>Цена: {Number(order.totalPrice).toFixed(2)} €</p>
            <p>Статус: {order.warehouseStatus}</p>
  
            {/* ✅ Время обработки (если заказ в обработке) */}
            {order.warehouseStatus === "processing" && (
                <p>⏳ Время до окончания: {formatTime(timers[order.id] || 0)}</p>
              )}
  
            {/* ✅ Отображение товаров в заказе */}
            <p><strong>Товары:</strong></p>
            {Array.isArray(order.orderDetails) && order.orderDetails.length > 0 ? (
              <ul>
                {order.orderDetails.map((item, index) => (
                  <li key={index}>
                    <img
                      src={`http://localhost:5000/${item.image}`}
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
                <button onClick={() => handleAcceptOrder(order.id)}>Принять заказ</button>
                {selectedOrderId === order.id && showTimeOptions && (
                  <div className={styles.TimeOptions}>
                    <p>Выберите время обработки:</p>
                    {[5, 10, 15, 25, 35, 45, 60].map((time) => (
                      <button
                        key={time}
                        onClick={() => handleSelectProcessingTime(order.id, `${time} минут`)}
                      >
                        {time} минут
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            {order.warehouseStatus === "processing" && (
              <>
                <button onClick={() => handleCompleteOrder(order.id)}>Готов к отправке</button>
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
