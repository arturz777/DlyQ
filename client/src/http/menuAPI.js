import { $authHost, $host } from "./index";

export const fetchMenuCategories = async (sellerId) => {
  const { data } = await $host.get("/menu/categories", {
    params: { sellerId },
  });
  return data;
};

export const createMenuCategory = async (body) => {
  const { data } = await $authHost.post("/menu/categories", body);
  return data;
};

export const updateMenuCategory = async (id, body) => {
  const { data } = await $authHost.put(`/menu/categories/${id}`, body);
  return data;
};

export const deactivateMenuCategory = async (id, sellerId) => {
  const { data } = await $authHost.patch(
    `/menu/categories/${id}/deactivate`,
    { sellerId }
  );
  return data;
};

export const fetchMenuItems = async (sellerId) => {
  const { data } = await $host.get("/menu/items", {
    params: { sellerId },
  });
  return data;
};

export const createMenuItem = async (body) => {
  const { data } = await $authHost.post("/menu/items", body);
  return data;
};

export const updateMenuItem = async (id, body) => {
  const { data } = await $authHost.put(`/menu/items/${id}`, body);
  return data;
};

export const toggleMenuItemAvailability = async (id, sellerId, isAvailable) => {
  const { data } = await $authHost.patch(`/menu/items/${id}/availability`, {
    sellerId,
    isAvailable,
  });
  return data;
};

export const deactivateMenuItem = async (id, sellerId) => {
  const { data } = await $authHost.patch(`/menu/items/${id}/deactivate`, {
    sellerId,
  });
  return data;
};
