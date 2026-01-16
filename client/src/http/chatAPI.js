import { $authHost } from "./index";

export const fetchUserChats = async (userId) => {
  const { data } = await $authHost.get(`/api/chat/user/${userId}`);
  return data;
};

export const fetchChatById = async (chatId) => {
  const { data } = await $authHost.get(`/api/chat/${chatId}`);
  return data;
};

export const fetchChatMessages = async (chatId) => {
  const { data } = await $authHost.get(`/api/chat/${chatId}/messages`);
  return data;
};

export const markChatRead = async (chatId, userId) => {
  const { data } = await $authHost.put(`/api/chat/${chatId}/mark-read`, { userId });
  return data;
};

export const openSupportChat = async () => {
  const { data } = await $authHost.get(`/api/chat/support`);
  return data;
};

export const fetchDeliveryChat = async (orderId) => {
  const { data } = await $authHost.get(`/api/chat/delivery/${orderId}`);
  return data;
};

export const fetchSellerChat = async (orderId) => {
  const { data } = await $authHost.get(`/api/chat/seller/${orderId}`);
  return data;
};
