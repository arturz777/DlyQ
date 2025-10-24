import React, { createContext} from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ConfirmProvider } from "./components/modals/ConfirmProvider";
import { GoogleOAuthProvider } from "@react-oauth/google";
import UserStore from "./store/UserStore";
import DeviceStore from "./store/DeviceStore";
import BasketStore from "./store/BasketStore";

export const Context = createContext(null);

const rootElement = document.getElementById('root');

if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  
   root.render(
    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID}>
      <Context.Provider value={{
        user: new UserStore(),
        device: new DeviceStore(),
        basket: new BasketStore()
      }}>
       <ConfirmProvider>
        <App />
        </ConfirmProvider>
      </Context.Provider>
    </GoogleOAuthProvider>
  );

    if ("serviceWorker" in navigator) {
    if (process.env.NODE_ENV === "production") {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((r) => console.log("SW registered:", r.scope))
          .catch(console.error);
      });
    } else {
      navigator.serviceWorker.getRegistrations?.().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
      if (window.caches?.keys) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
      }
    }
  }
}
