import { $authHost } from "./index";

export const fetchPaymentMethods = async () => {
  const { data } = await $authHost.get("/payments/payment-methods");
  return data;
};

export const detachPaymentMethod = async (pmId) => {
  const { data } = await $authHost.post("/payments/detach-pm", { pmId });
  return data;
};

export const createPaymentIntent = async (payload) => {
  const { data } = await $authHost.post("/payments/create-intent", payload);
  return data;
};

export const createSetupIntent = async (payload) => {
  const { data } = await $authHost.post("/payments/setup-intent", payload);
  return data;
};
