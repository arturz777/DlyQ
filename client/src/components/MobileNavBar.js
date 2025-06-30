import React, { useContext, useEffect } from "react";
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
  const { t, i18n } = useTranslation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className={styles.mobileNavBar}>
      <div className={styles.navItems}>
        <div className={styles.navItem} onClick={() => navigate("/")}>
          <Home size={24} />
          <div className={styles.navText}>
            {t("home", { ns: "mobileNavBar" })}
          </div>
        </div>

        <div className={styles.navItem} onClick={() => navigate("/catalog")}>
          <Search size={24} />
          <div className={styles.navText}>
            {t("search", { ns: "mobileNavBar" })}
          </div>
        </div>

        <div
          className={`${styles.navItem} ${styles.cart}`}
          onClick={() => navigate("/basket")}
        >
          <ShoppingCart size={24} />

          {basket.totalItems > 0 && (
            <span className={styles.cartBadge}>{basket.totalItems}</span>
          )}
          <div className={styles.navText}>
            {t("cart", { ns: "mobileNavBar" })}
          </div>
        </div>

        <div
          className={styles.navItem}
          onClick={() => navigate(user.isAuth ? "/profile" : "/login")}
        >
          <User size={24} />
          <div className={styles.navText}>
            {t("profile", { ns: "mobileNavBar" })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default observer(MobileNavBar);
