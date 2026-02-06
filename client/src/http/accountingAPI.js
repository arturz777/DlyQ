import { $authHost } from "./index";

export const fetchCourierAccounting = async ({ from, to }) => {
  const { data } = await $authHost.get("/accounting/couriers", {
    params: { from, to },
  });
  return data;
};

export const fetchAdminOrders = async () => {
  const { data } = await $authHost.get("/order/admin");
  return data;
};
