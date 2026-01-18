import { $authHost, $host } from "./index";

export const clearApiCache = () => {};

const toInt = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

export const fetchNewDevices = async (limit = 50, sellerId) => {
  const { data } = await $host.get("/device", {
    params: {
      isNew: true,
      limit,
      ...(sellerId ? { sellerId } : {}),
      onlyVisible: true,
    },
  });
  return data.rows || [];
};

export const fetchDiscountedDevices = async (limit = 50, sellerId) => {
  const { data } = await $host.get("/device", {
    params: {
      discount: true,
      limit,
      ...(sellerId ? { sellerId } : {}),
      onlyVisible: true,
    },
  });
  return data.rows || [];
};

export const fetchRecommendedDevices = async (typeId, limit = 50, sellerId) => {
  const { data } = await $host.get("/device", {
    params: {
      typeId,
      recommended: true,
      limit,
      ...(sellerId ? { sellerId } : {}),
      onlyVisible: true,
    },
  });
  return data.rows || [];
};

export const fetchDevices = async (
  typeId,
  subtypeId,
  brandId,
  page,
  limit = 20,
  makeId,
  modelId,
  sellerId,
  onlyVisible = true
) => {
  const params = {
    page,
    limit,
    typeId: toInt(typeId),
    subtypeId: toInt(subtypeId),
    brandId: toInt(brandId),
    makeId: toInt(makeId),
    modelId: toInt(modelId),
    ...(sellerId ? { sellerId } : {}),
    onlyVisible: String(onlyVisible),
  };

  Object.keys(params).forEach(
    (k) => params[k] === undefined && delete params[k]
  );

  const { data } = await $host.get("/device", { params });
  return data;
};

export const fetchOneDevice = async (id) => {
  const { data } = await $host.get("/device/" + id);
  return data;
};

export const fetchOneDeviceCached = async (id) => {
  const { data } = await $host.get(`/device/${id}`);
  return data;
};

export const searchDevices = async (query) => {
  const { data } = await $host.get(`/device/search`, {
    params: { q: query },
  });
  return data;
};

export const fetchFilter = async (
  typeId,
  subtypeId,
  brandId,
  page,
  limit,
  makeId,
  modelId,
  sellerId,
  onlyVisible = true
) => {
  const raw = {
    typeId,
    subtypeId,
    brandId,
    page,
    limit,
    makeId,
    modelId,
    ...(sellerId ? { sellerId } : {}),
    onlyVisible: String(onlyVisible),
  };
  const params = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v !== null && v !== undefined)
  );

  const { data } = await $host.get("/device/filter", { params });

  return data ?? { rows: [], count: 0, facets: { subtypes: [], brands: [] } };
};

export async function fetchCatalogCursor({
  typeId,
  subtypeId,
  brandId,
  makeId,
  modelId,
  sellerId,
  cursor,
  sort,
  limit,
  compatMode,
  onlyVisible = true,
  lang,
}) {
  const params = {};

  if (typeId != null) params.typeId = Number(typeId);
  if (subtypeId != null) params.subtypeId = Number(subtypeId);
  if (brandId != null) params.brandId = Number(brandId);
  if (makeId != null) params.makeId = Number(makeId);
  if (modelId != null) params.modelId = Number(modelId);
  if (sellerId != null) params.sellerId = Number(sellerId);
  if (cursor) params.cursor = cursor;
  if (sort) params.sort = sort;
  if (limit) params.limit = Number(limit);
  if (compatMode) params.compatMode = String(compatMode).toLowerCase();
  params.onlyVisible = String(onlyVisible);
  if (typeof lang === "string" && lang) params.lang = lang;

  const { data } = await $host.get("/device/cursor", { params });
  return data;
}

export const createDevice = async (device) => {
  const { data } = await $authHost.post("/device", device);
  return data;
};

export const updateDevice = async (id, device) => {
  const { data } = await $authHost.put(`/device/${id}`, device);
  return data;
};

export const deleteDevice = async (id) => {
  await $authHost.delete(`/device/${id}`);
};

export const updateDeviceVisibility = async (id, isVisible) => {
  const res = await fetch(
    `${process.env.REACT_APP_API_URL}/device/${id}/visibility`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isVisible }),
    }
  );
  if (!res.ok) throw new Error("Failed to update visibility");
  return res.json();
};

export const adjustDeviceStock = (id, delta, selectedOptions) =>
  $authHost
    .post(`/device/${id}/stock`, { delta, selectedOptions })
    .then((r) => r.data);

export const createType = async (type) => {
  const { data } = await $authHost.post("/type", type);
  return data;
};

export const checkStock = async (deviceId, quantity, selectedOptions) => {
  const { data } = await $host.post("/device/check-stock", {
    deviceId,
    quantity,
    selectedOptions,
  });
  return data;
};

export const fetchTypes = async () => {
  const { data } = await $host.get("/type");
  return data;
};

export const updateType = async (id, type) => {
  const { data } = await $authHost.put(`/type/${id}`, type);
  return data;
};

export const deleteType = async (id) => {
  await $authHost.delete(`/type/${id}`);
};

export const createSubtype = async (subtype) => {
  const { data } = await $authHost.post("/subtype", subtype);
  return data;
};

export const updateSubType = async (id, subType) => {
  const { data } = await $authHost.put(`/subtype/${id}`, subType);
  return data;
};

export const fetchSubtypes = async () => {
  const { data } = await $host.get("/subtype");
  return data;
};

export const fetchSubtypesByType = async (typeId) => {
  const { data } = await $host.get(`/subtype/${typeId}`);
  return data;
};

export const deleteSubtype = async (id) => {
  const { data } = await $authHost.delete(`/subtype/${id}`);
  return data;
};

export const createBrand = async (brand) => {
  const { data } = await $authHost.post("/brand", brand);
  return data;
};

export const fetchBrands = async () => {
  const { data } = await $host.get("/brand");
  return data;
};

export const updateBrand = async (id, brand) => {
  const { data } = await $authHost.put(`/brand/${id}`, brand);
  return data;
};

export const deleteBrand = async (id) => {
  await $authHost.delete(`/brand/${id}`);
};

export const fetchMakes = async () => {
  const { data } = await $host.get("/device/make");
  return data;
};

export const createMake = async (body) => {
  const { data } = await $authHost.post("/device/make", body);
  return data;
};

export const updateMake = async (id, body) => {
  const { data } = await $authHost.put(`/device/make/${id}`, body);
  return data;
};

export const deleteMake = async (id) => {
  const { data } = await $authHost.delete(`/device/make/${id}`);
  return data;
};

export const fetchModelsByMake = async (makeId) => {
  const { data } = await $host.get("/device/model", { params: { makeId } });
  return data;
};

export const createModel = async (body) => {
  const { data } = await $authHost.post("/device/model", body);
  return data;
};

export const updateModel = async (id, body) => {
  const { data } = await $authHost.put(`/device/model/${id}`, body);
  return data;
};

export const deleteModel = async (id) => {
  const { data } = await $authHost.delete(`/device/model/${id}`);
  return data;
};
