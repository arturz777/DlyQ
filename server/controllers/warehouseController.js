const {
  Order,
  Warehouse,
  SellerUser,
  Seller,
  Chat,
  ChatParticipant,
} = require("../models/models");
const { Op } = require("sequelize");
const { sendOrderAssignedPush } = require("../services/pushService");
const { scheduleCourierSearch } = require("../services/courierSearchScheduler");
const {
  sendOrderToNextCourier,
} = require("../services/orderDistributionService");

function safeParse(v) {
  if (!v) return [];
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return [];
    }
  }
  return v;
}

async function getOrCreateWarehouseForUser(user) {
  const userId = user.id;
  const role = String(user.role || "").toUpperCase();

  const getOrCreateMain = async () => {
    let wh = await Warehouse.findOne({
      where: { sellerId: null },
      order: [["id", "ASC"]],
    });

    if (!wh) {
      wh = await Warehouse.create({
        name: "Main warehouse",
        status: "active",
        sellerId: null,
      });
    }
    return wh;
  };

  const getOrCreateBySeller = async (sellerId) => {
    let wh = await Warehouse.findOne({ where: { sellerId } });
    if (!wh) {
      wh = await Warehouse.create({
        name: buildWarehouseName(user),
        status: "active",
        sellerId,
      });
    }
    return wh;
  };

  if (role === "ADMIN") return getOrCreateMain();

  if (role === "SELLER") {
    const link = await SellerUser.findOne({ where: { userId } });
    if (!link) return null;
    return getOrCreateBySeller(link.sellerId);
  }

  if (role === "WAREHOUSE") {
    const link = await SellerUser.findOne({ where: { userId } });
    if (link?.sellerId) return getOrCreateBySeller(link.sellerId);
    return getOrCreateMain();
  }

  return null;
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
  async getWarehouseHistory(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId)
        return res.status(401).json({ message: "Вы не авторизованы." });

      const warehouse = await getOrCreateWarehouseForUser(req.user);
      if (!warehouse)
        return res.status(403).json({ message: "Нет доступа к складу" });

      const where = {
        orderType: { [Op.ne]: "parcel" },
        status: {
          [Op.in]: [
            "Ready for pickup",
            "Picked up",
            "Arrived at destination",
            "Delivered",
            "Completed",
          ],
        },
        [Op.or]: [{ warehouseId: warehouse.id }, { warehouseId: null }],
      };

      if (warehouse.sellerId) {
        where.sellerId = warehouse.sellerId;
      } else {
        where[Op.or] = [{ sellerId: null }, { sellerId: 0 }];
      }

      const orders = await Order.findAll({
        where,
        order: [["createdAt", "DESC"]],
        limit: 300,
      });

      const formatted = orders.map((order) => ({
        ...order.toJSON(),
        orderDetails: safeParse(order.orderDetails),
        preorderDate: order.desiredDeliveryDate || null,
      }));

      return res.json(formatted);
    } catch (error) {
      console.error("❌ Ошибка получения истории заказов склада:", error);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async getMe(req, res) {
    const warehouse = await getOrCreateWarehouseForUser(req.user);
    if (!warehouse) {
      return res.status(403).json({ message: "Нет доступа к складу" });
    }

    let sellerName = "DlyQ Market";
    let sellerId = warehouse.sellerId || null;

    if (sellerId) {
      const seller = await Seller.findByPk(sellerId);
      if (seller?.name) sellerName = seller.name;
    }

    return res.json({
      warehouseId: warehouse.id,
      sellerId,
      role: req.user.role,

      sellerName,
      warehouseName: warehouse.name,
      warehouseStatus: warehouse.status,
      hasPushToken: !!warehouse.expoPushToken,
    });
  }

  async savePushToken(req, res) {
    try {
      const { token } = req.body;
      const userId = req.user?.id;

      if (!userId)
        return res.status(401).json({ message: "Вы не авторизованы." });

      const warehouse = await getOrCreateWarehouseForUser(req.user);
      if (!warehouse) {
        return res.status(403).json({ message: "Нет доступа к складу" });
      }

      if (!token) {
        warehouse.expoPushToken = null;
        await warehouse.save();
        return res.json({ message: "Push-токен склада удалён" });
      }

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
      const userId = req.user?.id;
      if (!userId)
        return res.status(401).json({ message: "Вы не авторизованы." });

      const warehouse = await getOrCreateWarehouseForUser(req.user);
      if (!warehouse) {
        return res.status(403).json({ message: "Нет доступа к складу" });
      }

      const where = {
        orderType: { [Op.ne]: "parcel" },
        warehouseStatus: { [Op.in]: ["pending", "processing"] },
        [Op.or]: [{ warehouseId: warehouse.id }, { warehouseId: null }],
      };

      if (warehouse.sellerId) {
        where.sellerId = warehouse.sellerId;
      } else {
        where[Op.and] = [{ [Op.or]: [{ sellerId: null }, { sellerId: 0 }] }];
      }

      const orders = await Order.findAll({
        where,
        order: [["createdAt", "DESC"]],
      });

      const formattedOrders = orders.map((order) => ({
        ...order.toJSON(),
        orderDetails: safeParse(order.orderDetails),
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

      const userId = req.user?.id;
      if (!userId)
        return res.status(401).json({ message: "Вы не авторизованы." });

      const warehouse = await getOrCreateWarehouseForUser(req.user);
      if (!warehouse) {
        return res.status(403).json({ message: "Нет доступа к складу" });
      }

      const whereOrder = { id };
      if (warehouse.sellerId) whereOrder.sellerId = warehouse.sellerId;
      else whereOrder[Op.or] = [{ sellerId: null }, { sellerId: 0 }];

      const order = await Order.findOne({ where: whereOrder });
      if (!order) return res.status(404).json({ message: "Заказ не найден" });

      order.warehouseStatus = "processing";
      order.processingTime = processingTime;
      order.processingStartTime = new Date();
      order.warehouseId = warehouse.id;
      order.status = "Waiting for courier";
      await order.save();

      const [sellerChat] = await Chat.findOrCreate({
        where: { type: "seller", orderId: order.id },
        defaults: { type: "seller", orderId: order.id },
      });

      if (!order.sellerChatId) {
        order.sellerChatId = sellerChat.id;
        await order.save();
      }

      await ChatParticipant.findOrCreate({
        where: { chatId: sellerChat.id, userId: req.user.id },
        defaults: {
          chatId: sellerChat.id,
          userId: req.user.id,
          role: "warehouse",
        },
      });

      const io = req.app.get("io");
      io.to(`order:${order.id}`).emit("orderStatusUpdate", {
        id: order.id,
        status: order.status,
        warehouseStatus: order.warehouseStatus,
        processingTime: order.processingTime,
        processingStartTime: order.processingStartTime,
      });

      await scheduleCourierSearch(order, io);

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
      if (!userId)
        return res.status(401).json({ message: "Вы не авторизованы." });

      const warehouse = await getOrCreateWarehouseForUser(req.user);
      if (!warehouse) {
        return res.status(403).json({ message: "Нет доступа к складу" });
      }

      const whereOrder = { id };
      if (warehouse.sellerId) whereOrder.sellerId = warehouse.sellerId;
      else whereOrder[Op.or] = [{ sellerId: null }, { sellerId: 0 }];

      const order = await Order.findOne({ where: whereOrder });
      if (!order) return res.status(404).json({ message: "Заказ не найден" });

      order.warehouseStatus = "ready";
      order.status = "Ready for pickup";
      await order.save();

      const io = req.app.get("io");
      io.emit("orderReady", order);
      io.to(`order:${order.id}`).emit("orderStatusUpdate", {
        id: order.id,
        status: order.status,
        warehouseStatus: order.warehouseStatus,
      });

      try {
        if (order.courierId) await sendOrderAssignedPush(order);
        else await scheduleCourierSearch(order, io);
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
