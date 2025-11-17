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
        title: "Заказ назначен вам",
        body: order.deliveryAddress
          ? `Новый заказ: ${order.deliveryAddress}`
          : `Вам назначен заказ #${order.id}`,
        data: {
          type: "assigned",
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

/**
 * Пуш «появился новый заказ на складе».
 * Сейчас логика такая: шлём всем курьерам, у кого:
 *  - есть expoPushToken
 *  - status === 'online'
 * (для одного курьера это вообще идеально)
 */
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

    const messages = [];

    for (const courier of couriers) {
      const token = courier.expoPushToken;
      if (!Expo.isExpoPushToken(token)) {
        console.warn("sendWarehouseOrderPush: неверный токен", token);
        continue;
      }

      messages.push({
        to: token,
        sound: "default",
        title: "Новый заказ",
        body: order.deliveryAddress
          ? `Новый заказ: ${order.deliveryAddress}`
          : `Новый заказ #${order.id}`,
        data: {
          type: "warehouse",
          orderId: order.id,
          status: order.status,
          deliveryAddress: order.deliveryAddress,
        },
        priority: "high",
      });
    }

    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }
  } catch (err) {
    console.error("❌ Ошибка отправки push для склада:", err);
  }
}

module.exports = {
  sendOrderAssignedPush,
  sendWarehouseOrderPush,
};
