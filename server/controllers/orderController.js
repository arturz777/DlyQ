// server/controllers/orderController.js
const sendEmail = require("../services/emailService");
const { Order, Device, , Translation } = require("../models/models");
const { Op } = require("sequelize");
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
    const { formData, totalPrice, orderDetails, desiredDeliveryDate } =
      req.body;
    const {
      firstName,
      lastName,
      email,
      phone,
      address,
      apartment,
      comment,
      latitude,
      longitude,
    } = formData;

    const distance = getDistanceFromWarehouse(latitude, longitude);
    const deliveryPrice = calculateDeliveryCost(totalPrice, distance);

    if (!orderDetails || orderDetails.length === 0) {
      throw new Error("orderDetails не может быть пустым");
    }

    const userId = req.user ? req.user.id : null;
    let warehouseId = userId;

    let deviceImageUrl =
      orderDetails[0]?.image || "https://example.com/placeholder.png";

    if (deviceImageUrl.startsWith("http")) {
      // Проверяем, что это URL, а не локальный путь
      try {
        const response = await fetch(deviceImageUrl);
        if (!response.ok) throw new Error("Ошибка загрузки изображения с URL");

        const buffer = await response.arrayBuffer();
        const fileName = `orders/${uuid.v4()}${deviceImageUrl.substring(
          deviceImageUrl.lastIndexOf(".")
        )}`;

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
          return res
            .status(400)
            .json({ message: `Товар "${item.name}" не найден.` });
        }

        if (device.quantity < item.count && !item.isPreorder) {
          return res
            .status(400)
            .json({
              message: `Недостаточно товара: ${item.name}. Осталось ${device.quantity} шт.`,
            });
        }

        // 🔥 **Уменьшаем количество товара в базе**
        await device.update({ quantity: device.quantity - item.count });
      }

      let isPreorder = false;

      for (const item of orderDetails) {
        const device = await Device.findByPk(item.deviceId);

        if (!device) {
          return res
            .status(400)
            .json({ message: `Товар "${item.name}" не найден.` });
        }

        if (device.quantity < item.count) {
          isPreorder = true; // Если товара нет в наличии, это предзаказ
        } else {
          await device.update({ quantity: device.quantity - item.count });
        }
      }

      // Определяем статус заказа
      let status = "Pending";
      if (isPreorder || desiredDeliveryDate) {
        status = "preorder"; // Если предзаказ — статус "preorder"
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
      deliveryLat: latitude,
      deliveryLng: longitude,
      deliveryAddress: address,
      deviceImage: deviceImageUrl,
      productName:
        orderDetails.length > 0 ? orderDetails[0].name : "Неизвестный товар",
      orderDetails: JSON.stringify(orderDetails),
      desiredDeliveryDate: desiredDeliveryDate || null,
    });

    const io = req.app.get("io");
    io.emit("newOrder", order);

    // **Разделяем товары правильно:**
    const preorderAvailable = orderDetails.filter(
  (item) => item.isPreorder && item.desiredDeliveryDate && item.count > 0
);

    const preorderOutOfStock = orderDetails.filter(
      (item) => item.isPreorder && (!item.desiredDeliveryDate || item.count === 0)
    );
    
    const regularItems = orderDetails.filter((item) => !item.isPreorder);

    const generateTableRows = (items) => {
      return items
        .map(
          (item) => `
      <tr>
        <td><img src="${
          item.image
        }" width="50" height="50" style="border-radius:5px;"></td>
        <td>${item.name}</td>
        <td>${item.count} шт.</td>
        <td>${item.price} €</td>
        <td>${
          item.selectedOptions
            ? Object.entries(item.selectedOptions)
                .map(([key, value]) => `${key}: ${value.value}`)
                .join(", ")
            : "Нет опций"
        }
        </td>
      </tr>
    `
        )
        .join("");
    };

   const emailHTML = `
  <div style="font-family:Arial, sans-serif; color:#333; max-width:600px; padding:20px; border:1px solid #ddd; border-radius:8px;">

    ${regularItems.length > 0 ? `
      <h3>📦 Обычные товары:</h3>
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr style="background:#f8f8f8;">
            <th>Фото</th><th>Товар</th><th>Кол-во</th><th>Цена</th><th>Опции</th>
          </tr>
        </thead>
        <tbody>${generateTableRows(regularItems)}</tbody>
      </table>
    ` : ""}

    ${preorderAvailable.length > 0 ? `
      <h3>⏳ Предзаказ (товар есть, доставка позже):</h3>
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr style="background:#f8f8f8;">
            <th>Фото</th><th>Товар</th><th>Кол-во</th><th>Цена</th><th>Опции</th>
          </tr>
        </thead>
        <tbody>${generateTableRows(preorderAvailable)}</tbody>
      </table>
      <p><strong>Дата доставки:</strong> ${
        desiredDeliveryDate
          ? new Date(desiredDeliveryDate).toLocaleDateString("ru-RU")
          : "Ожидается подтверждение"
      }</p>
    ` : ""}

    ${preorderOutOfStock.length > 0 ? `
      <h3>🏭 Предзаказ (товар отсутствует, ждет поступления):</h3>
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr style="background:#f8f8f8;">
            <th>Фото</th><th>Товар</th><th>Кол-во</th><th>Цена</th><th>Опции</th>
          </tr>
        </thead>
        <tbody>${generateTableRows(preorderOutOfStock)}</tbody>
      </table>
    ` : ""}

    <h3>🚚 Доставка:</h3>
    <p><strong>Адрес:</strong> ${address}, квартира ${apartment || "-"}</p>
    <p><strong>Стоимость доставки:</strong> ${deliveryPrice.toFixed(2)} €</p>

    <h3>💳 Итоговая сумма:</h3>
    <p><strong>${(totalPrice + deliveryPrice).toFixed(2)} €</strong></p>

    <hr>
    <p>📞 Контактные данные:</p>
    <p><strong>Телефон:</strong> ${phone}</p>
    <p><strong>Email:</strong> ${email}</p>

    <p style="margin-top:20px;">Спасибо за ваш заказ! 🚀</p>
  </div>
`;


    // Отправляем письмо клиенту
    await sendEmail(email, "🛒 Заказ!", emailHTML, true);
    res.status(201).json({ message: "Заказ успешно оформлен" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Ошибка при оформлении заказа", error: error.message });
  }
};

