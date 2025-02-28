const { Order, Courier } = require("../models/models");
const { Op } = require("sequelize");
const fetch = require("node-fetch");

class CourierController {
  // 🔹 Получение активных заказов (только НЕ назначенные курьеру)

  async getActiveOrders(req, res) {
    try {
      const courierId = req.user.id;
      if (!courierId) {
        return res.status(401).json({ message: "Вы не авторизованы." });
      }

      // ✅ Проверяем, онлайн ли курьер
      const courier = await Courier.findByPk(courierId);
      if (!courier || courier.status !== "online") {
        return res.json([]); // Если офлайн – отправляем пустой массив
      }

      // ✅ Получаем активные заказы
      const orders = await Order.findAll({
        where: {
          status: { [Op.or]: ["Waiting for courier", "Ready for pickup"] },
          courierId: { [Op.is]: null }, // ✅ Безопасный поиск NULL
        },
        order: [["createdAt", "DESC"]],
        attributes: [
          "id",
          "status",
          "deliveryLat",
          "deliveryLng",
          "deliveryAddress",
          "orderDetails",
        ],
      });

      if (orders.length === 0) {
        return res.json([]);
      }

      // ✅ Преобразуем `orderDetails`, если это строка (чтобы избежать ошибок)
      const formattedOrders = orders.map((order) => ({
        ...order.toJSON(),
        orderDetails: order.orderDetails ? JSON.parse(order.orderDetails) : [], // ✅ Преобразуем JSON
      }));

      return res.json(formattedOrders);
    } catch (error) {
      console.error("❌ Ошибка получения активных заказов:", error);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  // 🔹 Принятие заказа курьером
  async acceptOrder(req, res) {
    try {
      const { id } = req.params;
      const courierId = req.user.id;

      if (!courierId) {
        return res.status(401).json({ message: "Вы не авторизованы." });
      }

      // ✅ Проверяем, существует ли курьер в базе
      let courier = await Courier.findByPk(courierId);
      if (!courier) {
        courier = await Courier.create({
          id: courierId,
          name: req.user.name || "Админ-Курьер",
          status: "offline",
        });
      }

      // ✅ Проверяем, существует ли заказ
      const order = await Order.findByPk(id);

      if (!order) {
        return res.status(404).json({ message: "Заказ не найден." });
      }

      // ✅ Проверяем, что заказ можно принять (Waiting for courier или Ready for pickup)
      if (
        order.status !== "Waiting for courier" &&
        order.status !== "Ready for pickup"
      ) {
        return res
          .status(400)
          .json({ message: "Заказ уже занят или не доступен для курьера." });
      }

      // ✅ Если заказ уже "Ready for pickup", не меняем статус (чтобы не сбрасывать его)
      if (order.status === "Ready for pickup") {
        order.courierId = courierId;
      } else {
        order.status = "Accepted";
        order.courierId = courierId;
      }

      await order.save(); // 🔥 Сохраняем изменения

      // ✅ Отправляем обновление через WebSocket
      const io = req.app.get("io");

      // ✅ Отправляем актуальные данные на фронтенд
      return res.json({
        id: order.id,
        status: order.status, // Теперь статус всегда актуальный!
        deliveryLat: order.deliveryLat,
        deliveryLng: order.deliveryLng,
        deliveryAddress: order.deliveryAddress,
        courierId: order.courierId,
      });
    } catch (error) {
      console.error("❌ Ошибка принятия заказа:", error);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  // 🔹 Изменение статуса курьера (онлайн/оффлайн)
  async toggleCourierStatus(req, res) {
    console.log("🚀 Получен запрос на смену статуса", req.body);
    try {
      const { status } = req.body;
      const courierId = req.user.id;

      if (!courierId) {
        console.log("❌ Ошибка: нет courierId");
        return res.status(401).json({ message: "Вы не авторизованы." });
      }

      console.log(`🔄 Курьер ${courierId} меняет статус на ${status}`);
      // Проверяем, существует ли курьер
      const courier = await Courier.findByPk(courierId);
      if (!courier) {
        console.log("❌ Ошибка: курьер не найден");
        return res.status(404).json({ message: "Курьер не найден" });
      }

      // Обновляем статус курьера
      courier.status = status;
      await courier.save();

       console.log("✅ Статус успешно изменен!");
      return res.json({ message: `Вы в статусе: ${status}` });
    } catch (error) {
      console.error("❌ Ошибка смены статуса курьера:", error);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async updateDeliveryStatus(req, res) {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const courierId = req.user.id;

        if (!courierId) {
            return res.status(401).json({ message: "Вы не авторизованы." });
        }

        const order = await Order.findByPk(id);
        if (!order) {
            return res.status(404).json({ message: "Заказ не найден." });
        }

        if (order.courierId !== courierId) {
            return res.status(403).json({ message: "Этот заказ вам не принадлежит." });
        }

        // ✅ Устанавливаем новый статус
        order.status = status;

        // ✅ Когда курьер забрал заказ, рассчитываем время маршрута
        if (order.status === "Picked up") {
            const estimatedTime = await calculateRouteTime(order);
            order.estimatedTime = estimatedTime; // ✅ Реальное время
        }

        await order.save();

        // 🔥 Отправляем обновление через WebSocket
        const io = req.app.get("io");
        io.emit("orderStatusUpdate", {
            id: order.id,
            status: order.status,
            estimatedTime: order.estimatedTime || null,
        });


        return res.json(order);
    } catch (error) {
        console.error("❌ Ошибка обновления статуса доставки:", error);
        return res.status(500).json({ message: "Ошибка сервера" });
    }
}


  // 📌 Завершение заказа (доставлено)
  async completeDelivery(req, res) {
    try {
      const { id } = req.params;
      const courierId = req.user.id;

      if (!courierId) {
        return res.status(401).json({ message: "Вы не авторизованы." });
      }

      // ✅ Проверяем, существует ли заказ
      const order = await Order.findByPk(id);
      if (!order) {
        return res.status(404).json({ message: "Заказ не найден." });
      }

      // ✅ Проверяем, что заказ принадлежит этому курьеру
      if (order.courierId !== courierId) {
        return res
          .status(403)
          .json({ message: "Этот заказ вам не принадлежит." });
      }

      // ✅ Обновляем статус заказа
      order.status = "Delivered";
      order.estimatedTime = null;

      await order.save();

      // ✅ Отправляем обновленный статус всем клиентам
      const io = req.app.get("io");
      io.emit("orderStatusUpdate", {
        id: order.id,
        status: order.status,
        estimatedTime: null, // Время исчезает у клиента
      });

      return res.json(order);
    } catch (error) {
      console.error("❌ Ошибка завершения доставки:", error);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async updateCourierLocation(req, res) {
    try {
        const { lat, lng } = req.body;
        const courierId = req.user.id;

        if (!courierId) {
            return res.status(401).json({ message: "Вы не авторизованы." });
        }

        if (!lat || !lng) {
            return res.status(400).json({ message: "Координаты не переданы." });
        }

        let courier = await Courier.findByPk(courierId);
        if (!courier) {
            return res.status(404).json({ message: "Курьер не найден." });
        }

        // ✅ Обновляем координаты курьера
        courier.currentLat = lat;
        courier.currentLng = lng;
        await courier.save();

        // 🔥 Отправляем обновление через WebSocket
        const io = req.app.get("io");
        io.emit("courierLocationUpdate", { courierId, lat, lng });

        return res.json({ message: "Местоположение обновлено!" });
    } catch (error) {
        console.error("❌ Ошибка обновления местоположения курьера:", error);
        return res.status(500).json({ message: "Ошибка сервера" });
    }
}


}

async function calculateRouteTime(order) {
  if (!order.deliveryLat || !order.deliveryLng) {
      return 15 * 60; // ❗ Возвращаем заглушку 15 минут
  }

  // ✅ Получаем данные о курьере
  const courier = await Courier.findByPk(order.courierId);
  if (!courier || !courier.currentLat || !courier.currentLng) {
      return 15 * 60;
  }

  const API_KEY = "5b3ce3597851110001cf624889e39f2834a84a62aaca04f731838a64"; // 🔥 Замени на свой ключ
  const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${API_KEY}&start=${courier.currentLng},${courier.currentLat}&end=${order.deliveryLng},${order.deliveryLat}`;

  try {
      const response = await fetch(url);
      const data = await response.json();


      if (data.features && data.features.length > 0) {
          const realTime = Math.round(data.features[0].properties.segments[0].duration);
          return realTime; // ✅ Настоящее время в пути (секунды)
      } else {
          console.warn("⚠️ Не удалось получить данные маршрута, оставляем 15 минут.");
          return 15 * 60; // ❗ Если API не дал ответ – ставим заглушку
      }
  } catch (error) {
      console.error("❌ Ошибка получения маршрута:", error);
      return 15 * 60; // ❗ Ошибка – ставим заглушку
  }
}




module.exports = new CourierController();
