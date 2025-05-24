const sendEmail = require("../services/emailService");
const { Order, Device, Translation, Courier } = require("../models/models");
const { Op } = require("sequelize");
const getDistanceFromWarehouse = require("../utils/distance");
const { supabase } = require("../config/supabaseClient");
const uuid = require("uuid");

const calculateDeliveryCost = (totalPrice, distance) => {
  let baseCost = 2;
  let distanceCost = distance * 0.5;
  let deliveryCost = baseCost + distanceCost;
  let discount = Math.floor(totalPrice / 30) * 2;

  deliveryCost = Math.max(0, deliveryCost - discount);
  return parseFloat(deliveryCost.toFixed(2));
};

const createOrder = async (req, res) => {
  console.log("🟡 [createOrder] ➜ Запрос на создание заказа получен");
  try {
    console.log("📥 Тело запроса (req.body):", JSON.stringify(req.body, null, 2));
    console.log("🔑 Авторизация: userId =", req.user ? req.user.id : "неавторизован");
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

    if (!formData || typeof formData !== "object") {
      console.error("❌ formData отсутствует или неверного формата");
      return res.status(400).json({ message: "Некорректные данные доставки (formData)" });
    }

    if (!orderDetails || !Array.isArray(orderDetails) || orderDetails.length === 0) {
      console.error("❌ orderDetails пустой или не массив");
      return res.status(400).json({ message: "Корзина пуста или повреждена" });
    }

    const userId = req.user ? req.user.id : null;
    let warehouseId = userId;

    const deliveryDateFromFirstItem = orderDetails[0]?.deliveryDate || null;
    const preferredTimeFromFirstItem = orderDetails[0]?.preferredTime || null;
    const distance = getDistanceFromWarehouse(latitude, longitude);
    const deliveryPrice = calculateDeliveryCost(totalPrice, distance);

     let isPreorder = false;
    const devicesToUpdate = [];

    for (const item of orderDetails) {
      const device = await Device.findByPk(item.deviceId);
      if (!device) {
        return res.status(400).json({ message: `Товар "${item.name}" не найден.` });
      }

        if (device.quantity < item.count && !item.isPreorder) {
        return res.status(400).json({
          message: `Недостаточно товара: ${item.name}. Осталось ${device.quantity} шт.`,
        });
      }

      if (device.quantity < item.count) {
        isPreorder = true;
      }

       if (device.quantity >= item.count) {
  devicesToUpdate.push({ device, count: item.count });
}
    }

    let status = "Pending";
    if (isPreorder || desiredDeliveryDate) {
      status = "preorder";
    }

    let deviceImageUrl =
      orderDetails[0]?.image || "https://example.com/placeholder.png";

    if (deviceImageUrl.startsWith("http")) {
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
    }

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
      desiredDeliveryDate: deliveryDateFromFirstItem
        ? new Date(deliveryDateFromFirstItem)
        : null,
      preferredDeliveryComment: preferredTimeFromFirstItem,
      formData: JSON.stringify(formData),
    });

    for (const { device, count } of devicesToUpdate) {
      await device.update({ quantity: device.quantity - count });
    }

    const io = req.app.get("io");
    io.emit("newOrder", order);

    const preorderAvailable = orderDetails.filter(
      (item) => item.isPreorder && item.desiredDeliveryDate && item.count > 0
    );

    const preorderOutOfStock = orderDetails.filter(
      (item) =>
        item.isPreorder && (!item.desiredDeliveryDate || item.count === 0)
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

    ${
      regularItems.length > 0
        ? `
      <h3>📦 Обычные товары:</h3>
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr style="background:#f8f8f8;">
            <th>Фото</th><th>Товар</th><th>Кол-во</th><th>Цена</th><th>Опции</th>
          </tr>
        </thead>
        <tbody>${generateTableRows(regularItems)}</tbody>
      </table>
    `
        : ""
    }

    ${
      preorderAvailable.length > 0
        ? `
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
    `
        : ""
    }

    ${
      preorderOutOfStock.length > 0
        ? `
      <h3>🏭 Предзаказ (товар отсутствует, ждет поступления):</h3>
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr style="background:#f8f8f8;">
            <th>Фото</th><th>Товар</th><th>Кол-во</th><th>Цена</th><th>Опции</th>
          </tr>
        </thead>
        <tbody>${generateTableRows(preorderOutOfStock)}</tbody>
      </table>
    `
        : ""
    }

    ${
      deliveryDateFromFirstItem
        ? `<p><strong>Предпочитаемая дата доставки:</strong> ${new Date(
            deliveryDateFromFirstItem
          ).toLocaleString()}</p>`
        : ""
    }
    ${
      preferredTimeFromFirstItem
        ? `<p><strong>Комментарий о времени:</strong> ${preferredTimeFromFirstItem}</p>`
        : ""
    }

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

    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({ message: "Заказ не найден." });
    }

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

          const lang = "ru";
          if (translations[lang]) {
            detail.name = translations[lang];
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
      where: {
        userId,
        status: {
          [Op.in]: [
            "Pending",
            "Waiting for courier",
            "Ready for pickup",
            "Picked up",
            "Arrived at destination",
            "Delivered",
          ],
        },
      },
      order: [["createdAt", "DESC"]],
    });

    if (!order) {
      return res.json(null);
    }

    let orderItems = [];
    try {
      const parsedData = order.formData ? JSON.parse(order.formData) : {};
      orderItems = parsedData.orderDetails || [];
    } catch (error) {
      console.error("Ошибка парсинга formData:", error);
    }

    res.json({
      ...order.toJSON(),
      order_items: orderItems,
    });
  } catch (error) {
    console.error("Ошибка получения активного заказа:", error);
    res.status(500).json({ message: "Ошибка сервера при получении заказа." });
  }
};

