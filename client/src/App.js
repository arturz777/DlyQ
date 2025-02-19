//client/src/App.js
import React, { useContext, useEffect, useState } from "react";
import { BrowserRouter } from "react-router-dom";
import AppRouter from "./components/AppRouter";
import NavBar from "./components/NavBar";
import { observer } from "mobx-react-lite";
import { Context } from "./index";
import { check } from "./http/userAPI";
import { Spinner } from "react-bootstrap";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Elements } from "@stripe/react-stripe-js";  // Импортируем Elements
import { loadStripe } from "@stripe/stripe-js";
import MobileNavBar from "./components/MobileNavBar";
import OrderSidebar from "./components/OrderSidebar";
import Footer from "./components/Footer";
import CookieConsent from "./components/modals/CookieConsent";
import './locales/i18n';
import "./App.css"; 


const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);

const App = observer(() => {
  const { user } = useContext(Context);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token"); // Проверка наличия токена
    if (!token) {
      setLoading(false);
      user.setUser({}); // Устанавливаем, что пользователь не авторизован
      user.setIsAuth(false); // Обновляем состояние авторизации
      return; // Выходим из useEffect, если токен отсутствует
    }

    check() // Проверяем авторизацию с использованием токена
      .then((data) => {
        user.setUser(data);
        user.setIsAuth(true);
      })
      .catch((error) => {
        console.error("Ошибка при проверке авторизации:", error.message);
        user.setUser(false);
        user.setIsAuth(false);
      })
      .finally(() => setLoading(false)); // Завершаем загрузку
  }, [user]);

  if (loading) {
    return <Spinner animation={"grow"} />; // Показать спиннер, пока идет проверка авторизации
  }

  return (
    <BrowserRouter>
     <Elements stripe={stripePromise}>
      <NavBar />
      <AppRouter />
      <ToastContainer position="top-right" autoClose={3000} />
      <OrderSidebar />
      </Elements>
      <MobileNavBar />
      <CookieConsent />
      <Footer />
    </BrowserRouter>
  );
});

export default App;
