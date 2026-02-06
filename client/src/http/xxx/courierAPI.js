import { $authHost } from "./index";

export const fetchActiveOrders = async () => {
  try {
    const { data } = await $authHost.get("/couriers/orders");
    return data;
  } catch (error) {
    console.error("Ошибка загрузки активных заказов:", error);
    return [];
  }
};

export const acceptOrder = async (orderId) => {
  try {
    const { data } = await $authHost.post(`/couriers/orders/${orderId}/accept`);
    return data;
  } catch (error) {
    console.error("Ошибка при принятии заказа:", error);
    throw error;
  }
};

export const toggleCourierStatus = async (status) => {
  try {
    const { data } = await $authHost.post("/couriers/status", { status });
    return data;
  } catch (error) {
    console.error("Ошибка при изменении статуса курьера:", error);
    throw error;
  }
};

export const updateDeliveryStatus = async (orderId, newStatus) => {
  try {
    const { data } = await $authHost.post(`/couriers/orders/${orderId}/status`, { status: newStatus });
    return data;
  } catch (error) {
    console.error("Ошибка при обновлении статуса доставки:", error);
    throw error;
  }
};

export const completeDelivery = async (orderId) => {
  try {
    const { data } = await $authHost.post(`/couriers/orders/${orderId}/complete`);
    return data;
  } catch (error) {
    console.error("Ошибка при завершении доставки:", error);
    throw error;
  }
};

export const updateCourierLocation = async (lat, lng) => {
  try {
    const { data } = await $authHost.post("/couriers/update-location", { lat, lng });
    return data;
  } catch (error) {
    console.error("Ошибка при обновлении местоположения курьера:", error);
    throw error;
  }
};

export const fetchAllCouriers = async () => {
  const { data } = await $authHost.get("/couriers/couriers");
  return data;
};
