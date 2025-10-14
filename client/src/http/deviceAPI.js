import { $authHost, $host } from "./index";
import jwt_decode from "jwt-decode";

const CACHE_PREFIX = "api_cache_v1:";

export const clearApiCache = (prefix = "") => {
  try {
    const keys = Object.keys(localStorage);
    for (const k of keys) {
      if (k.startsWith(CACHE_PREFIX + prefix)) {
        localStorage.removeItem(k);
      }
    }
  } catch {}
};

const putCache = (k, v, ttlMs) => {
  try {
    localStorage.setItem(
      CACHE_PREFIX + k,
      JSON.stringify({ t: Date.now(), ttl: ttlMs, data: v })
    );
  } catch {}
};
const getCache = (k) => {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + k);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || !p.t || !p.ttl) return null;
    if (Date.now() - p.t > p.ttl) return null;
    return p.data;
  } catch {
    return null;
  }
};

const cached = async (
  key,
  fetcher,
  { ttlMs = 5 * 60 * 1000, refresh = false } = {}
) => {
  const c = !refresh && getCache(key);
  if (c) return c;
  const data = await fetcher();
  if (data !== undefined && data !== null) putCache(key, data, ttlMs);
  return data;
};

export const fetchNewDevices = async (limit = 50) => {
  return cached(
    `new:${limit}`,
    async () => {
      const { data } = await $host.get("/device", {
        params: { isNew: true, limit, onlyVisible: true },
      });
      return data.rows || [];
    },
    { ttlMs: 60 * 60 * 1000 }
  );
};

export const fetchDiscountedDevices = async (limit = 50) => {
  return cached(
    `discounted:${limit}`,
    async () => {
      const { data } = await $host.get("/device", {
        params: { discount: true, limit, onlyVisible: true },
      });
      return data.rows || [];
    },
    { ttlMs: 60 * 60 * 1000 }
  );
};

export const fetchRecommendedDevices = async (typeId, limit = 50) => {
  return cached(
    `recommended:${typeId || "all"}:${limit}`,
    async () => {
      const { data } = await $host.get("/device", {
        params: { typeId, recommended: true, limit, onlyVisible: true },
      });
      return data.rows || [];
    },
    { ttlMs: 60 * 60 * 1000 }
  );
};

export const createType = async (type) => {
  const { data } = await $authHost.post("/type", type);
  return data;
};

export const fetchTypes = async () => {
  return cached(
    "types",
    async () => {
      const { data } = await $host.get("/type");
      return data;
    },
    { ttlMs: 24 * 60 * 60 * 1000 }
  );
};

export const updateType = async (id, type) => {
  const { data } = await $authHost.put(`/type/${id}`, type);
  return data;
};

export const deleteType = async (id) => {
  await $authHost.delete(`/type/${id}`);
};

export const fetchMakes = async () => {
  return cached(
    "makes",
    async () => (await $host.get("/device/make")).data,
    { ttlMs: 24 * 60 * 60 * 1000 }
  );
};

export const createMake = async (body) => {
  const { data } = await $authHost.post('/device/make', body);
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
  return cached(
    `models:${makeId}`,
    async () =>
      (await $host.get("/device/model", { params: { makeId } })).data,
    { ttlMs: 24 * 60 * 60 * 1000 }
  );
};

export const createModel = async (body) => {
  const { data } = await $authHost.post('/device/model', body);
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

export const createSubtype = async (subtype) => {
  const { data } = await $authHost.post("/subtype", subtype);
  return data;
};

export const updateSubType = async (id, subType) => {
  const { data } = await $authHost.put(`/subtype/${id}`, subType);
  return data;
};

export const fetchSubtypes = async () => {
  return cached(
    "subtypes",
    async () => {
      const { data } = await $host.get("/subtype");
      return data;
    },
    { ttlMs: 24 * 60 * 60 * 1000 }
  );
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
  return cached("brands", async () => (await $host.get("/brand")).data, {
    ttlMs: 24 * 60 * 60 * 1000,
  });
};

export const updateBrand = async (id, brand) => {
  const { data } = await $authHost.put(`/brand/${id}`, brand);
  return data;
};

export const deleteBrand = async (id) => {
  await $authHost.delete(`/brand/${id}`);
};

export const createDevice = async (device) => {
  const { data } = await $authHost.post("/device", device);
  return data;
};

const toInt = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

export const fetchFilter = async (
  typeId,
  subtypeId,
  brandId,
  page,
  limit,
  makeId,
  modelId
) => {
  const raw = { typeId, subtypeId, brandId, page, limit, makeId, modelId };
  const params = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v !== null && v !== undefined)
  );

  const key =
    "filter:" +
    [
      params.typeId ?? "",
      params.subtypeId ?? "",
      params.brandId ?? "",
      params.page ?? 1,
      params.limit ?? 20,
      params.makeId ?? "",
      params.modelId ?? "",
    ].join(":");

  return cached(
    key,
    async () => {
      const { data } = await $host.get("/device/filter", { params });
      return (
        data ?? { rows: [], count: 0, facets: { subtypes: [], brands: [] } }
      );
    },
    { ttlMs: 2 * 60 * 1000 }
  );
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

export const fetchDevices = async (
  typeId,
  subtypeId,
  brandId,
  page,
  limit = 20,
  makeId,
  modelId
) => {
  const params = {
    page,
    limit,
    typeId: toInt(typeId),
    subtypeId: toInt(subtypeId),
    brandId: toInt(brandId),
    makeId: toInt(makeId),
    modelId: toInt(modelId),
  };
  Object.keys(params).forEach(
    (k) => params[k] === undefined && delete params[k]
  );

  const { data } = await $host.get("/device", { params });
  return data;
};

export const fetchOneDeviceCached = (
  id,
  { ttlMs = 10 * 60 * 1000, refresh = false } = {}
) =>
  cached(
    `device:${id}`,
    async () => (await $host.get(`/device/${id}`)).data,
    { ttlMs, refresh }
  );

export const fetchOneDevice = async (id) => {
  const { data } = await $host.get("/device/" + id);
  return data;
};

export const updateDevice = async (id, device) => {
  const { data } = await $authHost.put(`/device/${id}`, device);
  clearApiCache("filter:");
  clearApiCache("new:");
  clearApiCache("discounted:");
  clearApiCache("recommended:");
  return data;
};

export const deleteDevice = async (id) => {
  await $authHost.delete(`/device/${id}`);
};

export const searchDevices = async (query) => {
  const { data } = await $host.get(`/device/search`, {
    params: { q: query },
  });
  return data;
};

export const adjustDeviceStock = (id, delta, selectedOptions) =>
  $authHost
    .post(`/device/${id}/stock`, { delta, selectedOptions })
    .then((r) => r.data);
