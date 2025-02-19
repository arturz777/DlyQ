import React, { useContext } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { authRoutes, publicRoutes } from "../routes";
import { SHOP_ROUTE, ADMIN_ROUTE } from "../utils/consts";
import { Context } from "../index";
import Basket from "../pages/Basket";
import CatalogPage from "../pages/CatalogPage";
import UserProfile from "../pages/UserProfile";
import ProfileSettings from "../pages/ProfileSettings";
import Admin from "../pages/Admin";
import Courier from "../pages/Courier";
import Warehouse from "../pages/Warehouse"

const AppRouter = () => {
  const { user } = useContext(Context);

  const location = useLocation();

  // Если обычный пользователь попал в админку → выкидываем его
  if (location.pathname === ADMIN_ROUTE && (!user.isAuth || user.user?.role !== "ADMIN")) {
    return <Navigate to={SHOP_ROUTE} replace />;
  }

  return (
    <Routes>
      {/* Routers для авторизованных пользователей */}
      {user.isAuth &&
        authRoutes.map(({ path, Component }) => (
          <Route key={path} path={path} element={<Component />} exact />
        ))}

         {/* ✅ Защищаем маршрут админ-панели */}
         <Route path={ADMIN_ROUTE} element={<Admin />} />
         <Route path="/courier" element={<Courier />} />
         <Route path="/warehouse" element={<Warehouse />} />

      <Route path="/profile" element={<UserProfile />} />
      <Route path="/settings" element={<ProfileSettings />} />

      {/* Публичные маршруты */}
      {publicRoutes.map(({ path, Component }) => (
        <Route key={path} path={path} element={<Component />} exact />
      ))}

      <Route path="/catalog" element={<CatalogPage />} />
      <Route path="/basket" element={<Basket />} />

      <Route path="*" element={<Navigate to={SHOP_ROUTE} />} />
    </Routes>
  );
};

export default AppRouter;
