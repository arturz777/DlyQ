import { $authHost, $host } from "./index";
import jwt_decode from "jwt-decode";

export const fetchNewDevices = async (limit = 10) => {
  try {
    const { data } = await $host.get("/device/new", { params: { limit } });

    if (!data.devices) {
      console.warn("⚠️ Сервер не вернул ожидаемые данные:", data);
      return [];
    }

    return data.devices; // Теперь ожидаем devices, а не просто data
  } catch (error) {
    console.error("❌ Ошибка загрузки новых товаров:", error);
    return [];
  }
};

export const fetchDiscountedDevices = async (limit = 10) => {
  try {
    const { data } = await $host.get("/device", {
      params: { discount: true, limit },
    });
    
    return data.rows || []; // 🔥 Используем `data.rows`, а не `data.devices`
  } catch (error) {
    console.error("❌ Ошибка загрузки товаров со скидками:", error);
    return [];
  }
};


export const fetchRecommendedDevices = async (limit = 10) => {
  try {
    const { data } = await $host.get("/device", {
      params: { recommended: true, limit },
    });
    
    return data.rows || []; // 🔥 Используем `data.rows`, а не `data.devices`
  } catch (error) {
    console.error("❌ Ошибка загрузки рекомендованных товаров:", error);
    return [];
  }
};

export const createType = async (type) => {
  const { data } = await $authHost.post("/type", type);
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

export const createDevice = async (device) => {
  const { data } = await $authHost.post("/device", device);
  return data;
};

export const fetchDevices = async (typeId, subtypeId, brandId, page, limit = 100) => {
  const { data } = await $host.get("/device", {
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
  const { data } = await $host.get("/device/" + id);
  return data;
};

export const updateDevice = async (id, device) => {
  const { data } = await $authHost.put(`/device/${id}`, device);
  return data;
};

export const deleteDevice = async (id) => {
  await $authHost.delete(`/device/${id}`);
};

export const searchDevices = async (query) => {
  const { data } = await $host.get(`/device/search`, { params: { q: query } });
  return data;
};