const getDeliveryCost = (req, res) => {
  const { totalPrice, lat, lon } = req.query;

  if (!totalPrice || !lat || !lon) {
    return res
      .status(400)
      .json({ message: "Нужно указать totalPrice, lat и lon" });
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

   
    const deviceIds = orders.flatMap((order) =>
      JSON.parse(order.orderDetails || "[]").map((d) => d.deviceId)
    );

    if (deviceIds.length > 0) {
     
      const translations = await Translation.findAll({
        where: {
          key: {
            [Op.or]: deviceIds.map((id) => `device_${id}.name`),
          },
        },
      });

      const translationMap = {};
      translations.forEach((t) => {
        const deviceId = t.key.replace("device_", "").replace(".name", "");
        if (!translationMap[deviceId]) translationMap[deviceId] = {};
        translationMap[deviceId][t.lang] = t.text;
      });
      
      orders.forEach((order) => {
        const orderDetails = JSON.parse(order.orderDetails || "[]");
      
        orderDetails.forEach((detail) => {
          const translations = translationMap[detail.deviceId] || {};
          detail.translations = { name: translations };
      
          const lang = "ru"; // Можно менять на req.locale или заголовок запроса
          if (translations[lang]) {
            detail.name = translations[lang]; // Подставляем перевод
          }
        });
      
        order.orderDetails = orderDetails;
      });
      
    }

    res.json(orders);
  } catch (error) {
    console.error("❌ Ошибка получения заказов:", error);
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
};

module.exports = {
  createOrder,
  getDeliveryCost,
  getUserOrders,
  getActiveOrder,
  updateOrderStatus,
};
