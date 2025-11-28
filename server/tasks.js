const schedule = require("node-schedule");
const { Op } = require("sequelize");
const fs = require("fs");
const path = require("path");
const { Order, OrderDecline, Courier } = require("./models/models");
const {
  sendOrderToNextCourier,
} = require("./services/orderDistributionService");

const ACTIVE_STATUSES = ["Waiting for courier", "Ready for pickup"];

async function processExpiredOffers() {
  const now = new Date();

  const expiredOrders = await Order.findAll({
    where: {
      status: { [Op.in]: ACTIVE_STATUSES },
      courierId: null,
      offerCourierId: { [Op.ne]: null },
      offerExpiresAt: { [Op.lt]: now },
    },
  });

  for (const order of expiredOrders) {
    const courierId = order.offerCourierId;

    if (courierId) {
      await OrderDecline.findOrCreate({
        where: { orderId: order.id, courierId },
        defaults: { orderId: order.id, courierId },
      });

      const courier = await Courier.findByPk(courierId);
      if (courier && courier.status === "online") {
        courier.status = "offline";
        await courier.save();
        console.log(
          `💤 Courier ${courierId} автоматически переведён в offline (проспал оффер)`
        );
      }
    }

    order.offerCourierId = null;
    order.offerExpiresAt = null;
    await order.save();

    await sendOrderToNextCourier(order);
  }
}

const setupCleanupTask = () => {
  // Удаление истории заказов минута- '* * * * *' 30 дней- '0 0 1 * *'
  schedule.scheduleJob("0 0 1 * *", async () => {
    try {
      const cutoffDate = new Date(
        new Date().getTime() - 30 * 24 * 60 * 60 * 1000
      ); // // какие заказы считаются "старыми". старше 30 дней - 30 * 24 * 60 * 60 * 1000 , Старше минуты-  - 1 * 60 * 1000

      // Находим заказы старше 30 дней
      const ordersToDelete = await Order.findAll({
        where: {
          createdAt: { [Op.lt]: cutoffDate },
        },
      });

      ordersToDelete.forEach((order) => {
        if (
          order.deviceImage &&
          !order.deviceImage.includes("placeholder.png") &&
          order.deviceImage.startsWith("orders/")
        ) {
          const filePath = path.resolve(__dirname, "static", order.deviceImage);
          if (fs.existsSync(filePath)) {
            console.log(`🗑 Удаляем изображение заказа: ${filePath}`);
            fs.unlinkSync(filePath);
          } else {
            console.warn(`⚠️ Файл не найден: ${filePath}`);
          }
        }
      });

      const deletedCount = await Order.destroy({
        where: {
          createdAt: { [Op.lt]: cutoffDate },
        },
      });

      console.log(`✅ Удалено заказов: ${deletedCount}`);
    } catch (error) {
      console.error("❌ Ошибка при удалении старых заказов:", error);
    }
  });
  setInterval(processExpiredOffers, 5000);
};

module.exports = setupCleanupTask;
