import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Context } from "../index";
import { useNavigate, useLocation, NavLink } from "react-router-dom";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import {
  Home,
  Search,
  ShoppingCart,
  User,
  List,
  Settings,
  LogOut,
} from "lucide-react";
import styles from "./MobileNavBar.module.css";

const helpLinks = [
  { to: "/terms-of-service", tKey: "userAgreement" },
  { to: "/return-policy", tKey: "warrantyReturns" },
  { to: "/privacy-policy", tKey: "privacyPolicy" },
  { to: "/courier-policy", tKey: "aboutCouriers" },
  { to: "/shipping-policy", tKey: "delivery" },
  { to: "/cookie-policy", tKey: "cookie" },
];

const MobileNavBar = () => {
  const navigate = useNavigate();
  const { user, basket } = useContext(Context);
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileSheetRef = useRef(null);

  const languages = [
    { code: "ET", language: "est" },
    { code: "EN", language: "en" },
    { code: "RU", language: "ru" },
  ];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    setIsProfileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const closeOnScroll = () => {
      setIsProfileOpen(false);
    };
    window.addEventListener("scroll", closeOnScroll, { passive: true });
    return () => window.removeEventListener("scroll", closeOnScroll);
  }, []);

  const isParcel = useMemo(() => {
    const p = location.pathname;
    return p.startsWith("/parcel") || p.startsWith("/main");
  }, [location.pathname]);

  const isFoodContext = useMemo(() => {
    const p = location.pathname;
    return (
      p === "/main" || p.startsWith("/seller") || p.startsWith("/food-catalog")
    );
  }, [location.pathname]);

  const searchTo = isFoodContext ? "/food-catalog" : "/catalog";

  const tabs = useMemo(
    () => [
      {
        key: "home",
        to: "/",
        label: t("home", { ns: "mobileNavBar" }),
        icon: Home,
      },
      {
        key: "catalog",
        to: searchTo,
        label: t("search", { ns: "mobileNavBar" }),
        icon: Search,
        disabled: isParcel,
      },
      {
        key: "basket",
        to: "/basket",
        label: t("cart", { ns: "mobileNavBar" }),
        icon: ShoppingCart,
        badge: basket.totalItems,
      },
      {
        key: "profile",
        to: user.isAuth ? "/profile" : "/login",
        label: t("profile", { ns: "mobileNavBar" }),
        icon: User,
      },
    ],
    [t, searchTo, isParcel, basket.totalItems, user.isAuth],
  );

  const isActive = (to) =>
    location.pathname === to ||
    (to !== "/" && location.pathname.startsWith(to));

  const logOut = () => {
    localStorage.removeItem("token");
    user.setUser({});
    user.setIsAuth(false);
  };

  const handleMobileLogOut = () => {
    logOut();
    setIsProfileOpen(false);
    navigate("/login");
  };

  const handleProfileClick = () => {
    if (!user.isAuth) {
      navigate("/login");
      return;
    }
    setIsProfileOpen((prev) => !prev);
  };

  const handleNavClick = (key, to) => {
    if (key === "profile") {
      handleProfileClick();
      return;
    }
    setIsProfileOpen(false);
    navigate(to);
  };

  const profileOverlayNode =
    isProfileOpen && user.isAuth
      ? createPortal(
          <div
            className={styles.profileOverlay}
            onClick={() => setIsProfileOpen(false)}
          >
            <div
              className={styles.profileSheet}
              role="menu"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.sheetHandle} />

              <button
                type="button"
                className={`${styles.profileItem} ${styles.profileItemCompact}`}
                onClick={() => {
                  setIsProfileOpen(false);
                  navigate("/profile");
                }}
                role="menuitem"
              >
                <List size={18} />
                <span>{t("myOrders", { ns: "navbar" })}</span>
              </button>

              <button
                type="button"
                className={styles.profileItem}
                onClick={() => {
                  setIsProfileOpen(false);
                  navigate("/settings");
                }}
                role="menuitem"
              >
                <Settings size={18} />
                <span>{t("settings", { ns: "navbar" })}</span>
              </button>

              <div className={styles.profileDivider} />

              <div className={styles.langRow}>
                {languages.map((lang) => (
                  <button
                    key={lang.language}
                    type="button"
                    className={`${styles.langPill} ${
                      i18n.language === lang.language
                        ? styles.langPillActive
                        : ""
                    }`}
                    onClick={() => {
                      i18n.changeLanguage(lang.language);
                      setIsProfileOpen(false);
                    }}
                  >
                    {lang.code}
                  </button>
                ))}
              </div>

              <div className={styles.profileSectionTitle}>
                {t("documents", { ns: "navbar" })}
              </div>

              <div className={styles.profileDocsGrid}>
                {helpLinks.map((l) => (
                  <NavLink
                    key={l.to}
                    to={l.to}
                    className={styles.profileDocChip}
                    onClick={() => setIsProfileOpen(false)}
                    role="menuitem"
                  >
                    {t(l.tKey, { ns: "navbar" })}
                  </NavLink>
                ))}
              </div>

              <div className={styles.profileDivider} />

              <div className={styles.profileDivider} />

              <button
                type="button"
                className={`${styles.profileItem} ${styles.profileLogout}`}
                onClick={handleMobileLogOut}
                role="menuitem"
              >
                <LogOut size={18} />
                <span>{t("logOut", { ns: "navbar" })}</span>
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {profileOverlayNode}
      <nav className={styles.mobileNavBar} aria-label="Bottom navigation">
        <div className={styles.dock}>
          <div className={styles.navItems}>
            {tabs.map(({ key, to, label, icon: Icon, badge, disabled }) => {
              const active =
                key === "profile"
                  ? isProfileOpen || isActive("/profile")
                  : isActive(to);

              return (
                <button
                  key={key}
                  type="button"
                  disabled={!!disabled}
                  className={`${styles.navBtn} ${active ? styles.navBtnActive : ""} ${
                    disabled ? styles.navBtnDisabled : ""
                  }`}
                  onClick={() => {
                    if (disabled) return;
                    handleNavClick(key, to);
                  }}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  aria-disabled={disabled ? "true" : undefined}
                >
                  <Icon className={styles.icon} />
                  {badge > 0 && key === "basket" && (
                    <span className={styles.cartBadge}>{badge}</span>
                  )}
                  <span className={styles.navText}>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
};

export default observer(MobileNavBar);
