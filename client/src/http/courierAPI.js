import { $authHost } from "./index";

export const fetchAllCouriers = async () => {
  const { data } = await $authHost.get("/couriers/couriers");
  return data;
};

export const adminSearchUsers = async ({ query = "" } = {}) => {
  const { data } = await $authHost.get("/couriers/admin/users", {
    params: { query },
  });
  return data;
};

export const adminMakeCourier = async (userId) => {
  const { data } = await $authHost.post(`/couriers/admin/${userId}/make`);
  return data;
};

export const adminRemoveCourier = async (userId) => {
  const { data } = await $authHost.post(`/couriers/admin/${userId}/remove`);
  return data;
};

export const adminUpdateCourierProfile = async (userId, payload) => {
  const { data } = await $authHost.patch(
    `/couriers/admin/${userId}`,
    payload,
  );
  return data;
};

export const adminResetCourierPushToken = async (userId) => {
  const { data } = await $authHost.post(
    `/couriers/admin/${userId}/reset-push`,
  );
  return data;
};

export const adminToggleUserBlock = async (userId, isBlocked) => {
  const { data } = await $authHost.post(`/couriers/admin/${userId}/block`, {
    isBlocked,
  });
  return data;
};
