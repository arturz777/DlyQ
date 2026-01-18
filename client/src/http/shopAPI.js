import { $host } from "./index";

export const fetchShopStatus = async () => {
  const { data } = await $host.get("api/shop/status");
  return data;
};
