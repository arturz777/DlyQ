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
import ChatModal from "./components/modals/ChatModal";
import { ChatContext } from "./context/ChatContext";
import './locales/i18n';
import "./App.css"; 

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);

const App = observer(() => {
  const { user } = useContext(Context);
  const [loading, setLoading] = useState(true);
  const [supportChatVisible, setSupportChatVisible] = useState(false);
  const [supportChatId, setSupportChatId] = useState(1); 

  const fetchSupportChat = async (userId) => {
  const res = await fetch(`https://dlyq-backend-staging.onrender.com/api/chat/support-chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  return await res.json();
};

const openSupportChat = () => {
  setSupportChatId(null); 
  setSupportChatVisible(true);
};

  const closeSupportChat = () => setSupportChatVisible(false);

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
    if (data) {
      user.setUser(data);
      user.setIsAuth(true);
    } else {
      user.setUser({});
      user.setIsAuth(false);
    }
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
    <ChatContext.Provider value={{
      supportChatVisible,
      supportChatId,
      openSupportChat,
      closeSupportChat
    }}>
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
      <ChatModal />
      <Footer />
     </BrowserRouter>
     </ChatContext.Provider>
  );
});

export default App;
