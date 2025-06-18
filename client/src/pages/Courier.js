import React, { useState, useEffect, useContext } from "react";
import { Context } from "../index";
import {
  fetchActiveOrders,
  acceptOrder,
  toggleCourierStatus,
} from "../http/courierAPI";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMap,
  Popup,
} from "react-leaflet";
import ChatBox from "../components/ChatBox";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { io } from "socket.io-client";
import {
  completeDelivery,
  updateDeliveryStatus,
  updateCourierLocation,
} from "../http/courierAPI";
import styles from "./Courier.module.css";

const socket = io("https://zang-4.onrender.com");

const WAREHOUSE_LOCATION = { lat: 59.51372, lng: 24.828888 };

const customIcon = new L.Icon({
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const MapUpdater = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center && center.lat !== undefined && center.lng !== undefined) {
      map.setView(center, 12, { animate: true });
    }
  }, [center, map]);
  return null;
};

const Courier = () => {
  const { user } = useContext(Context);
  const [orders, setOrders] = useState([]);
  const [route, setRoute] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [courierStatus, setCourierStatus] = useState(
    localStorage.getItem("courierStatus") || "offline"
  );
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [showSupportChat, setShowSupportChat] = useState(false);

  useEffect(() => {
    document.body.classList.add("courier-page");

    return () => {
      document.body.classList.remove("courier-page");
    };
  }, []);

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

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
    socket.on("warehouseOrder", (newOrder) => {
      playNotificationSound();
      setOrders((prevOrders) => [...prevOrders, newOrder]);
      if (
        newOrder.deliveryLat !== undefined &&
        newOrder.deliveryLng !== undefined
      ) {
        fetchRoute(WAREHOUSE_LOCATION, {
          lat: newOrder.deliveryLat,
          lng: newOrder.deliveryLng,
        });
      } else {
        console.warn("📌 Новый заказ без координат – маршрут не строится.");
      }
    });

    return () => {
      socket.off("warehouseOrder");
    };
  }, []);

  useEffect(() => {
    socket.on("orderReady", (updatedOrder) => {
      if (currentOrder && updatedOrder.id === currentOrder.id) {
        setCurrentOrder(updatedOrder);
      }
    });

    return () => {
      socket.off("orderReady");
    };
  }, [currentOrder]);

  useEffect(() => {
    if (courierStatus === "online") {
      loadOrders();
    }
  }, [courierStatus]);

  useEffect(() => {
    socket.on("orderStatusUpdate", (updatedOrder) => {
      if (currentOrder && updatedOrder.id === currentOrder.id) {
        setCurrentOrder(updatedOrder);
      }
    });

    return () => {
      socket.off("orderStatusUpdate");
    };
  }, [currentOrder]);

  const loadOrders = async () => {
    try {
      const data = await fetchActiveOrders();
      setOrders(data);
      if (
        data.length > 0 &&
        data[0].deliveryLat !== undefined &&
        data[0].deliveryLng !== undefined
      ) {
        fetchRoute(WAREHOUSE_LOCATION, {
          lat: data[0].deliveryLat,
          lng: data[0].deliveryLng,
        });
      }
    } catch (error) {
      console.error("Ошибка загрузки заказов:", error);
    }
  };

  const handleAcceptOrder = async (orderId) => {
    if (isAccepting) return;

    setIsAccepting(true);
    try {
      const response = await acceptOrder(orderId); 
      setCurrentOrder(response); 
      localStorage.setItem("currentOrder", JSON.stringify(response)); 
    } catch (error) {
      console.error("Ошибка принятия заказа:", error);
    } finally {
      setIsAccepting(false); 
    }
  };

  useEffect(() => {
    const savedOrder = localStorage.getItem("currentOrder");
    if (savedOrder) {
      const parsedOrder = JSON.parse(savedOrder);
      setCurrentOrder(parsedOrder);
      fetchRoute(WAREHOUSE_LOCATION, {
        lat: parsedOrder.deliveryLat,
        lng: parsedOrder.deliveryLng,
      });
    }
  }, []);

  const handleToggleStatus = async () => {
    try {
      const newStatus = courierStatus === "offline" ? "online" : "offline";
      await toggleCourierStatus(newStatus);
      setCourierStatus(newStatus);
      localStorage.setItem("courierStatus", newStatus);

      if (newStatus === "online") {
        loadOrders();
      } else {
        setOrders([]);
        setRoute([]);
      }
    } catch (error) {
      console.error("Ошибка смены статуса курьера:", error);
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    if (!currentOrder) return;

    try {
      await updateDeliveryStatus(currentOrder.id, newStatus);
      setCurrentOrder({ ...currentOrder, status: newStatus }); 

      if (newStatus === "Completed") {
        setCurrentOrder(null);
        setOrders([]); 
      }
    } catch (error) {
      console.error("Ошибка обновления статуса доставки:", error);
    }
  };

  const handleCompleteDelivery = async () => {
    if (!currentOrder) return;

    try {
      await completeDelivery(currentOrder.id);

      socket.emit("orderStatusUpdate", {
        id: currentOrder.id,
        status: "Delivered",
      });

      localStorage.removeItem("currentOrder");
      setCurrentOrder(null); 
      setOrders([]);
    } catch (error) {
      console.error("Ошибка завершения доставки:", error);
    }
  };

  useEffect(() => {
    const sendLocationUpdate = async () => {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            await updateCourierLocation(latitude, longitude);
          } catch (error) {
            console.error(
              "❌ Ошибка обновления местоположения курьера:",
              error
            );
          }
        });
      }
    };

    sendLocationUpdate();
    const interval = setInterval(sendLocationUpdate, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchRoute = async (start, end) => {
    if (!start.lat || !start.lng || !end.lat || !end.lng) {
      console.warn("❌ Ошибка: Некорректные координаты маршрута!", start, end);
      return;
    }
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
      }
    } catch (error) {
      console.error("Ошибка получения маршрута:", error);
    }
  };

  return (
    <div
      className={styles.CourierContainer}
      style={{ height: "100vh", width: "100%" }}
    >
      <div className={styles.BurgerMenu} onClick={toggleMenu}>
        ☰
      </div>

      {menuOpen && (
        <div className={styles.ModalMenu}>
          <button className={styles.CloseButton} onClick={toggleMenu}>
            ×
          </button>
          <ul>
            <li>👤 Профиль</li>
            <li>📦 Доставленные заказы</li>
            <li>💰 Финансы</li>
            <li
              onClick={() => {
                setMenuOpen(false);
                setShowSupportChat(true);
              }}
            >
              🛟 Поддержка
            </li>
          </ul>
        </div>
      )}

      <MapContainer
        center={[WAREHOUSE_LOCATION.lat, WAREHOUSE_LOCATION.lng]}
        zoom={12}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap"
        />

        {orders.length > 0 && (
          <MapUpdater center={[orders[0].deliveryLat, orders[0].deliveryLng]} />
        )}

        <Marker
          position={[WAREHOUSE_LOCATION.lat, WAREHOUSE_LOCATION.lng]}
          icon={customIcon}
        >
          <Popup>📦 Склад</Popup>
        </Marker>

         {currentOrder?.deliveryLat && currentOrder?.deliveryLng ? (
          <Marker
            position={[currentOrder.deliveryLat, currentOrder.deliveryLng]}
            icon={customIcon}
          >
            <Popup>🏠 Адрес клиента</Popup>
          </Marker>
        ) : orders.length > 0 &&
          orders[0].deliveryLat &&
          orders[0].deliveryLng ? (
          <Marker
            position={[orders[0].deliveryLat, orders[0].deliveryLng]}
            icon={customIcon}
          >
            <Popup>🏠 Адрес клиента</Popup>
          </Marker>
        ) : null}

        {route.length > 0 && <Polyline positions={route} color="blue" />}
      </MapContainer>

      <div
        className={styles.FixedBottomBar}
        onClick={() => setShowOrderModal(true)}
      >
        {courierStatus === "offline" ? (
          <button onClick={handleToggleStatus}>🟢 Выйти в онлайн</button>
        ) : currentOrder ? (
          <p>📦 Детали заказа</p>
        ) : orders.length > 0 ? (
          <button
            className={`${styles.AcceptButton} ${styles.Animate}`}
            onClick={() => handleAcceptOrder(orders[0].id)}
            disabled={isAccepting}
          >
            {isAccepting ? "⏳ Принятие..." : "✅ Принять заказ"}
          </button>
        ) : (
          <p>🔎 Поиск заказа...</p>
        )}
      </div>

      <div
        className={styles.FixedBottomBar}
        onClick={() => setShowOrderModal(true)}
      >
        {courierStatus === "offline" ? (
          <button onClick={handleToggleStatus}>🟢 Выйти в онлайн</button>
        ) : !currentOrder && orders.length > 0 ? (
          <button
            className={`${styles.AcceptButton} ${styles.Animate}`}
            onClick={() => handleAcceptOrder(orders[0].id)}
          >
            ✅ Принять заказ
          </button>
        ) : currentOrder ? (
          <p>📦 Детали заказа</p>
        ) : (
          <p>🔎 Поиск заказа...</p>
        )}
      </div>

      {showOrderModal && (
        <div
          className={`${styles.OrderModal} ${
            showOrderModal ? styles.open : ""
          }`}
        >
          <button
            className={styles.CloseButton}
            onClick={() => setShowOrderModal(false)}
          >
            ×
          </button>

          <h3>📦 Информация</h3>

          {courierStatus === "online" && !currentOrder && (
            <div>
              <p>🔎 Поиск заказа...</p>
              <button
                onClick={handleToggleStatus}
                className={styles.OfflineButton}
              >
                🔴 Выключить
              </button>
            </div>
          )}

          {courierStatus === "offline" && (
            <div className={styles.ModalContent}>
              <p>Вы офлайн. Включите онлайн, чтобы получать заказы.</p>
              <button
                onClick={handleToggleStatus}
                className={styles.OnlineButton}
              >
                🟢 Выйти в онлайн
              </button>
            </div>
          )}

          {currentOrder && (
            <div className={styles.ModalContent}>
              <p>
                <strong>Адрес доставки:</strong> {currentOrder.deliveryAddress}
              </p>
              <p>
                <strong>Статус:</strong>{" "}
                {currentOrder.status === "Ready for pickup"
                  ? "📦 Готово к доставке!"
                  : currentOrder.status}
              </p>

              {currentOrder &&
                currentOrder.status === "Picked up" && 
                currentOrder.deliveryLat &&
                currentOrder.deliveryLng && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${currentOrder.deliveryLat},${currentOrder.deliveryLng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.GoogleMapsButton}
                  >
                    🗺 Открыть маршрут
                  </a>
                )}

              {currentOrder.status === "Ready for pickup" && ( 
                <button
                  className={styles.PickedUpButton}
                  onClick={() => handleUpdateStatus("Picked up")}
                >
                  📦 Забрал заказ
                </button>
              )}

              {currentOrder.status === "Picked up" && (
                <button
                  className={styles.ArrivedButton}
                  onClick={() => handleUpdateStatus("Arrived at destination")}
                >
                  📍 Прибыл к клиенту
                </button>
              )}

              {currentOrder.status === "Arrived at destination" && (
                <button
                  className={styles.DeliveredButton}
                  onClick={() => handleCompleteDelivery(currentOrder.id)}
                >
                  ✅ Доставлено
                </button>
              )}
            </div>
          )}
        </div>
      )}

         {showSupportChat && (
        <div
          className={styles.SupportChatOverlay}
          onClick={() => setShowSupportChat(false)}
        >
          <div
            className={styles.SupportChatModal}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className={styles.CloseButton}
              onClick={() => setShowSupportChat(false)}
            >
              ×
            </button>
            <h3>🛟 Чат поддержки</h3>
            <ChatBox userId={user.user.id} userRole={user.user.role} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Courier;
