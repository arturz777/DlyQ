// server/controllers/orderController.js
const sendEmail = require("../services/emailService");
const { Order, Device } = require("../models/models");
const getDistanceFromWarehouse = require("../utils/distance");
const { supabase } = require("../config/supabaseClient"); // ✅ Импорт Supabase
const uuid = require("uuid");

const calculateDeliveryCost = (totalPrice, distance) => {
  let baseCost = 2; // Базовая цена 2€
  let distanceCost = distance * 0.5; // 0.5€ за км
  let deliveryCost = baseCost + distanceCost;
  let discount = Math.floor(totalPrice / 30) * 2; // Округляем вниз (каждые 30€ скидка -2€)

  // Ограничение: доставка не может быть меньше 0€
  deliveryCost = Math.max(0, deliveryCost - discount);
  return parseFloat(deliveryCost.toFixed(2)); // Округляем
};

// Пример создания заказа и отправки уведомлений
const createOrder = async (req, res) => {
  try {
    const { formData, totalPrice, orderDetails } = req.body;
    const { firstName, lastName, email, phone, address, apartment, comment, latitude, longitude } =
      formData;

      const distance = getDistanceFromWarehouse(latitude, longitude);
      const deliveryPrice = calculateDeliveryCost(totalPrice, distance); 
      

    if (!orderDetails || orderDetails.length === 0) {
      throw new Error("orderDetails не может быть пустым");
    }

    const userId = req.user ? req.user.id : null;
    let warehouseId = userId;

    let deviceImageUrl = orderDetails[0]?.image || "https://example.com/placeholder.png";

    if (deviceImageUrl.startsWith("http")) { // Проверяем, что это URL, а не локальный путь
      try {
        const response = await fetch(deviceImageUrl);
        if (!response.ok) throw new Error("Ошибка загрузки изображения с URL");

        const buffer = await response.arrayBuffer();
        const fileName = `orders/${uuid.v4()}${deviceImageUrl.substring(deviceImageUrl.lastIndexOf("."))}`;

        const { data, error } = await supabase.storage
          .from("images")
          .upload(fileName, Buffer.from(buffer), {
            contentType: "image/jpeg",
          });

        if (error) {
          console.error("❌ Ошибка загрузки изображения в Supabase:", error);
        } else {
          deviceImageUrl = `https://ujsitjkochexlcqrwxan.supabase.co/storage/v1/object/public/images/${fileName}`;
        }
      } catch (error) {
        console.error("❌ Ошибка обработки изображения:", error);
      }

      for (const item of orderDetails) {
        const device = await Device.findByPk(item.deviceId);
  
        if (!device) {
          return res.status(400).json({ message: `Товар "${item.name}" не найден.` });
        }
  
        if (device.quantity < item.count) {
          return res.status(400).json({ message: `Недостаточно товара: ${item.name}. Осталось ${device.quantity} шт.` });
        }
  
        // 🔥 **Уменьшаем количество товара в базе**
        await device.update({ quantity: device.quantity - item.count });
      }

    }

    // Создаём заказ с фото устройства
    const order = await Order.create({
      userId,
      totalPrice: totalPrice + deliveryPrice,
      deliveryPrice,
      status: "Pending",
      warehouseStatus: "pending",
      warehouseId,
      courierId: null,
      deliveryLat: latitude,   // ✅ Сохраняем широту
      deliveryLng: longitude, 
      deliveryAddress: address,
      deviceImage: deviceImageUrl,
      productName: orderDetails.length > 0 ? orderDetails[0].name : "Неизвестный товар",
      orderDetails: JSON.stringify(orderDetails),
  });

  const io = req.app.get("io"); // 🔥 Получаем WebSocket-сервер из `app`
  io.emit("newOrder", order);
  
  const productsList = orderDetails
  .map((detail) => {
    const options = Object.entries(detail.selectedOptions || {})
      .map(([key, value]) => `${key}: ${value.value || value}`)
      .join(", ");
    return `- ${detail.name} (кол: ${detail.count}, опции: ${options || "нет"})`;
  })
  .join("\n");

    // Формируем текст письма
    const subject = " Заказ !";
    const text = `
      Информация о клиенте:
      - ${firstName}${lastName}
      - ${email}${phone}
      ---------------------------------
      - ${productsList}
      - ${totalPrice} €
      ----------------------------------
      Адрес: ${address}, квартира ${apartment}
      ----------------------------------
      - Комментарий: ${comment}
    `;

    // Отправляем письмо клиенту
    await sendEmail(email, subject, text);
    res.status(201).json({ message: "Заказ успешно оформлен" });
    
  } catch (error) {
    res.status(500).json({ message: "Ошибка при оформлении заказа" });
  }
};

