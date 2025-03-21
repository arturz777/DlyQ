import React, { useContext, useState, useEffect } from "react";
import { Context } from "../index";
import { NavLink, useLocation } from "react-router-dom";
import {
  ADMIN_ROUTE,
  LOGIN_ROUTE,
  SHOP_ROUTE,
  REGISTRATION_ROUTE,
} from "../utils/consts";
import { observer } from "mobx-react-lite";
import { useNavigate } from "react-router-dom";
import SearchBar from "./SearchBar"; // Импортируем SearchBar
import styles from "./NavBar.module.css";
import Flag from "react-world-flags";
import {
  FaShoppingCart,
  FaCog,
  FaListAlt,
  FaUser,
  FaSignOutAlt,
} from "react-icons/fa"; // Для иконок
import { useTranslation } from "react-i18next";

const NavBar = observer(() => {
  const [scrollDirection, setScrollDirection] = useState("up");
  const [lastScroll, setLastScroll] = useState(0);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const { user, basket } = useContext(Context);
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();

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

  const handleLogOut = () => {
    logOut(); // Выход пользователя
    navigate("/login"); // Возврат на главную страницу
  };

  useEffect(() => {
    const handleScroll = () => {
      const currentScroll = window.pageYOffset;
      if (currentScroll > lastScroll) {
        setScrollDirection("down");
      } else {
        setScrollDirection("up");
      }
      setLastScroll(currentScroll);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScroll]);

  const navbarStyle = {
    position: "fixed",
    top: scrollDirection === "up" ? "0" : "-150px", // Скрыть при прокрутке вниз
    width: "100%",
    transition: "top 0.3s",
    zIndex: 1000,
  };

  const logOut = () => {
    localStorage.removeItem("token"); // Удаляем токен из локального хранилища
    user.setUser({}); // Сбрасываем пользователя
    user.setIsAuth(false); // Устанавливаем, что пользователь не авторизован
  };

  return (
    <div className={`${styles.navbar} NavBar`} style={navbarStyle}>
      <div className={styles.navbarContainer}>
        <NavLink to="/" className={styles.navbarLogo}>
          Zang
        </NavLink>

        {/* Иконка "Каталог" */}
        <NavLink to="/catalog" className={styles.navbarLink}>
          <FaListAlt />
          <span className={styles.navbarLinkTitle}>{t("catalog")}</span>
        </NavLink>

        {/* Поиск */}
        <SearchBar />

        <div
          className={styles.languageSelectorWrapper}
          onMouseLeave={() => setIsLanguageMenuOpen(false)} // Закрыть меню при уходе курсора
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
        {user.isAuth && user?.user?.role === "ADMIN" && (
          <div
            className={styles.navbarLink}
            onClick={() => navigate(ADMIN_ROUTE)}
          >
            <FaCog />
            <span className={styles.navbarLinkTitle}>
              {t("adminPanel", { ns: "navbar" })}
            </span>
          </div>
        )}
        <div className={styles.navbarLink} onClick={() => navigate("/basket")}>
          <FaShoppingCart />
          <span className={styles.navbarLinkTitle}>
            {t("cart")} ({basket.totalItems})
          </span>
        </div>
        {/* Авторизация */}
        {user.isAuth ? (
          location.pathname === "/profile" ? (
            <div className={styles.navbarLink} onClick={handleLogOut}>
              <FaSignOutAlt />
              <span className={styles.navbarLinkTitle}>{t("logOut")}</span>
            </div>
          ) : (
            <div
              className={styles.navbarLink}
              onClick={() => navigate("/profile")}
            >
              <FaUser />
              <span className={styles.navbarLinkTitle}>{t("profile")}</span>
            </div>
          )
        ) : (
          <div className={styles.navbarLink} onClick={() => navigate("/login")}>
            <FaUser />
            <span className={styles.navbarLinkTitle}>{t("profile")}</span>
          </div>
        )}
      </div>
    </div>
  );
});

export default NavBar;
