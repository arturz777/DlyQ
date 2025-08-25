import React, { useState, useEffect, useContext } from "react";
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
import { Button, Form, Row, Col } from "react-bootstrap";
import { toast } from "react-toastify";
import { fetchProfile, updateProfile } from "../http/userAPI";
import { Context } from "../index";
import { fetchDeliveryCost } from "../utils/deliveryCost";
import { useTranslation } from "react-i18next";
import styles from "./PaymentForm.module.css";

const customIcon = new L.Icon({
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const MapUpdater = ({ latitude, longitude }) => {
  const map = useMap();
  useEffect(() => {
    if (latitude && longitude) {
      map.setView([latitude, longitude], 13, { animate: true });
    }
  }, [latitude, longitude, map]);
  return null;
};

const LocationPicker = ({ setFormData }) => {
  const { t } = useTranslation("paymentForm");
  useMapEvents({
    click(e) {
      setFormData((prev) => ({
        ...prev,
        latitude: e.latlng.lat,
        longitude: e.latlng.lng,
      }));
      
      fetch(` ${process.env.REACT_APP_API_URL}/geo/reverse?lat=${e.latlng.lat}&lon=${e.latlng.lng}`)
        .then((res) => res.json())
        .then((data) => {
          setFormData((prev) => ({
            ...prev,
            address:
              data.display_name ||
              t("address not found", { ns: "paymentForm" }),
          }));
        })
        .catch((err) =>
          console.error(t("address not found", { ns: "paymentForm" }), err)
        );

      toast.info(t("address selected", { ns: "paymentForm" }));
    },
  });
  return null;
};

const PaymentForm = ({
  totalPrice,
  onPaymentSuccess,
  onDeliveryCostChange,
}) => {
  const { user } = useContext(Context);
  const [loading, setLoading] = useState(false);
  const stripe = useStripe();
  const elements = useElements();
  const [deliveryCost, setDeliveryCost] = useState(0);
  const { t } = useTranslation("paymentForm");

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    apartment: "",
    comment: "",
    latitude: 59.437,
    longitude: 24.753,
  });

  useEffect(() => {
    const updateLocation = (latitude, longitude) => {
      setFormData((prev) => ({
        ...prev,
        latitude,
        longitude,
      }));

      fetch(`https://dlyq-backend-staging.onrender.com/api/geo/reverse?lat=${latitude}&lon=${longitude}`)
        .then((res) => res.json())
        .then((data) => {
          setFormData((prev) => ({
            ...prev,
            address:
              data.display_name ||
              t("address not found", { ns: "paymentForm" }),
          }));
        })
        .catch((err) =>
          console.error(t("fetching address error", { ns: "paymentForm" }), err)
        );
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          updateLocation(position.coords.latitude, position.coords.longitude);
        },
        async (error) => {
          console.warn(t("geolocation disabled", { ns: "paymentForm" }));

          try {
            const res = await fetch(
              "https://ipinfo.io/json?token=e66bf7a246010e"
            );
            const data = await res.json();
            const [lat, lon] = data.loc.split(",");

            updateLocation(parseFloat(lat), parseFloat(lon));
          } catch (err) {
            console.error(
              t("ip geolocation error", { ns: "paymentForm" }),
              err
            );
          }
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    }
  }, []);

  useEffect(() => {
    const updateDeliveryCost = async () => {
      if (!formData.latitude || !formData.longitude) return;

      const newDeliveryCost = await fetchDeliveryCost(
        totalPrice,
        formData.latitude,
        formData.longitude
      );

      setDeliveryCost(newDeliveryCost);
      if (onDeliveryCostChange) {
        onDeliveryCostChange(newDeliveryCost);
      }
    };

    updateDeliveryCost();
  }, [totalPrice, formData.latitude, formData.longitude, onDeliveryCostChange]);

  const searchAddress = async () => {
    if (!formData.address) return;

    try {
       const res = await fetch(` ${process.env.REACT_APP_API_URL}/geo/search?q=${formData.address}`);
      const data = await res.json();

      if (data.length > 0) {
        const location = data[0];
        setFormData((prev) => ({
          ...prev,
          latitude: parseFloat(location.lat),
          longitude: parseFloat(location.lon),
        }));
        toast.success(t("address found", { ns: "paymentForm" }));
      } else {
        toast.error(t("address not found", { ns: "paymentForm" }));
      }
    } catch (error) {
      toast.error(t("address search error", { ns: "paymentForm" }));
    }
  };

  const [saveData, setSaveData] = useState(true);

  useEffect(() => {
    const loadUserData = async () => {
      if (user.isAuth) {
        try {
          const profile = await fetchProfile();
          const savedData = localStorage.getItem("userFormData");
          let parsedData = savedData ? JSON.parse(savedData) : {};

          setFormData((prev) => ({
            ...prev,
            firstName: profile.firstName || "",
            lastName: profile.lastName || "",
            email: profile.email || "",
            phone: profile.phone || "",
            apartment: parsedData.apartment || prev.apartment,
            comment: parsedData.comment || prev.comment,
            address: parsedData.address || prev.address,
            latitude: parsedData.latitude || prev.latitude,
            longitude: parsedData.longitude || prev.longitude,
          }));
        } catch (error) {
          console.error("Ошибка загрузки профиля", error);
        }
      } else {
        const savedData = localStorage.getItem("userFormData");
        if (savedData) {
          try {
            const parsedData = JSON.parse(savedData);
            setFormData((prev) => ({
              ...prev,
              firstName: parsedData.firstName || prev.firstName,
              lastName: parsedData.lastName || prev.lastName,
              email: parsedData.email || prev.email,
              phone: parsedData.phone || prev.phone,
              apartment: parsedData.apartment || prev.apartment,
              comment: parsedData.comment || prev.comment,
              address: parsedData.address || prev.address,
              latitude: parsedData.latitude || prev.latitude,
              longitude: parsedData.longitude || prev.longitude,
            }));
          } catch (error) {
            console.error("Ошибка парсинга данных:", error);
          }
        }
      }
    };

    loadUserData();
  }, [user.isAuth]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updatedData = { ...prev, [name]: value };

      localStorage.setItem("userFormData", JSON.stringify(updatedData));

      return updatedData;
    });
  };

  const handleSaveDataChange = (e) => {
    setSaveData(e.target.checked);
  };

 const normalizePhone = (raw = "") => {
  let p = String(raw).replace(/\u00A0/g, " ").replace(/[^\d+]/g, "");
  if (p.startsWith("00")) p = "+" + p.slice(2);
  p = p.replace(/^\++/, "+");
  return p.trim();
};

