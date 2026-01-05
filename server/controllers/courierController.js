const { Op, fn, col, literal } = require("sequelize");
const fetch = require("node-fetch");
const {
  Order,
  Courier,
  OrderDecline,
  Seller,
  User,
} = require("../models/models");
const {
  sendOrderToNextCourier,
} = require("../services/orderDistributionService");
const { scheduleCourierSearch } = require("../services/courierSearchScheduler");

const PARCEL_FLOW = [
  "Accepted",
  "Arrived at pickup",
  "In transit",
  "Arrived at destination",
  "Delivered",
];

const PARCEL_STATUSES = new Set(PARCEL_FLOW);

const COURIER_ACTIVE_STATUSES = [
  "Waiting for courier",
  "Ready for pickup",
  "Picked up",
  "Accepted",
  "Arrived at pickup",
  "In transit",
  "Arrived at destination",
];

function calcAcceptRate(sent, acc) {
  sent = Number(sent || 0);
  acc = Number(acc || 0);
  if (sent <= 0) return 100;
  return Math.max(0, Math.min(100, Math.floor((acc / sent) * 100)));
}

async function bumpAcceptRate(courierId, delta) {
  const c = await Courier.findByPk(courierId, {
    attributes: ["id", "acceptRate"],
    raw: true,
  });
  console.log("bumpAcceptRate raw", { courierId, delta, acceptRate: c?.acceptRate, pid: process.pid, host: process.env.HOSTNAME });
  if (!c) return;

  const cur = Number.isFinite(Number(c.acceptRate))
    ? Number(c.acceptRate)
    : 100;
  const next = Math.max(0, Math.min(100, cur + Number(delta || 0)));

  console.log("bumpAcceptRate", { courierId, cur, delta, next });

  if (next !== cur) {
    c.acceptRate = next;
    await c.save();
  }
}

