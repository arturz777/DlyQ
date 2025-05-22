import React, { useState, useEffect } from "react";
import { fetchActiveOrder, updateOrderStatus } from "../http/orderAPI";
import { useNavigate } from "react-router-dom";
import { useRef } from "react";
import { useMap } from "react-leaflet";
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
import { useTranslation } from "react-i18next";
import styles from "./OrderSidebar.module.css";

const socket = io("https://zang-4.onrender.com");

const WAREHOUSE_LOCATION = { lat: 59.51372, lng: 24.828888 };

const OrderSidebar = ({ isSidebarOpen, setSidebarOpen }) => {
  const [order, setOrder] = useState(null);
  const [showIcon, setShowIcon] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [courierLocation, setCourierLocation] = useState(null);
  const [isAccepted, setIsAccepted] = useState(false);
  const [route, setRoute] = useState([]);
  const [routeTime, setRouteTime] = useState(null);
  const [isPreorder, setIsPreorder] = useState(false);
  const [preorderDate, setPreorderDate] = useState(null);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const courierMarkerRef = useRef(null);

  const courierIcon = new L.Icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/744/744465.png", // 🚗 машинка
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
  });

  useEffect(() => {
    if (courierMarkerRef.current && courierLocation) {
      courierMarkerRef.current.setLatLng([
        courierLocation.lat,
        courierLocation.lng,
      ]);
    }
  }, [courierLocation]);

  const AutoPanToCourier = ({ position }) => {
    const map = useMap();
    useEffect(() => {
      if (position) {
        map.panTo(position);
      }
    }, [position]);
    return null;
  };

  const loadOrder = async () => {
    try {
      const activeOrder = await fetchActiveOrder();

      if (activeOrder) {
        setOrder(activeOrder);
        setShowIcon(true);

        if (activeOrder.desiredDeliveryDate) {
          setIsPreorder(true);
          setPreorderDate(activeOrder.desiredDeliveryDate);
        } else {
          setIsPreorder(false);
          setPreorderDate(null);
        }

        if (
          activeOrder.status === "Waiting for courier" &&
          activeOrder.processingTime &&
          activeOrder.updatedAt
        ) {
          const [value, unit] = activeOrder.processingTime.split(" ");
          let totalSeconds = 0;

          if (unit.includes("мин")) totalSeconds = parseInt(value, 10) * 60;
          else if (unit.includes("дн"))
            totalSeconds = parseInt(value, 10) * 24 * 60 * 60;

          const started = new Date(activeOrder.updatedAt).getTime();
          const now = Date.now();
          const elapsed = Math.floor((now - started) / 1000);
          const remaining = Math.max(totalSeconds - elapsed, 0);

          setTimeLeft(remaining);
        } else if (
          activeOrder.status === "Picked up" &&
          activeOrder.estimatedTime &&
          activeOrder.pickupStartTime
        ) {
          const started = new Date(activeOrder.pickupStartTime).getTime();
          const now = Date.now();
          const elapsed = Math.floor((now - started) / 1000);
          const remaining = Math.max(activeOrder.estimatedTime - elapsed, 0);

          setTimeLeft(remaining);
        }

        if (activeOrder.courierLocation) {
          setCourierLocation(activeOrder.courierLocation);
        }

        if (
          activeOrder.deliveryLat &&
          activeOrder.deliveryLng &&
          activeOrder.courierLocation
        ) {
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

  useEffect(() => {
    loadOrder();

    const handleOrderUpdate = (updatedOrder) => {
      if (updatedOrder && updatedOrder.id) {
        setOrder((prevOrder) =>
          prevOrder && prevOrder.id === updatedOrder.id
            ? { ...prevOrder, ...updatedOrder }
            : prevOrder
        );
        setShowIcon(true);

        if (updatedOrder.accepted === true) {
          setIsAccepted(true);
          if (updatedOrder.courierLocation) {
            setCourierLocation(updatedOrder.courierLocation);
          }
        }

        if (updatedOrder.desiredDeliveryDate) {
          setIsPreorder(true);
          setPreorderDate(updatedOrder.desiredDeliveryDate);
        } else {
          setIsPreorder(false);
          setPreorderDate(null);
        }

        if (
          updatedOrder.status === "Waiting for courier" &&
          updatedOrder.processingTime
        ) {
          const [value, unit] = updatedOrder.processingTime.split(" "); // Разделяем число и единицу измерения
          let timeInSeconds = 0;

          if (unit.includes(`${t("minutes", { ns: "orderSidebar" })}`)) {
            timeInSeconds = parseInt(value, 10) * 60; // Минуты → секунды
          } else if (unit.includes(`${t("days", { ns: "orderSidebar" })}`)) {
            timeInSeconds = parseInt(value, 10) * 24 * 60 * 60; // Дни → секунды
          }

          setTimeLeft(timeInSeconds);
        } else if (
          updatedOrder.status === "Picked up" &&
          updatedOrder.estimatedTime &&
          updatedOrder.pickupStartTime
        ) {
          const started = new Date(updatedOrder.pickupStartTime).getTime();
          const now = Date.now();
          const elapsed = Math.floor((now - started) / 1000);
          const remaining = Math.max(updatedOrder.estimatedTime - elapsed, 0);

          setTimeLeft(remaining);
        } else if (
          updatedOrder.status === "Arrived at destination" ||
          updatedOrder.status === "Delivered"
        ) {
          setTimeLeft(null);
        }

        if (updatedOrder.courierLocation && updatedOrder.accepted === true) {
          setCourierLocation(updatedOrder.courierLocation);
        }

        if (
          updatedOrder.deliveryLat &&
          updatedOrder.deliveryLng &&
          updatedOrder.courierLocation
        ) {
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
    if (seconds <= 0) return `${t("zero seconds", { ns: "orderSidebar" })}`; // Если время вышло

    const days = Math.floor(seconds / (24 * 60 * 60)); // Количество дней
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60)); // Оставшиеся часы
    const mins = Math.floor((seconds % (60 * 60)) / 60); // Оставшиеся минуты
    const secs = seconds % 60; // Оставшиеся секунды

    let result = "";
    if (days > 0) result += `${days} ${t("days", { ns: "orderSidebar" })} `;
    if (hours > 0) result += `${hours} ${t("hours", { ns: "orderSidebar" })} `;
    if (mins > 0) result += `${mins} ${t("minutes", { ns: "orderSidebar" })} `;
    if (secs > 0 && days === 0 && hours === 0)
      result += `${secs} ${t("seconds", { ns: "orderSidebar" })} `;

    return result.trim(); 
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

        const durationInSeconds =
          data.features[0].properties.segments[0].duration;
        setRouteTime(Math.round(durationInSeconds));
      }
    } catch (error) {
      console.error("Ошибка получения маршрута:", error);
    }
  };

  const handleToggleSidebar = () => {
    setSidebarOpen((prevState) => {
      const newState = !prevState;
      localStorage.setItem("orderSidebarOpen", newState);
      return newState;
    });
  };

  const handleCompleteOrder = async () => {
    if (!order) return;
    try {
      await updateOrderStatus(order.id, "Completed");
      setOrder(null);
      setShowIcon(false);
      window.dispatchEvent(new Event("orderUpdated"));
    } catch (error) {
      console.error("Ошибка завершения заказа:", error);
    }
  };

  return (
    <>
      {showIcon && setSidebarOpen && (
        <div
          className={styles.floatingIcon}
          onClick={() => setSidebarOpen(true)}
        >
          📦
        </div>
      )}
      <div className={`${styles.sidebar} ${isSidebarOpen ? styles.open : ""}`}>
        <div className={styles.header}>
          <h3>{t("delivery status", { ns: "orderSidebar" })}</h3>
          <button onClick={() => setSidebarOpen(false)}>×</button>
        </div>

        {order ? (
          <div>
            {isPreorder ? (
              <p className={styles.preorderInfo}>
                <strong>{t("preorder", { ns: "orderSidebar" })}</strong>
                {t("scheduled delivery", { ns: "orderSidebar" })}{" "}
                <span className={styles.preorderDate}>
                  {new Date(preorderDate).toLocaleString("ru-RU", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </p>
            ) : (
              <p>
                <strong>{t("status", { ns: "orderSidebar" })}</strong>
                <span className={styles.statusText}>
                  {!order?.status ||
                    (order?.status === "Pending" &&
                      `${t("waiting for order confirmation", {
                        ns: "orderSidebar",
                      })}`)}
                  {order?.status === "Waiting for courier" &&
                    `${t("order accepted", { ns: "orderSidebar" })}`}
                  {order?.status === "Ready for pickup" &&
                    `${t("order is ready waiting for the courier", {
                      ns: "orderSidebar",
                    })}`}
                  {order?.status === "Picked up" &&
                    `${t("courier is on the way", { ns: "orderSidebar" })}`}
                  {order?.status === "Arrived at destination" &&
                    `${t("courier has arrived", { ns: "orderSidebar" })}`}
                  {order?.status === "Delivered" &&
                    `${t("order delivered", { ns: "orderSidebar" })}`}
                </span>
              </p>
            )}
            {!order.preorderDate &&
              order?.status === "Waiting for courier" &&
              timeLeft !== null && (
                <p>
                  <strong>
                    {t("preparation time", { ns: "orderSidebar" })}
                  </strong>{" "}
                  ⏳ {formatTime(timeLeft)}
                </p>
              )}

            {order?.status === "Picked up" && timeLeft !== null && (
              <p>
                <strong>{t("time in transit", { ns: "orderSidebar" })}</strong>{" "}
                🚗 {formatTime(timeLeft)}
              </p>
            )}
            <div className={styles.mapContainer}>
              <MapContainer
                center={[order.deliveryLat, order.deliveryLng]}
                zoom={13}
                style={{ height: "300px", width: "100%" }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution="&copy; OpenStreetMap"
                />
                {courierLocation && (
                  <AutoPanToCourier
                    position={[courierLocation.lat, courierLocation.lng]}
                  />
                )}
                <Marker
                  position={[order.deliveryLat, order.deliveryLng]}
                  icon={
                    new L.Icon({
                      iconUrl:
                        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
                      iconSize: [25, 41],
                    })
                  }
                />
                {courierLocation &&
                  (isAccepted ||
                    ["Picked up", "Arrived at destination"].includes(
                      order?.status
                    )) && (
                    <Marker
                      position={[courierLocation.lat, courierLocation.lng]}
                      icon={courierIcon}
                      ref={courierMarkerRef}
                    >
                      <Popup>🚗 Курьер</Popup>
                    </Marker>
                  )}

                {route.length > 0 && (
                  <Polyline positions={route} color="blue" />
                )}
                <Marker
                  position={[WAREHOUSE_LOCATION.lat, WAREHOUSE_LOCATION.lng]}
                  icon={
                    new L.Icon({
                      iconUrl:
                        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
                      iconSize: [25, 41],
                    })
                  }
                >
                  <Popup>📦 Склад</Popup>
                </Marker>
              </MapContainer>
            </div>
            {(order.status === "Delivered" || order.status === "Completed") && (
              <button
                className={styles.completeButton}
                onClick={handleCompleteOrder}
              >
                {t("confirm delivery", { ns: "orderSidebar" })}
              </button>
            )}
            <button
              className={styles.orderHistoryButton}
              onClick={() => navigate("/profile")}
            >
              {t("my orders", { ns: "orderSidebar" })}
            </button>
          </div>
        ) : (
          <p>{t("no active orders", { ns: "orderSidebar" })}</p>
        )}
      </div>
    </>
  );
};

export default OrderSidebar;
