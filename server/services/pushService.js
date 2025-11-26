const { Courier } = require("../models/models");
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

async function sendWarehouseOrderPushToCourier(order, courier) {
  const token = courier.expoPushToken;
  if (!token) {
    console.warn(
      "sendWarehouseOrderPushToCourier: нет токена у курьера",
      courier.id
    );
    return;
  }

  const isReady = order.status === "Ready for pickup";

  const payload = {
    notification: {
      title: isReady ? "Заказ готов" : "Новый заказ",
      body: isReady
        ? "Заказ готов, можно забирать."
        : order.deliveryAddress
        ? `Новый заказ: ${order.deliveryAddress}`
        : `Новый заказ #${order.id}`,
    },
    data: {
      type: "warehouse",
      orderId: String(order.id),
      status: order.status || "",
      deliveryAddress: order.deliveryAddress || "",
    },
  };

  console.log("📨 Пуш склад → курьер", courier.id);
  await sendFcmToToken(token, payload);
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

    const title = isReady ? "Заказ готов" : "Заказ назначен вам";
    const bodyText = isReady
      ? "Заказ готов, можно забирать."
      : order.deliveryAddress
      ? `Новый заказ: ${order.deliveryAddress}`
      : `Вам назначен заказ #${order.id}`;

    const payload = {
      notification: {
        title,
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

module.exports = {
  sendOrderAssignedPush,
  sendWarehouseOrderPushToCourier,
};
