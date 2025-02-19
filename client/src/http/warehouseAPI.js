import { $authHost } from "./index";

export const fetchWarehouseOrders = async () => {
  const { data } = await $authHost.get("/api/warehouse/orders");
  return data;
};

export const acceptWarehouseOrder = async (orderId, processingTime) => {
  const { data } = await $authHost.post(`/api/warehouse/orders/${orderId}/accept`, { processingTime });
  return data;
};

export const completeWarehouseOrder = async (orderId) => {
  const { data } = await $authHost.post(`/api/warehouse/orders/${orderId}/complete`);
  return data;
};
