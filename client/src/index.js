//client/src/index.js
import React, { createContext} from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import UserStore from "./store/UserStore";
import DeviceStore from "./store/DeviceStore";
import BasketStore from "./store/BasketStore";

// Создаем контекст
export const Context = createContext(null);

const rootElement = document.getElementById('root');

if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  
  // Оборачиваем компонент App в Provider и передаем значение
  root.render(
    <Context.Provider value={{
      user: new UserStore(),
      device: new DeviceStore(),
      basket: new BasketStore()
    }}>
      <App />
    </Context.Provider>
  );
}
