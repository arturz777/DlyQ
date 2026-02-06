import { $authHost } from "./index";

export const fetchAllCouriers = async () => {
  const { data } = await $authHost.get("/couriers/couriers");
  return data;
};
