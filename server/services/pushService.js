const { Courier } = require("../models/models");
const { Op } = require("sequelize");
const admin = require("../config/firebaseAdmin");

async function sendFcmToToken(token, payload) {
  try {
    const message = {
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
    };

    const res = await admin.messaging().send(message);
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

    const bodyText = order.deliveryAddress
      ? `Новый заказ: ${order.deliveryAddress}`
      : `Вам назначен заказ #${order.id}`;

    const payload = {
      notification: {
        title: "Заказ назначен вам",
        body: bodyText,
      },
      data: {
        type: "assigned",
        orderId: String(order.id),
        status: order.status || "",
        deliveryAddress: order.deliveryAddress || "",
      },
    };

    console.log('📨 Пуш "назначен" на токен:', token);
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

    const title = isReady ? "Заказ готов к забору" : "Новый заказ";

    const bodyText = order.deliveryAddress
      ? isReady
        ? `Заказ готов: ${order.deliveryAddress}`
        : `Новый заказ: ${order.deliveryAddress}`
      : isReady
        ? `Заказ #${order.id} готов к забору`
        : `Новый заказ #${order.id}`;

      const payload = {
      notification: {
        title,
        body: bodyText,
      },
      data: {
        type: "warehouse",
        orderId: String(order.id),
        status: order.status || "",
        deliveryAddress: order.deliveryAddress || "",
      },
    };

    console.log(
      `📨 Пуш по складу: рассылаем ${couriers.length} курьерам`,
    );

    for (const courier of couriers) {
      const token = courier.expoPushToken;
      if (!token) continue;
      console.log("  → курьер", courier.id, "токен", token);
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
