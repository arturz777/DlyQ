const { Op } = require("sequelize");
const { Order, Courier, OrderDecline, Seller } = require("../models/models");
const { sendWarehouseOrderPushToCourier } = require("./pushService");

const ACTIVE_STATUSES = [
  "Waiting for courier",
  "Ready for pickup",
  "Picked up",
  "Arrived at destination",
];

const OFFER_TTL_SECONDS = 15;

const BASE_POOL_METERS = 200;
const PERFECT_BONUS_METERS = 500;
const MAX_POOL_METERS = 600;

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

function calcAcceptRate(c) {
  const sent = Number(c?.offersSent || 0);
  const acc = Number(c?.offersAccepted || 0);
  if (sent <= 0) return 100;
  return Math.max(0, Math.min(100, Math.floor((acc / sent) * 100)));
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
    attributes: [
      "id",
      "name",
      "currentLat",
      "currentLng",
      "expoPushToken",
      "offersSent",
      "offersAccepted",
    ],
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

  candidates = candidates.map((c) => {
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

    return {
      ...c,
      dist,
      acceptRate: calcAcceptRate(c),
      offersSent: Number(c.offersSent || 0),
      _tie: Math.random(),
    };
  });

  const finite = candidates.filter((c) => Number.isFinite(c.dist));
  const bestDist = finite.length
    ? Math.min(...finite.map((c) => c.dist))
    : null;

  let pool = candidates;

  if (bestDist != null) {
    const baseWindow = bestDist + BASE_POOL_METERS;
    const bonusWindow = bestDist + BASE_POOL_METERS + PERFECT_BONUS_METERS;

    const baseLimit = Math.min(MAX_POOL_METERS, baseWindow);
    const bonusLimit = Math.min(MAX_POOL_METERS, bonusWindow);

    const perfectWithinBonus = finite.some(
      (c) => c.acceptRate === 100 && c.dist <= bonusLimit
    );

    const limit = perfectWithinBonus ? bonusLimit : baseLimit;

    pool = finite.filter((c) => c.dist <= limit);

    if (!pool.length) pool = candidates;
  }

  pool.sort((a, b) => {
    if (b.acceptRate !== a.acceptRate) return b.acceptRate - a.acceptRate;

    const aFin = Number.isFinite(a.dist);
    const bFin = Number.isFinite(b.dist);

    if (aFin && bFin && a.dist !== b.dist) return a.dist - b.dist;
    if (aFin && !bFin) return -1;
    if (!aFin && bFin) return 1;

    if (a.offersSent !== b.offersSent) return a.offersSent - b.offersSent;
    return a._tie - b._tie;
  });

  const nextCourier = pool[0];

  fresh.offerCourierId = nextCourier.id;
  fresh.offerExpiresAt = new Date(Date.now() + OFFER_TTL_SECONDS * 1000);
  await fresh.save();

  try {
    await Courier.increment("offersSent", {
      by: 1,
      where: { id: nextCourier.id },
    });
  } catch (e) {
    console.error("offersSent increment error:", e);
  }

  await sendWarehouseOrderPushToCourier(fresh, nextCourier);

  if (io) {
    io.to(`courier:${nextCourier.id}`).emit("warehouseOrder", { id: fresh.id });
  }

  setTimeout(async () => {
    try {
      const o = await Order.findByPk(fresh.id);
      if (!o) return;
      if (o.courierId) return;

      if (Number(o.offerCourierId) !== Number(nextCourier.id)) return;

      const now2 = new Date();
      if (o.offerExpiresAt && o.offerExpiresAt > now2) return;

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
