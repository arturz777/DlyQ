import { $host } from "./index";

export const searchFood = async (q, limit = 30) => {
  const { data } = await $host.get("api/food-catalog/search", { params: { q, limit } });
  return data;
};
