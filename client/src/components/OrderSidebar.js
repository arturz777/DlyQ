import React, { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { observer } from "mobx-react-lite";
import { useRef } from "react";
import { useMap } from "react-leaflet";
import { Context } from "../index";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { fetchActiveOrder, updateOrderStatus } from "../http/orderAPI";
import { fetchDeliveryChat, fetchSellerChat } from "../http/chatAPI";
import { ChatContext } from "../context/ChatContext";
import { useTranslation } from "react-i18next";
import styles from "./OrderSidebar.module.css";
import { socket } from "../socket";

const WAREHOUSE_LOCATION = { lat: 59.51372, lng: 24.828888 };

const OrderSidebar = ({
  isSidebarOpen: controlledOpen,
  setSidebarOpen: controlledSetOpen,
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);

  const isControlled =
    typeof controlledOpen === "boolean" &&
    typeof controlledSetOpen === "function";

  const isSidebarOpen = isControlled ? controlledOpen : uncontrolledOpen;
  const setSidebarOpen = isControlled ? controlledSetOpen : setUncontrolledOpen;
  const { user } = useContext(Context);
  const [order, setOrder] = useState(null);
  const [showIcon, setShowIcon] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [timerEndMs, setTimerEndMs] = useState(null);
  const [courierLocation, setCourierLocation] = useState(null);
  const [isAccepted, setIsAccepted] = useState(false);
  const [route, setRoute] = useState([]);
  const [routeTime, setRouteTime] = useState(null);
  const [isPreorder, setIsPreorder] = useState(false);
  const [preorderDate, setPreorderDate] = useState(null);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const courierMarkerRef = useRef(null);
  const orderRef = useRef(null);
  const [deliveryChatId, setDeliveryChatId] = useState(null);
  const { openChat } = useContext(ChatContext);
  const [sellerChatId, setSellerChatId] = useState(null);
  const [pendingChat, setPendingChat] = useState(null);

  const userId = user.user?.id;

  const requestOpenChat = (id, kind) => {
    if (!id) return;
    setPendingChat({ id, kind });
    setSidebarOpen(false);
  };

  useEffect(() => {
    if (!isSidebarOpen && pendingChat?.id) {
      openChat(pendingChat.id, pendingChat.kind);
      setPendingChat(null);
    }
  }, [isSidebarOpen, pendingChat, openChat]);

  const canShowChat = (o) => {
    if (!o) return false;
    if (!o.courierId) return false;
    if (o.accepted === true) return true;
    return isOrderAccepted(o);
  };

  const canShowSellerChat = (o) => {
    if (!o) return false;
    if (o.orderType === "parcel") return false;
    if (["Delivered", "Completed"].includes(o.status)) return false;
    return Boolean(o.sellerChatId || sellerChatId);
  };

  useEffect(() => {
    const onChatReady = ({ orderId, chatId }) => {
      if (orderId !== orderRef.current?.id) return;
      if (!chatId || !userId) return;

      setDeliveryChatId(chatId);
      socket.emit("joinChat", { chatId, userId });
    };

    socket.on("deliveryChatReady", onChatReady);
    return () => socket.off("deliveryChatReady", onChatReady);
  }, [userId]);

  useEffect(() => {
    const onSellerChatReady = ({ orderId, chatId }) => {
      if (orderId !== orderRef.current?.id) return;
      if (!chatId || !userId) return;

      setSellerChatId(chatId);
      socket.emit("joinChat", { chatId, userId });
    };

    socket.on("sellerChatReady", onSellerChatReady);
    return () => socket.off("sellerChatReady", onSellerChatReady);
  }, [userId]);

  const isOrderAccepted = (o) => {
    if (!o) return false;
    const st = o.status;

    if (o.orderType === "parcel") {
      return [
        "Accepted",
        "Arrived at pickup",
        "In transit",
        "Arrived at destination",
        "Delivered",
        "Completed",
      ].includes(st);
    }

    return [
      "Accepted",
      "Ready for pickup",
      "Picked up",
      "Arrived at destination",
      "Delivered",
      "Completed",
    ].includes(st);
  };

  useEffect(() => {
    if (!order?.id || !userId) return;

    if (!canShowChat(order) || !order?.courierId) {
      setDeliveryChatId(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const data = await fetchDeliveryChat(order.id);
        if (cancelled) return;

        const chatId = data?.chatId ?? data?.id ?? null;
        setDeliveryChatId(chatId);

        if (chatId) socket.emit("joinChat", { chatId, userId });
      } catch (e) {
        console.log("fetchDeliveryChat web error:", e?.message || e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    order?.id,
    order?.status,
    order?.orderType,
    order?.accepted,
    order?.courierId,
    userId,
  ]);

  useEffect(() => {
    if (!order?.id || !userId) return;

    if (!canShowSellerChat(order)) {
      setSellerChatId(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const data = await fetchSellerChat(order.id);
        if (cancelled) return;

        const chatId = data?.chatId ?? data?.id ?? null;
        setSellerChatId(chatId);

        if (chatId) socket.emit("joinChat", { chatId, userId });
      } catch (e) {
        console.log("fetchSellerChat web error:", e?.message || e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [order?.id, order?.status, order?.sellerId, userId]);

  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  const dateLocale = (() => {
    const l = String(i18n.language || "en").toLowerCase();
    if (l.startsWith("ru")) return "ru-RU";
    if (l === "est" || l.startsWith("et")) return "et-EE";
    return "en-GB";
  })();

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
      if (
        position &&
        Number.isFinite(position[0]) &&
        Number.isFinite(position[1])
      ) {
        map.panTo(position);
      }
    }, [position]);
    return null;
  };

  const parseDurationToSeconds = (str) => {
    if (!str) return 0;

    const m = String(str)
      .trim()
      .match(/^(\d+)\s*([a-zA-Zа-яА-ЯёЁ.]+)?/);
    if (!m) return 0;

    const value = parseInt(m[1], 10);
    const unit = (m[2] || "").toLowerCase();

    if (!Number.isFinite(value)) return 0;
    if (unit.includes("min") || unit.includes("мин")) return value * 60;
    if (unit.includes("hour") || unit.includes("час")) return value * 60 * 60;
    if (unit.includes("day") || unit.includes("дн"))
      return value * 24 * 60 * 60;

    return value * 60;
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
          activeOrder.processingTime
        ) {
          const totalSeconds = parseDurationToSeconds(
            activeOrder.processingTime
          );

          const startedAt =
            activeOrder.processingStartTime || activeOrder.updatedAt;
          const started = startedAt
            ? new Date(startedAt).getTime()
            : Date.now();
          const endMs = started + totalSeconds * 1000;
          setTimerEndMs(endMs);
          setTimeLeft(Math.floor((endMs - Date.now()) / 1000));
        } else {
          const isParcel = activeOrder.orderType === "parcel";
          const inTransitStatus = isParcel ? "In transit" : "Picked up";

          if (
            activeOrder.status === inTransitStatus &&
            activeOrder.estimatedTime &&
            activeOrder.pickupStartTime
          ) {
            const started = new Date(activeOrder.pickupStartTime).getTime();
            const now = Date.now();
            const elapsed = Math.floor((now - started) / 1000);
            const endMs =
              started + Number(activeOrder.estimatedTime || 0) * 1000;
            setTimerEndMs(endMs);
            setTimeLeft(Math.floor((endMs - Date.now()) / 1000));
          } else {
            setTimerEndMs(null);
            setTimeLeft(null);
          }
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
        setTimerEndMs(null);
        setTimeLeft(null);
      }
    } catch (error) {
      console.warn(t("no active order", { ns: "orderSidebar" }), error);
      setOrder(null);
      setShowIcon(false);
    }
  };

  useEffect(() => {
    loadOrder();

    const handleOrderUpdate = (updatedOrder) => {
      if (!updatedOrder?.id) return;

      setOrder((prev) => {
        if (!prev) return prev;
        if (prev.id !== updatedOrder.id) return prev;
        return { ...prev, ...updatedOrder };
      });

      if (!orderRef.current) {
        loadOrder();
      }

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
        ["Waiting for courier", "Accepted"].includes(updatedOrder.status) &&
        updatedOrder.processingTime
      ) {
        const totalSeconds = parseDurationToSeconds(
          updatedOrder.processingTime
        );

        const startedAt =
          updatedOrder.processingStartTime || updatedOrder.updatedAt;
        const started = startedAt ? new Date(startedAt).getTime() : Date.now();
        const endMs = started + totalSeconds * 1000;
        setTimerEndMs(endMs);
        setTimeLeft(Math.floor((endMs - Date.now()) / 1000));
      } else {
        const isParcel = updatedOrder.orderType === "parcel";
        const inTransitStatus = isParcel ? "In transit" : "Picked up";

        if (
          updatedOrder.status === inTransitStatus &&
          updatedOrder.estimatedTime &&
          updatedOrder.pickupStartTime
        ) {
          const started = new Date(updatedOrder.pickupStartTime).getTime();
          const now = Date.now();
          const elapsed = Math.floor((now - started) / 1000);
          const endMs =
            started + Number(updatedOrder.estimatedTime || 0) * 1000;
          setTimerEndMs(endMs);
          setTimeLeft(Math.floor((endMs - Date.now()) / 1000));
        } else if (updatedOrder.status === inTransitStatus) {
          setTimerEndMs(null);
          setTimeLeft(null);
        } else if (
          updatedOrder.status === "Arrived at destination" ||
          updatedOrder.status === "Delivered"
        ) {
          setTimerEndMs(null);
          setTimeLeft(null);
        }
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
    };

    const handleCourierLocationUpdate = (p) => {
      const o = orderRef.current;
      if (!o || p?.orderId !== o.id) return;

      const location = { lat: p.lat, lng: p.lng };
      setCourierLocation(location);

      if (o.deliveryLat && o.deliveryLng) {
        fetchRoute(location, { lat: o.deliveryLat, lng: o.deliveryLng });
      }
    };

    const handleEta = (p) => {
      const o = orderRef.current;
      if (!p?.orderId || !o) return;
      if (o.id !== p.orderId) return;

      const isParcel = o.orderType === "parcel";
      const inTransitStatus = isParcel ? "In transit" : "Picked up";

      if (o.status === inTransitStatus) {
        const etaSec = Number(p.etaSeconds || 0);
        const endMs = Date.now() + etaSec * 1000;
        setTimerEndMs(endMs);
        setTimeLeft(Math.floor((endMs - Date.now()) / 1000));
      }
    };

    socket.on("orderStatusUpdate", handleOrderUpdate);
    socket.on("courierLocationUpdate", handleCourierLocationUpdate);
    socket.on("orderEtaUpdate", handleEta);

    window.addEventListener("orderUpdated", loadOrder);

    return () => {
      socket.off("orderStatusUpdate", handleOrderUpdate);
      socket.off("courierLocationUpdate", handleCourierLocationUpdate);
      socket.off("orderEtaUpdate", handleEta);
      window.removeEventListener("orderUpdated", loadOrder);
    };
  }, []);

  useEffect(() => {
    if (!order?.id) return;

    const joinRoom = () => {
      socket.emit("joinOrderRoom", { orderId: order.id });
    };

    if (socket.connected) joinRoom();
    socket.on("connect", joinRoom);

    return () => {
      socket.off("connect", joinRoom);
      socket.emit("leaveOrderRoom", { orderId: order.id });
    };
  }, [order?.id]);

  useEffect(() => {
    if (timerEndMs == null) return;

    const tick = () => {
      setTimeLeft(Math.floor((timerEndMs - Date.now()) / 1000));
    };

    tick();
    const id = setInterval(tick, 1000);

    const sync = () => tick();
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);

    return () => {
      clearInterval(id);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [timerEndMs]);

  const formatTime = (seconds) => {
    if (seconds == null) return "";

    const sign = seconds < 0 ? "-" : "";
    let s = Math.abs(Math.trunc(seconds));

    const days = Math.floor(s / (24 * 60 * 60));
    s %= 24 * 60 * 60;

    const hours = Math.floor(s / (60 * 60));
    s %= 60 * 60;

    const mins = Math.floor(s / 60);
    const secs = s % 60;

    let result = "";
    if (days > 0) result += `${days} ${t("days", { ns: "orderSidebar" })} `;
    if (hours > 0) result += `${hours} ${t("hours", { ns: "orderSidebar" })} `;
    if (mins > 0) result += `${mins} ${t("minutes", { ns: "orderSidebar" })} `;
    if (days === 0 && hours === 0) {
      result += `${secs} ${t("seconds", { ns: "orderSidebar" })} `;
    }

    const trimmed = result.trim();
    return sign + (trimmed || `0 ${t("seconds", { ns: "orderSidebar" })}`);
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
      console.error(t("route fetch error", { ns: "orderSidebar" }), error);
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
      console.error(t("complete order error", { ns: "orderSidebar" }), error);
    }
  };

  const isParcel = order?.orderType === "parcel";
  const dLat = Number(order?.deliveryLat);
  const dLng = Number(order?.deliveryLng);
  const hasDelivery = Number.isFinite(dLat) && Number.isFinite(dLng);

  return (
    <>
      {showIcon && !isSidebarOpen && (
        <div
          className={styles.floatingIcon}
          onClick={() => setSidebarOpen(true)}
        >
          {t("order", { ns: "userProfile" })}
        </div>
      )}
      <div className={`${styles.sidebar} ${isSidebarOpen ? styles.open : ""}`}>
        <div className={styles.header}>
          <h3></h3>

          <div className={styles.headerActions}>
            {isSidebarOpen && canShowChat(order) && deliveryChatId && (
              <button
                className={styles.chatButton}
                onClick={() => requestOpenChat(deliveryChatId, "delivery")}
                type="button"
              >
                💬{" "}
                {t("chatWithCourier", {
                  ns: "orderSidebar",
                  defaultValue: "Чат с курьером",
                })}
              </button>
            )}

            {isSidebarOpen && canShowSellerChat(order) && sellerChatId && (
              <button
                className={styles.chatButton}
                onClick={() => requestOpenChat(sellerChatId, "seller")}
                type="button"
              >
                💬{" "}
                {t("chatWithRestaurant", {
                  ns: "orderSidebar",
                  defaultValue: "Чат с рестораном",
                })}
              </button>
            )}

            <button
              className={styles.closeButton}
              onClick={() => setSidebarOpen(false)}
              type="button"
            >
              ×
            </button>
          </div>
        </div>

        {order ? (
          <div className={styles.body}>
            {isPreorder ? (
              <p className={styles.preorderInfo}>
                <strong>{t("preorder", { ns: "orderSidebar" })}</strong>
                {t("scheduled delivery", { ns: "orderSidebar" })}{" "}
                <span className={styles.preorderDate}>
                  {new Date(preorderDate).toLocaleString(dateLocale, {
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

                  {order?.status === "preorder" &&
                    t("waiting for order confirmation", { ns: "orderSidebar" })}

                  {isParcel &&
                    order?.status === "Waiting for courier" &&
                    t("parcel searching courier...", { ns: "orderSidebar" })}

                  {isParcel &&
                    order?.status === "Accepted" &&
                    t("parcel courier going to point A", {
                      ns: "orderSidebar",
                    })}

                  {isParcel &&
                    order?.status === "Arrived at pickup" &&
                    t("parcel courier arrived at point A", {
                      ns: "orderSidebar",
                    })}

                  {isParcel &&
                    order?.status === "In transit" &&
                    t("parcel courier going to point B", {
                      ns: "orderSidebar",
                    })}

                  {isParcel &&
                    order?.status === "Arrived at destination" &&
                    t("parcel courier arrived at point B", {
                      ns: "orderSidebar",
                    })}

                  {isParcel &&
                    order?.status === "Delivered" &&
                    t("parcel delivered", { ns: "orderSidebar" })}

                  {!isParcel &&
                    order?.status === "Waiting for courier" &&
                    `${t("order accepted", { ns: "orderSidebar" })}`}

                  {!isParcel &&
                    order?.status === "Accepted" &&
                    `${t("order accepted", { ns: "orderSidebar" })}`}

                  {!isParcel &&
                    order?.status === "Ready for pickup" &&
                    `${t("order is ready waiting for the courier", {
                      ns: "orderSidebar",
                    })}`}

                  {!isParcel &&
                    order?.status === "Picked up" &&
                    t("the courier is on the way to you", { ns: "orderSidebar" })}

                  {!isParcel &&
                    order?.status === "Arrived at destination" &&
                    `${t("courier has arrived", { ns: "orderSidebar" })}`}

                  {!isParcel &&
                    order?.status === "Delivered" &&
                    `${t("order delivered", { ns: "orderSidebar" })}`}
                </span>
              </p>
            )}
            {!order.preorderDate &&
              ["Waiting for courier", "Accepted"].includes(order?.status) &&
              timeLeft !== null && (
                <p>
                  <strong>
                    {t("preparation time", { ns: "orderSidebar" })}
                  </strong>{" "}
                  ⏳ {formatTime(timeLeft)}
                </p>
              )}

            {((order?.orderType === "parcel" &&
              order?.status === "In transit") ||
              (order?.orderType !== "parcel" &&
                order?.status === "Picked up")) &&
              timeLeft !== null && (
                <p>
                  <strong>
                    {t("time in transit", { ns: "orderSidebar" })}
                  </strong>{" "}
                  🚗 {formatTime(timeLeft)}
                </p>
              )}

            <div className={styles.mapContainer}>
              {hasDelivery ? (
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
                      (isParcel
                        ? [
                            "Accepted",
                            "Arrived at pickup",
                            "In transit",
                            "Arrived at destination",
                          ].includes(order?.status)
                        : [
                            "Accepted",
                            "Picked up",
                            "Arrived at destination",
                          ].includes(order?.status))) && (
                      <Marker
                        position={[courierLocation.lat, courierLocation.lng]}
                        icon={courierIcon}
                        ref={courierMarkerRef}
                      >
                        <Popup>🚗 {t("courier", { ns: "orderSidebar" })}</Popup>
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
                    <Popup>📦 {t("warehouse", { ns: "orderSidebar" })}</Popup>
                  </Marker>
                </MapContainer>
              ) : (
                <div
                  style={{
                    height: 300,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {t("loading map...", { ns: "orderSidebar" })}
                </div>
              )}
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

export default observer(OrderSidebar);
