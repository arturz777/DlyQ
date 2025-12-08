import React, { useContext, useEffect, useState, lazy, Suspense } from "react";
import { Context } from "../index";
import { fetchUserOrders } from "../http/orderAPI";
import { updateProfile, fetchProfile } from "../http/userAPI";
import OrderSidebar from "../components/OrderSidebar";
import SlideModal from "../components/modals/SlideModal";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import styles from "./UserProfile.module.css";

const DevicePageLazy = lazy(() => import("../pages/DevicePage"));

const UserProfile = () => {
  const [orders, setOrders] = useState([]);
  const { user } = useContext(Context);
  const navigate = useNavigate();
  const isAuth = Boolean(localStorage.getItem("token"));
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const { t, i18n } = useTranslation();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const currentLang = i18n.language;
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);

  const handleBack = () => {
    navigate(-1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      const response = await axios.put(
        "http://localhost:5000/api/user/profile",
        { firstName, lastName, phone },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      alert(t("profileUpdated", { ns: "userProfile" }));
    } catch (error) {
      console.error("Ошибка обновления профиля", error);
    }
  };

  const handleLogOut = () => {
    localStorage.removeItem("token");
    user.setUser({});
    user.setIsAuth(false);
    navigate("/login");
  };

  const translateStatus = (status) => {
    const statuses = {
      Pending: t("pending", { ns: "userProfile" }),
      Completed: t("completed", { ns: "userProfile" }),
      Cancelled: t("cancelled", { ns: "userProfile" }),
    };
    return statuses[status] || t("unknown", { ns: "userProfile" });
  };

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const data = await fetchUserOrders();
        setOrders(data);
      } catch (error) {}
    };
    loadOrders();
  }, []);

  useEffect(() => {
    if (!isAuth) {
      navigate("/login");
    }
  }, [isAuth, navigate]);

  useEffect(() => {
    fetchProfile().then((data) => {
      setFirstName(data.firstName || "");
      setLastName(data.lastName || "");
      setPhone(data.phone || "");
    });
  }, []);

  const handleSave = async () => {
    try {
      await updateProfile({ firstName, lastName, phone });
      toast.success(t("updateSuccess", { ns: "userProfile" }));
    } catch (error) {
      toast.error(
        error.response?.data?.message || t("updateError", { ns: "userProfile" })
      );
    }
  };

  const handleProductClick = (product) => {
    if (!product) return;

    const deviceId =
      product.deviceId || product.device_id || product.id || product.device?.id;

    if (!deviceId) {
      console.warn("Не удалось определить deviceId для продукта", product);
      return;
    }

    setSelectedDeviceId(deviceId);
  };

  return (
    <div className={styles.shopWrapper}>
      <div className={styles.mainContent}>
        <div className={styles.buttonsContainer}>
         
            <OrderSidebar
              isSidebarOpen={isSidebarOpen}
              setSidebarOpen={setSidebarOpen}
            />
          
        </div>

        <button
          className={styles.openSidebarButton}
          onClick={() => setSidebarOpen(true)}
        >
          {t("order", { ns: "userProfile" })}
        </button>

        <h1 className={styles.ProfileTitle}>
          {t("myOrders", { ns: "userProfile" })}
        </h1>
        <div className={styles.ordersContainer}>
          {orders.length > 0 ? (
            orders.map((order) => (
              <div key={order.id} className={styles.orderGroup}>
                <div className={styles.orderHeader}>
                  <strong>
                    {t("order", { ns: "userProfile" })} №{order.id}
                  </strong>
                  <span>
                    {t("totalAmount", { ns: "userProfile" })} {order.totalPrice}{" "}
                    €
                  </span>
                  <span>{translateStatus(order.status)}</span>
                  <span>
                    {new Date(order.createdAt).toLocaleString("ru-RU", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {order.orderDetails && order.orderDetails.length > 0 ? (
                  order.orderDetails.map((product, index) => (
                    <div
                      key={index}
                      className={styles.orderCard}
                      onClick={() => handleProductClick(product)}
                      style={{ cursor: "pointer" }}
                    >
                      <img
                        src={product.image || order.deviceImage}
                        alt={product.name || "Товар"}
                        className={styles.deviceImage}
                      />
                      <div className={styles.orderDetails}>
                        <span>
                          {product.translations?.name?.[currentLang] ||
                            product.name}
                        </span>
                        <span>
                          {t("quantity", { ns: "userProfile" })}{" "}
                          {product.count || "Не указано"}
                        </span>
                        <span>
                          {t("price", { ns: "userProfile" })}{" "}
                          {product.price ? `${product.price} €` : "Не указана"}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={styles.orderCard}>
                    <img
                      src={order.deviceImage}
                      alt="Изображение заказа"
                      className={styles.deviceImage}
                    />
                    <div className={styles.orderDetails}>
                      <span>
                        {t("orderSummary", { ns: "userProfile" })}{" "}
                        {order.productName}
                      </span>
                      <span>
                        {t("orderTotalPrice", { ns: "userProfile" })}{" "}
                        {order.totalPrice} €
                      </span>
                      <span>{translateStatus(order.status)}</span>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className={styles.NoOrderTitle}>
              {t("noOrders", { ns: "userProfile" })}
            </p>
          )}
        </div>
      </div>
      {selectedDeviceId && (
        <SlideModal onClose={() => setSelectedDeviceId(null)}>
          <Suspense
            fallback={
              <div style={{ padding: 16 }}>
                {t("loading", { ns: "userProfile" }) || "Загрузка..."}
              </div>
            }
          >
            <DevicePageLazy id={selectedDeviceId} />
          </Suspense>
        </SlideModal>
      )}
    </div>
  );
};

export default UserProfile;
