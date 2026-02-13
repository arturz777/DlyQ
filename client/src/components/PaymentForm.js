import React, { useState, useEffect, useContext, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  useStripe,
  useElements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
} from "@stripe/react-stripe-js";
import { useConfirm } from "./modals/ConfirmProvider";
import { Button, Form, Row, Col, Modal } from "react-bootstrap";
import { toast } from "react-toastify";
import { geoSearch, geoReverse } from "../http/geoAPI";
import {
  fetchPaymentMethods,
  detachPaymentMethod,
  createPaymentIntent,
  createSetupIntent,
  setDefaultPaymentMethod,
} from "../http/paymentsAPI";
import { Context } from "../index";
import { fetchDeliveryCost } from "../http/orderAPI";
import LoadingButton from "../components/LoadingButton";
import LoadingIconButton from "../components/LoadingIconButton";
import { useTranslation } from "react-i18next";
import styles from "./PaymentForm.module.css";

const customIcon = new L.Icon({
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const RAW_BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL) ||
  process.env.PUBLIC_URL ||
  "";

const BASE_URL = RAW_BASE_URL.endsWith("/") ? RAW_BASE_URL : RAW_BASE_URL + "/";

const CARD_LOGOS_FILES = {
  visa: "visa.svg",
  mastercard: "mastercard.svg",
  amex: "amex.svg",
  discover: "discover.svg",
  jcb: "jcb.svg",
  unionpay: "unionpay.svg",
  diners: "diners.svg",
  _default: "generic.svg",
};

import React, { useState, useEffect, useContext, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  useStripe,
  useElements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
} from "@stripe/react-stripe-js";
import { useConfirm } from "./modals/ConfirmProvider";
import { Button, Form, Row, Col, Modal } from "react-bootstrap";
import { toast } from "react-toastify";
import { geoSearch, geoReverse } from "../http/geoAPI";
import {
  fetchPaymentMethods,
  detachPaymentMethod,
  createPaymentIntent,
  createSetupIntent,
  setDefaultPaymentMethod,
} from "../http/paymentsAPI";
import { Context } from "../index";
import { fetchDeliveryCost } from "../http/orderAPI";
import LoadingButton from "../components/LoadingButton";
import LoadingIconButton from "../components/LoadingIconButton";
import { useTranslation } from "react-i18next";
import styles from "./PaymentForm.module.css";


