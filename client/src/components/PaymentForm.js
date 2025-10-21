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
      
       fetch(
        `${process.env.REACT_APP_API_URL}geo/reverse?lat=${e.latlng.lat}&lon=${e.latlng.lng}`
      )
         .then((res) => res.json())
        .then((data) => {
          setFormData((prev) => ({
            ...prev,
            address:
              data.short_display_name ||
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
  preorder,
}) => {
  const { user } = useContext(Context);
  const [loading, setLoading] = useState(false);
  const stripe = useStripe();
  const elements = useElements();
  const [deliveryCost, setDeliveryCost] = useState(0);
  const { t } = useTranslation("paymentForm");
  const [suggestions, setSuggestions] = useState([]);
  const [addrFetchTimer, setAddrFetchTimer] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  const applyPlace = (place) => {
    const short = place.short_display_name || place.display_name;
    const lat = parseFloat(place.lat);
    const lon = parseFloat(place.lon);
    setFormData((prev) => ({
      ...prev,
      address: short || prev.address,
      latitude: isFinite(lat) ? lat : prev.latitude,
      longitude: isFinite(lon) ? lon : prev.longitude,
    }));
    toast.success(t("address found", { ns: "paymentForm" }));
  };

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    apartment: "",
    floor: "",
    entrance: "",
    comment: "",
    latitude: 59.437,
    longitude: 24.753,
  });

  useEffect(() => {
    const q = (formData.address || "").trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }

      const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `${
            process.env.REACT_APP_API_URL
          }/geo/search?q=${encodeURIComponent(q)}`
        );
        const data = await res.json();
        setSuggestions(Array.isArray(data) ? data.slice(0, 5) : []);
      } catch {
        setSuggestions([]);
      }
    }, 250);

      return () => clearTimeout(timer);
  }, [formData.address]);

   useEffect(() => {
    const updateLocation = (latitude, longitude) => {
      setFormData((prev) => ({
        ...prev,
        latitude,
        longitude,
      }));

      fetch(
        `${process.env.REACT_APP_API_URL}geo/reverse?lat=${latitude}&lon=${longitude}`
      )
        .then((res) => res.json())
        .then((data) => {
          setFormData((prev) => ({
            ...prev,
            address:
              data.short_display_name || data.display_name || prev.address,
          }));
        })
        .catch((err) =>
          console.error(t("fetching address error", { ns: "paymentForm" }), err)
        );
    };

    try {
      const saved = JSON.parse(localStorage.getItem("userFormData") || "null");
      if (saved && (saved.address || (saved.latitude && saved.longitude)))
        return;
    } catch {}

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          updateLocation(position.coords.latitude, position.coords.longitude);
        },
        async (error) => {
          console.warn(t("geolocation disabled", { ns: "paymentForm" }));

        try {
            const res = await fetch(
              `https://ipinfo.io/json?token=${process.env.REACT_APP_IPINFO_TOKEN}`
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
    const q = (formData.address || "").trim();
    if (!q) return;

    try {
      const res = await fetch(
        `${process.env.REACT_APP_API_URL}geo/search?q=${encodeURIComponent(
          formData.address
        )}`
      );
      if (!res.ok) throw new Error("search failed");
      const data = await res.json();

      if (Array.isArray(data) && data.length > 0) {
        const place = data[0];
        const short = place.short_display_name || place.display_name || q;

        setFormData((prev) => ({
          ...prev,
          address: short, // подставляем сокращённый адрес
          latitude: parseFloat(place.lat) || prev.latitude,
          longitude: parseFloat(place.lon) || prev.longitude,
        }));

        toast.success(t("address found", { ns: "paymentForm" }));
      } else {
        toast.error(t("address not found", { ns: "paymentForm" }));
      }
    } catch (error) {
      console.error("Address search error:", error);
      toast.error(t("address search error", { ns: "paymentForm" }));
    }
  };

  useEffect(() => {
    const loadUserData = async () => {
      try {
        let parsedData = {};
        const saved = localStorage.getItem("userFormData");
        if (saved) parsedData = JSON.parse(saved);

        if (user.isAuth) {
          const profile = await fetchProfile();
          setFormData((prev) => ({
            ...prev,
            firstName: profile.firstName || "",
            lastName: profile.lastName || "",
            email: profile.email || "",
            phone: profile.phone || "",
            apartment:
              parsedData.apartment != null
                ? String(parsedData.apartment)
                : prev.apartment,
            floor:
              parsedData.floor != null ? String(parsedData.floor) : prev.floor,
            entrance:
              parsedData.entrance != null
                ? String(parsedData.entrance)
                : prev.entrance,
            comment:
              parsedData.comment != null
                ? String(parsedData.comment)
                : prev.comment,
            address: parsedData.address ?? prev.address,
            latitude: parsedData.latitude ?? prev.latitude,
            longitude: parsedData.longitude ?? prev.longitude,
          }));
        } else {
          setFormData((prev) => ({
            ...prev,
            firstName: parsedData.firstName ?? prev.firstName,
            lastName: parsedData.lastName ?? prev.lastName,
            email: parsedData.email ?? prev.email,
            phone: parsedData.phone ?? prev.phone,
            apartment:
              parsedData.apartment != null
                ? String(parsedData.apartment)
                : prev.apartment,
            floor:
              parsedData.floor != null ? String(parsedData.floor) : prev.floor,
            entrance:
              parsedData.entrance != null
                ? String(parsedData.entrance)
                : prev.entrance,
            comment:
              parsedData.comment != null
                ? String(parsedData.comment)
                : prev.comment,
            address: parsedData.address ?? prev.address,
            latitude: parsedData.latitude ?? prev.latitude,
            longitude: parsedData.longitude ?? prev.longitude,
          }));
        }
      } catch (e) {
        console.error("Ошибка загрузки/парсинга userFormData", e);
      } finally {
        setHydrated(true);
      }
    };

    loadUserData();
  }, [user.isAuth]);

 useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        "userFormData",
        JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          apartment: String(formData.apartment ?? ""),
          floor: String(formData.floor ?? ""),
          entrance: String(formData.entrance ?? ""),
          comment: String(formData.comment ?? ""),
          latitude: formData.latitude,
          longitude: formData.longitude,
        })
      );
    } catch (e) {
      console.warn("Не удалось сохранить форму", e);
    }
  }, [formData, hydrated]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

