import { $authHost } from './index';

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
      return data || null; 
  } catch (error) {
      if (error.response && error.response.status === 401) {
          return null;
      }
      console.error("Ошибка при загрузке активного заказа:", error);
      return null;
  }
};

export const updateOrderStatus = async (orderId, newStatus) => {
    const { data } = await $authHost.put('/order/update-status', {
        orderId,
        newStatus
    });
    return data;
};

export const fetchAllOrdersForAdmin = async () => {
    const { data } = await $authHost.get('/order/admin');
    return data;
  };
  
  export const adminUpdateOrderStatus = async (id, status, processingTime, estimatedTime) => {
    const { data } = await $authHost.put(`/order/${id}/status`, {
      status,
      processingTime,
      estimatedTime,
    });
    return data;
  };  
  
  export const updateOrderStatusById = async (id, status) => {
    const { data } = await $authHost.put(`/order/${id}/status`, { status });
    return data;
  };

  export const assignCourierToOrder = async (orderId, courierId) => {
    const { data } = await $authHost.put(`/order/${orderId}/assign-courier`, {
      courierId,
    });
    return data;
  };
  