const getAllOrdersForAdmin = async (req, res) => {
  try {
    const orders = await Order.findAll({
      order: [["createdAt", "DESC"]],
    });

    res.json(orders);
  } catch (error) {
    console.error("❌ Ошибка получения заказов админом:", error);
    res.status(500).json({ message: "Ошибка сервера" });
  }
};

const adminUpdateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status, processingTime, estimatedTime } = req.body;

  const order = await Order.findByPk(id);
  if (!order) return res.status(404).json({ message: "Заказ не найден" });

  if (status) order.status = status;
  if (processingTime !== undefined) order.processingTime = processingTime;
  if (estimatedTime !== undefined) order.estimatedTime = estimatedTime;

  if (status === "Picked up") {
    order.pickupStartTime = new Date();
  }

  await order.save();

  const io = req.app.get("io");
  io.emit("orderStatusUpdate", order);

  return res.json({ message: "Обновлено", order });
};

const assignCourier = async (req, res) => {
  const { id } = req.params;
  const { courierId } = req.body;

  try {
    const order = await Order.findByPk(id);
    if (!order) return res.status(404).json({ message: "Заказ не найден" });

    const courier = await Courier.findByPk(courierId);
    if (!courier) return res.status(404).json({ message: "Курьер не найден" });

    order.courierId = courierId;
    await order.save();

    const io = req.app.get("io");
    io.emit("orderStatusUpdate", {
      id: order.id,
      status: order.status,
      courierId: order.courierId,
      deliveryLat: order.deliveryLat,
      deliveryLng: order.deliveryLng,
      deliveryAddress: order.deliveryAddress,
      orderDetails: order.orderDetails ? JSON.parse(order.orderDetails) : [],
    });

    res.json({ message: "Курьер назначен", order });
  } catch (error) {
    console.error("❌ Ошибка назначения курьера:", error);
    res.status(500).json({ message: "Ошибка сервера" });
  }
};

module.exports = {
  createOrder,
  getDeliveryCost,
  getUserOrders,
  getActiveOrder,
  updateOrderStatus,
  getAllOrdersForAdmin,
  adminUpdateOrderStatus,
  assignCourier,
};
