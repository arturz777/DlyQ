import { $authHost } from "./index";

export const fetchDeliveryChat = async (orderId) => {
  const { data } = await $authHost.get(`/api/chat/delivery/${orderId}`);
  return data;
};

export const fetchSellerChat = async (orderId) => {
  const { data } = await $authHost.get(`/api/chat/seller/${orderId}`);
  return data;
};
