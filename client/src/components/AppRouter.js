import React, { lazy, Suspense, useContext, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { authRoutes, publicRoutes } from "../routes";
import { SHOP_ROUTE, ADMIN_ROUTE } from "../utils/consts";
import { Context } from "../index";
import appStore from "../store/appStore";
import LoadingBar from "./LoadingBar";

const Basket = lazy(() => import("../pages/Basket"));
const CatalogPage = lazy(() => import("../pages/CatalogPage"));
const UserProfile = lazy(() => import("../pages/UserProfile"));
const ProfileSettings = lazy(() => import("../pages/ProfileSettings"));
const Admin = lazy(() => import("../pages/Admin"));
const Courier = lazy(() => import("../pages/Courier"));
const Warehouse = lazy(() => import("../pages/Warehouse"));

const AppRouter = () => {
  const { user } = useContext(Context);

  const location = useLocation();

  useEffect(() => {
    appStore.startLoading();

    const timer = setTimeout(() => {
      appStore.stopLoading(); 
    }, 500);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  if (location.pathname === ADMIN_ROUTE && (!user.isAuth || user.user?.role !== "ADMIN")) {
    return <Navigate to={SHOP_ROUTE} replace />;
  }

  return (
    <Suspense fallback={<LoadingBar />}>
    <Routes>
      {user.isAuth &&
        authRoutes.map(({ path, Component }) => (
          <Route key={path} path={path} element={<Component />} exact />
        ))}

         <Route path={ADMIN_ROUTE} element={<Admin />} />
         <Route path="/courier" element={<Courier />} />
         <Route path="/warehouse" element={<Warehouse />} />

      <Route path="/profile" element={<UserProfile />} />
      <Route path="/settings" element={<ProfileSettings />} />

      {publicRoutes.map(({ path, Component }) => (
        <Route key={path} path={path} element={<Component />} exact />
      ))}

      <Route path="/catalog" element={<CatalogPage />} />
      <Route path="/basket" element={<Basket />} />

      <Route path="*" element={<Navigate to={SHOP_ROUTE} />} />
    </Routes>
     </Suspense>
  );
};

export default AppRouter;
