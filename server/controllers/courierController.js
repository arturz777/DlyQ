const { Order, Courier } = require("../models/models");
const { Op } = require("sequelize");
const fetch = require("node-fetch");

class CourierController {
  async getAllCouriers(req, res) {
    try {
      const couriers = await Courier.findAll({
        attributes: ["id", "name", "currentLat", "currentLng", "status"],
      });
      res.json(couriers);
    } catch (error) {
      console.error("Ошибка получения курьеров:", error);
      res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async getActiveOrders(req, res) {
    try {
      const courierId = req.user.id;
      if (!courierId) {
        return res.status(401).json({ message: "Вы не авторизованы." });
      }

      const courier = await Courier.findByPk(courierId);
      if (!courier || courier.status !== "online") {
        return res.json([]);
      }

      const orders = await Order.findAll({
        where: {
          status: { [Op.or]: ["Waiting for courier", "Ready for pickup"] },
          [Op.or]: [{ courierId: null }, { courierId: courierId }],
        },

        order: [["createdAt", "DESC"]],
        attributes: [
          "id",
          "status",
          "deliveryLat",
          "deliveryLng",
          "deliveryAddress",
          "orderDetails",
        ],
      });

      if (orders.length === 0) {
        return res.json([]);
      }

      const formattedOrders = orders.map((order) => ({
        ...order.toJSON(),
        orderDetails: order.orderDetails ? JSON.parse(order.orderDetails) : [],
      }));

      return res.json(formattedOrders);
    } catch (error) {
      console.error("❌ Ошибка получения активных заказов:", error);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async acceptOrder(req, res) {
    try {
      const { id } = req.params;
      const courierId = req.user.id;

      if (!courierId) {
        return res.status(401).json({ message: "Вы не авторизованы." });
      }

      let courier = await Courier.findByPk(courierId);
      if (!courier) {
        courier = await Courier.create({
          id: courierId,
          name: req.user.name || "Админ-Курьер",
          status: "offline",
        });
      }

      const order = await Order.findByPk(id);

      if (!order) {
        return res.status(404).json({ message: "Заказ не найден." });
      }

      if (
        order.status !== "Waiting for courier" &&
        order.status !== "Ready for pickup"
      ) {
        return res
          .status(400)
          .json({ message: "Заказ уже занят или не доступен для курьера." });
      }

      order.courierId = courierId;
      order.acceptedAt = new Date();

      await order.save();

      const io = req.app.get("io");

      io.emit("orderStatusUpdate", {
        id: order.id,
        status: order.status,
        accepted: true,
        courierId: order.courierId,
        courierLocation:
          courier.currentLat && courier.currentLng
            ? { lat: courier.currentLat, lng: courier.currentLng }
            : null,
      });

      return res.json({
        id: order.id,
        status: order.status,
        deliveryLat: order.deliveryLat,
        deliveryLng: order.deliveryLng,
        deliveryAddress: order.deliveryAddress,
        courierId: order.courierId,
      });
    } catch (error) {
      console.error("❌ Ошибка принятия заказа:", error);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async toggleCourierStatus(req, res) {
    try {
      const { status } = req.body;
      const courierId = req.user.id;

      if (!courierId) {
        return res.status(401).json({ message: "Вы не авторизованы." });
      }

      const courier = await Courier.findByPk(courierId);
      if (!courier) {
        return res.status(404).json({ message: "Курьер не найден" });
      }

      courier.status = status;
      await courier.save();

      const io = req.app.get("io");
      io.emit("courierStatusUpdate", { courierId, status });

      return res.json({ message: `Вы в статусе: ${status}` });
    } catch (error) {
      console.error("❌ Ошибка смены статуса курьера:", error);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async updateDeliveryStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const courierId = req.user.id;

      if (!courierId) {
        return res.status(401).json({ message: "Вы не авторизованы." });
      }

      const order = await Order.findByPk(id);
      if (!order) {
        return res.status(404).json({ message: "Заказ не найден." });
      }

      if (order.courierId !== courierId) {
        return res
          .status(403)
          .json({ message: "Этот заказ вам не принадлежит." });
      }

      order.status = status;

      if (order.status === "Picked up") {
        const estimatedTime = await calculateRouteTime(order);
        order.estimatedTime = estimatedTime;
        order.pickupStartTime = new Date();
      }

      await order.save();

      const io = req.app.get("io");
      io.emit("orderStatusUpdate", {
        id: order.id,
        status: order.status,
        estimatedTime: order.estimatedTime || null,
      });

      return res.json(order);
    } catch (error) {
      console.error("❌ Ошибка обновления статуса доставки:", error);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async completeDelivery(req, res) {
    try {
      const { id } = req.params;
      const courierId = req.user.id;

      if (!courierId) {
        return res.status(401).json({ message: "Вы не авторизованы." });
      }

      const order = await Order.findByPk(id);
      if (!order) {
        return res.status(404).json({ message: "Заказ не найден." });
      }

      if (order.courierId !== courierId) {
        return res
          .status(403)
          .json({ message: "Этот заказ вам не принадлежит." });
      }

      order.status = "Delivered";
      order.estimatedTime = null;

      await order.save();

      const io = req.app.get("io");
      io.emit("orderStatusUpdate", {
        id: order.id,
        status: order.status,
        estimatedTime: null,
      });

      return res.json(order);
    } catch (error) {
      console.error("❌ Ошибка завершения доставки:", error);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async updateCourierLocation(req, res) {
    try {
      const { lat, lng } = req.body;
      const courierId = req.user.id;

      if (!courierId) {
        return res.status(401).json({ message: "Вы не авторизованы." });
      }

      if (!lat || !lng) {
        return res.status(400).json({ message: "Координаты не переданы." });
      }

      let courier = await Courier.findByPk(courierId);
      if (!courier) {
        return res.status(404).json({ message: "Курьер не найден." });
      }

      courier.currentLat = lat;
      courier.currentLng = lng;
      await courier.save();

      const io = req.app.get("io");
      io.emit("courierLocationUpdate", { courierId, lat, lng });

      return res.json({ message: "Местоположение обновлено!" });
    } catch (error) {
      console.error("❌ Ошибка обновления местоположения курьера:", error);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }
}

async function calculateRouteTime(order) {
  if (!order.deliveryLat || !order.deliveryLng) {
    return 15 * 60;
  }

  const courier = await Courier.findByPk(order.courierId);
  if (!courier || !courier.currentLat || !courier.currentLng) {
    return 15 * 60;
  }

  const API_KEY = "5b3ce3597851110001cf624889e39f2834a84a62aaca04f731838a64";
  const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${API_KEY}&start=${courier.currentLng},${courier.currentLat}&end=${order.deliveryLng},${order.deliveryLat}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.features && data.features.length > 0) {
      const realTime = Math.round(
        data.features[0].properties.segments[0].duration
      );
      return realTime;
    } else {
      console.warn(
        "⚠️ Не удалось получить данные маршрута, оставляем 15 минут."
      );
      return 15 * 60;
    }
  } catch (error) {
    console.error("❌ Ошибка получения маршрута:", error);
    return 15 * 60;
  }
}

module.exports = new CourierController();
