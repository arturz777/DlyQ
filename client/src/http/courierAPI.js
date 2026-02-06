import { $authHost } from "./index";

export const fetchAllCouriers = async () => {
  const { data } = await $authHost.get("/api/couriers/couriers");
  return data;
};
