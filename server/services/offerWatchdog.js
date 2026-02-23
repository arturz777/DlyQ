const { Op } = require("sequelize");
const { Order, OrderDecline } = require("../models/models");
const { sendOrderToNextCourier } = require("./orderDistributionService");

const WATCH_MS = 1000;

function startOfferWatchdog(io) {
  setInterval(async () => {
    try {
      const now = new Date();

      const expired = await Order.findAll({
        where: {
          status: { [Op.in]: ["Waiting for courier", "Ready for pickup"] },

          courierId: { [Op.ne]: null },

          offerExpiresAt: { [Op.ne]: null, [Op.lte]: now },
        },
        limit: 50,
      });

      for (const o of expired) {
        const lastCourierId = o.courierId;

        o.courierId = null;
        o.offerCourierId = null;
        o.offerExpiresAt = null;
        await o.save();

        if (lastCourierId) {
          await OrderDecline.findOrCreate({
            where: { orderId: o.id, courierId: lastCourierId },
            defaults: { orderId: o.id, courierId: lastCourierId },
          });
        }

        await sendOrderToNextCourier(o, { io });
      }
    } catch (e) {
      console.error("offer watchdog error:", e);
    }
  }, WATCH_MS);
}

module.exports = { startOfferWatchdog };
