const { Courier } = require("../models/models");
const { Op } = require("sequelize");
const admin = require("../config/firebaseAdmin");

async function sendFcmToToken(token, payload) {
  try {
    const res = await admin.messaging().send({
      token,
      notification: payload.notification,
      data: payload.data,
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "default",
        },
      },
    });

    console.log("✅ FCM push sent:", res);
    return true;
  } catch (err) {
    console.error("❌ FCM push error:", err.code || err.message || err);

    if (
      err.code === "messaging/registration-token-not-registered" ||
      err.code === "messaging/invalid-registration-token"
    ) {
      console.warn("⚠️ Удаляем невалидный FCM токен:", token);
      await Courier.update(
        { expoPushToken: null },
        { where: { expoPushToken: token } }
      );
    }

    return false;
  }
}

async function sendOrderAssignedPush(order) {
  try {
    if (!order.courierId) {
      console.warn("sendOrderAssignedPush: у заказа нет courierId");
      return;
    }

    const courier = await Courier.findByPk(order.courierId);
    if (!courier) {
      console.warn("sendOrderAssignedPush: курьер не найден", order.courierId);
      return;
    }

    const token = courier.expoPushToken;
    if (!token) {
      console.warn("sendOrderAssignedPush: у курьера нет FCM токена");
      return;
    }

    const isReady = order.status === "Ready for pickup";

    const payload = {
      notification: {
        title: isReady ? "Заказ готов" : "Заказ назначен вам",
        body: order.deliveryAddress
          ? isReady
            ? `Заказ готов: ${order.deliveryAddress}`
            : `Новый заказ: ${order.deliveryAddress}`
          : isReady
          ? `Заказ #${order.id} готов`
          : `Вам назначен заказ #${order.id}`,
        sound: "default",
      },
      data: {
        type: isReady ? "ready" : "assigned",
        orderId: String(order.id),
        status: order.status || "",
        deliveryAddress: order.deliveryAddress || "",
      },
    };

    await sendFcmToToken(token, payload);
  } catch (err) {
    console.error("❌ Ошибка отправки push для курьера:", err);
  }
}

async function sendWarehouseOrderPush(order) {
  try {
    const couriers = await Courier.findAll({
      where: {
        expoPushToken: { [Op.ne]: null },
        status: "online",
      },
    });

    if (!couriers.length) {
      console.warn("sendWarehouseOrderPush: нет онлайн курьеров с токенами");
      return;
    }

    const isReady = order.status === "Ready for pickup";

    const payload = {
      notification: {
        title: isReady ? "Заказ готов" : "Новый заказ",
        body: order.deliveryAddress
          ? isReady
            ? `Заказ готов: ${order.deliveryAddress}`
            : `Новый заказ: ${order.deliveryAddress}`
          : isReady
          ? `Заказ #${order.id} готов`
          : `Новый заказ #${order.id}`,
        sound: "default",
      },
      data: {
        type: isReady ? "warehouse_ready" : "warehouse",
        orderId: String(order.id),
        status: order.status || "",
        deliveryAddress: order.deliveryAddress || "",
      },
    };

    for (const courier of couriers) {
      const token = courier.expoPushToken;
      if (!token) continue;
      await sendFcmToToken(token, payload);
    }
  } catch (err) {
    console.error("❌ Ошибка отправки push для склада:", err);
  }
}

module.exports = {
  sendOrderAssignedPush,
  sendWarehouseOrderPush,
};
