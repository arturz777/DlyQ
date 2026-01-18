import { $host } from "./index";

export const fetchShopStatus = async () => {
  const { data } = await $host.get("/shop/status");
  return data;
};
