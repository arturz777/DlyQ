import React, { useContext, useEffect, useState } from "react";
import { BrowserRouter, useLocation } from "react-router-dom";
import AppRouter from "./components/AppRouter";
import NavBar from "./components/NavBar";
import { observer } from "mobx-react-lite";
import { Context } from "./index";
import { check } from "./http/userAPI";
import { fetchMaintenance } from "./http/configAPI";
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
import ChatFab from "./components/ChatFab";
import ChatNotifier from "./components//ChatNotifier";
import "./locales/i18n";
import "./App.css";

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);

const AppLayout = observer(() => {
  const location = useLocation();
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const open = () => setSidebarOpen(true);
    const close = () => setSidebarOpen(false);

    window.addEventListener("openOrderSidebar", open);
    window.addEventListener("closeOrderSidebar", close);

    return () => {
      window.removeEventListener("openOrderSidebar", open);
      window.removeEventListener("closeOrderSidebar", close);
    };
  }, []);

  function useMediaQuery(query) {
    const getMatch = () =>
      typeof window !== "undefined" ? window.matchMedia(query).matches : false;

    const [matches, setMatches] = React.useState(getMatch);

    React.useEffect(() => {
      const mql = window.matchMedia(query);
      const onChange = () => setMatches(mql.matches);

      if (mql.addEventListener) mql.addEventListener("change", onChange);
      else mql.addListener(onChange);

      setMatches(mql.matches);

      return () => {
        if (mql.removeEventListener)
          mql.removeEventListener("change", onChange);
        else mql.removeListener(onChange);
      };
    }, [query]);

    return matches;
  }

  const hideLayout =
    location.pathname.startsWith("/seller-admin/") ||
    location.pathname === "/courier" ||
    location.pathname === "/warehouse";

  const isCatalog = location.pathname.startsWith("/catalog");
  const isDesktop = useMediaQuery("(min-width: 769px)");
  const hideDesktopNavBar = hideLayout || (isCatalog && !isDesktop);

  return (
    <>
      {appStore.isLoading && <LoadingBar />}

      <Elements stripe={stripePromise}>
        {!hideDesktopNavBar && <NavBar />}
        <AppRouter />
        {!hideLayout && (
          <OrderSidebar
            isSidebarOpen={isSidebarOpen}
            setSidebarOpen={setSidebarOpen}
          />
        )}
      </Elements>

      {!hideLayout && (
        <>
          <MobileNavBar maintenanceMode={appStore.maintenance.enabled} />
          <CookieConsent />
          <ChatNotifier />
          <ChatFab />
          <ChatModal />
          <Footer maintenanceMode={appStore.maintenance.enabled} />
        </>
      )}

      <ToastContainer
        position="top-right"
        autoClose={3000}
        newestOnTop
        limit={3}
        pauseOnFocusLoss
        theme="colored"
        style={{ zIndex: 2147483647 }}
      />
    </>
  );
});

const App = observer(() => {
  const { user } = useContext(Context);
  const [loading, setLoading] = useState(true);
  const [supportChatVisible, setSupportChatVisible] = useState(false);
  const [supportChatId, setSupportChatId] = useState(1);
  const [chatVisible, setChatVisible] = useState(false);
  const [chatId, setChatId] = useState(null);
  const [chatMode, setChatMode] = useState(null);
  const [unreadSupportMsgCount, setUnreadSupportMsgCount] = useState(0);

  const openChat = (id, mode) => {
    setChatId(id);
    setChatMode(mode);
    setChatVisible(true);
  };

  const closeChat = () => {
    setChatVisible(false);
    setChatId(null);
    setChatMode(null);
  };

  const openSupportChat = () => {
  setChatId(null);
  setChatMode("support");
  setChatVisible(true);
};

  const isAdmin =
    user.isAuth && (user.user?.role === "ADMIN" || user.user?.role === "admin");
  const maintenanceKnown = appStore.isMaintenanceKnown;
  const maintenanceActive =
    maintenanceKnown && appStore.maintenance.enabled && !isAdmin;

  const fetchSupportChat = async (userId) => {
    const res = await fetch(
      `${process.env.REACT_APP_API_URL}/chat/support-chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      }
    );
    return await res.json();
  };

  const closeSupportChat = () => setSupportChatVisible(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    appStore.setIsLoading(true);

    fetchMaintenance()
      .then((v) => appStore.setMaintenance(v))
      .catch(() => {
        appStore.setMaintenance({ enabled: false });
      });

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
    <ChatContext.Provider
      value={{
        chatVisible,
        chatId,
        chatMode,
        openChat,
        closeChat,
        supportChatVisible: chatVisible,
        supportChatId: chatId,
        openSupportChat,
        closeSupportChat: closeChat,
        unreadSupportMsgCount,
        setUnreadSupportMsgCount,
      }}
    >
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </ChatContext.Provider>
  );
});

export default App;
