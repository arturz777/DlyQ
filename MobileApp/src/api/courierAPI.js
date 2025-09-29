import {$authHost} from './http';

export const fetchActiveOrders = async () => {
  const {data} = await $authHost.get('/couriers/orders');
  return data;
};

export const toggleCourierStatus = async status => {
  const {data} = await $authHost.post('/couriers/status', {status});
  return data;
};

export const acceptOrder = async orderId => {
  const {data} = await $authHost.post(`/couriers/orders/${orderId}/accept`);
  return data;
};

export const updateDeliveryStatus = async (orderId, status) => {
  const {data} = await $authHost.post(`/couriers/orders/${orderId}/status`, {
    status,
  });
  return data;
};

export const completeDelivery = async orderId => {
  const {data} = await $authHost.post(`/couriers/orders/${orderId}/complete`);
  return data;
};

export const updateCourierLocation = async (lat, lng) => {
  const {data} = await $authHost.post('/couriers/update-location', {lat, lng});
  return data;
};
