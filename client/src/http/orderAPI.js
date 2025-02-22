import { $authHost } from './index';

// Получение заказов пользователя
export const fetchUserOrders = async () => {
    const { data } = await $authHost.get('/order/user');
    return data;
};

export const createOrder = async (orderData) => {
    const { data } = await $authHost.post('/order/create', orderData);
    return data;
};

export const fetchActiveOrder = async () => {
  try {
      const { data } = await $authHost.get("/order/active");
      return data || null; // ✅ Если заказа нет, возвращаем null
  } catch (error) {
      if (error.response && error.response.status === 401) {
          // ✅ Если ошибка 401 (неавторизованный), просто возвращаем null
          return null;
      }
      console.error("Ошибка при загрузке активного заказа:", error);
      return null; // ✅ Любая другая ошибка тоже возвращает null
  }
};

export const updateOrderStatus = async (orderId, newStatus) => {
    const { data } = await $authHost.put('/order/update-status', {
        orderId,
        newStatus
    });
    return data;
};
