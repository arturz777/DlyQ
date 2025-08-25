const API_URL = process.env.REACT_APP_API_URL || "https://dlyq-backend-staging.onrender.com";

export const fetchDeliveryCost = async (totalPrice, latitude, longitude) => {
	try {
	  const response = await fetch(
		`${API_URL}/order/delivery-cost?totalPrice=${totalPrice}&lat=${latitude}&lon=${longitude}`
	  );
	  const data = await response.json();
	  return data.deliveryCost; // Возвращаем рассчитанную сервером стоимость
	} catch (error) {
	  console.error("Ошибка получения стоимости доставки:", error);
	  return 5; // Значение по умолчанию, если сервер не ответил
	}
};

  
  
