//client/src/routes.js
import Admin from "./pages/Admin";
import { ADMIN_ROUTE, BASKET_ROUTE, DEVICE_ROUTE, LOGIN_ROUTE, REGISTRATION_ROUTE, SHOP_ROUTE, TERMS_ROUTE, PRIVACY_ROUTE, RETURN_ROUTE, SHIPPING_ROUTE, COOKIE_ROUTE } from "./utils/consts";
import Basket from "./pages/Basket";
import Shop from "./pages/Shop";
import HomePage from "./pages/HomePage";
import Auth from "./pages/Auth";
import DevicePage from "./pages/DevicePage";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import ReturnPolicy from "./pages/ReturnPolicy";
import DeliveryPolicy from "./pages/DeliveryPolicy";
import CookiePolicy from "./pages/CookiePolicy";
import CourierPolicy from "./pages/CourierPolicy";

export const authRoutes = [
    {
        path: ADMIN_ROUTE,
        Component: Admin
    },
    {
        path: BASKET_ROUTE,
        Component: Basket
    },
]

export const publicRoutes = [
    {
        path: "/",
        Component: HomePage
    },
    {
        path: SHOP_ROUTE,
        Component: Shop
    },
    {
        path: LOGIN_ROUTE,
        Component: Auth
    },
    {
        path: REGISTRATION_ROUTE,
        Component: Auth
    },
    {
        path: DEVICE_ROUTE + '/:id',
        Component: DevicePage
    },

    {
        path: TERMS_ROUTE,
        Component: TermsOfService
    },

    {
        path: PRIVACY_ROUTE,
        Component: PrivacyPolicy
    },

    {
        path: RETURN_ROUTE,
        Component: ReturnPolicy
    },

    {
        path: SHIPPING_ROUTE,
        Component: DeliveryPolicy
    },

    {
        path: COOKIE_ROUTE,
        Component: CookiePolicy
    }

    {
        path: "/courier-policy",
        Component: CourierPolicy,
      }

]
