import React, { useContext, useEffect, useState, lazy, Suspense } from "react";
import { Context } from "../index";
import { fetchUserOrders } from "../http/orderAPI";
import { updateProfile, fetchProfile } from "../http/userAPI";
import OrderSidebar from "../components/OrderSidebar";
import SlideModal from "../components/modals/SlideModal";
import DishModal from "../components/DishModal";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import styles from "./UserProfile.module.css";

const DevicePageLazy = lazy(() => import("../pages/DevicePage"));

const API_BASE = process.env.REACT_APP_API_URL;

const getMenuImgSrc = (img) => {
  if (!img) return null;
  if (/^https?:\/\//i.test(img)) return img;
  if (img.startsWith("/")) return `${API_BASE}${img}`;
  return `${API_BASE}/${img}`;
};

const normUiLang = (l) => {
  const short = String(l || "ru")
    .toLowerCase()
    .split("-")[0];
  if (short === "et") return "est";
  return short;
};

const pickTr = (base, map, lang) => {
  if (!map || typeof map !== "object") return base;
  const v = map[lang];
  return typeof v === "string" && v.trim() ? v : base;
};

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
  const currentLang = normUiLang(i18n.language);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [selectedDish, setSelectedDish] = useState(null);

  const uiLocale = i18n.language?.toLowerCase().startsWith("ru")
    ? "ru-RU"
    : i18n.language?.toLowerCase().startsWith("en")
    ? "en-GB"
    : i18n.language?.toLowerCase() === "est" ||
      i18n.language?.toLowerCase().startsWith("et")
    ? "et-EE"
    : "en-GB";

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

  const handleProductClick = (product) => {
    if (!product) return;

    if (product.isRestaurantItem || product.menuItemId) {
      setSelectedDish(product);
      return;
    }

    const deviceId =
      product.deviceId || product.device_id || product.id || product.device?.id;

    if (!deviceId) return;

    setSelectedDeviceId(deviceId);
  };

  return (
    <div className={styles.shopWrapper}>
      <div className={styles.mainContent}>
        <div className={styles.buttonsContainer}></div>

        <button
          className={styles.openSidebarButton}
          onClick={() => window.dispatchEvent(new Event("openOrderSidebar"))}
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
                    {new Date(order.createdAt).toLocaleString(uiLocale, {
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
                        alt={
                          pickTr(
                            product.name,
                            product.translations?.name,
                            currentLang
                          ) || t("product", { ns: "userProfile" })
                        }
                        className={styles.deviceImage}
                      />
                      <div className={styles.orderDetails}>
                        <span>
                          {pickTr(
                            product.name,
                            product.translations?.name,
                            currentLang
                          )}
                        </span>
                        <span>
                          {t("quantity", { ns: "userProfile" })}{" "}
                          {product.count ||
                            t("not specified", { ns: "userProfile" })}
                        </span>
                        <span>
                          {t("price", { ns: "userProfile" })}{" "}
                          {product.price
                            ? `${product.price} €`
                            : t("not specified", { ns: "userProfile" })}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={styles.orderCard}>
                    <img
                      src={order.deviceImage}
                      alt={t("order image", { ns: "userProfile" })}
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
                {t("loading", { ns: "userProfile" })}
              </div>
            }
          >
            <DevicePageLazy id={selectedDeviceId} />
          </Suspense>
        </SlideModal>
      )}
      {selectedDish && (
        <SlideModal
          title={pickTr(
            selectedDish.name,
            selectedDish.translations?.name,
            currentLang
          )}
          onClose={() => setSelectedDish(null)}
        >
          <DishModal
            item={{
              ...selectedDish,
              img: selectedDish.image || selectedDish.img || null,

              name: pickTr(
                selectedDish.name,
                selectedDish.translations?.name,
                currentLang
              ),
              description: pickTr(
                selectedDish.description || "",
                selectedDish.translations?.description,
                currentLang
              ),
            }}
            getImgSrc={getMenuImgSrc}
          />
        </SlideModal>
      )}
    </div>
  );
};

export default UserProfile;
