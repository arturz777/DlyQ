import axios from "axios";

// 🔹 Настроим базовый URL сервера (замени на свой IP)
const API_URL = "http://192.168.X.X:5000/api/couriers"; // ⚠️ Укажи свой IP-адрес

// ✅ Настроенный Axios-инстанс для запросов
const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// ✅ Функция для установки токена авторизации (если он нужен)
export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["Authorization"];
  }
};

// ✅ Получение активных заказов
export const fetchActiveOrders = async () => {
  try {
    const { data } = await api.get("/orders");
    return data;
  } catch (error) {
    console.error("Ошибка загрузки активных заказов:", error);
    return [];
  }
};

// ✅ Принятие заказа курьером
export const acceptOrder = async (orderId) => {
  try {
    const { data } = await api.post(`/orders/${orderId}/accept`);
    return data;
  } catch (error) {
    console.error("Ошибка при принятии заказа:", error);
    throw error;
  }
};

// ✅ Смена статуса курьера (онлайн/офлайн)
export const toggleCourierStatus = async (status) => {
  try {
    const { data } = await api.post("/status", { status });
    return data;
  } catch (error) {
    console.error("Ошибка при изменении статуса курьера:", error);
    throw error;
  }
};

// 🔹 Обновление статуса доставки
export const updateDeliveryStatus = async (orderId, newStatus) => {
  try {
    const { data } = await api.post(`/orders/${orderId}/status`, { status: newStatus });
    return data;
  } catch (error) {
    console.error("Ошибка при обновлении статуса доставки:", error);
    throw error;
  }
};

// ✅ Завершение доставки
export const completeDelivery = async (orderId) => {
  try {
    const { data } = await api.post(`/orders/${orderId}/complete`);
    return data;
  } catch (error) {
    console.error("Ошибка при завершении доставки:", error);
    throw error;
  }
};

// ✅ Обновление местоположения курьера
export const updateCourierLocation = async (lat, lng) => {
  try {
    const { data } = await api.post("/update-location", { lat, lng });
    return data;
  } catch (error) {
    console.error("Ошибка при обновлении местоположения курьера:", error);
    throw error;
  }
};

