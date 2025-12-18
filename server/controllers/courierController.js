const { Op } = require("sequelize");
const fetch = require("node-fetch");
const { Order, Courier, OrderDecline, Seller } = require("../models/models");
const {
  sendOrderToNextCourier,
} = require("../services/orderDistributionService");

const PARCEL_FLOW = [
  "Accepted",
  "Arrived at pickup",
  "In transit",
  "Arrived at destination",
  "Delivered",
];

const PARCEL_STATUSES = new Set([
  "Accepted",
  "Arrived at pickup",
  "In transit",
  "Arrived at destination",
  "Delivered",
]);

const COURIER_ACTIVE_STATUSES = [
  "Waiting for courier",
  "Ready for pickup",
  "Picked up", 
  "Accepted",
  "Arrived at pickup",
  "In transit",
  "Arrived at destination",
];

function canMoveParcel(from, to) {
  const i = PARCEL_FLOW.indexOf(from);
  return i !== -1 && PARCEL_FLOW[i + 1] === to;
}

function buildCourierName(user) {
  const parts = [];
  if (user.firstName) parts.push(user.firstName);
  if (user.lastName) parts.push(user.lastName);
  const full = parts.join(" ").trim();

  if (full) return full;
  if (user.email) return user.email;
  return `Courier #${user.id}`;
}

function safeParse(v, fallback) {
  if (v == null) return fallback;
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return fallback;
    }
  }
  if (typeof v === "object") return v;
  return fallback;
}

