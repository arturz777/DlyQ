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
import SearchBar from "./SearchBar";
import {
  FaShoppingCart,
  FaCog,
  FaListAlt,
  FaUser,
  FaSignOutAlt,
} from "react-icons/fa";
import { io } from "socket.io-client";
import { useTranslation } from "react-i18next";
import ruFlag from "../assets/flags/ru.png";
import enFlag from "../assets/flags/en.png";
import estFlag from "../assets/flags/est.png";
import styles from "./NavBar.module.css";

const flags = {
  ru: ruFlag,
  en: enFlag,
  est: estFlag,
};

const NavBar = observer(() => {
  const [scrollDirection, setScrollDirection] = useState("up");
  const [lastScroll, setLastScroll] = useState(0);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const { user, basket } = useContext(Context);
  const [unreadChats, setUnreadChats] = useState(new Set());
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();

  const languages = [
    { code: "GB", language: "en" },
    { code: "RU", language: "ru" },
    { code: "EE", language: "est" },
  ];

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    setIsLanguageMenuOpen(false);
  };

  const currentLanguage = i18n.language;
  const currentFlag = languages.find(
    (lang) => lang.language === currentLanguage
  );

  const handleLogOut = () => {
    logOut();
    navigate("/login");
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

  useEffect(() => {
    if (!user?.user?.id) return;

    fetch(`https://zang-4.onrender.com/api/chat/user/${user.user.id}`)
      .then((res) => res.json())
      .then((data) => {
        const unread = new Set();
        data.forEach((chat) => {
          const hasUnread = chat.messages?.some(
            (msg) => !msg.isRead && msg.senderId !== user.user.id
          );
          if (hasUnread) unread.add(chat.id);
        });

        setUnreadChats(unread);
      })
      .catch(console.error);
  }, [user?.user?.id]);

  useEffect(() => {
    const socket = io("https://zang-4.onrender.com", {
  withCredentials: true,
  transports: ["websocket", "polling"]
});


    if (user?.user?.role === "ADMIN" || user?.user?.role === "admin") {
      socket.emit("joinAdminNotifications");

      socket.on("newChatMessage", (msg) => {
        setUnreadChats((prev) => {
          const updated = new Set(prev);
          updated.add(msg.chatId);
          return updated;
        });
      });

      socket.on("readMessages", ({ chatId, userId: readerId }) => {
        if (readerId === user.user.id) {
          setUnreadChats((prev) => {
            const updated = new Set(prev);
            updated.delete(chatId);
            return updated;
          });
        }
      });
    }

    return () => {
      socket.disconnect();
    };
  }, [user]);

  const navbarStyle = {
    position: "fixed",
    top: scrollDirection === "up" ? "0" : "-150px",
    width: "100%",
    transition: "top 0.3s",
    zIndex: 1000,
  };

  const logOut = () => {
    localStorage.removeItem("token");
    user.setUser({});
    user.setIsAuth(false);
  };

  return (
    <div className={`${styles.navbar} NavBar`} style={navbarStyle}>
      <div className={styles.navbarContainer}>
        <NavLink to="/" className={styles.navbarLogo}>
          Zang
        </NavLink>

        <NavLink to="/catalog" className={styles.navbarLink}>
          <FaListAlt />
          <span className={styles.navbarLinkTitle}>{t("catalog")}</span>
        </NavLink>

        <SearchBar />

        <div
          className={styles.languageSelectorWrapper}
          onMouseLeave={() => setIsLanguageMenuOpen(false)}
        >
          <button
            onClick={() => setIsLanguageMenuOpen(!isLanguageMenuOpen)}
            className={styles.currentLanguageButton}
          >
            <img
              src={flags[currentFlag?.language] || flags["en"]}
              alt={currentFlag?.language}
              className={styles.flag}
            />
          </button>
          {isLanguageMenuOpen && (
            <div className={styles.dropdownMenu}>
              {languages.map((lang) => (
                <button
                  key={lang.language}
                  onClick={() => changeLanguage(lang.language)}
                  className={styles.dropdownItem}
                >
                  <img
                    src={require(`../assets/flags/${lang.language}.png`)}
                    alt={lang.language}
                    className={styles.flag}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
        {user.isAuth && user?.user?.role === "ADMIN" && (
          <div
            className={styles.navbarLink}
            onClick={() => navigate(ADMIN_ROUTE)}
            style={{ position: "relative" }}
          >
            <FaCog />
            {unreadChats.size > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  color: "red",
                  fontSize: "1.4rem",
                  lineHeight: 1,
                }}
              >
                ●
              </span>
            )}
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
