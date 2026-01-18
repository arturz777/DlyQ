import { $authHost, $host } from "./index";

export const fetchMaintenance = async () => {
  const { data } = await $host.get("/config/maintenance");
  return data;
};

export const updateMaintenance = async (enabled) => {
  const { data } = await $authHost.post("/config/maintenance", { enabled });
  return data;
};

export const fetchShopConfig = async () => {
  const { data } = await $host.get("/config/shop");
  return data;
};

export const updateShopConfig = async (payload) => {
  const { data } = await $authHost.post("/config/shop", payload);
  return data;
};
