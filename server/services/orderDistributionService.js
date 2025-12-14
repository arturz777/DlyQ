const { Order, Courier, OrderDecline } = require("../models/models");
const { Op } = require("sequelize");
const { sendWarehouseOrderPushToCourier } = require("./pushService");

const ACTIVE_STATUSES = [
  "Waiting for courier",
  "Ready for pickup",
  "Picked up",
  "Arrived at destination",
];

const OFFER_TTL_SECONDS = 15;

async function sendOrderToNextCourier(order) {
  if (!["Waiting for courier", "Ready for pickup"].includes(order.status)) {
    return;
  }

  const couriers = await Courier.findAll({
    where: {
      status: "online",
      expoPushToken: { [Op.ne]: null },
    },
    order: [["id", "ASC"]],
  });

  if (!couriers.length) {
    console.warn("sendOrderToNextCourier: нет онлайн-курьеров");
    return;
  }

  const now = new Date();

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
  });

  const busyCouriers = new Set();
  for (const o of busyOrders) {
    if (o.courierId) busyCouriers.add(o.courierId);
    if (o.offerCourierId) busyCouriers.add(o.offerCourierId);
  }

  const declines = await OrderDecline.findAll({
    where: { orderId: order.id },
  });

  const declinedSet = new Set(declines.map((d) => d.courierId));

  let candidates = couriers.filter(
    (c) => !declinedSet.has(c.id) && !busyCouriers.has(c.id)
  );

  if (!candidates.length) {
    await OrderDecline.destroy({ where: { orderId: order.id } });
    candidates = couriers.filter((c) => !busyCouriers.has(c.id));
  }

  if (!candidates.length) {
    console.warn(
      "sendOrderToNextCourier: все онлайн-курьеры сейчас заняты (заказами или офферами)"
    );
    return;
  }

  const nextCourier = candidates[0];

  order.offerCourierId = nextCourier.id;
  order.offerExpiresAt = new Date(Date.now() + OFFER_TTL_SECONDS * 1000);
  await order.save();

  await sendWarehouseOrderPushToCourier(order, nextCourier);
}

module.exports = {
  sendOrderToNextCourier,
};
