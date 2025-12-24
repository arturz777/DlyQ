import React, { lazy, Suspense, useContext, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { authRoutes, publicRoutes } from "../routes";
import { SHOP_ROUTE, ADMIN_ROUTE } from "../utils/consts";
import { Context } from "../index";
import { observer } from "mobx-react-lite";
import Maintenance from "../pages/Maintenance";
import appStore from "../store/appStore";
import LoadingBar from "./LoadingBar";
import SellerAdminPage from "../pages/SellerAdminPage";
import MainPage from "../pages/MainPage";
import SellerPage from "../pages/SellerPage";
import ParcelPage from "../pages/ParcelPage";
import FoodCatalogPage from "../pages/FoodCatalogPage";

const Basket = lazy(() => import("../pages/Basket"));
const CatalogPage = lazy(() => import("../pages/CatalogPage"));
const UserProfile = lazy(() => import("../pages/UserProfile"));
const ProfileSettings = lazy(() => import("../pages/ProfileSettings"));
const Admin = lazy(() => import("../pages/Admin"));
const Courier = lazy(() => import("../pages/Courier"));
const Warehouse = lazy(() => import("../pages/Warehouse"));

const ALLOWED_DURING_MAINTENANCE = ["/maintenance", "/login", "/catalog"];

const AppRouter = () => {
  const { user } = useContext(Context);
  const location = useLocation();

  const role = String(user.user?.role || "").toUpperCase();
  const isSeller = user.isAuth && role === "SELLER";
  const isAdmin = user.isAuth && role === "ADMIN";

  if (!isAdmin && appStore.maintenance.enabled === null) {
    return null;
  }

  useEffect(() => {
    if (appStore.maintenance.enabled && !isAdmin) return;
    appStore.startLoading();
    const timer = setTimeout(() => {
      appStore.stopLoading();
    }, 500);
    return () => clearTimeout(timer);
  }, [location.pathname, isAdmin]);

  const allowedNow = ALLOWED_DURING_MAINTENANCE.some((p) =>
    location.pathname.startsWith(p)
  );

  const suspenseFallback =
    appStore.maintenance.enabled && !isAdmin ? null : <LoadingBar />;

  if (appStore.maintenance.enabled && !isAdmin && !allowedNow) {
    return (
      <Suspense fallback={suspenseFallback}>
        <Routes>
          <Route path="/maintenance" element={<Maintenance />} />
          <Route path="*" element={<Navigate to="/maintenance" replace />} />
        </Routes>
      </Suspense>
    );
  }

  if (
    location.pathname === ADMIN_ROUTE &&
    (!user.isAuth || role !== "ADMIN") &&
    !isSeller
  ) {
    return <Navigate to={SHOP_ROUTE} replace />;
  }

  if (isSeller) {
    const sellerAllowedPrefixes = ["/seller-admin/", "/maintenance"];

    const isAllowedForSeller = sellerAllowedPrefixes.some((p) =>
      location.pathname.startsWith(p)
    );

    if (!isAllowedForSeller) {
      return (
        <div style={{ padding: 24, marginTop: 80 }}>
          <h2>Нету доступа</h2>
        </div>
      );
    }
  }

  return (
    <Suspense fallback={suspenseFallback}>
      <Routes>
        {user.isAuth &&
          authRoutes.map(({ path, Component }) => (
            <Route key={path} path={path} element={<Component />} exact />
          ))}

        <Route path={ADMIN_ROUTE} element={<Admin />} />
        <Route path="/seller-admin/:sellerId" element={<SellerAdminPage />} />
        <Route path="/courier" element={<Courier />} />
        <Route path="/warehouse" element={<Warehouse />} />
        <Route path="/main" element={<MainPage />} />
        <Route path="/seller/:idOrSlug" element={<SellerPage />} />

        <Route path="/profile" element={<UserProfile />} />
        <Route path="/settings" element={<ProfileSettings />} />
        <Route path="/maintenance" element={<Maintenance />} />

        {publicRoutes.map(({ path, Component }) => (
          <Route key={path} path={path} element={<Component />} exact />
        ))}

        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/food-catalog" element={<FoodCatalogPage />} />
        <Route path="/basket" element={<Basket />} />
        <Route path="/parcel" element={<ParcelPage />} />

        <Route path="*" element={<Navigate to={SHOP_ROUTE} />} />
      </Routes>
    </Suspense>
  );
};

export default observer(AppRouter);
