import { $authHost } from "./index";

export const fetchCourierAccounting = async ({ from, to }) => {
  const { data } = await $authHost.get("/api/accounting/couriers", {
    params: { from, to },
  });
  return data;
};

export const fetchAdminOrders = async () => {
  const { data } = await $authHost.get("/api/order/admin");
  return data;
};
