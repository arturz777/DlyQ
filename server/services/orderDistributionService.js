const { Order, Courier, OrderDecline, Seller } = require("../models/models");
const { Op } = require("sequelize");
const { sendWarehouseOrderPushToCourier } = require("./pushService");

const ACTIVE_STATUSES = [
  "Waiting for courier",
  "Ready for pickup",
  "Picked up",
  "Arrived at destination",
];

const OFFER_TTL_SECONDS = 15;

async function getPickupPoint(order) {
  if (order.pickupLat != null && order.pickupLng != null) {
    return { lat: Number(order.pickupLat), lng: Number(order.pickupLng) };
  }

  if (order.sellerId) {
    const s = await Seller.findByPk(order.sellerId, {
      attributes: ["pickupLat", "pickupLng"],
    });

    if (s?.pickupLat != null && s?.pickupLng != null) {
      return { lat: Number(s.pickupLat), lng: Number(s.pickupLng) };
    }
  }

  return null;
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}

async function sendOrderToNextCourier(order, { io } = {}) {
  const fresh = order?.id ? await Order.findByPk(order.id) : null;
  if (!fresh) return;

  if (!["Waiting for courier", "Ready for pickup"].includes(fresh.status))
    return;
  if (fresh.courierId) return;

  const now = new Date();
  if (
    fresh.offerCourierId &&
    fresh.offerExpiresAt &&
    fresh.offerExpiresAt > now
  ) {
    return;
  }

  const couriers = await Courier.findAll({
    where: {
      status: "online",
      expoPushToken: { [Op.ne]: null },
    },
    attributes: ["id", "name", "currentLat", "currentLng", "expoPushToken"],
    raw: true,
  });

  if (!couriers.length) {
    console.warn("sendOrderToNextCourier: нет онлайн-курьеров");
    return;
  }

  const busyOrders = await Order.findAll({
    where: {
      [Op.or]: [
        {
          courierId: { [Op.ne]: null },
          status: { [Op.in]: ACTIVE_STATUSES },
        },
        {
          offerCourierId: { [Op.ne]: null },
          offerExpiresAt: { [Op.gt]: now },
        },
      ],
    },
    attributes: ["courierId", "offerCourierId"],
    raw: true,
  });

  const busyCouriers = new Set();
  for (const o of busyOrders) {
    if (o.courierId) busyCouriers.add(Number(o.courierId));
    if (o.offerCourierId) busyCouriers.add(Number(o.offerCourierId));
  }

  const declines = await OrderDecline.findAll({
    where: { orderId: fresh.id },
    attributes: ["courierId"],
    raw: true,
  });

  const declinedSet = new Set(declines.map((d) => Number(d.courierId)));

  let candidates = couriers.filter(
    (c) => !declinedSet.has(Number(c.id)) && !busyCouriers.has(Number(c.id))
  );

  if (!candidates.length) {
    await OrderDecline.destroy({ where: { orderId: fresh.id } });
    candidates = couriers.filter((c) => !busyCouriers.has(Number(c.id)));
  }

  if (!candidates.length) {
    console.warn("sendOrderToNextCourier: все курьеры заняты");
    return;
  }

  const pickup = await getPickupPoint(fresh);

  candidates = candidates
    .map((c) => {
      let dist = Number.POSITIVE_INFINITY;

      if (
        pickup &&
        c.currentLat != null &&
        c.currentLng != null &&
        Number.isFinite(Number(c.currentLat)) &&
        Number.isFinite(Number(c.currentLng))
      ) {
        dist = haversineMeters(
          pickup.lat,
          pickup.lng,
          Number(c.currentLat),
          Number(c.currentLng)
        );
      }

      return { ...c, dist };
    })
    .sort((a, b) => {
      if (a.dist !== b.dist) return a.dist - b.dist;
      return Number(a.id) - Number(b.id);
    });

  const nextCourier = candidates[0];

  fresh.offerCourierId = nextCourier.id;
  fresh.offerExpiresAt = new Date(Date.now() + OFFER_TTL_SECONDS * 1000);
  await fresh.save();

  await sendWarehouseOrderPushToCourier(fresh, nextCourier);

  if (io) {
    io.to(`courier:${nextCourier.id}`).emit("warehouseOrder", {
      id: fresh.id,
    });
  }

  setTimeout(async () => {
    try {
      const o = await Order.findByPk(fresh.id);
      if (!o) return;
      if (o.courierId) return;

      if (Number(o.offerCourierId) !== Number(nextCourier.id)) return;

      o.offerCourierId = null;
      o.offerExpiresAt = null;
      await o.save();

      await OrderDecline.findOrCreate({
        where: { orderId: o.id, courierId: nextCourier.id },
        defaults: { orderId: o.id, courierId: nextCourier.id },
      });

      await sendOrderToNextCourier(o, { io });
    } catch (e) {
      console.error("offer expire -> next courier error:", e);
    }
  }, (OFFER_TTL_SECONDS + 1) * 1000);
}

module.exports = {
  sendOrderToNextCourier,
};
