import React, { useContext } from "react";
import { Context } from "../index";
import { useNavigate } from "react-router-dom";
import "bootstrap-icons/font/bootstrap-icons.css"; // Подключение Bootstrap Icons

const MobileNavBar = () => {
  const navigate = useNavigate();
  const { user } = useContext(Context);

  return (
    <div className="MobileNavBar d-md-none fixed-bottom bg-light border-top">
      <div className="d-flex justify-content-around py-2">
        <div
          className="text-center"
          onClick={() => navigate("/")}
          style={{ cursor: "pointer" }}
        >
          <i className="bi bi-house" style={{ fontSize: "1.5rem" }}></i>
          <div style={{ fontSize: "0.75rem" }}>Главная</div>
        </div>
        <div
          className="text-center"
          onClick={() => navigate("/catalog")}
          style={{ cursor: "pointer" }}
        >
          <i className="bi bi-search" style={{ fontSize: "1.5rem" }}></i>
          <div style={{ fontSize: "0.75rem" }}>Поиск</div>
        </div>
        <div
          className="text-center"
          onClick={() => navigate("/basket")}
          style={{ cursor: "pointer" }}
        >
          <i className="bi bi-bag" style={{ fontSize: "1.5rem" }}></i>
          <div style={{ fontSize: "0.75rem" }}>Корзина</div>
        </div>
        {user.isAuth ? (
          <div
            className="text-center"
            onClick={() => navigate("/profile")}
            style={{ cursor: "pointer" }}
          >
            <i className="bi bi-person" style={{ fontSize: "1.5rem" }}></i>
            <div style={{ fontSize: "0.75rem" }}>Профиль</div>
          </div>
        ) : (
          <div
            className="text-center"
            onClick={() => navigate("/login")}
            style={{ cursor: "pointer" }}
          >
            <i className="bi bi-person" style={{ fontSize: "1.5rem" }}></i>
            <div style={{ fontSize: "0.75rem" }}>Профиль</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileNavBar;
