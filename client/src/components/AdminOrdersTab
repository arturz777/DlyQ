import React, { useEffect, useMemo, useState } from "react";
import { fetchAllCouriers } from "../http/courierAPI";
import {
  fetchAllOrdersForAdmin,
  adminUpdateOrderStatus,
  assignCourierToOrder,
} from "../http/orderAPI";
import CourierMap from "./CourierMap";
import { socket } from "../socket";
import styles from "./AdminOrdersTab.module.css";

const STATUS_LABELS_RU = {
  Pending: "В обработке",
  "Waiting for courier": "Ожидает курьера",
  "Ready for pickup": "Готов к выдаче",
  "Picked up": "Забран курьером",
  "Arrived at destination": "Курьер прибыл",
  Delivered: "Доставлен",
  Completed: "Завершён",
  Cancelled: "Отменён",
};

const AdminOrdersTab = () => {
  const [allOrders, setAllOrders] = useState([]);
  const [couriers, setCouriers] = useState([]);
  const [orderSaving, setOrderSaving] = useState({});
  const [orderError, setOrderError] = useState({});
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingCouriers, setLoadingCouriers] = useState(false);

  const couriersById = useMemo(() => {
    const m = new Map();
    (couriers || []).forEach((c) => m.set(String(c.id), c));
    return m;
  }, [couriers]);

  const reloadOrders = async () => {
    try {
      setLoadingOrders(true);
      const fresh = await fetchAllOrdersForAdmin();
      setAllOrders(Array.isArray(fresh) ? fresh : []);
    } catch (e) {
      console.error("fetchAllOrdersForAdmin failed:", e);
    } finally {
      setLoadingOrders(false);
    }
  };

  const reloadCouriers = async () => {
    try {
      setLoadingCouriers(true);
      const list = await fetchAllCouriers();
      setCouriers(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error("fetchAllCouriers failed:", e);
    } finally {
      setLoadingCouriers(false);
    }
  };

  useEffect(() => {
    reloadCouriers();
    reloadOrders();
  }, []);

  useEffect(() => {
    if (!couriers?.length) return;

    couriers.forEach((c) => {
      socket.emit("joinCourierRoom", { courierId: c.id });
    });

    const onLoc = ({ courierId, lat, lng }) => {
      setCouriers((prev) =>
        prev.map((c) =>
          c.id === courierId ? { ...c, currentLat: lat, currentLng: lng } : c,
        ),
      );
    };

    const onStatus = ({ courierId, status }) => {
      setCouriers((prev) =>
        prev.map((c) => (c.id === courierId ? { ...c, status } : c)),
      );
    };

    socket.on("courierLocationUpdate", onLoc);
    socket.on("courierStatusUpdate", onStatus);

    return () => {
      socket.off("courierLocationUpdate", onLoc);
      socket.off("courierStatusUpdate", onStatus);
    };
  }, [couriers]);

  const handleAssignCourier = async (orderId, courierIdRaw) => {
    const courierId = courierIdRaw ? String(courierIdRaw) : "";

    setAllOrders((prev) =>
      prev.map((o) =>
        o.id === orderId ? { ...o, courierId: courierId || null } : o,
      ),
    );

    try {
      await assignCourierToOrder(orderId, courierId || null);
    } catch (e) {
      console.error("assignCourierToOrder failed:", e);
      await reloadOrders();
    }
  };

  const handleStatusChange = async (
    orderId,
    status,
    processingTime,
    estimatedTime,
  ) => {
    const prevOrder = allOrders.find((o) => o.id === orderId);

    setOrderSaving((p) => ({ ...p, [orderId]: true }));
    setOrderError((p) => ({ ...p, [orderId]: "" }));

    try {
      await adminUpdateOrderStatus(
        orderId,
        status,
        processingTime,
        estimatedTime,
      );

      await reloadOrders();
    } catch (err) {
      console.error("adminUpdateOrderStatus failed:", err);

      if (prevOrder) {
        setAllOrders((prev) =>
          prev.map((o) => (o.id === orderId ? prevOrder : o)),
        );
      }

      setOrderError((p) => ({ ...p, [orderId]: "Не сохранилось" }));
    } finally {
      setOrderSaving((p) => ({ ...p, [orderId]: false }));
    }
  };

  return (
    <div className={styles.tabWrap}>
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.title}>Заказы</h2>
          <div className={styles.subTitle}>
            {loadingOrders ? "Загрузка заказов…" : `Всего: ${allOrders.length}`}
            <span className={styles.dot}>•</span>
            {loadingCouriers
              ? "Загрузка курьеров…"
              : `Курьеров: ${couriers.length}`}
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.refreshButton} onClick={reloadOrders}>
            Обновить
          </button>
        </div>
      </div>

      <div className={styles.mapBlock}>
        <div className={styles.blockTitle}>Курьеры на карте</div>
        <CourierMap couriers={couriers} />
      </div>

      <div className={styles.ordersTable}>
        {allOrders.length === 0 ? (
          <div className={styles.empty}>Нет заказов</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Курьер</th>
                <th>Статус</th>
                <th>Время готовки</th>
                <th>Время доставки</th>
                <th>Адрес</th>
                <th>Сумма</th>
                <th>Дата</th>
                <th>Действия</th>
              </tr>
            </thead>

            <tbody>
              {allOrders.map((order) => (
                <tr key={order.id}>
                  <td className={styles.cellId}>#{order.id}</td>

                  <td>
                    <select
                      className={styles.tableSelect}
                      value={order.courierId || ""}
                      onChange={(e) =>
                        handleAssignCourier(order.id, e.target.value)
                      }
                    >
                      <option value="">Не назначен</option>
                      {couriers.map((courier) => (
                        <option key={courier.id} value={courier.id}>
                          {courier.name}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td>
                    <select
                      className={styles.tableSelect}
                      value={order.status}
                      onChange={(e) =>
                        setAllOrders((prev) =>
                          prev.map((o) =>
                            o.id === order.id
                              ? { ...o, status: e.target.value }
                              : o,
                          ),
                        )
                      }
                    >
                      {Object.entries(STATUS_LABELS_RU).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </td>

                  <td>
                    {order.status === "Waiting for courier" ? (
                      <select
                        className={styles.tableSelect}
                        value={order.processingTime || ""}
                        onChange={(e) =>
                          setAllOrders((prev) =>
                            prev.map((o) =>
                              o.id === order.id
                                ? { ...o, processingTime: e.target.value }
                                : o,
                            ),
                          )
                        }
                      >
                        <option value="">-- выберите --</option>
                        <option value="5 минут">5 минут</option>
                        <option value="10 минут">10 минут</option>
                        <option value="15 минут">15 минут</option>
                        <option value="20 минут">20 минут</option>
                        <option value="30 минут">30 минут</option>
                        <option value="60 минут">60 минут</option>
                        <option value="720 минут">1 день</option>
                      </select>
                    ) : (
                      <span className={styles.muted}>—</span>
                    )}
                  </td>

                  <td>
                    {order.status === "Picked up" ? (
                      <select
                        className={styles.tableSelect}
                        value={order.estimatedTime || ""}
                        onChange={(e) =>
                          setAllOrders((prev) =>
                            prev.map((o) =>
                              o.id === order.id
                                ? {
                                    ...o,
                                    estimatedTime: parseInt(e.target.value, 10),
                                  }
                                : o,
                            ),
                          )
                        }
                      >
                        <option value="">-- выберите --</option>
                        <option value="300">5 минут</option>
                        <option value="600">10 минут</option>
                        <option value="900">15 минут</option>
                        <option value="1200">20 минут</option>
                        <option value="1800">30 минут</option>
                        <option value="3600">1 час</option>
                      </select>
                    ) : (
                      <span className={styles.muted}>—</span>
                    )}
                  </td>

                  <td className={styles.cellAddress}>
                    {order.deliveryAddress}
                  </td>
                  <td className={styles.cellPrice}>{order.totalPrice} €</td>
                  <td className={styles.cellDate}>
                    {new Date(order.createdAt).toLocaleString("ru-RU")}
                  </td>

                  <td className={styles.actionsCell}>
                    <button
                      className={styles.saveButton}
                      disabled={!!orderSaving[order.id]}
                      onClick={() =>
                        handleStatusChange(
                          order.id,
                          order.status,
                          order.processingTime,
                          order.estimatedTime,
                        )
                      }
                      title="Сохранить"
                    >
                      {orderSaving[order.id] ? "..." : "💾"}
                    </button>

                    {orderError[order.id] ? (
                      <div className={styles.errText}>
                        {orderError[order.id]}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {allOrders.some(
        (o) => o.courierId && !couriersById.has(String(o.courierId)),
      ) ? (
        <div className={styles.hint}>
          ⚠️ Внимание: у некоторых заказов указан courierId, которого нет в
          списке курьеров (возможна рассинхронизация данных).
        </div>
      ) : null}
    </div>
  );
};

export default AdminOrdersTab;
