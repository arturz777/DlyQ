import React, { useContext, useState, useEffect, useRef } from "react";
import { Context } from "../index";
import { NavLink, useLocation } from "react-router-dom";
import { ShoppingCart, Settings, List, UserCircle, LogOut } from "lucide-react";
import { ADMIN_ROUTE } from "../utils/consts";
import { observer } from "mobx-react-lite";
import { useNavigate } from "react-router-dom";
import SearchBar from "./SearchBar";
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

const helpLinks = [
  { to: "/terms-of-service", tKey: "userAgreement" },
  { to: "/privacy-policy", tKey: "privacyPolicy" },
  { to: "/return-policy", tKey: "warrantyReturns" },
  { to: "/courier-policy", tKey: "aboutCouriers" },
  { to: "/shipping-policy", tKey: "delivery" },
  { to: "/cookie-policy", tKey: "cookie" },
];

const NavBar = observer(() => {
  const [scrollDirection, setScrollDirection] = useState("up");
  const [lastScroll, setLastScroll] = useState(0);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileRef = useRef(null);
  const { user, basket } = useContext(Context);
  const [unreadChats, setUnreadChats] = useState(new Set());
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const langRef = useRef(null);

  const languages = [
    { code: "EE", language: "est" },
    { code: "GB", language: "en" },
    { code: "RU", language: "ru" },
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
    setIsProfileMenuOpen(false);
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
    const closeMenusOnScroll = () => {
      setIsProfileMenuOpen(false);
      setIsLanguageMenuOpen(false);
    };

    window.addEventListener("scroll", closeMenusOnScroll, { passive: true });
    return () => window.removeEventListener("scroll", closeMenusOnScroll);
  }, []);

  useEffect(() => {
    if (!user?.user?.id) return;

    fetch(`${process.env.REACT_APP_API_URL}api/chat/user/${user.user.id}`)
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
    const socket = io(`${process.env.REACT_APP_API_URL}`);

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

  useEffect(() => {
    const onDocClick = (e) => {
      if (
        isLanguageMenuOpen &&
        langRef.current &&
        !langRef.current.contains(e.target)
      ) {
        setIsLanguageMenuOpen(false);
      }

      if (
        isProfileMenuOpen &&
        profileRef.current &&
        !profileRef.current.contains(e.target)
      ) {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [isLanguageMenuOpen, isProfileMenuOpen]);

  useEffect(() => {
    setIsLanguageMenuOpen(false);
    setIsProfileMenuOpen(false);
  }, [location.pathname]);

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
          DlyQ
        </NavLink>

        <NavLink to="/catalog" className={styles.navbarLink}>
          <List size={22} />
          <span className={styles.navbarLinkTitle}>{t("catalog")}</span>
        </NavLink>

        <SearchBar />

        <div
          ref={langRef}
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
        {user.isAuth && user?.user?.role?.toUpperCase() === "ADMIN" && (
          <NavLink
            to={ADMIN_ROUTE}
            className={styles.navbarLink}
            style={{ position: "relative" }}
          >
            <Settings size={22} />
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
          </NavLink>
        )}
        <NavLink to="/basket" className={styles.navbarLink}>
          <ShoppingCart />
          <span className={styles.navbarLinkTitle}>
            {t("cart")} ({basket.totalItems})
          </span>
        </NavLink>
        {user.isAuth ? (
          <div ref={profileRef} className={styles.profileMenuWrapper}>
            <button
              type="button"
              className={`${styles.navbarLink} ${styles.profileMenuButton}`}
              onClick={() => {
                setIsProfileMenuOpen((prev) => !prev);
                setIsLanguageMenuOpen(false);
              }}
              aria-haspopup="menu"
              aria-expanded={isProfileMenuOpen}
            >
              <UserCircle size={22} />
              <span className={styles.navbarLinkTitle}>
                {t("profile", { ns: "navbar" })}
              </span>
            </button>

            {isProfileMenuOpen && (
              <div className={styles.profileDropdownMenu} role="menu">
                <NavLink
                  to="/profile"
                  className={styles.profileDropdownItem}
                  role="menuitem"
                  onClick={() => setIsProfileMenuOpen(false)}
                >
                  <List size={18} />
                  <span>{t("myOrders", { ns: "navbar" })}</span>
                </NavLink>

                <NavLink
                  to="/settings"
                  className={styles.profileDropdownItem}
                  role="menuitem"
                  onClick={() => setIsProfileMenuOpen(false)}
                >
                  <Settings size={18} />
                  <span>{t("settings", { ns: "navbar" })}</span>
                </NavLink>

                <div className={styles.profileDropdownDivider} />

                <div className={styles.profileDropdownSectionTitle}>
                  {t("documents", { ns: "navbar" })}
                </div>

                {helpLinks.map((l) => (
                  <NavLink
                    key={l.to}
                    to={l.to}
                    className={styles.profileDropdownItem}
                    role="menuitem"
                    onClick={() => setIsProfileMenuOpen(false)}
                  >
                    <span className={styles.profileDocDot}>•</span>
                    <span>{t(l.tKey, { ns: "navbar" })}</span>
                  </NavLink>
                ))}

                <div className={styles.profileDropdownDivider} />

                <div className={styles.profileDropdownSectionTitle}>
                  {t("contacts", { ns: "navbar" })}
                </div>

                <div className={styles.profileContactsBlock}>
                  <div>
                    {t("workingHours", { ns: "navbar" })}:{" "}
                    {t("workingHoursValue", { ns: "navbar" })}
                  </div>
                  <div>{t("companyLine", { ns: "navbar" })}</div>
                </div>

                <div className={styles.profileDropdownDivider} />

                <button
                  type="button"
                  className={styles.profileDropdownItem}
                  onClick={handleLogOut}
                  role="menuitem"
                >
                  <LogOut size={18} />
                  <span>{t("logOut", { ns: "navbar" })}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <NavLink to="/login" className={styles.navbarLink}>
            <UserCircle size={22} />
            <span className={styles.navbarLinkTitle}>
              {t("profile", { ns: "navbar" })}
            </span>
          </NavLink>
        )}
      </div>
    </div>
  );
});

export default NavBar;