const normalizePhone = (raw = "") => {
    let p = String(raw)
      .replace(/\u00A0/g, " ")
      .replace(/[^\d+]/g, "");
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

    setFormData((prev) => ({ ...prev, phone: phoneNormalized }));

    if (!formData.firstName?.trim()) {
      toast.error(t("first name is required", { ns: "paymentForm" }));
      return;
    }

    if (!formData.email?.trim()) {
      toast.error(t("email is required", { ns: "paymentForm" }));
      return;
    }

    if (!stripe || !elements) {
      toast.error(t("payment initialization error", { ns: "paymentForm" }));
      return;
    }

    const card = elements.getElement(CardNumberElement);

    if (!card) {
      toast.error(t("card element not found", { ns: "paymentForm" }));
      return;
    }

    setLoading(true);

    try {
      const amountCents = Math.round((totalPrice + deliveryCost) * 100);

      const piRes = await fetch(
        `${process.env.REACT_APP_API_URL}payments/create-intent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: amountCents,
            currency: "eur",
            receipt_email: formData.email,
            metadata: {
              phone: phoneNormalized,
            },
          }),
        }
      );

      if (!piRes.ok) {
        toast.error(t("payment initialization error", { ns: "paymentForm" }));
        setLoading(false);
        return;
      }

      const { clientSecret } = await piRes.json();

      const { error, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card,
            billing_details: {
              name: `${formData.firstName || ""} ${
                formData.lastName || ""
              }`.trim(),
              email: formData.email,
              phone: phoneNormalized,
            },
          },
        }
      );

      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }

      if (paymentIntent?.status !== "succeeded") {
        toast.error(`Статус платежа: ${paymentIntent?.status || "unknown"}`);
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

      await onPaymentSuccess(
        { paymentIntentId: paymentIntent.id },
        { ...formData, phone: phoneNormalized }
      );
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
          <div className="d-flex position-relative">
            <Form.Control
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder={t("enter address", { ns: "paymentForm" })}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  searchAddress();
                }
                if (e.key === "Escape") {
                  setSuggestions([]);
                }
              }}
              onBlur={() => setTimeout(() => setSuggestions([]), 100)}
              autoComplete="off"
            />

            <Button
              type="button"
              onClick={searchAddress}
              variant="primary"
              className="ms-2"
            >
              🔍
            </Button>

            {suggestions.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  zIndex: 1000,
                  background: "#fff",
                  border: "1px solid #ddd",
                  borderRadius: 6,
                  marginTop: 4,
                  boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
                  maxHeight: 220,
                  overflowY: "auto",
                }}
              >
                {suggestions.map((s, i) => (
                  <div
                    key={i}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      applyPlace(s);
                      setSuggestions([]);
                    }}
                    style={{
                      padding: "10px 12px",
                      cursor: "pointer",
                      borderBottom: "1px solid #f3f3f3",
                    }}
                  >
                    {s.short_display_name || s.display_name}
                  </div>
                ))}
              </div>
            )}
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

        <Col md={6} className="mb-2">
          <Form.Group controlId="apartment">
            <Form.Control
              type="text"
              name="apartment"
              placeholder={t("enter apartment number", { ns: "paymentForm" })}
              value={formData.apartment}
              onChange={handleChange}
            />
          </Form.Group>
        </Col>

        <Col md={6} className="mb-2">
          <Form.Control
            type="text"
            name="floor"
            placeholder={t("enter floor", { ns: "paymentForm" })}
            value={formData.floor}
            onChange={handleChange}
          />
        </Col>

        <Col md={6} className="mb-2">
          <Form.Control
            type="text"
            name="entrance"
            placeholder={t("enter entrance", { ns: "paymentForm" })}
            value={formData.entrance}
            onChange={handleChange}
          />
        </Col>

        <Col md={6}>
          <Form.Group controlId="comment">
            <Form.Control
              as="textarea"
              rows={1}
              name="comment"
              placeholder={t("add comment", { ns: "paymentForm" })}
              value={formData.comment}
              onChange={handleChange}
            />
          </Form.Group>
        </Col>
      </Row>

      {preorder &&
        (preorder.hasOnlyStockItems || preorder.hasOnlyPreorders) &&
        !preorder.hasMixedItems && (
          <Form.Group className={styles.preorderSection}>
            {(preorder.isPreorder || preorder.hasOnlyPreorders) && (
              <div className={styles.preorderNote}>
                {t("order processed as preorder", { ns: "basket" })}
              </div>
            )}

            <Form.Check
              type="checkbox"
              label={t("place a pre-order", { ns: "basket" })}
              checked={preorder.isPreorder}
              onChange={() => preorder.setIsPreorder(!preorder.isPreorder)}
              className={styles.preorderCheckbox}
              disabled={preorder.disablePreorderCheckbox}
            />

            {preorder.isPreorder && (
              <>
                <Form.Label>
                  {t("desired delivery datetime", { ns: "basket" })}
                </Form.Label>
                <Form.Control
                  type="datetime-local"
                  value={preorder.deliveryDate || ""}
                  onChange={(e) => preorder.setDeliveryDate(e.target.value)}
                  className={styles.dateInput}
                  required
                />
                <Form.Label>
                  {t("preferred delivery time comment", { ns: "basket" })}
                </Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={preorder.preferredTime}
                  onChange={(e) => preorder.setPreferredTime(e.target.value)}
                  className={styles.commentInput}
                  required
                />
              </>
            )}
          </Form.Group>
        )}

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
