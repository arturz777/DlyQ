import React, { useContext, useState, useMemo, useEffect, useRef } from "react";
import { Context } from "../index";
import { NavLink, useLocation } from "react-router-dom";
import { ShoppingCart, Settings, List, UserCircle, LogOut } from "lucide-react";
import { ADMIN_ROUTE } from "../utils/consts";
import { observer } from "mobx-react-lite";
import { useNavigate } from "react-router-dom";
import SearchBar from "./SearchBar";
import { io } from "socket.io-client";
import { useTranslation } from "react-i18next";
import styles from "./NavBar.module.css";

const NavBar = observer(() => {
  const [scrollDirection, setScrollDirection] = useState("up");
  const [lastScroll, setLastScroll] = useState(0);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileRef = useRef(null);
  const { user, basket } = useContext(Context);
  const [unreadChats, setUnreadChats] = useState(new Set());
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();

  const languages = [
    { code: "EE", language: "est" },
    { code: "EN", language: "en" },
    { code: "RU", language: "ru" },
  ];

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
    };

    window.addEventListener("scroll", closeMenusOnScroll, { passive: true });
    return () => window.removeEventListener("scroll", closeMenusOnScroll);
  }, []);

  useEffect(() => {
    if (!user?.user?.id) return;

    fetch(`${process.env.REACT_APP_API_URL}/chat/user/${user.user.id}`)
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
        isProfileMenuOpen &&
        profileRef.current &&
        !profileRef.current.contains(e.target)
      ) {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [isProfileMenuOpen]);

  useEffect(() => {
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

  const navMode = useMemo(() => {
  const p = location.pathname;

  // neutral (parcel)
  if (p.startsWith("/parcel")) return "neutral";
  if (p.startsWith("/main")) return "neutral";

  // food
  if (p === "/MainPage" || p.startsWith("/seller") || p.startsWith("/food")) {
    return "food-catalog";
  }

  // market default
  return "market";
}, [location.pathname]);

  return (
    <div className={`${styles.navbar} NavBar`} style={navbarStyle}>
      <div className={styles.navbarContainer}>
        <div className={styles.left}>
          <NavLink to="/" className={styles.navbarLogo}>
            DlyQ
          </NavLink>

         {navMode !== "neutral" && (
  <NavLink to={navMode === "food-catalog" ? "/food-catalog" : "/catalog"} className={styles.navItem}>
    <List size={22} />
    <span className={styles.navbarLinkTitle}>
      {navMode === "food-catalog" ? t("search", { ns: "navbar" }) : t("catalog")}
    </span>
  </NavLink>
)}

        </div>

        <div className={styles.center}>
          <SearchBar />
        </div>

        <div className={styles.right}>
          {user.isAuth && user?.user?.role?.toUpperCase() === "ADMIN" && (
            <NavLink
              to={ADMIN_ROUTE}
              className={styles.iconBtn}
              title={t("adminPanel", { ns: "navbar" })}
            >
              <Settings size={18} />
              {unreadChats.size > 0 && <span className={styles.dot} />}
            </NavLink>
          )}

          <NavLink to="/basket" className={styles.iconBtn} title={t("cart")}>
            <ShoppingCart size={18} />
            {basket.totalItems > 0 && (
              <span className={styles.badge}>{basket.totalItems}</span>
            )}
          </NavLink>

          <div ref={profileRef} className={styles.profileMenuWrapper}>
            <button
              type="button"
              className={`${styles.iconBtn} ${styles.profileMenuButton}`}
              onClick={() => setIsProfileMenuOpen((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={isProfileMenuOpen}
              title={t("profile", { ns: "navbar" })}
            >
              <UserCircle size={18} />
            </button>

            {isProfileMenuOpen && (
              <div className={styles.profileDropdownMenu} role="menu">
                <div className={styles.langRow}>
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      className={`${styles.langPill} ${
                        i18n.language === lang.language
                          ? styles.langPillActive
                          : ""
                      }`}
                      onClick={() => {
                        i18n.changeLanguage(lang.language);
                        setIsProfileMenuOpen(false);
                      }}
                    >
                      {lang.code}
                    </button>
                  ))}
                </div>

                <div className={styles.profileDropdownDivider} />

                {user.isAuth ? (
                  <>
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

                    <button
                      type="button"
                      className={styles.profileDropdownItem}
                      onClick={handleLogOut}
                      role="menuitem"
                    >
                      <LogOut size={18} />
                      <span>{t("logOut", { ns: "navbar" })}</span>
                    </button>
                  </>
                ) : (
                  <NavLink
                    to="/login"
                    className={styles.profileDropdownItem}
                    role="menuitem"
                    onClick={() => setIsProfileMenuOpen(false)}
                  >
                    <UserCircle size={18} />
                    <span>{t("profile", { ns: "navbar" })}</span>
                  </NavLink>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default NavBar;
