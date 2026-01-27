import { $host } from "./index";

export const geoSearch = async (q) => {
  const { data } = await $host.get("/geo/search", {
    params: { q },
  });
  return data;
};

export const geoReverse = async (lat, lon) => {
  const { data } = await $host.get("/geo/reverse", {
    params: { lat, lon },
  });
  return data;
};
