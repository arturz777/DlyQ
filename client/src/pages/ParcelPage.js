import React, { useContext, useEffect, useMemo, useState } from "react";
import { Container, Row, Col, Form, Button, Card } from "react-bootstrap";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { Context } from "../index";
import { fetchProfile, updateProfile } from "../http/userAPI";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  useStripe,
  useElements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
} from "@stripe/react-stripe-js";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import styles from "./ParcelPage.module.css";

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);

const customIcon = new L.Icon({
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const normalizePhone = (raw = "") => {
  let p = String(raw)
    .replace(/\u00A0/g, " ")
    .replace(/[^\d+]/g, "");
  if (p.startsWith("00")) p = "+" + p.slice(2);
  p = p.replace(/^\++/, "+");
  return p.trim();
};

const MapUpdater = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center?.lat && center?.lng) {
      map.setView([center.lat, center.lng], 13, { animate: true });
    }
  }, [center, map]);
  return null;
};

const ClickPicker = ({ activePoint, setPointFromClick }) => {
  useMapEvents({
    click(e) {
      setPointFromClick(activePoint, e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

function ParcelCheckout() {
  const { user } = useContext(Context);
  const navigate = useNavigate();

  const stripe = useStripe();
  const elements = useElements();

  const token = localStorage.getItem("token") || "";

  useEffect(() => {
    if (!token) {
      toast.info("Для доставки посылки нужно войти в аккаунт");
    }
  }, [token]);

  const [activePoint, setActivePoint] = useState("pickup");

  const [pickup, setPickup] = useState({
    address: "",
    lat: 59.437,
    lng: 24.753,
  });

  const [delivery, setDelivery] = useState({
    address: "",
    lat: null,
    lng: null,
  });

  const [center, setCenter] = useState({ lat: 59.437, lng: 24.753 });

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    comment: "",
  });

  const [suggestions, setSuggestions] = useState([]);
  const [focusedField, setFocusedField] = useState(null);
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [savedCards, setSavedCards] = useState([]);
  const [selectedPmId, setSelectedPmId] = useState("new");
  const [payLoading, setPayLoading] = useState(false);

  const recipientComplete = useMemo(() => {
    if (!user.isAuth) return false;
    const phone = normalizePhone(formData.phone);
    return (
      !!formData.firstName.trim() &&
      !!formData.lastName.trim() &&
      !!formData.email.trim() &&
      !!phone
    );
  }, [
    user.isAuth,
    formData.firstName,
    formData.lastName,
    formData.email,
    formData.phone,
  ]);

  const showRecipientBlock = !recipientComplete;

  const canQuote = useMemo(() => {
    return (
      pickup?.lat != null &&
      pickup?.lng != null &&
      delivery?.lat != null &&
      delivery?.lng != null
    );
  }, [pickup, delivery]);

  const reverseGeocode = async (lat, lng) => {
    const res = await fetch(
      `${process.env.REACT_APP_API_URL}/geo/reverse?lat=${lat}&lon=${lng}`
    );
    if (!res.ok) throw new Error(`reverse failed: ${res.status}`);
    const data = await res.json();
    return data.short_display_name || data.display_name || "";
  };

  const setPointFromClick = async (which, lat, lng) => {
    if (which === "pickup") setPickup((p) => ({ ...p, lat, lng }));
    else setDelivery((d) => ({ ...d, lat, lng }));

    const fallback = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

    try {
      const addr = await reverseGeocode(lat, lng);
      if (which === "pickup") {
        setPickup((p) => ({ ...p, address: addr || fallback || p.address }));
      } else {
        setDelivery((d) => ({ ...d, address: addr || fallback || d.address }));
      }
    } catch (e) {
      if (which === "pickup") {
        setPickup((p) => ({ ...p, address: p.address || fallback }));
      } else {
        setDelivery((d) => ({ ...d, address: d.address || fallback }));
      }
    }
  };

  const applyPlace = (which, place) => {
    const addr = place.short_display_name || place.display_name || "";
    const lat = Number(place.lat);
    const lng = Number(place.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    if (which === "pickup") {
      setPickup({ address: addr, lat, lng });
      setCenter({ lat, lng });
      setActivePoint("pickup");
    } else {
      setDelivery({ address: addr, lat, lng });
      setCenter({ lat, lng });
      setActivePoint("delivery");
    }

    setSuggestions([]);
    toast.success("Адрес выбран");
  };

  useEffect(() => {
    let cancelled = false;

    const fillPickupAddress = async (lat, lng) => {
      try {
        const addr = await reverseGeocode(lat, lng);
        if (!cancelled && addr) {
          setPickup((p) => ({ ...p, address: p.address || addr }));
        }
      } catch {}
    };

    fillPickupAddress(pickup.lat, pickup.lng);

    if (!navigator.geolocation) return () => {};

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        setCenter({ lat, lng });
        setPickup((p) => ({ ...p, lat, lng }));

        await fillPickupAddress(lat, lng);
      },
      () => {}
    );

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        if (!user.isAuth) return;
        const profile = await fetchProfile();
        setFormData((prev) => ({
          ...prev,
          firstName: profile.firstName || "",
          lastName: profile.lastName || "",
          email: profile.email || "",
          phone: profile.phone || "",
        }));
      } catch {}
    })();
  }, [user.isAuth]);

  useEffect(() => {
    (async () => {
      try {
        if (!user.isAuth) return;

        const res = await fetch(
          `${process.env.REACT_APP_API_URL}/payments/payment-methods`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!res.ok) return;
        const data = await res.json();
        const cards = Array.isArray(data.cards) ? data.cards : [];
        setSavedCards(cards);
        if (cards.length > 0) setSelectedPmId(cards[0].id);
      } catch {}
    })();
  }, [user.isAuth, token]);

  useEffect(() => {
    const field = focusedField;
    if (!field) {
      setSuggestions([]);
      return;
    }

    const q =
      field === "pickupAddress"
        ? (pickup.address || "").trim()
        : (delivery.address || "").trim();

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
        setSuggestions(Array.isArray(data) ? data.slice(0, 6) : []);
      } catch {
        setSuggestions([]);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [focusedField, pickup.address, delivery.address]);

  useEffect(() => {
    if (!canQuote) {
      setQuote(null);
      return;
    }

    const run = async () => {
      setQuoteLoading(true);
      try {
        const res = await fetch(
          `${process.env.REACT_APP_API_URL}/parcel/quote`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pickupLat: pickup.lat,
              pickupLng: pickup.lng,
              deliveryLat: delivery.lat,
              deliveryLng: delivery.lng,
            }),
          }
        );

        const data = await res.json();
        if (!res.ok) {
          setQuote(null);
          return;
        }
        setQuote(data);
      } catch {
        setQuote(null);
      } finally {
        setQuoteLoading(false);
      }
    };

    run();
  }, [canQuote, pickup.lat, pickup.lng, delivery.lat, delivery.lng]);

  const handlePay = async (e) => {
    e.preventDefault();

    if (!token) {
      toast.error("Нужно войти в аккаунт");
      navigate("/login");
      return;
    }

    if (!quote?.price) {
      toast.error("Выберите точки A и B (или подождите расчёт цены)");
      return;
    }

    const phoneNormalized = normalizePhone(formData.phone);
    if (!phoneNormalized) return toast.error("Телефон обязателен");
    if (!formData.firstName.trim()) return toast.error("Имя обязательно");
    if (!formData.email.trim()) return toast.error("Email обязателен");
    if (!pickup.address.trim()) return toast.error("Укажите адрес точки A");
    if (!delivery.address.trim()) return toast.error("Укажите адрес точки B");

    if (!stripe || !elements) {
      toast.error("Stripe не готов");
      return;
    }

    setPayLoading(true);
    try {
      const amountCents = Math.round(Number(quote.price) * 100);

      const piRes = await fetch(
        `${process.env.REACT_APP_API_URL}/payments/create-intent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            amount: amountCents,
            currency: "eur",
            receipt_email: formData.email,
            metadata: {
              type: "parcel",
              pickupAddress: pickup.address,
              deliveryAddress: delivery.address,
            },
          }),
        }
      );

      if (!piRes.ok) {
        toast.error("Не удалось создать платёж");
        setPayLoading(false);
        return;
      }

      const { clientSecret } = await piRes.json();

      let confirmResult;

      if (selectedPmId !== "new") {
        confirmResult = await stripe.confirmCardPayment(clientSecret, {
          payment_method: selectedPmId,
        });
      } else {
        const cardEl = elements.getElement(CardNumberElement);
        if (!cardEl) {
          toast.error("CardNumberElement не найден");
          setPayLoading(false);
          return;
        }

        confirmResult = await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card: cardEl,
            billing_details: {
              name: `${formData.firstName} ${formData.lastName}`.trim(),
              email: formData.email,
              phone: phoneNormalized,
            },
          },
        });
      }

      const { error, paymentIntent } = confirmResult;
      if (error) {
        toast.error(error.message || "Ошибка оплаты");
        setPayLoading(false);
        return;
      }
      if (paymentIntent?.status !== "succeeded") {
        toast.error(`Статус платежа: ${paymentIntent?.status || "unknown"}`);
        setPayLoading(false);
        return;
      }

      if (user.isAuth && !user.user?.phone?.trim()) {
        try {
          await updateProfile({ phone: phoneNormalized });
          const upd = await fetchProfile();
          user.setUser({ ...user.user, phone: upd.phone });
        } catch {
          toast.error("Не удалось сохранить телефон в профиле");
          setPayLoading(false);
          return;
        }
      }

      const createRes = await fetch(
        `${process.env.REACT_APP_API_URL}/parcel/create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            paymentIntentId: paymentIntent.id,
            formData: {
              firstName: formData.firstName,
              lastName: formData.lastName,
              email: formData.email,
              phone: phoneNormalized,
            },
            pickup: {
              address: pickup.address,
              lat: pickup.lat,
              lng: pickup.lng,
            },
            delivery: {
              address: delivery.address,
              lat: delivery.lat,
              lng: delivery.lng,
            },
            comment: formData.comment || "",
          }),
        }
      );

      const created = await createRes.json();

      if (!createRes.ok) {
        toast.error(created?.message || "Не удалось создать заказ посылки");
        setPayLoading(false);
        return;
      }

      toast.success("Заказ посылки создан! Курьер скоро получит оффер ✅");
      navigate("/");
    } catch (err) {
      console.error(err);
      toast.error("Ошибка при оплате/создании заказа");
    } finally {
      setPayLoading(false);
    }
  };

  return (
    <Container className={styles.container}>
      <h2 className={styles.title}>📦 Доставка посылки</h2>

      {!token && (
        <Card className="mb-3">
          <Card.Body>
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div>Чтобы оформить доставку посылки, нужно войти в аккаунт.</div>
              <Button onClick={() => navigate("/login")}>Войти</Button>
            </div>
          </Card.Body>
        </Card>
      )}

      <Row className="g-3">
        <Col xs={12}>
          <Card className={styles.card}>
            <Card.Body>
              <Form.Group className="mb-2">
                <Form.Label>Точка A (забрать)</Form.Label>
                <div className={styles.addrRow}>
                  <Form.Control
                    value={pickup.address}
                    onChange={(e) =>
                      setPickup((p) => ({ ...p, address: e.target.value }))
                    }
                    onFocus={() => {
                      setActivePoint("pickup");
                      setFocusedField("pickupAddress");
                    }}
                    onBlur={() => setTimeout(() => setFocusedField(null), 120)}
                    placeholder="Введите адрес или выберите на карте"
                  />
                  <Button
                    type="button"
                    variant="outline-secondary"
                    onClick={() => setActivePoint("pickup")}
                    title="Выбирать точку A кликом по карте"
                  >
                    🎯
                  </Button>
                </div>
              </Form.Group>

              <Form.Group className="mb-2">
                <Form.Label>Точка B (доставить)</Form.Label>
                <div className={styles.addrRow}>
                  <Form.Control
                    value={delivery.address}
                    onChange={(e) =>
                      setDelivery((d) => ({ ...d, address: e.target.value }))
                    }
                    onFocus={() => {
                      setActivePoint("delivery");
                      setFocusedField("deliveryAddress");
                    }}
                    onBlur={() => setTimeout(() => setFocusedField(null), 120)}
                    placeholder="Введите адрес или выберите на карте"
                  />
                  <Button
                    type="button"
                    variant="outline-secondary"
                    onClick={() => setActivePoint("delivery")}
                    title="Выбирать точку B кликом по карте"
                  >
                    🎯
                  </Button>
                </div>
              </Form.Group>

              {focusedField && suggestions.length > 0 && (
                <div className={styles.suggestBox}>
                  {suggestions.map((s, i) => (
                    <div
                      key={i}
                      className={styles.suggestItem}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applyPlace(
                          focusedField === "pickupAddress"
                            ? "pickup"
                            : "delivery",
                          s
                        );
                      }}
                    >
                      {s.short_display_name || s.display_name}
                    </div>
                  ))}
                </div>
              )}

              <div className={styles.mapWrap}>
                <MapContainer
                  center={[center.lat, center.lng]}
                  zoom={13}
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution="&copy; OpenStreetMap"
                  />
                  <MapUpdater center={center} />
                  <ClickPicker
                    activePoint={activePoint}
                    setPointFromClick={setPointFromClick}
                  />

                  {pickup?.lat != null && pickup?.lng != null && (
                    <Marker
                      position={[pickup.lat, pickup.lng]}
                      icon={customIcon}
                    />
                  )}

                  {delivery?.lat != null && delivery?.lng != null && (
                    <Marker
                      position={[delivery.lat, delivery.lng]}
                      icon={customIcon}
                    />
                  )}
                </MapContainer>

                <div className={styles.mapHint}>
                  Клик по карте ставит маркер для:{" "}
                  <b>{activePoint === "pickup" ? "точки A" : "точки B"}</b>
                </div>
              </div>

              <div className={styles.quoteBox}>
                {quoteLoading && <div>Расчёт стоимости...</div>}
                {!quoteLoading && quote && (
                  <div className={styles.quoteRow}>
                    <div>
                      Дистанция: <b>{quote.distanceKm} км</b>
                    </div>
                    <div>
                      Стоимость: <b>{Number(quote.price).toFixed(2)} €</b>
                    </div>
                  </div>
                )}
                {!quoteLoading && !quote && (
                  <div className={styles.quoteMuted}>
                    Выберите обе точки (A и B), чтобы рассчитать стоимость.
                  </div>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12}>
          <Card className={styles.card}>
            <Card.Body>
              {showRecipientBlock && (
                <>
                  <h5 className="mb-3">Данные получателя</h5>

                  <Row className="g-2">
                    <Col xs={12}>
                      <Form.Control
                        placeholder="Имя"
                        value={formData.firstName}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            firstName: e.target.value,
                          }))
                        }
                      />
                    </Col>
                    <Col xs={12}>
                      <Form.Control
                        placeholder="Фамилия"
                        value={formData.lastName}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            lastName: e.target.value,
                          }))
                        }
                      />
                    </Col>
                    <Col xs={12}>
                      <Form.Control
                        placeholder="Email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, email: e.target.value }))
                        }
                      />
                    </Col>
                    <Col xs={12}>
                      <Form.Control
                        placeholder="Телефон"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, phone: e.target.value }))
                        }
                        disabled={user.isAuth && !!user.user?.phone?.trim()}
                      />
                    </Col>
                  </Row>

                  <hr />
                </>
              )}

              <Form.Control
                className="mt-2"
                as="textarea"
                rows={2}
                placeholder="Комментарий (что за посылка, как забрать, код домофона и т.п.)"
                value={formData.comment}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, comment: e.target.value }))
                }
              />

              <hr />

              <h5 className="mb-2">Оплата</h5>

              {savedCards.length > 0 && (
                <Form.Select
                  className="mb-2"
                  value={selectedPmId}
                  onChange={(e) => setSelectedPmId(e.target.value)}
                >
                  {savedCards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {(c.brand || "CARD").toUpperCase()} •••• {c.last4}
                    </option>
                  ))}
                  <option value="new">Новая карта</option>
                </Form.Select>
              )}

              {savedCards.length === 0 && (
                <div className={styles.smallMuted}>
                  Нет сохранённых карт — оплатите новой картой.
                </div>
              )}

              {(selectedPmId === "new" || savedCards.length === 0) && (
                <>
                  <div className={styles.stripeField}>
                    <div className={styles.stripeLabel}>Номер карты</div>
                    <div className={styles.stripeBox}>
                      <CardNumberElement />
                    </div>
                  </div>

                  <Row className="g-2">
                    <Col xs={12}>
                      <div className={styles.stripeField}>
                        <div className={styles.stripeLabel}>Срок</div>
                        <div className={styles.stripeBox}>
                          <CardExpiryElement />
                        </div>
                      </div>
                    </Col>
                    <Col xs={12}>
                      <div className={styles.stripeField}>
                        <div className={styles.stripeLabel}>CVC</div>
                        <div className={styles.stripeBox}>
                          <CardCvcElement />
                        </div>
                      </div>
                    </Col>
                  </Row>
                </>
              )}

              <Button
                className="w-100 mt-3"
                onClick={handlePay}
                disabled={payLoading || !stripe || !quote?.price}
              >
                {payLoading
                  ? "Оплата..."
                  : quote?.price
                  ? `Оплатить ${Number(quote.price).toFixed(2)} €`
                  : "Выберите точки A и B"}
              </Button>

              <div className={styles.smallMuted + " mt-2"}>
                После оплаты заказ уйдёт курьерам как обычный оффер (как у
                ресторанов).
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default function ParcelPage() {
  return (
    <Elements stripe={stripePromise}>
      <ParcelCheckout />
    </Elements>
  );
}
