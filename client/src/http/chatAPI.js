import { $authHost } from './index';

export const fetchDeliveryChat = async (orderId) => {
  const { data } = await $authHost.get(`/chat/delivery/${orderId}`);
  return data;
};
