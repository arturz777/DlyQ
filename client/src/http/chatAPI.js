import { $authHost } from "./index";

export const fetchDeliveryChat = async (orderId) => {
  const { data } = await $authHost.get(`/chat/delivery/${orderId}`);
  return data;
};

export const fetchSellerChat = async (orderId) => {
  const { data } = await $authHost.get(`/chat/seller/${orderId}`);
  return data;
};
