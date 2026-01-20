import { $authHost, $host } from "./index";

export const fetchMenuItemOptions = async (itemId) => {
  const { data } = await $host.get(`/api/menu/item/${itemId}/options`);
  return data;
};

export const createOptionGroup = async (payload) => {
  const { data } = await $authHost.post(`/api/menu/option-groups`, payload);
  return data;
};

export const updateOptionGroup = async (id, payload) => {
  const { data } = await $authHost.put(`/api/menu/option-groups/${id}`, payload);
  return data;
};

export const deactivateOptionGroup = async (id) => {
  const { data } = await $authHost.post(`/api/menu/option-groups/${id}/deactivate`);
  return data;
};

export const createOption = async (payload) => {
  const { data } = await $authHost.post(`/api/menu/options`, payload);
  return data;
};

export const updateOption = async (id, payload) => {
  const { data } = await $authHost.put(`/api/menu/options/${id}`, payload);
  return data;
};

export const deactivateOption = async (id) => {
  const { data } = await $authHost.post(`/api/menu/options/${id}/deactivate`);
  return data;
};
