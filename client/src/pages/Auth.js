import React, { useContext, useState } from "react";
import { Col, Container, Form } from "react-bootstrap";
import Card from "react-bootstrap/Card";
import Button from "react-bootstrap/Button";
import Row from "react-bootstrap/Row";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { LOGIN_ROUTE, REGISTRATION_ROUTE, SHOP_ROUTE } from "../utils/consts";
import { login, registration } from "../http/userAPI";
import { observer } from "mobx-react-lite";
import { Context } from "../index";
import styles from "./Auth.module.css";

const Auth = observer(() => {
  const { user } = useContext(Context);
  const location = useLocation();
  const navigate = useNavigate();
  const isLogin = location.pathname === LOGIN_ROUTE;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [agreed, setAgreed] = useState(false);

  const click = async () => {
    try {
      let data;
      if (isLogin) {
        data = await login(email, password);
      } else {
        data = await registration(email, password, firstName, lastName, phone);
      }
      user.setUser(user);
      user.setIsAuth(true);
      navigate(SHOP_ROUTE);
    } catch (e) {
      alert(e.response.data.message);
    }
  };

  return (
    <div className={styles.authWrapper}>
      <div className={styles.authContainer}>
        <h2 className={styles.authTitle}>{isLogin ? "Авторизация" : "Регистрация"}</h2>
        <form className={styles.authForm}>
          <input
            className={styles.inputField}
            placeholder="Введите вашу эл. почту"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className={styles.inputField}
            placeholder="Введите ваш пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
          />
          {!isLogin && (
            <>
              <input
                className={styles.inputField}
                placeholder="Введите ваше имя"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
              <input
                className={styles.inputField}
                placeholder="Введите вашу фамилию"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
              <input
                className={styles.inputField}
                placeholder="Введите ваш телефон"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </>
          )}
          <div className={styles.authSwitch}>
            {isLogin ? (
              <span>
                Нет аккаунта?{" "}
                <NavLink to={REGISTRATION_ROUTE}>Регистрация</NavLink>
              </span>
            ) : (
              <span>
                Уже есть аккаунт? <NavLink to={LOGIN_ROUTE}>Войти</NavLink>
              </span>
            )}
          </div>
          {/* Чекбокс согласия */}
          {!isLogin && (
  <div className={styles.checkboxContainer}>
    <input
      type="checkbox"
      id="policyCheckbox"
      checked={agreed}
      onChange={() => setAgreed(!agreed)}
    />
    <label htmlFor="policyCheckbox">
      <span>
        Я ознакомился(-ась) и согласен(-на) с{" "}
        <a href="/terms-of-purchase" target="_blank">Условиями покупки в интернет-магазине</a>
        <a href="/privacy-policy" target="_blank">Политикой конфиденциальности</a>{" "}
        <a href="/site-rules" target="_blank">Правилами пользования веб-сайтом</a>
      </span>
    </label>
  </div>
)}




          <button
          type="button"
            className={styles.authButton}
            onClick={click}
            disabled={!agreed && !isLogin}
          >
            {isLogin ? "Войти" : "Регистрация"}
          </button>
        </form>
      </div>
    </div>
  );
});

export default Auth;
