const { Courier, OrderDecline } = require("../models/models");
const { Op } = require("sequelize");
const { sendWarehouseOrderPushToCourier } = require("./pushService");

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

  const declines = await OrderDecline.findAll({
    where: { orderId: order.id },
  });

  const declinedSet = new Set(declines.map((d) => d.courierId));

  let candidates = couriers.filter((c) => !declinedSet.has(c.id));

  if (!candidates.length) {
    await OrderDecline.destroy({ where: { orderId: order.id } });
    candidates = couriers;
  }

  const nextCourier = candidates[0];
  if (!nextCourier) return;

  await sendWarehouseOrderPushToCourier(order, nextCourier);
}

module.exports = {
  sendOrderToNextCourier,
};
