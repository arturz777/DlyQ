const { Expo } = require("expo-server-sdk");
const { Courier } = require("../models/models");
const { Op } = require("sequelize");

const expo = new Expo();

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
      console.warn("sendOrderAssignedPush: у курьера нет expoPushToken");
      return;
    }

    if (!Expo.isExpoPushToken(token)) {
      console.warn("sendOrderAssignedPush: неверный Expo токен", token);
      return;
    }

    const messages = [
      {
        to: token,
        sound: "default",
        title: "Новый заказ",
        body: order.deliveryAddress
          ? `Новый заказ: ${order.deliveryAddress}`
          : "Вам назначен новый заказ",
        data: {
          orderId: order.id,
          status: order.status,
          deliveryAddress: order.deliveryAddress,
        },
        priority: "high",
      },
    ];

    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }
  } catch (err) {
    console.error("❌ Ошибка отправки push для курьера:", err);
  }
}

module.exports = {
  sendOrderAssignedPush,
};
