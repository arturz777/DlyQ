import React, { useState, useEffect } from "react";
import { fetchActiveOrder, updateOrderStatus } from "../http/orderAPI";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import styles from "./OrderSidebar.module.css";

const socket = io("http://localhost:5000");

const OrderSidebar = () => {
  const [order, setOrder] = useState(null);
  const [isOpen, setIsOpen] = useState(() => {
    return localStorage.getItem("orderSidebarOpen") === "true"; // 🔥 Восстанавливаем состояние
  });
  const [showIcon, setShowIcon] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [courierLocation, setCourierLocation] = useState(null);
  const [route, setRoute] = useState([]);
  const [routeTime, setRouteTime] = useState(null);
  const navigate = useNavigate();

  // ✅ Загружаем активный заказ
  const loadOrder = async () => {
    try {
      const activeOrder = await fetchActiveOrder();
      if (activeOrder) {
        setOrder(activeOrder);
        setShowIcon(true);

        if (activeOrder.processingTime) {
          const minutes = parseInt(activeOrder.processingTime.split(" ")[0], 10);
          setTimeLeft(minutes * 60);
        }

        if (activeOrder.courierLocation) {
          setCourierLocation(activeOrder.courierLocation);
        }

        if (activeOrder.deliveryLat && activeOrder.deliveryLng && activeOrder.courierLocation) {
          fetchRoute(activeOrder.courierLocation, {
            lat: activeOrder.deliveryLat,
            lng: activeOrder.deliveryLng,
          });
        }
      } else {
        setOrder(null);
        setShowIcon(false);
      }
    } catch (error) {
      console.warn("Нет активного заказа:", error);
      setOrder(null);
      setShowIcon(false);
    }
  };

  // ✅ Загружаем заказ при первом рендере + слушаем обновления
  useEffect(() => {
    loadOrder();

    const handleOrderUpdate = (updatedOrder) => {
  
      if (updatedOrder && updatedOrder.id) {
          setOrder((prevOrder) => (prevOrder && prevOrder.id === updatedOrder.id ? { ...prevOrder, ...updatedOrder } : prevOrder));
          setShowIcon(true);
  
          if (updatedOrder.status === "Waiting for courier" && updatedOrder.processingTime) {
              const minutes = parseInt(updatedOrder.processingTime.split(" ")[0], 10);
              setTimeLeft(minutes * 60);
          } else if (updatedOrder.status === "Picked up") {
              setTimeLeft(updatedOrder.estimatedTime || 15 * 60);
          } else if (updatedOrder.status === "Arrived at destination" || updatedOrder.status === "Delivered") {
              setTimeLeft(null);
          }
  
          if (updatedOrder.courierLocation) {
              setCourierLocation(updatedOrder.courierLocation);
          }
  
          if (updatedOrder.deliveryLat && updatedOrder.deliveryLng && updatedOrder.courierLocation) {
              fetchRoute(updatedOrder.courierLocation, {
                  lat: updatedOrder.deliveryLat,
                  lng: updatedOrder.deliveryLng,
              });
          }
      }
  };
  
  


    socket.on("orderStatusUpdate", handleOrderUpdate);
    socket.on("courierLocationUpdate", (location) => {
      setCourierLocation(location);
      if (order && order.deliveryLat && order.deliveryLng) {
        fetchRoute(location, {
          lat: order.deliveryLat,
          lng: order.deliveryLng,
        });
      }
    });

    window.addEventListener("orderUpdated", loadOrder);

    return () => {
      socket.off("orderStatusUpdate", handleOrderUpdate);
      socket.off("courierLocationUpdate");
      window.removeEventListener("orderUpdated", loadOrder);
    };
  }, []);

  useEffect(() => {
    if (timeLeft === null) return;

    const timer = setInterval(() => {
      setTimeLeft((prevTime) => (prevTime !== null ? prevTime - 1 : null));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds) => {
    const absSeconds = Math.abs(seconds);
    const mins = Math.floor(absSeconds / 60);
    const secs = absSeconds % 60;
    return `${seconds < 0 ? "-" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const fetchRoute = async (start, end) => {
    if (!start || !end) return;

    const API_KEY = "5b3ce3597851110001cf624889e39f2834a84a62aaca04f731838a64";
    const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${API_KEY}&start=${start.lng},${start.lat}&end=${end.lng},${end.lat}`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data.features && data.features.length > 0) {
        const coordinates = data.features[0].geometry.coordinates.map(
          (coord) => [coord[1], coord[0]]
        );
        setRoute(coordinates);

        const durationInSeconds = data.features[0].properties.segments[0].duration;
      setRouteTime(Math.round(durationInSeconds)); // Округляем до целого числа
    }
     } catch (error) {
    console.error("Ошибка получения маршрута:", error);
  }
};

  const handleToggleSidebar = () => {
    setIsOpen((prevState) => {
      const newState = !prevState;
      localStorage.setItem("orderSidebarOpen", newState); // ✅ Сохраняем в localStorage
      return newState;
    });
  };

  // ✅ Завершаем заказ
  const handleCompleteOrder = async () => {
    if (!order) return;
    try {
      await updateOrderStatus(order.id, "Completed");
      setOrder(null); // ✅ Скрываем заказ после завершения
      setShowIcon(false); // ✅ Убираем иконку
      window.dispatchEvent(new Event("orderUpdated"));
    } catch (error) {
      console.error("Ошибка завершения заказа:", error);
    }
  };

  return (
    <>
      {/* 📦 Плавающая иконка (только если есть активный заказ) */}
      {showIcon && (
        <div className={styles.floatingIcon} onClick={() => setIsOpen(true)}>
          📦
        </div>
      )}

      {/* 🛒 Модальное окно с информацией о доставке */}
      <div className={`${styles.sidebar} ${isOpen ? styles.open : ""}`}>
        <div className={styles.header}>
          <h3>Статус доставки</h3>
          <button onClick={() => setIsOpen(false)}>×</button>
        </div>

        {order ? (
          <div>
            <p>
              <strong>Статус:</strong>
              <span className={styles.statusText}>
                {!order?.status ||
                  (order?.status === "Pending" &&
                    "🕒 Ожидаем подтверждение заказа")}
                {order?.status === "Waiting for courier" &&
                  "✅ Заказ принят складом"}
                {order?.status === "Ready for pickup" &&
                  "👨‍🍳 Заказ готов, ждет курьера"}
                {order?.status === "Picked up" && "🚗 Курьер в пути"}
                {order?.status === "Arrived at destination" &&
                  "🏠 Курьер у двери"}
                {order?.status === "Delivered" && "✅ Заказ успешно доставлен"}
              </span>
            </p>

            {/* ✅ Отображение времени в зависимости от статуса заказа */}
{order?.status === "Waiting for courier" && timeLeft !== null && (
  <p>
    <strong>Примерное время приготовления:</strong> ⏳ {formatTime(timeLeft)}
  </p>
)}

{order?.status === "Picked up" && timeLeft !== null && (
  <p>
    <strong>Примерное время в пути:</strong> 🚗 {formatTime(timeLeft)}
  </p>
)}


            {/* 🔥 Будущее место для карты */}
            <div className={styles.mapContainer}>
              <MapContainer center={[order.deliveryLat, order.deliveryLng]} zoom={13} style={{ height: "300px", width: "100%" }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
                <Marker position={[order.deliveryLat, order.deliveryLng]} icon={new L.Icon({ iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png", iconSize: [25, 41] })} />
                {courierLocation && <Marker position={[courierLocation.lat, courierLocation.lng]} />}
                {route.length > 0 && <Polyline positions={route} color="blue" />}
              </MapContainer>
            </div>

            {/* ✅ Кнопка “Заказ доставлен” */}
            {(order.status === "Delivered" || order.status === "Completed") && (
              <button
                className={styles.completeButton}
                onClick={handleCompleteOrder}
              >
                🚀 Подтвердить доставку
              </button>
            )}

            {/* 🔥 Кнопка "Мои заказы" */}
            <button
              className={styles.orderHistoryButton}
              onClick={() => navigate("/profile")}
            >
              📜 Мои заказы
            </button>
          </div>
        ) : (
          <p>У вас нет активных заказов.</p>
        )}
      </div>
    </>
  );
};

export default OrderSidebar;