const handleSubmit = async (event) => {
  event.preventDefault();

  const phoneNormalized = normalizePhone(formData.phone);
  if (!phoneNormalized) {
    toast.error(t("phone is required", { ns: "paymentForm" }));
    return;
  }

  setFormData(prev => ({ ...prev, phone: phoneNormalized }));

  if (!formData.firstName?.trim()) { toast.error(t("first name is required", { ns: "paymentForm" })); return; }
  if (!formData.email?.trim()) { toast.error(t("email is required", { ns: "paymentForm" })); return; }

  if (!stripe || !elements) { toast.error(t("payment initialization error", { ns: "paymentForm" })); return; }

  const card = elements.getElement(CardNumberElement);
  if (!card) { toast.error(t("card element not found", { ns: "paymentForm" })); return; }

  setLoading(true);

  try {
    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: "card",
      card
    });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    if (user.isAuth && !user.user?.phone?.trim()) {
      try {
        await updateProfile({ phone: phoneNormalized });
        const updatedProfile = await fetchProfile();
        user.setUser({
          ...user.user,
          phone: updatedProfile.phone,
          firstName: updatedProfile.firstName,
          lastName: updatedProfile.lastName,
          email: updatedProfile.email,
        });
      } catch (err) {
        console.warn("Не удалось сохранить номер телефона в профиль:", err);
        toast.error("Не удалось сохранить номер телефона в профиль");
        setLoading(false);
        return;
      }
    }

    await onPaymentSuccess(paymentMethod, { ...formData, phone: phoneNormalized });

  } catch (err) {
    console.error(err);
    toast.error(t("payment processing error", { ns: "paymentForm" }));
  } finally {
    setLoading(false);
  }
};

  return (
    <Form
      onSubmit={handleSubmit}
      className={styles.form}
      style={{ maxWidth: "600px" }}
    >
      {(!user.isAuth || (user.isAuth && !user.user?.phone?.trim())) && (
        <>
          <Row className="mb-1">
            <Col md={6}>
              <Form.Group controlId="firstName">
                <Form.Label>
                  {t("first name", { ns: "paymentForm" })}
                </Form.Label>
                <Form.Control
                  type="text"
                  placeholder={t("enter first name", { ns: "paymentForm" })}
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  disabled={user.isAuth}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group controlId="lastName">
                <Form.Label>{t("last name", { ns: "paymentForm" })}</Form.Label>
                <Form.Control
                  type="text"
                  placeholder={t("enter last name", { ns: "paymentForm" })}
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  disabled={user.isAuth}
                />
              </Form.Group>
            </Col>
          </Row>
          <Row className="mb-1">
            <Col md={6}>
              <Form.Group controlId="email">
                <Form.Label>{t("email", { ns: "paymentForm" })}</Form.Label>
                <Form.Control
                  type="email"
                  placeholder={t("enter email", { ns: "paymentForm" })}
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={user.isAuth}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group controlId="phone">
                <Form.Label>{t("phone", { ns: "paymentForm" })}</Form.Label>
                <Form.Control
                  type="text"
                  placeholder={t("enter phone", { ns: "paymentForm" })}
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  disabled={user.isAuth && !!user.user?.phone?.trim()}
                />
              </Form.Group>
            </Col>
          </Row>
        </>
      )}

      <Row className="mb-1">
        <Form.Group className="mb-1" controlId="address">
          <Form.Label>{t("address", { ns: "paymentForm" })}</Form.Label>
          <div className="d-flex">
            <Form.Control
              type="text"
              name="address"
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              placeholder={t("enter address", { ns: "paymentForm" })}
              onFocus={(e) => e.target.select()}
            />
            <Button onClick={searchAddress} variant="primary" className="ms-2">
              🔍
            </Button>
          </div>
        </Form.Group>

        <div
          style={{
            height: "300px",
            width: "100%",
            borderRadius: "10px",
            marginBottom: "20px",
          }}
        >
          <MapContainer
            center={[formData.latitude, formData.longitude]}
            zoom={13}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap"
            />
            <MapUpdater
              latitude={formData.latitude}
              longitude={formData.longitude}
            />{" "}
            <LocationPicker setFormData={setFormData} />
            <Marker
              position={[formData.latitude, formData.longitude]}
              icon={customIcon}
            />
          </MapContainer>
        </div>

        <Col md={6}>
          <Form.Group controlId="apartment">
            <Form.Label>{t("apartment", { ns: "paymentForm" })}</Form.Label>
            <Form.Control
              type="text"
              placeholder={t("enter apartment number", { ns: "paymentForm" })}
              name="apartment"
              value={formData.apartment}
              onChange={handleChange}
            />
          </Form.Group>
        </Col>

        <Col md={6}>
          <Form.Group controlId="comment">
            <Form.Label>{t("comment", { ns: "paymentForm" })}</Form.Label>
            <Form.Control
              as="textarea"
              rows={1}
              placeholder={t("add comment", { ns: "paymentForm" })}
              name="comment"
              value={formData.comment}
              onChange={handleChange}
            />
          </Form.Group>
        </Col>
      </Row>
      <Form.Group className="mb-3">
        <Form.Check
          type="checkbox"
          label={t("save address and comment", { ns: "paymentForm" })}
          checked={saveData}
          onChange={handleSaveDataChange}
        />
      </Form.Group>
      <h4 className="mb-1 text-center">
        {t("card details", { ns: "paymentForm" })}
      </h4>
      <Form.Group className="mb-3">
        <Form.Label>{t("card number", { ns: "paymentForm" })}</Form.Label>
        <div className="border rounded p-2">
          <CardNumberElement />
        </div>
      </Form.Group>
      <Row className="mb-2">
        <Col md={6}>
          <Form.Group>
            <Form.Label>{t("expiry date", { ns: "paymentForm" })}</Form.Label>
            <div className="border rounded p-2">
              <CardExpiryElement />
            </div>
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group>
            <Form.Label>{t("cvc", { ns: "paymentForm" })}</Form.Label>
            <div className="border rounded p-2">
              <CardCvcElement />
            </div>
          </Form.Group>
        </Col>
      </Row>
      <div className="text-center">
        <button
          className={styles.buttonTPrice}
          type="submit"
          disabled={loading || !stripe}
        >
          {loading
            ? t("processing", { ns: "paymentForm" })
            : `${t("pay", { ns: "paymentForm" })} ${(
                totalPrice + deliveryCost
              ).toFixed(2)} €`}
        </button>
      </div>
    </Form>
  );
};

export default PaymentForm;