function buildCustomerName(u) {
  if (!u) return null;
  const parts = [];
  if (u.firstName) parts.push(u.firstName);
  if (u.lastName) parts.push(u.lastName);
  const full = parts.join(" ").trim();
  if (full) return full;
  if (u.email) return u.email;
  return null;
}

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
  async getHistory(req, res) {
    try {
      const courierId = req.user?.id;
      if (!courierId)
        return res.status(401).json({ message: "Вы не авторизованы." });

      const { from, to } = req.query;

      const where = { courierId, status: "Delivered" };

      const timeField = Order.rawAttributes?.deliveredAt
        ? "deliveredAt"
        : "updatedAt";

      if (from || to) {
        where[timeField] = {};
        if (from) where[timeField][Op.gte] = new Date(from);
        if (to) where[timeField][Op.lt] = new Date(to);
      }

      const orders = await Order.findAll({
        where,
        order: [[timeField, "DESC"]],
        attributes: [
          "id",
          "orderType",
          "sellerId",
          "userId",
          "pickupAddress",
          "deliveryAddress",
          "totalPrice",
          timeField,
          "createdAt",
        ],
        raw: true,
      });

      const sellerIds = [
        ...new Set(orders.map((o) => o.sellerId).filter(Boolean)),
      ];

      const sellers = sellerIds.length
        ? await Seller.findAll({
            where: { id: { [Op.in]: sellerIds } },
            attributes: ["id", "name", "kind"],
            raw: true,
          })
        : [];

      const sellerMap = new Map(sellers.map((s) => [Number(s.id), s]));

      const userIds = [...new Set(orders.map((o) => o.userId).filter(Boolean))];

      const users = userIds.length
        ? await User.findAll({
            where: { id: { [Op.in]: userIds } },
            attributes: ["id", "firstName", "lastName", "phone", "email"],
            raw: true,
          })
        : [];

      const userMap = new Map(users.map((u) => [Number(u.id), u]));

      return res.json(
        orders.map((o) => {
          const seller = o.sellerId ? sellerMap.get(Number(o.sellerId)) : null;
          const u = o.userId ? userMap.get(Number(o.userId)) : null;

          const kind =
            o.orderType === "parcel"
              ? "parcel"
              : seller
              ? "restaurant"
              : "market";

          return {
            id: o.id,
            kind,
            sellerName: seller?.name || null,
            deliveredAt: o[timeField] || o.createdAt,
            pickupAddress: o.pickupAddress || null,
            deliveryAddress: o.deliveryAddress || null,
            sum: Number(o.totalPrice || 0),
            customerName: o.customerName || buildCustomerName(u) || null,
            customerPhone: o.customerPhone || u?.phone || null,
          };
        })
      );
    } catch (e) {
      console.error("getHistory error:", e);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async getFinance(req, res) {
    try {
      const courierId = req.user?.id;
      if (!courierId)
        return res.status(401).json({ message: "Вы не авторизованы." });

      const { from, to } = req.query;

      const where = { courierId, status: "Delivered" };
      if (from && to)
        where.updatedAt = { [Op.gte]: new Date(from), [Op.lt]: new Date(to) };

      const row = await Order.findOne({
        where,
        attributes: [
          [fn("COUNT", col("id")), "trips"],
          [fn("COALESCE", fn("SUM", col("courierFeeGross")), 0), "gross"],
          [fn("COALESCE", fn("SUM", col("courierCommission")), 0), "withheld"],
          [fn("COALESCE", fn("SUM", col("courierFee")), 0), "net"],
        ],
        raw: true,
      });

      const courier = await Courier.findByPk(courierId, {
        attributes: ["acceptRate"],
        raw: true,
      });

      const acceptRate = Number(courier?.acceptRate ?? 100);

      return res.json({
        trips: Number(row?.trips || 0),
        gross: Number(Number(row?.gross || 0).toFixed(2)),
        withheld: Number(Number(row?.withheld || 0).toFixed(2)),
        net: Number(Number(row?.net || 0).toFixed(2)),
        bonuses: 0,
        tips: 0,
        acceptRate,
      });
    } catch (e) {
      console.error("getFinance error:", e);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

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
          acceptRate: 100,
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
          "courierFeeGross",
          "courierCommission",
          "courierCommissionRate",
          "offerExpiresAt",
          "offerCourierId",
          "sellerId",
          "userId",
          "processingTime",
          "processingStartTime",
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

      const userIds = [...new Set(orders.map((o) => o.userId).filter(Boolean))];

      const users = userIds.length
        ? await User.findAll({
            where: { id: { [Op.in]: userIds } },
            attributes: ["id", "firstName", "lastName", "phone", "email"],
            raw: true,
          })
        : [];

      const userMap = new Map(users.map((u) => [Number(u.id), u]));

      const formattedOrders = orders.map((order) => {
        const o = order.toJSON();
        const s = o.sellerId ? sellerMap.get(o.sellerId) : null;
        const u = o.userId ? userMap.get(Number(o.userId)) : null;

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
          customerName: o.customerName || buildCustomerName(u) || null,
          customerPhone: o.customerPhone || u?.phone || null,
          processingTime: order.processingTime,
          processingStartTime: order.processingStartTime,
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

      if (order.courierId && String(order.courierId) !== String(courierId)) {
        return res.status(400).json({ message: "Заказ уже занят." });
      }

      if (
        order.offerCourierId &&
        String(order.offerCourierId) !== String(courierId)
      ) {
        return res
          .status(400)
          .json({ message: "Этот заказ вам не предлагался." });
      }

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

      const prevStatus = order.status;
      const isParcel = order.orderType === "parcel";
      const user = order.userId
        ? await User.findByPk(order.userId, {
            attributes: ["id", "firstName", "lastName", "phone", "email"],
          })
        : null;

      const customerName =
        order.customerName || buildCustomerName(user) || null;
      const customerPhone = order.customerPhone || user?.phone || null;

      order.courierId = courierId;
      order.acceptedAt = new Date();
      order.offerCourierId = null;
      order.offerExpiresAt = null;

      if (isParcel) {
        order.status = "Accepted";
      } else {
        order.status =
          prevStatus === "Ready for pickup" ? "Ready for pickup" : "Accepted";
      }

      await order.save();

      await Courier.increment("offersAccepted", {
        by: 1,
        where: { id: courierId },
      });

      await bumpAcceptRate(courierId, +1);

      const io = req.app.get("io");

      io.to(`order:${order.id}`).emit("orderStatusUpdate", {
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
        courierFeeGross: order.courierFeeGross,
        courierCommission: order.courierCommission,
        courierCommissionRate: order.courierCommissionRate,
        processingTime: order.processingTime,
        processingStartTime: order.processingStartTime,

        pickupAddress,
        pickupLat,
        pickupLng,
        customerName,
        customerPhone,
        userId: order.userId,
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
            attributes: [
              "id",
              "status",
              "orderType",
              "warehouseStatus",
              "processingTime",
              "processingStartTime",
              "courierId",
              "offerCourierId",
              "offerExpiresAt",
            ],
          });

          const io = req.app.get("io");

          for (const o of waitingOrders) {
            await scheduleCourierSearch(o, io);
          }
        } catch (err) {
          console.error(
            "❌ Ошибка планирования распределения при выходе курьера в онлайн:",
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
      io.to(`order:${order.id}`).emit("orderStatusUpdate", {
        id: order.id,
        status: order.status,
        estimatedTime: order.estimatedTime ?? null,
        pickupStartTime: order.pickupStartTime ?? null,
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

      if (Order.rawAttributes?.deliveredAt) {
        order.deliveredAt = new Date();
      }

      await order.save();

      const io = req.app.get("io");
      io.to(`order:${order.id}`).emit("orderStatusUpdate", {
        id: order.id,
        status: order.status,
        estimatedTime: order.estimatedTime ?? null,
        pickupStartTime: order.pickupStartTime ?? null,
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
          attributes: [
            "id",
            "status",
            "orderType",
            "warehouseStatus",
            "processingTime",
            "processingStartTime",
            "courierId",
            "offerCourierId",
            "offerExpiresAt",
          ],
        });

        const io = req.app.get("io");

        for (const o of waitingOrders) {
          await scheduleCourierSearch(o, io);
        }
      } catch (err) {
        console.error(
          "❌ Ошибка планирования распределения после завершения доставки:",
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

      const activeOrders = await Order.findAll({
        where: {
          courierId,
          status: { [Op.in]: COURIER_ACTIVE_STATUSES },
        },
        attributes: ["id"],
      });

      for (const o of activeOrders) {
        io.to(`order:${o.id}`).emit("courierLocationUpdate", {
          orderId: o.id,
          lat,
          lng,
          courierId,
        });
      }

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

      if (String(order.offerCourierId) !== String(courierId)) {
        return res
          .status(400)
          .json({ message: "Этот заказ вам не предлагался." });
      }

      if (String(order.offerCourierId) === String(courierId)) {
        order.offerCourierId = null;
        order.offerExpiresAt = null;
        await order.save();
      }

      await Courier.update(
        {
          acceptRate: fn(
            "GREATEST",
            0,
            fn("LEAST", 100, literal('COALESCE("acceptRate", 100) - 1'))
          ),
        },
        { where: { id: courierId } }
      );

      const io = req.app.get("io");

      await OrderDecline.findOrCreate({
        where: { orderId: order.id, courierId },
        defaults: { orderId: order.id, courierId },
      });

      await sendOrderToNextCourier(order, { io });

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
