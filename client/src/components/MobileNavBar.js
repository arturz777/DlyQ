import React, { useContext, useEffect, useMemo } from "react";
import { Context } from "../index";
import { useNavigate, useLocation } from "react-router-dom";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { Home, Search, ShoppingCart, User } from "lucide-react";
import styles from "./MobileNavBar.module.css";

const MobileNavBar = () => {
  const navigate = useNavigate();
  const { user, basket } = useContext(Context);
  const location = useLocation();
  const { t } = useTranslation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const tabs = useMemo(() => ([
    { key: "home",    to: "/",                label: t("home",    { ns: "mobileNavBar" }),    icon: Home },
    { key: "catalog", to: "/catalog",         label: t("search",  { ns: "mobileNavBar" }),    icon: Search },
    { key: "basket",  to: "/basket",          label: t("cart",    { ns: "mobileNavBar" }),    icon: ShoppingCart, badge: basket.totalItems },
    { key: "profile", to: user.isAuth ? "/profile" : "/login",
                       label: t("profile", { ns: "mobileNavBar" }), icon: User },
  ]), [t, basket.totalItems, user.isAuth]);

  const isActive = (to) =>
    location.pathname === to || (to !== "/" && location.pathname.startsWith(to));

  return (
    <nav className={styles.mobileNavBar} aria-label="Bottom navigation">
      <div className={styles.dock}>
        <div className={styles.navItems}>
          {tabs.map(({ key, to, label, icon: Icon, badge }) => {
            const active = isActive(to);
            return (
              <button
                key={key}
                type="button"
                className={`${styles.navBtn} ${active ? styles.navBtnActive : ""}`}
                onClick={() => navigate(to)}
                aria-label={label}
                aria-current={active ? "page" : undefined}
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
  );
};

export default observer(MobileNavBar);

