import React, { useContext, useEffect, useState } from "react";
import { BrowserRouter } from "react-router-dom";
import AppRouter from "./components/AppRouter";
import NavBar from "./components/NavBar";
import { observer } from "mobx-react-lite";
import { Context } from "./index";
import { check } from "./http/userAPI";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Elements } from "@stripe/react-stripe-js"; 
import { loadStripe } from "@stripe/stripe-js";
import MobileNavBar from "./components/MobileNavBar";
import OrderSidebar from "./components/OrderSidebar";
import Footer from "./components/Footer";
import appStore from "./store/appStore";
import CookieConsent from "./components/modals/CookieConsent";
import LoadingBar from "./components/LoadingBar";
import './locales/i18n';
import "./App.css"; 


const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);

const App = observer(() => {
  const { user } = useContext(Context);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token"); 

    appStore.setIsLoading(true);

    if (!token) {
      setLoading(false);
      appStore.setIsLoading(false);
      user.setUser({}); 
      user.setIsAuth(false); 
      return; 
    }

    check() 
      .then((data) => {
        user.setUser(data);
        user.setIsAuth(true);
      })
      .catch((error) => {
        console.error("Ошибка при проверке авторизации:", error.message);
        user.setUser(false);
        user.setIsAuth(false);
      })
      .finally(() => {
        setLoading(false);
        appStore.setIsLoading(false); 
      });
  }, [user]);

  if (loading) {
    return <LoadingBar />;
  }
  
  return (
    <BrowserRouter>
     <Elements stripe={stripePromise}>
     <LoadingBar />
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
