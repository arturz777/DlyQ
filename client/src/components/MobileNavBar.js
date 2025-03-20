import React, { useContext } from "react";
import { Context } from "../index";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "bootstrap-icons/font/bootstrap-icons.css"; // Подключение Bootstrap Icons

const MobileNavBar = () => {
  const navigate = useNavigate();
  const { user } = useContext(Context);
   const { t, i18n } = useTranslation();

  return (
    <div className="MobileNavBar d-md-none fixed-bottom bg-light border-top">
      <div className="d-flex justify-content-around py-2">
        <div
          className="text-center"
          onClick={() => navigate("/")}
          style={{ cursor: "pointer" }}
        >
          <i className="bi bi-house" style={{ fontSize: "1.5rem" }}></i>
          <div style={{ fontSize: "0.75rem" }}>{t("home", { ns: "mobileNavBar" })}</div>
        </div>
        <div
          className="text-center"
          onClick={() => navigate("/catalog")}
          style={{ cursor: "pointer" }}
        >
          <i className="bi bi-search" style={{ fontSize: "1.5rem" }}></i>
          <div style={{ fontSize: "0.75rem" }}>{t("search", { ns: "mobileNavBar" })}</div>
        </div>
        <div
          className="text-center"
          onClick={() => navigate("/basket")}
          style={{ cursor: "pointer" }}
        >
          <i className="bi bi-bag" style={{ fontSize: "1.5rem" }}></i>
          <div style={{ fontSize: "0.75rem" }}>{t("cart", { ns: "mobileNavBar" })}</div>
        </div>
        {user.isAuth ? (
          <div
            className="text-center"
            onClick={() => navigate("/profile")}
            style={{ cursor: "pointer" }}
          >
            <i className="bi bi-person" style={{ fontSize: "1.5rem" }}></i>
            <div style={{ fontSize: "0.75rem" }}>{t("profile", { ns: "mobileNavBar" })}</div>
          </div>
        ) : (
          <div
            className="text-center"
            onClick={() => navigate("/login")}
            style={{ cursor: "pointer" }}
          >
            <i className="bi bi-person" style={{ fontSize: "1.5rem" }}></i>
            <div style={{ fontSize: "0.75rem" }}>{t("profile", { ns: "mobileNavBar" })}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileNavBar;
