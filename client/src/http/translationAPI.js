import { $authHost, $host } from "./index";

export const fetchTranslations = async () => {
  const { data } = await $host.get("/translations");
  return data;
};

export const updateTranslation = async (key, lang, text) => {
  const { data } = await $authHost.put("/translations", { key, lang, text });
  return data;
};

export const createTranslation = async (payload) => {
  const { data } = await $authHost.post("/translations", payload);
  return data;
};
