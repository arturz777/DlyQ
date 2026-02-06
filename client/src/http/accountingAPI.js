import { $authHost } from "./index";

export const fetchCourierAccounting = async (params) => {
  const { data } = await $authHost.get("/accounting/couriers", { params });
  return data;
};

export const fetchIncomeShop = async (params) => {
  const { data } = await $authHost.get("/accounting/income/shop", { params });
  return data;
};

export const fetchIncomeSellers = async (params) => {
  const { data } = await $authHost.get("/accounting/income/sellers", { params });
  return data;
};

export const fetchCourierIncomeOrders = async (courierId, params) => {
  const { data } = await $authHost.get(
    `/accounting/income/couriers/${courierId}/orders`,
    { params }
  );
  return data;
};

export const fetchAdminOrders = async () => {
  const { data } = await $authHost.get("/order/admin");
  return data;
};
