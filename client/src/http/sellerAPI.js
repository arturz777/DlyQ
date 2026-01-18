import { $authHost, $host } from "./index";

export const fetchSellers = async (onlyActive = false) => {
  const { data } = await $host.get("/seller", {
    params: onlyActive ? { onlyActive: true } : {},
  });
  return data;
};

export const fetchOneSeller = async (idOrSlug) => {
  const { data } = await $host.get(`/seller/${idOrSlug}`);
  return data;
};

export const fetchSeller = async (idOrSlug) => {
  const { data } = await $host.get(`/seller/${idOrSlug}`);
  return data;
};

export const createSeller = async (body) => {
  const { data } = await $authHost.post("/seller", body, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const updateSeller = async (id, body) => {
  const { data } = await $authHost.put(`/seller/${id}`, body, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const deactivateSeller = async (id) => {
  const { data } = await $authHost.patch(`/seller/${id}/deactivate`);
  return data;
};

export const checkSellerCanManage = async (sellerId) => {
  const { data } = await $authHost.get(`/seller/${sellerId}/can-manage`);
  return data;
};

export const updateSellerHours = async (sellerId, payload) => {
  const { data } = await $authHost.put(`/seller/${sellerId}`, payload);
  return data;
};

export const fetchSellerById = async (sellerId) => {
  const { data } = await $host.get(`/seller/${sellerId}`);
  return data;
};
