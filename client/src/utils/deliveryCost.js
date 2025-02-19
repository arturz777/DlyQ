export const fetchDeliveryCost = async (totalPrice, latitude, longitude) => {
	try {
	  const response = await fetch(
		`http://localhost:5000/api/order/delivery-cost?totalPrice=${totalPrice}&lat=${latitude}&lon=${longitude}`
	  );
	  const data = await response.json();
	  return data.deliveryCost; // Возвращаем рассчитанную сервером стоимость
	} catch (error) {
	  console.error("Ошибка получения стоимости доставки:", error);
	  return 5; // Значение по умолчанию, если сервер не ответил
	}
  };
  
  