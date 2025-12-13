const { Order, Warehouse, SellerUser } = require("../models/models");
const { Op } = require("sequelize");
const { sendOrderAssignedPush } = require("../services/pushService");
const {
  sendOrderToNextCourier,
} = require("../services/orderDistributionService");

async function getOrCreateWarehouseForUser(user) {
  const userId = user.id;
  let warehouse = await Warehouse.findByPk(userId);

  if (!warehouse) {
    const payload = {
      id: userId,
      name: buildWarehouseName(user),
      status: "active",
    };

    if (user.role === "SELLER") {
      const link = await SellerUser.findOne({ where: { userId } });
      if (link) {
        payload.sellerId = link.sellerId;
      }
    }

    warehouse = await Warehouse.create(payload);
  } else if (!warehouse.sellerId && user.role === "SELLER") {
    const link = await SellerUser.findOne({ where: { userId } });
    if (link) {
      warehouse.sellerId = link.sellerId;
      await warehouse.save();
    }
  }

  return warehouse;
}

function buildWarehouseName(user) {
  const parts = [];
  if (user.firstName) parts.push(user.firstName);
  if (user.lastName) parts.push(user.lastName);
  const full = parts.join(" ").trim();

  if (full) return full;
  if (user.email) return user.email;
  return `Склад #${user.id}`;
}

class WarehouseController {
  async savePushToken(req, res) {
    try {
      const { token } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: "Вы не авторизованы." });
      }

      if (!token) {
        return res.status(400).json({ message: "Токен не передан." });
      }

      const warehouse = await getOrCreateWarehouseForUser(req.user);
      warehouse.expoPushToken = token;
      await warehouse.save();

      return res.json({ message: "Push-токен склада сохранён" });
    } catch (error) {
      console.error("❌ Ошибка сохранения push-токена склада:", error);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async getWarehouseOrders(req, res) {
    try {
      const userId = req.user.id;
      if (!userId) {
        return res.status(401).json({ message: "Вы не авторизованы." });
      }

      const warehouse = await getOrCreateWarehouseForUser(req.user);

      const where = {
        warehouseStatus: {
          [Op.in]: ["pending", "processing"],
        },
        [Op.or]: [{ warehouseId: warehouse.id }, { warehouseId: null }],
      };

      if (warehouse.sellerId) {
        where.sellerId = warehouse.sellerId;
      } else {
        where.sellerId = {
          [Op.or]: [null, 0],
        };
      }

      const orders = await Order.findAll({
        where,
        order: [["createdAt", "DESC"]],
      });

      const formattedOrders = orders.map((order) => ({
        ...order.toJSON(),
        orderDetails: order.orderDetails ? JSON.parse(order.orderDetails) : [],
        preorderDate: order.desiredDeliveryDate || null,
      }));

      return res.json(formattedOrders);
    } catch (error) {
      console.error("❌ Ошибка получения заказов склада:", error);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async acceptOrder(req, res) {
    try {
      const { id } = req.params;
      const { processingTime } = req.body;
      const userId = req.user.id;

      if (!userId) {
        return res.status(401).json({ message: "Вы не авторизованы." });
      }

      const warehouse = await getOrCreateWarehouseForUser(req.user);

      const whereOrder = { id };

      if (warehouse.sellerId) {
        whereOrder.sellerId = warehouse.sellerId;
      } else {
        whereOrder.sellerId = { [Op.or]: [null, 0] };
      }

      const order = await Order.findOne({ where: whereOrder });
      if (!order) {
        return res.status(404).json({ message: "Заказ не найден" });
      }

      order.warehouseStatus = "processing";
      order.processingTime = processingTime;
      order.processingStartTime = new Date();
      order.warehouseId = warehouse.id;
      order.status = "Waiting for courier";
      await order.save();

      const io = req.app.get("io");
      io.emit("warehouseOrder", order);
      io.emit("orderStatusUpdate", order);

      try {
        await sendOrderToNextCourier(order);
      } catch (err) {
        console.error("push error (warehouse.acceptOrder):", err);
      }

      return res.json(order);
    } catch (error) {
      console.error("❌ Ошибка обработки заказа складом:", error);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async completeOrder(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: "Вы не авторизованы." });
      }

      const warehouse = await getOrCreateWarehouseForUser(req.user);

      const whereOrder = { id };

      if (warehouse.sellerId) {
        whereOrder.sellerId = warehouse.sellerId;
      } else {
        whereOrder.sellerId = { [Op.or]: [null, 0] };
      }

      const order = await Order.findOne({ where: whereOrder });
      if (!order) {
        return res.status(404).json({ message: "Заказ не найден" });
      }

      order.warehouseStatus = "ready";
      order.status = "Ready for pickup";
      await order.save();

      const io = req.app.get("io");
      io.emit("orderReady", order);
      io.emit("orderStatusUpdate", { id: order.id, status: order.status });

      try {
        if (order.courierId) {
          await sendOrderAssignedPush(order);
        } else {
          await sendOrderToNextCourier(order);
        }
      } catch (err) {
        console.error("push error (warehouse.completeOrder):", err);
      }

      return res.json(order);
    } catch (error) {
      console.error("❌ Ошибка завершения заказа:", error);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }
}

module.exports = new WarehouseController();
