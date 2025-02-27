import React, { useContext, useEffect, useState } from "react";
import { Context } from "../index";
import { fetchUserOrders } from "../http/orderAPI";
import { updateProfile, fetchProfile } from "../http/userAPI";
import styles from "./UserProfile.module.css";
import { FaCog, FaSignOutAlt } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import Flag from "react-world-flags";
import { useTranslation } from "react-i18next";
import axios from "axios";

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

  const handleBack = () => {
    navigate(-1); // Вернуться на предыдущую страницу
  };

  const languages = [
    { code: "GB", language: "en" },
    { code: "RU", language: "ru" },
    { code: "EE", language: "est" },
  ];

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng); // Смена языка
    setIsLanguageMenuOpen(false);
  };

  const currentLanguage = i18n.language; // Текущий язык
  const currentFlag = languages.find(
    (lang) => lang.language === currentLanguage
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token"); // Убедитесь, что токен есть
      const response = await axios.put(
        "http://localhost:5000/api/user/profile",
        { firstName, lastName, phone },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      alert("Профиль обновлен");
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
      Pending: "В ожидании",
      Completed: "Завершено",
      Cancelled: "Отменено",
    };
    return statuses[status] || "Неизвестно";
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
      navigate("/login"); // Перенаправляем на страницу авторизации
    }
  }, [isAuth, navigate]);

  useEffect(() => {
    // Загружаем данные профиля
    fetchProfile().then((data) => {
      setFirstName(data.firstName || "");
      setLastName(data.lastName || "");
      setPhone(data.phone || "");
    });
  }, []);

  const handleSave = async () => {
    try {
      await updateProfile({ firstName, lastName, phone });
      toast.success("Данные успешно обновлены!");
    } catch (error) {
      toast.error(error.response?.data?.message || "Ошибка обновления данных");
    }
  };

  return (
    <div className={styles.shopWrapper}>
      <div className={styles.mainContent}>
        <div className={styles.buttonsContainer}>
          <button className={styles.backButton} onClick={() => navigate(-1)}>
            ← Назад
          </button>

          <div
            className={styles.languageSelectorWrapper}
            onMouseLeave={() => setIsLanguageMenuOpen(false)}
          >
            <button
              onClick={() => setIsLanguageMenuOpen(!isLanguageMenuOpen)}
              className={styles.currentLanguageButton}
            >
              <Flag code={currentFlag?.code} className={styles.flag} />
            </button>
            {isLanguageMenuOpen && (
              <div className={styles.dropdownMenu}>
                {languages.map((lang) => (
                  <button
                    key={lang.language}
                    onClick={() => changeLanguage(lang.language)}
                    className={styles.dropdownItem}
                  >
                    <Flag code={lang.code} className={styles.flag} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div
            className={styles.settingsButton}
            onClick={() => navigate("/settings")}
          >
            <FaCog size={20} />
          </div>

          <div className={styles.profileButtonLogOut} onClick={handleLogOut}>
            <FaSignOutAlt size={20} />
            <span className={styles.navbarLinkTitle}>Выйти</span>
          </div>
        </div>

        <h1 className={styles.ProfileTitle}>Мои заказы</h1>
        <div className={styles.ordersContainer}>
          {orders.length > 0 ? (
            orders.map((order) => (
              <div key={order.id} className={styles.orderGroup}>
                {/* Заголовок заказа */}
                <div className={styles.orderHeader}>
                  <strong>Заказ №{order.id}</strong>
                  <span>Общая сумма: {order.totalPrice} €</span>
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

                {/* Товары из заказа */}
                {order.orderDetails && order.orderDetails.length > 0 ? (
                  order.orderDetails.map((product, index) => (
                    <div key={index} className={styles.orderCard}>
                      <img
                        src={product.image || order.deviceImage}
                        alt={product.name || "Товар"}
                        className={styles.deviceImage}
                      />
                      <div className={styles.orderDetails}>
                        <span>{product.name || "Неизвестный товар"}</span>
                        <span>Кол-во: {product.count || "Не указано"}</span>
                        <span>
                          Цена:{" "}
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
                      <span>Общий заказ: {order.productName}</span>
                      <span>Сумма: {order.totalPrice} €</span>
                      <span>{translateStatus(order.status)}</span>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className={styles.NoOrderTitle}>У вас пока нет заказов.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