class CourierController {
  async savePushToken(req, res) {
    try {
      const { token } = req.body;
      const courierId = req.user?.id;

      if (!courierId) {
        console.warn("⚠️ savePushToken: нет req.user, авторизация не прошла");
        return res.status(401).json({ message: "Вы не авторизованы." });
      }

      if (!token) {
        console.warn("⚠️ savePushToken: пустой token");
        return res.status(400).json({ message: "Токен не передан." });
      }

      let courier = await Courier.findByPk(courierId);
      if (!courier) {
        courier = await Courier.create({
          id: courierId,
          name: buildCourierName(req.user),
          status: "offline",
        });
      }

      courier.expoPushToken = token;
      await courier.save();

      return res.json({ message: "Push-токен сохранён" });
    } catch (error) {
      console.error("❌ Ошибка сохранения push-токена:", error);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async getAllCouriers(req, res) {
    try {
      const couriers = await Courier.findAll({
        attributes: [
          "id",
          "name",
          "currentLat",
          "currentLng",
          "status",
          "expoPushToken",
        ],
      });
      res.json(couriers);
    } catch (error) {
      console.error("Ошибка получения курьеров:", error);
      res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async getSelf(req, res) {
    try {
      const courierId = req.user.id;
      if (!courierId) {
        return res.status(401).json({ message: "Вы не авторизованы." });
      }

      let courier = await Courier.findByPk(courierId);

      if (!courier) {
        courier = await Courier.create({
          id: courierId,
          name: buildCourierName(req.user),
          status: "offline",
        });
      }

      return res.json({
        id: courier.id,
        name: courier.name,
        status: courier.status,
        currentLat: courier.currentLat,
        currentLng: courier.currentLng,
        expoPushToken: courier.expoPushToken,
      });
    } catch (error) {
      console.error("❌ Ошибка получения курьера:", error);
      return res.status(500).json({ message: "Ошибка сервера" });
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
          status: { [Op.in]: COURIER_ACTIVE_STATUSES },
          [Op.or]: [
            { courierId: courierId },
            { courierId: null, offerCourierId: courierId },
          ],
        },

        order: [["createdAt", "DESC"]],
        attributes: [
          "id",
          "orderType",
          "status",
          "pickupAddress",
          "pickupLat",
          "pickupLng",
          "deliveryLat",
          "deliveryLng",
          "deliveryAddress",
          "orderDetails",
          "deliveryPrice",
          "courierFee",
          "courierId",
          "offerExpiresAt",
          "offerCourierId",
          "sellerId",
        ],
      });

      if (orders.length === 0) {
        return res.json([]);
      }

      const sellerIds = [
        ...new Set(orders.map((o) => o.sellerId).filter(Boolean)),
      ];

      const sellers = sellerIds.length
        ? await Seller.findAll({
            where: { id: sellerIds },
            attributes: ["id", "address", "pickupLat", "pickupLng"],
          })
        : [];

      const sellerMap = new Map(sellers.map((s) => [s.id, s]));

      const formattedOrders = orders.map((order) => {
        const o = order.toJSON();
        const s = o.sellerId ? sellerMap.get(o.sellerId) : null;

        const isParcel = o.orderType === "parcel";

        return {
          ...o,
          orderDetails: safeParse(order.orderDetails, []),
          pickupAddress: isParcel
            ? o.pickupAddress || null
            : o.pickupAddress || s?.address || null,
          pickupLat: isParcel
            ? o.pickupLat ?? null
            : o.pickupLat ?? s?.pickupLat ?? null,
          pickupLng: isParcel
            ? o.pickupLng ?? null
            : o.pickupLng ?? s?.pickupLng ?? null,
        };
      });

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
          name: buildCourierName(req.user),
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
      order.offerCourierId = null;
      order.offerExpiresAt = null;
      const isParcel = order.orderType === "parcel";

     if (isParcel) {
  order.status = "Accepted";
}

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

      let pickupAddress = null,
        pickupLat = null,
        pickupLng = null;

      if (isParcel) {
        pickupAddress = order.pickupAddress || null;
        pickupLat = order.pickupLat ?? null;
        pickupLng = order.pickupLng ?? null;
      } else {
        const s = order.sellerId ? await Seller.findByPk(order.sellerId) : null;
        pickupAddress = order.pickupAddress || s?.address || null;
        pickupLat = order.pickupLat ?? s?.pickupLat ?? null;
        pickupLng = order.pickupLng ?? s?.pickupLng ?? null;
      }

      return res.json({
        id: order.id,
        orderType: order.orderType,
        status: order.status,

        deliveryLat: order.deliveryLat,
        deliveryLng: order.deliveryLng,
        deliveryAddress: order.deliveryAddress,

        deliveryPrice: order.deliveryPrice,
        courierFee: order.courierFee,
        courierId: order.courierId,

        pickupAddress,
        pickupLat,
        pickupLng,
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

      let courier = await Courier.findByPk(courierId);

      if (!courier) {
        courier = await Courier.create({
          id: courierId,
          name: buildCourierName(req.user),
          status: "offline",
        });
      }

      courier.status = status;
      await courier.save();

      const io = req.app.get("io");
      io.emit("courierStatusUpdate", { courierId, status });

      if (status === "online") {
        try {
          const ACTIVE_STATUSES = ["Waiting for courier", "Ready for pickup"];

          const waitingOrders = await Order.findAll({
            where: {
              status: { [Op.in]: ACTIVE_STATUSES },
              courierId: null,
              offerCourierId: null,
            },
            order: [["createdAt", "ASC"]],
          });

          for (const order of waitingOrders) {
            await sendOrderToNextCourier(order);
          }
        } catch (err) {
          console.error(
            "❌ Ошибка автораспределения заказов при выходе курьера в онлайн:",
            err
          );
        }
      }

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

      const isParcel = order.orderType === "parcel";

      if (isParcel) {
        if (!PARCEL_STATUSES.has(status)) {
          return res
            .status(400)
            .json({ message: "Неверный статус для parcel" });
        }
        if (!canMoveParcel(order.status, status)) {
          return res.status(400).json({
            message: `Нельзя перейти ${order.status} → ${status}`,
          });
        }
      }

      order.status = status;

      if (isParcel && status === "In transit") {
        const estimatedTime = await calculateRouteTime(order);
        order.estimatedTime = estimatedTime;
        order.pickupStartTime = new Date();
      }

      if (!isParcel && status === "Picked up") {
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

      try {
        const ACTIVE_STATUSES = ["Waiting for courier", "Ready for pickup"];

        const waitingOrders = await Order.findAll({
          where: {
            status: { [Op.in]: ACTIVE_STATUSES },
            courierId: null,
            offerCourierId: null,
          },
          order: [["createdAt", "ASC"]],
        });

        for (const o of waitingOrders) {
          await sendOrderToNextCourier(o);
        }
      } catch (err) {
        console.error(
          "❌ Ошибка автораспределения заказов после завершения доставки:",
          err
        );
      }

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

      if (lat == null || lng == null) {
        return res.status(400).json({ message: "Координаты не переданы." });
      }

      let courier = await Courier.findByPk(courierId);

      if (!courier) {
        courier = await Courier.create({
          id: courierId,
          name: buildCourierName(req.user),
          status: "offline",
        });
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

  async declineOrder(req, res) {
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

      await OrderDecline.findOrCreate({
        where: { orderId: order.id, courierId },
        defaults: { orderId: order.id, courierId },
      });

      await sendOrderToNextCourier(order);

      const io = req.app.get("io");

      const courierPayload = {
        id: order.id,
        status: order.status,
        deliveryLat: order.deliveryLat,
        deliveryLng: order.deliveryLng,
        deliveryAddress: order.deliveryAddress,
        deliveryPrice: order.deliveryPrice,
        courierFee: order.courierFee,
        courierId: order.courierId,
        offerExpiresAt: order.offerExpiresAt,
      };

      io.emit("warehouseOrder", courierPayload);

      return res.json({ message: "Заказ отклонён", orderId: order.id });
    } catch (error) {
      console.error("❌ Ошибка отклонения заказа курьером:", error);
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
