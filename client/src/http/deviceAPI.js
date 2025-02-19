import { $authHost, $host } from "./index";
import jwt_decode from "jwt-decode";

export const createType = async (type) => {
  const { data } = await $authHost.post("api/type", type);
  return data;
};

export const fetchTypes = async () => {
  const { data } = await $host.get("api/type");
  return data;
};

export const updateType = async (id, type) => {
  const { data } = await $authHost.put(`api/type/${id}`, type);
  return data;
};

export const deleteType = async (id) => {
  await $authHost.delete(`api/type/${id}`);
};

export const createSubtype = async (subtype) => {
  const { data } = await $authHost.post("api/subtype", subtype);
  return data;
};

export const updateSubType = async (id, subType) => {
  const { data } = await $authHost.put(`api/subtype/${id}`, subType);
  return data;
};

export const fetchSubtypes = async () => {
  const { data } = await $host.get("api/subtype");
  return data;
};

export const fetchSubtypesByType = async (typeId) => {
  const { data } = await $host.get(`api/subtype/${typeId}`);
  return data;
};

export const deleteSubtype = async (id) => {
  const { data } = await $authHost.delete(`api/subtype/${id}`);
  return data;
};

export const createBrand = async (brand) => {
  const { data } = await $authHost.post("api/brand", brand);
  return data;
};

export const fetchBrands = async () => {
  const { data } = await $host.get("api/brand");
  return data;
};

export const updateBrand = async (id, brand) => {
  const { data } = await $authHost.put(`api/brand/${id}`, brand);
  return data;
};

export const deleteBrand = async (id) => {
  await $authHost.delete(`api/brand/${id}`);
};

export const createDevice = async (device) => {
  const { data } = await $authHost.post("api/device", device);
  return data;
};

export const fetchDevices = async (typeId, subtypeId, brandId, page, limit = 100) => {
  const { data } = await $host.get("api/device", {
    params: {
      typeId,
      subtypeId,
      brandId,
      page,
      limit,
    },
  });
  return data;
};

export const fetchOneDevice = async (id) => {
  const { data } = await $host.get("api/device/" + id);
  return data;
};

export const updateDevice = async (id, device) => {
  const { data } = await $authHost.put(`api/device/${id}`, device);
  return data;
};

export const deleteDevice = async (id) => {
  await $authHost.delete(`api/device/${id}`);
};

export const searchDevices = async (query) => {
  const { data } = await $host.get(`/api/device/search?q=${query}`);
  return data;
};
