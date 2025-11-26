const { Order, Courier, OrderDecline } = require("../models/models");
const { Op } = require("sequelize");
const { sendWarehouseOrderPushToCourier } = require("./pushService");

const ACTIVE_STATUSES = [
  "Waiting for courier",
  "Ready for pickup",
  "Picked up",
  "Arrived at destination",
];

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

  const activeOrders = await Order.findAll({
    where: {
      courierId: { [Op.ne]: null },
      status: { [Op.in]: ACTIVE_STATUSES },
    },
    attributes: ["courierId"],
  });

  const busyCouriers = new Set(activeOrders.map((o) => o.courierId));

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
      "sendOrderToNextCourier: все онлайн-курьеры сейчас с активными заказами"
    );
    return;
  }

  const nextCourier = candidates[0];
  await sendWarehouseOrderPushToCourier(order, nextCourier);
}

module.exports = {
  sendOrderToNextCourier,
};