const getDeliveryCost = (req, res) => {
  const { totalPrice, lat, lon } = req.query;

  if (!totalPrice || !lat || !lon) {
    return res.status(400).json({ message: "Нужно указать totalPrice, lat и lon" });
  }

  const distance = getDistanceFromWarehouse(parseFloat(lat), parseFloat(lon));
  const deliveryCost = calculateDeliveryCost(parseFloat(totalPrice), distance);

  res.json({ deliveryCost });
};

const updateOrderStatus = async (req, res) => {
  try {
    const { orderId, newStatus } = req.body;

    // Ищем заказ
    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({ message: "Заказ не найден." });
    }

    // Обновляем статус
    order.status = newStatus;
    await order.save();

    res.json({ message: "Статус заказа обновлён!", order });
  } catch (error) {
    res.status(500).json({ message: "Ошибка сервера" });
  }
};

const getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id;

    const orders = await Order.findAll({
      where: { userId },
      order: [["createdAt", "DESC"]],
    });

    const formattedOrders = orders.map((order) => ({
      ...order.toJSON(),
      orderDetails: JSON.parse(order.orderDetails || "[]"), // ✅ Преобразуем строку JSON в массив
    }));

    res.json(formattedOrders);
  } catch (error) {
    console.error("Ошибка получения заказов:", error);
    res.status(500).json({ message: "Ошибка получения заказов" });
  }
};

const getActiveOrder = async (req, res) => {
  try {
    
    const userId = req.user ? req.user.id : null;
    const order = await Order.findOne({
      where: { userId, status: "Pending" },
    });

    if (!order) {
      return res.json(null);
    }

    // ✅ Извлекаем товары из formData (потому что они там сохранены)
    let orderItems = [];
    try {
      const parsedData = order.formData ? JSON.parse(order.formData) : {};
      orderItems = parsedData.orderDetails || []; // Берём товары
    } catch (error) {
      console.error("Ошибка парсинга formData:", error);
    }

    // ✅ Добавляем товары в ответ
    res.json({
      ...order.toJSON(),
      order_items: orderItems,
    });
  } catch (error) {
    console.error("Ошибка получения активного заказа:", error);
    res.status(500).json({ message: "Ошибка сервера при получении заказа." });
  }

  async function createOrder(req, res) {
    try {
      const { orderDetails } = req.body; // Получаем товары из заказа
  
      for (let item of orderDetails) {
        const device = await Device.findByPk(item.deviceId);
  
        if (!device) {
          return res.status(400).json({ message: `Товар ${item.name} не найден.` });
        }
  
        if (device.quantity < item.count) {
          return res.status(400).json({ message: `Товара ${item.name} недостаточно. Осталось ${device.quantity} шт.` });
        }
      }
  
      // Если все в порядке - создаем заказ
      // ❗️ Здесь добавить код сохранения заказа в базу
  
      return res.json({ message: "Заказ успешно оформлен!" });
    } catch (error) {
      console.error("Ошибка при создании заказа:", error);
      return res.status(500).json({ message: "Ошибка сервера при создании заказа." });
    }
  }

};

module.exports = {
  createOrder,
  getDeliveryCost,
  getUserOrders,
  getActiveOrder,
  updateOrderStatus,
};
