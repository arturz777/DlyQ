// client/src/components/PaymentForm.js
import React, { useState, useEffect, useContext } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet"; // ✅ Добавил Leaflet
import "leaflet/dist/leaflet.css"; // ✅ Подключил стили Leaflet
import L from "leaflet"; // ✅ Импортируем Leaflet
import {
  useStripe,
  useElements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
} from "@stripe/react-stripe-js";
import { Button, Form, Row, Col } from "react-bootstrap";
import { toast } from "react-toastify";
import { fetchProfile } from "../http/userAPI";
import { Context } from "../index";
import { fetchDeliveryCost } from "../utils/deliveryCost";
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
      map.setView([latitude, longitude], 13, { animate: true }); // ✅ Перемещение к точке с анимацией
    }
  }, [latitude, longitude, map]);
  return null;
};

const LocationPicker = ({ setFormData }) => {
  useMapEvents({
    click(e) {
      setFormData((prev) => ({
        ...prev,
        latitude: e.latlng.lat,
        longitude: e.latlng.lng,
      }));

      // 🔥 Получаем адрес с Nominatim API
      fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${e.latlng.lat}&lon=${e.latlng.lng}`
      )
        .then((res) => res.json())
        .then((data) => {
          setFormData((prev) => ({
            ...prev,
            address: data.display_name || "Адрес не найден",
          }));
        })
        .catch((err) => console.error("Ошибка получения адреса:", err));

      toast.info("📍 Адрес выбран!");
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
  const [deliveryCost, setDeliveryCost] = useState(0); // Начальная стоимость

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    apartment: "",
    comment: "",
    latitude: 59.437, // Координаты Таллинна (пример)
    longitude: 24.753,
  });

  useEffect(() => {
    const updateLocation = (latitude, longitude) => {
      setFormData((prev) => ({
        ...prev,
        latitude,
        longitude,
      }));

      // Получаем адрес по координатам
      fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
      )
        .then((res) => res.json())
        .then((data) => {
          setFormData((prev) => ({
            ...prev,
            address: data.display_name || "Адрес не найден",
          }));
        })
        .catch((err) => console.error("Ошибка получения адреса:", err));
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          updateLocation(position.coords.latitude, position.coords.longitude);
        },
        async (error) => {
          console.warn("⚠️ Геолокация отключена, используем IP-геолокацию...");

          // 🔥 Используем IP-геолокацию
          try {
            const res = await fetch(
              "https://ipinfo.io/json?token=e66bf7a246010e"
            );
            const data = await res.json();
            const [lat, lon] = data.loc.split(",");

            console.log("🌍 IP-геолокация:", lat, lon);
            updateLocation(parseFloat(lat), parseFloat(lon));
          } catch (err) {
            console.error("Ошибка получения IP-геолокации:", err);
          }
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    }
  }, []);

  useEffect(() => {
    const updateDeliveryCost = async () => {
      if (!formData.latitude || !formData.longitude) return; // Ждём координаты

      const newDeliveryCost = await fetchDeliveryCost(
        totalPrice,
        formData.latitude,
        formData.longitude
      );

      setDeliveryCost(newDeliveryCost);
      if (onDeliveryCostChange) {
        onDeliveryCostChange(newDeliveryCost); // ✅ Сообщаем Basket
      }
    };

    updateDeliveryCost();
  }, [totalPrice, formData.latitude, formData.longitude, onDeliveryCostChange]); // Пересчёт при изменении суммы или координат

  const searchAddress = async () => {
    if (!formData.address) return;

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${formData.address}`
      );
      const data = await res.json();

      if (data.length > 0) {
        const location = data[0];
        setFormData((prev) => ({
          ...prev,
          latitude: parseFloat(location.lat),
          longitude: parseFloat(location.lon),
        }));
        toast.success("📍 Адрес найден!");
      } else {
        toast.error("❌ Адрес не найден!");
      }
    } catch (error) {
      console.error("Ошибка поиска адреса:", error);
      toast.error("❌ Ошибка при поиске адреса.");
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
            apartment: parsedData.apartment || prev.apartment,  // ✅ Восстанавливаем квартиру
            comment: parsedData.comment || prev.comment,  // ✅ Восстанавливаем комментарий
            address: parsedData.address || prev.address,  // ✅ Восстанавливаем адрес
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
  
      // ✅ Сохраняем данные в `localStorage` даже для авторизованных пользователей
      localStorage.setItem("userFormData", JSON.stringify(updatedData));
  
      return updatedData;
    });
  };
  
  

  const handleSaveDataChange = (e) => {
    setSaveData(e.target.checked);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
  
    if (!stripe || !elements) {
      toast.error("Ошибка инициализации платежной системы. Попробуйте позже.");
      return;
    }
  
    const card = elements.getElement(CardNumberElement);
    if (!card) {
      toast.error("Ошибка: элемент карты не найден.");
      return;
    }
  
    setLoading(true);
  
    try {
      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: "card",
        card: card,
      });
  
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Платеж успешно обработан!");
  
        if (!user.isAuth && saveData) {
          localStorage.setItem("userFormData", JSON.stringify(formData));
        } else if (user.isAuth) {
          // ✅ Сохраняем только `apartment` и `comment` для авторизованных пользователей
          const savedData = JSON.parse(localStorage.getItem("userFormData")) || {};
          savedData.apartment = formData.apartment;
          savedData.comment = formData.comment;
          localStorage.setItem("userFormData", JSON.stringify(savedData));
        } else {
          localStorage.removeItem("userFormData");
        }
  
        // Передаём результат в Basket.js
        onPaymentSuccess(paymentMethod, formData);
      }
    } catch (err) {
      toast.error("Произошла ошибка при обработке платежа.");
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
      {!user.isAuth && (
  <>
      <Row className="mb-1">
        <Col md={6}>
          <Form.Group controlId="firstName">
            <Form.Label>Имя</Form.Label>
            <Form.Control
              type="text"
              placeholder="Введите имя"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              disabled={user.isAuth}
            />
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group controlId="lastName">
            <Form.Label>Фамилия</Form.Label>
            <Form.Control
              type="text"
              placeholder="Введите фамилию"
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
            <Form.Label>Email</Form.Label>
            <Form.Control
              type="email"
              placeholder="Введите email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              disabled={user.isAuth}
            />
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group controlId="phone">
            <Form.Label>Телефон</Form.Label>
            <Form.Control
              type="text"
              placeholder="Введите телефон"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              disabled={user.isAuth}
            />
          </Form.Group>
        </Col>
      </Row>
       </>
      )}

      <Row className="mb-1">

        {/* Поле ввода адреса */}
        <Form.Group className="mb-1" controlId="address">
          <Form.Label>Адрес</Form.Label>
          <div className="d-flex">
            <Form.Control
              type="text"
              name="address"
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              placeholder="Введите адрес"
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
            {/* ✅ Авто-переход к точке */}
            <LocationPicker setFormData={setFormData} />
            <Marker
              position={[formData.latitude, formData.longitude]}
              icon={customIcon}
            />
          </MapContainer>
        </div>

        <Col md={6}>
          <Form.Group controlId="apartment">
            <Form.Label>Номер квартиры</Form.Label>
            <Form.Control
              type="text"
              placeholder="Введите номер квартиры"
              name="apartment"
              value={formData.apartment}
              onChange={handleChange}
            />
          </Form.Group>
        </Col>

        <Col md={6}>
          <Form.Group controlId="comment">
            <Form.Label>Комментарий</Form.Label>
            <Form.Control
              as="textarea"
              rows={1}
              placeholder="Добавьте комментарий"
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
          label="Сохранить адрес и комментарий"
          checked={saveData}
          onChange={handleSaveDataChange}
        />
      </Form.Group>
      <h4 className="mb-1 text-center">Данные карты</h4>
      <Form.Group className="mb-3">
        <Form.Label>Номер карты</Form.Label>
        <div className="border rounded p-2">
          <CardNumberElement />
        </div>
      </Form.Group>
      <Row className="mb-2">
        <Col md={6}>
          <Form.Group>
            <Form.Label>Срок действия</Form.Label>
            <div className="border rounded p-2">
              <CardExpiryElement />
            </div>
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group>
            <Form.Label>CVC</Form.Label>
            <div className="border rounded p-2">
              <CardCvcElement />
            </div>
          </Form.Group>
        </Col>
      </Row>
      <div className="text-center">
        <Button
          className={styles.buttonTPrice}
          type="submit"
          disabled={loading || !stripe}
          variant="primary"
        >
          {loading
            ? "Обработка..."
            : `Оплатить ${(totalPrice + deliveryCost).toFixed(2)} $`}
        </Button>
      </div>
    </Form>
  );
};

export default PaymentForm;
