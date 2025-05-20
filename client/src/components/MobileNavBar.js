import React, { useContext, useEffect  } from "react";
import { Context } from "../index";
import { useNavigate, useLocation  } from "react-router-dom";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import "bootstrap-icons/font/bootstrap-icons.css";

const MobileNavBar = () => {
  const navigate = useNavigate();
  const { user, basket } = useContext(Context);
  const location = useLocation();
  const { t, i18n } = useTranslation();

  useEffect(() => {
    window.scrollTo(0, 0); 
  }, [location.pathname]);

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
  className="text-center position-relative"
  onClick={() => navigate("/basket")}
  style={{ cursor: "pointer" }}
>
  <i className="bi bi-bag" style={{ fontSize: "1.5rem", position: "relative" }}></i>
  
  {basket.totalItems > 0 && (
    <span
      style={{
        position: "absolute",
        top: "0px",
        right: "-6px",
        backgroundColor: "#dc3545",
        color: "white",
        borderRadius: "50%",
        fontSize: "10px",
        padding: "2px 5px",
        lineHeight: "1",
      }}
    >
      {basket.totalItems}
    </span>
  )}

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

export default observer(MobileNavBar);
