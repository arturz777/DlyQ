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
import { fetchDeliveryCost } from "../utils/deliveryCost";
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

const getCardLogo = (brand = "") => {
  const key = String(brand).toLowerCase();
  const file = CARD_LOGOS_FILES[key] || CARD_LOGOS_FILES._default;
  return `${BASE_URL}card-logos/${file}`;
};
// Proda

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
      const lat = e.latlng.lat;
      const lon = e.latlng.lng;

      setFormData((prev) => ({
        ...prev,
        latitude: lat,
        longitude: lon,
      }));

      const fallback = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;

      geoReverse(lat, lon)
        .then((data) => {
          const addr = data.short_display_name || data.display_name;
          setFormData((prev) => ({
            ...prev,
            address: addr || prev.address || fallback,
          }));
        })
        .catch(() => {
          setFormData((prev) => ({
            ...prev,
            address: prev.address || fallback,
          }));
        });

      toast.info(t("address selected", { ns: "paymentForm" }));
    },
  });
  return null;
};

const PaymentForm = ({
  totalPrice,
  sellerId,
  onPaymentSuccess,
  onDeliveryCostChange,
  onDeliveryMetaChange,
  preorder,
}) => {
  const { user } = useContext(Context);
  const [loading, setLoading] = useState(false);
  const {
    isPreorder,
    setIsPreorder,
    hasOnlyPreorders,
    hasOnlyStockItems,
    hasMixedItems,
    disablePreorderCheckbox,
    deliveryDate,
    setDeliveryDate,
    preferredTime,
    setPreferredTime,
    isStoreClosed,
  } = preorder || {};
  const stripe = useStripe();
  const elements = useElements();
  const confirm = useConfirm();
  const [deliveryCost, setDeliveryCost] = useState(0);
  const { t } = useTranslation("paymentForm");
  const [suggestions, setSuggestions] = useState([]);
  const [addressFocused, setAddressFocused] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [savedCards, setSavedCards] = useState([]);
  const [selectedPmId, setSelectedPmId] = useState("new");
  const [showPmModal, setShowPmModal] = useState(false);
  const [tempPmId, setTempPmId] = useState("new");
  const [selectedCardMeta, setSelectedCardMeta] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [pmSaving, setPmSaving] = useState(false);
  const [deliveryMeta, setDeliveryMeta] = useState({
    deliveryCost: 0,
    baseDelivery: 0,
    peakMultiplier: 1,
    peakSource: null,
  });

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
    address: "",
    apartment: "",
    floor: "",
    entrance: "",
    comment: "",
    latitude: 59.437,
    longitude: 24.753,
  });

  useEffect(() => {
    if (!addressFocused) {
      setSuggestions([]);
      return;
    }

    const q = (formData.address || "").trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const data = await geoSearch(q);
        setSuggestions(Array.isArray(data) ? data.slice(0, 5) : []);
      } catch {
        setSuggestions([]);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [formData.address, addressFocused]);

  useEffect(() => {
    const loadSaved = async () => {
      if (!user.isAuth) return;
      try {
        const { cards } = await fetchPaymentMethods();
        setSavedCards(Array.isArray(cards) ? cards : []);
        if (cards && cards.length > 0) {
          setSelectedPmId(cards[0].id);
          setSelectedCardMeta(cards[0]);
        }
      } catch (e) {
        console.warn(t("failed to load saved cards", { ns: "paymentForm" }), e);
      }
    };
    loadSaved();
  }, [user.isAuth]);

  useEffect(() => {
    const updateLocation = (latitude, longitude) => {
      setFormData((prev) => ({
        ...prev,
        latitude,
        longitude,
      }));

      const fallback = `${Number(latitude).toFixed(6)}, ${Number(
        longitude,
      ).toFixed(6)}`;

      geoReverse(latitude, longitude)
        .then((data) => {
          const addr = data.short_display_name || data.display_name;
          setFormData((prev) => ({
            ...prev,
            address: addr || prev.address || fallback,
          }));
        })
        .catch(() => {
          setFormData((prev) => ({
            ...prev,
            address: prev.address || fallback,
          }));
        });
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
              `https://ipinfo.io/json?token=${process.env.REACT_APP_IPINFO_TOKEN}`,
            );
            const data = await res.json();
            const [lat, lon] = data.loc.split(",");
            updateLocation(parseFloat(lat), parseFloat(lon));
          } catch (err) {
            console.error(
              t("ip geolocation error", { ns: "paymentForm" }),
              err,
            );
          }
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
      );
    }
  }, []);

  useEffect(() => {
    const updateDeliveryCost = async () => {
      const lat = Number(formData.latitude);
      const lon = Number(formData.longitude);
      const total = Number(totalPrice);

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      if (!Number.isFinite(total) || total < 0) return;
      const r = await fetchDeliveryCost(total, lat, lon, sellerId ?? null);
      const meta = {
        deliveryCost: Number(r?.deliveryCost) || 0,
        baseDelivery: Number(r?.baseDelivery) || 0,
        peakMultiplier: Number(r?.peakMultiplier) || 1,
        peakSource: r?.peakSource || null,
      };

      setDeliveryCost(meta.deliveryCost);
      onDeliveryCostChange?.(meta.deliveryCost);
      onDeliveryMetaChange?.(meta);
    };

    updateDeliveryCost();
  }, [totalPrice, formData.latitude, formData.longitude, sellerId]);

  const handleDeleteCard = async (pmIdToDelete) => {
    try {
      setDeletingId(pmIdToDelete);
      await detachPaymentMethod(pmIdToDelete);
      const { cards } = await fetchPaymentMethods();
      const list = Array.isArray(cards) ? cards : [];
      setSavedCards(list);

      if (selectedPmId === pmIdToDelete) {
        if (list.length) {
          setSelectedPmId(list[0].id);
          setSelectedCardMeta(list[0]);
        } else {
          setSelectedPmId("new");
          setSelectedCardMeta(null);
        }
      }
      if (tempPmId === pmIdToDelete) {
        setTempPmId(list.length ? list[0].id : "new");
      }

      toast.success(t("card removed", { ns: "paymentForm" }));
    } catch (e) {
      console.error(e);
      toast.error(t("failed to remove card", { ns: "paymentForm" }));
    } finally {
      setDeletingId(null);
    }
  };

  const searchAddress = async () => {
    const q = (formData.address || "").trim();
    if (!q || addressLoading) return;

    setAddressLoading(true);
    try {
      const data = await geoSearch(q);

      if (Array.isArray(data) && data.length > 0) {
        const place = data[0];
        const short = place.short_display_name || place.display_name || q;

        setFormData((prev) => ({
          ...prev,
          address: short,
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
    } finally {
      setAddressLoading(false);
    }
  };

  useEffect(() => {
    const loadUserData = async () => {
      try {
        let parsedData = {};
        const saved = localStorage.getItem("userFormData");
        if (saved) parsedData = JSON.parse(saved);

        setFormData((prev) => ({
          ...prev,
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
      } catch (e) {
        console.error(
          t("failed to load or parse userFormData", { ns: "paymentForm" }),
          e,
        );
      } finally {
        setHydrated(true);
      }
    };

    loadUserData();
  }, [user.isAuth, t]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        "userFormData",
        JSON.stringify({
          address: formData.address,
          apartment: String(formData.apartment ?? ""),
          floor: String(formData.floor ?? ""),
          entrance: String(formData.entrance ?? ""),
          comment: String(formData.comment ?? ""),
          latitude: formData.latitude,
          longitude: formData.longitude,
        }),
      );
    } catch (e) {
      console.warn(t("failed to save form", { ns: "paymentForm" }), e);
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

  const phoneNormalized = useMemo(
    () => normalizePhone(user?.user?.phone || ""),
    [user?.user?.phone],
  );

  const handleSubmit = async (event) => {
    event.preventDefault();

    const phoneNormalized = normalizePhone(user?.user?.phone || "");
    if (!phoneNormalized) {
      toast.error(t("phone is required", { ns: "paymentForm" }));
      return;
    }

    const emailToUse = String(user?.user?.email || "").trim();
    if (!emailToUse) {
      toast.error(t("email is required", { ns: "paymentForm" }));
      return;
    }

    const nameToUse =
      `${user?.user?.firstName || ""} ${user?.user?.lastName || ""}`.trim();

    if (
      preorder &&
      !preorder.hasMixedItems &&
      preorder.hasOnlyStockItems &&
      preorder.isPreorder
    ) {
      if (!preorder.deliveryDate) {
        toast.error(
          t("specify the desired delivery date and time", {
            ns: "paymentForm",
          }),
        );
        return;
      }
    }

    if (!stripe || !elements) {
      toast.error(t("payment initialization error", { ns: "paymentForm" }));
      return;
    }

    if (!selectedPmId || selectedPmId === "new") {
      toast.error(t("select or add card", { ns: "paymentForm" }));
      return;
    }

    setLoading(true);

    try {
      const amountCents = Math.round((totalPrice + deliveryCost) * 100);

      const { clientSecret } = await createPaymentIntent({
        amount: amountCents,
        currency: "eur",
        receipt_email: emailToUse,
        metadata: { phone: phoneNormalized },
      });

      let confirmResult;

      if (selectedPmId !== "new" && savedCards.length > 0) {
        confirmResult = await stripe.confirmCardPayment(clientSecret, {
          payment_method: selectedPmId,
        });
      } else {
        const cardEl = elements.getElement(CardNumberElement);
        if (!cardEl) {
          toast.error(t("card element not found", { ns: "paymentForm" }));
          return;
        }
        confirmResult = await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card: cardEl,
            billing_details: {
              name: nameToUse || undefined,
              email: emailToUse,
              phone: phoneNormalized,
            },
          },
        });
      }

      const { error, paymentIntent } = confirmResult;

      if (error) {
        toast.error(error.message);
        return;
      }

      if (paymentIntent?.status !== "succeeded") {
        toast.error(
          t("payment status", {
            ns: "paymentForm",
            status: paymentIntent?.status || "unknown",
          }),
        );
        return;
      }

      await onPaymentSuccess(
        { paymentIntentId: paymentIntent.id },
        {
          ...formData,
          phone: phoneNormalized,
          email: emailToUse,
          firstName: user?.user?.firstName || "",
          lastName: user?.user?.lastName || "",
        },
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
      <Row className="mb-1">
        <Form.Group className="mb-1" controlId="address">
          <div className="d-flex position-relative">
            <Form.Control
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder={t("enter address", { ns: "paymentForm" })}
              onFocus={(e) => {
                setAddressFocused(true);
                e.target.select();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  searchAddress();
                }
                if (e.key === "Escape") {
                  setSuggestions([]);
                  setAddressFocused(false);
                }
              }}
              onBlur={() =>
                setTimeout(() => {
                  setSuggestions([]);
                  setAddressFocused(false);
                }, 120)
              }
              autoComplete="off"
            />

            <LoadingIconButton
              className="ms-2 btn btn-primary"
              loading={addressLoading}
              spinnerVariant="light"
              onClick={searchAddress}
              aria-label="Search address"
            >
              🔍
            </LoadingIconButton>

            {addressFocused && suggestions.length > 0 && (
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

        <div className={styles.flatRow}>
          <Form.Group controlId="apartment" className={styles.flatGroup}>
            <Form.Control
              size="sm"
              type="text"
              name="apartment"
              className={styles.flatInput}
              placeholder={t("apartment", { ns: "paymentForm" })}
              value={formData.apartment}
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group controlId="floor" className={styles.flatGroup}>
            <Form.Control
              size="sm"
              type="text"
              name="floor"
              className={styles.flatInput}
              placeholder={t("floor", { ns: "paymentForm" })}
              value={formData.floor}
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group controlId="entrance" className={styles.flatGroup}>
            <Form.Control
              size="sm"
              type="text"
              name="entrance"
              className={styles.flatInput}
              placeholder={t("entrance", { ns: "paymentForm" })}
              value={formData.entrance}
              onChange={handleChange}
            />
          </Form.Group>
        </div>

        <div className="mb-2">
          <Form.Group controlId="comment">
            <Form.Control
              as="textarea"
              rows={2}
              name="comment"
              placeholder={t("comment", { ns: "paymentForm" })}
              value={formData.comment}
              onChange={handleChange}
            />
          </Form.Group>
        </div>
      </Row>

      {preorder &&
        (hasOnlyStockItems || hasOnlyPreorders) &&
        !hasMixedItems && (
          <Form.Group className={styles.preorderSection}>
            {(isPreorder || hasOnlyPreorders) && (
              <div className={styles.preorderNote}>
                {isStoreClosed
                  ? t("preorder note store closed", { ns: "paymentForm" })
                  : hasOnlyPreorders
                    ? t("preorder note out of stock", { ns: "paymentForm" })
                    : t("preorder note scheduled", { ns: "paymentForm" })}
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

            {preorder.isPreorder && preorder.hasOnlyStockItems && (
              <>
                <Form.Label>
                  {t("desired delivery datetime", { ns: "basket" })}
                </Form.Label>
                <Form.Control
                  type="datetime-local"
                  value={preorder.deliveryDate || ""}
                  onChange={(e) => preorder.setDeliveryDate(e.target.value)}
                  className={styles.dateInput}
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
                />
              </>
            )}
          </Form.Group>
        )}

      <h4 className="mb-2">{t("payment method", { ns: "paymentForm" })}</h4>

      {selectedCardMeta ? (
        <div className={styles.pmSummary}>
          <div className={styles.pmCardRow}>
            <img
              className={styles.pmBrandIcon}
              src={getCardLogo(selectedCardMeta.brand)}
              alt={selectedCardMeta.brand || "card"}
            />
            <div className={styles.pmCardText}>
              {(selectedCardMeta.brand || "CARD").toUpperCase()}
              <span className={styles.pmLast4}>
                {" "}
                •••• {selectedCardMeta.last4}
              </span>
            </div>
          </div>

          <button
            type="button"
            className={styles.pmChangeLink}
            onClick={() => {
              setTempPmId(selectedPmId || "new");
              setShowPmModal(true);
            }}
          >
            {t("change", { ns: "paymentForm" })}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={styles.pmAddBtn}
          onClick={() => {
            setTempPmId("new");
            setShowPmModal(true);
          }}
        >
          {t("add card", { ns: "paymentForm" })}
        </button>
      )}

      <div className="text-center">
        <LoadingButton
          type="submit"
          loading={loading}
          loadingText={t("processing", { ns: "paymentForm" })}
          disabled={!stripe}
          className={styles.buttonTPrice}
          minWidth={0}
          style={{ width: "100%" }}
        >
          {`${t("pay", { ns: "paymentForm" })} ${(
            totalPrice + deliveryCost
          ).toFixed(2)} €`}
        </LoadingButton>
      </div>

      <Modal
        show={showPmModal}
        onHide={() => setShowPmModal(false)}
        centered
        backdrop="static"
        restoreFocus={false}
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {t("payment method", { ns: "paymentForm" })}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {savedCards.length > 0 && (
            <div className="mb-3">
              {savedCards.map((card) => (
                <div
                  key={card.id}
                  className="d-flex align-items-center justify-content-between mb-2"
                >
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="pmChoiceModal"
                      id={`pm-modal-${card.id}`}
                      value={card.id}
                      checked={tempPmId === card.id}
                      onChange={() => setTempPmId(card.id)}
                    />
                    <label
                      className="form-check-label ms-1"
                      htmlFor={`pm-modal-${card.id}`}
                    >
                      <span className="d-inline-flex align-items-center gap-2">
                        <img
                          src={getCardLogo(card.brand)}
                          //local
                          alt={card.brand || "card"}
                          className={styles.pmBrandIcon}
                        />
                        <span className={styles.pmCardText}>
                          {(card.brand || "CARD").toUpperCase()}
                          <span className={styles.pmLast4}>
                            {" "}
                            •••• {card.last4}
                          </span>
                        </span>
                      </span>
                    </label>
                  </div>

                  <button
                    type="button"
                    className={styles.pmDeleteBtn}
                    disabled={deletingId === card.id}
                    onClick={async () => {
                      const ok = await confirm({
                        title: t("delete", { ns: "paymentForm" }),
                        message: t("confirm delete card", {
                          ns: "paymentForm",
                          last4: card.last4,
                        }),
                        confirmText: t("delete", { ns: "paymentForm" }),
                        cancelText: t("cancel", { ns: "paymentForm" }),
                        confirmVariant: "danger",
                      });
                      if (ok) await handleDeleteCard(card.id);
                    }}
                  >
                    {deletingId === card.id
                      ? "..."
                      : t("delete", { ns: "paymentForm" })}
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="form-check mb-2">
            <input
              className="form-check-input"
              type="radio"
              name="pmChoiceModal"
              id="pm-modal-new"
              value="new"
              checked={tempPmId === "new"}
              onChange={() => setTempPmId("new")}
            />
            <label className="form-check-label" htmlFor="pm-modal-new">
              {t("add new card", { ns: "paymentForm" })}
            </label>
          </div>

          {tempPmId === "new" && (
            <>
              <Form.Label className="mt-2">
                {t("card number", { ns: "paymentForm" })}
              </Form.Label>
              <div className="border rounded p-2">
                <CardNumberElement />
              </div>

              <Row className="mt-2">
                <Col md={6}>
                  <Form.Label>
                    {t("expiry date", { ns: "paymentForm" })}
                  </Form.Label>
                  <div className="border rounded p-2">
                    <CardExpiryElement />
                  </div>
                </Col>
                <Col md={6}>
                  <Form.Label>{t("cvc", { ns: "paymentForm" })}</Form.Label>
                  <div className="border rounded p-2">
                    <CardCvcElement />
                  </div>
                </Col>
              </Row>
            </>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowPmModal(false)}
          >
            {t("cancel", { ns: "paymentForm" })}
          </Button>
          <LoadingButton
            type="button"
            loading={pmSaving}
            loadingText={t("processing", { ns: "paymentForm" })}
            onClick={async () => {
              if (pmSaving) return;
              setPmSaving(true);
              try {
                if (tempPmId !== "new") {
                  const meta =
                    savedCards.find((x) => x.id === tempPmId) || null;
                  setSelectedPmId(tempPmId);
                  setSelectedCardMeta(meta);
                  setShowPmModal(false);
                  return;
                }

                if (!stripe || !elements) return;
                const cardEl = elements.getElement(CardNumberElement);
                if (!cardEl) {
                  toast.error(
                    t("card element not found", { ns: "paymentForm" }),
                  );
                  return;
                }

                const emailToUse = String(user?.user?.email || "").trim();
                const nameToUse =
                  `${user?.user?.firstName || ""} ${user?.user?.lastName || ""}`.trim();

                let clientSecret;
                try {
                  const r = await createSetupIntent({ email: emailToUse });
                  clientSecret = r.clientSecret;
                } catch (e) {
                  toast.error(
                    t("could not create setupintent", { ns: "paymentForm" }),
                  );
                  return;
                }

                const { error, setupIntent, paymentMethod } =
                  await stripe.confirmCardSetup(clientSecret, {
                    payment_method: {
                      card: cardEl,
                      billing_details: {
                        name: nameToUse || undefined,
                        email: emailToUse,
                        phone: phoneNormalized || undefined,
                      },
                    },
                  });
                if (error) {
                  toast.error(error.message);
                  return;
                }

                const pmId = paymentMethod?.id || setupIntent?.payment_method;

                try {
                  await setDefaultPaymentMethod(pmId);
                } catch (e) {
                  toast.error(
                    t("failed to attach card", { ns: "paymentForm" }),
                  );
                  return;
                }

                let cards = [];
                try {
                  const r = await fetchPaymentMethods();
                  cards = r.cards || [];
                } catch (e) {
                  cards = [];
                }

                setSavedCards(Array.isArray(cards) ? cards : []);
                const meta = (cards || []).find((x) => x.id === pmId) || null;
                setSelectedPmId(pmId);
                setSelectedCardMeta(meta);
                if (cardEl?.clear) cardEl.clear();
                setShowPmModal(false);
              } catch (e) {
                console.error(e);
                toast.error(t("failed to add card", { ns: "paymentForm" }));
              } finally {
                setPmSaving(false);
              }
            }}
          >
            {tempPmId === "new"
              ? t("save card", { ns: "paymentForm" })
              : t("select", { ns: "paymentForm" })}
          </LoadingButton>
        </Modal.Footer>
      </Modal>
    </Form>
  );
};

export default PaymentForm;
