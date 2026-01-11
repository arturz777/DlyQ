const {
  Chat,
  ChatParticipant,
  ChatMessage,
  User,
  Order,
} = require("../models/models");
const { Op } = require("sequelize");

function normalizeChatRole(appRole) {
  const map = {
    user: "client",
    client: "client",
    admin: "admin",
    courier: "courier",
    warehouse: "warehouse",
    seller: "restaurant",
    restaurant: "restaurant",
  };
  const role = String(appRole || "").toLowerCase();
  return map[role] || "client";
}

class ChatController {
  async createChat(req, res) {
    try {
      const { type, orderId, participants = [] } = req.body;

      if (!["delivery", "restaurant", "support"].includes(type)) {
        return res.status(400).json({ message: "Bad type" });
      }

      if (type === "support") {
        return res.status(400).json({ message: "Use /api/chat/support" });
      }

      if (!orderId) {
        return res.status(400).json({ message: "orderId required" });
      }

      let chat = await Chat.findOne({ where: { type, orderId } });
      if (!chat) chat = await Chat.create({ type, orderId });

      for (const p of participants) {
        await ChatParticipant.findOrCreate({
          where: { chatId: chat.id, userId: p.userId },
          defaults: { chatId: chat.id, userId: p.userId, role: p.role },
        });
      }

      return res.json(chat);
    } catch (e) {
      console.error("createChat error:", e);
      return res.status(500).json({ message: "Server error" });
    }
  }

  async getOrCreateSellerChat(req, res) {
    try {
      const orderId = Number(req.params.orderId);
      const requesterId = req.user?.id;

      if (!requesterId)
        return res.status(401).json({ message: "Unauthorized" });
      if (!orderId) return res.status(400).json({ message: "Bad orderId" });

      const order = await Order.findByPk(orderId, {
        attributes: ["id", "userId", "sellerId", "status"],
        raw: true,
      });

      if (!order) return res.status(404).json({ message: "Order not found" });

      const isParticipant =
        String(order.userId) === String(requesterId) ||
        (order.sellerId != null &&
          String(order.sellerId) === String(requesterId));

      if (!isParticipant) {
        return res.status(403).json({ message: "Forbidden" });
      }

      if (!order.sellerId) {
        return res.status(409).json({ message: "Restaurant not assigned yet" });
      }

      let chat = await Chat.findOne({ where: { type: "restaurant", orderId } });
      if (!chat) chat = await Chat.create({ type: "restaurant", orderId });

      const want = [
        { userId: order.userId, role: "client" },
        { userId: order.sellerId, role: "restaurant" },
      ];

      const existing = await ChatParticipant.findAll({
        where: {
          chatId: chat.id,
          userId: { [Op.in]: want.map((x) => x.userId) },
        },
        attributes: ["userId"],
        raw: true,
      });

      const haveSet = new Set(existing.map((x) => String(x.userId)));

      for (const p of want) {
        if (!haveSet.has(String(p.userId))) {
          await ChatParticipant.create({
            chatId: chat.id,
            userId: p.userId,
            role: p.role,
          });
        }
      }

      return res.json({ chatId: chat.id, orderId });
    } catch (e) {
      console.error("getOrCreateSellerChat error:", e);
      return res.status(500).json({ message: "Server error" });
    }
  }

  async getOrCreateSupportChat(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const role = normalizeChatRole(req.user?.role);
      const supportKey = `support:${role}:${userId}`;

      const [chat] = await Chat.findOrCreate({
        where: { type: "support", supportKey },
        defaults: { type: "support", supportKey, orderId: null },
      });

      await ChatParticipant.findOrCreate({
        where: { chatId: chat.id, userId },
        defaults: { chatId: chat.id, userId, role },
      });

      const ADMIN_ID = 1;

      await ChatParticipant.findOrCreate({
        where: { chatId: chat.id, userId: ADMIN_ID },
        defaults: { chatId: chat.id, userId: ADMIN_ID, role: "admin" },
      });

      return res.json({ chatId: chat.id });
    } catch (e) {
      console.error("getOrCreateSupportChat error:", e);
      return res.status(500).json({ message: "Server error" });
    }
  }

  async getOrCreateDeliveryChat(req, res) {
    try {
      const orderId = Number(req.params.orderId);
      const requesterId = req.user?.id;

      if (!requesterId)
        return res.status(401).json({ message: "Unauthorized" });
      if (!orderId) return res.status(400).json({ message: "Bad orderId" });

      const order = await Order.findByPk(orderId, {
        attributes: ["id", "userId", "courierId", "status"],
        raw: true,
      });
      if (!order) return res.status(404).json({ message: "Order not found" });

      const isParticipant =
        String(order.userId) === String(requesterId) ||
        (order.courierId != null &&
          String(order.courierId) === String(requesterId));

      if (!isParticipant) {
        return res.status(403).json({ message: "Forbidden" });
      }

      if (!order.courierId) {
        return res.status(409).json({ message: "Courier not assigned yet" });
      }

      let chat = await Chat.findOne({ where: { type: "delivery", orderId } });
      if (!chat) {
        chat = await Chat.create({ type: "delivery", orderId });
      }

      const want = [
        { userId: order.userId, role: "client" },
        { userId: order.courierId, role: "courier" },
      ];

      const existing = await ChatParticipant.findAll({
        where: {
          chatId: chat.id,
          userId: { [Op.in]: want.map((x) => x.userId) },
        },
        attributes: ["userId"],
        raw: true,
      });
      const haveSet = new Set(existing.map((x) => String(x.userId)));

      for (const p of want) {
        if (!haveSet.has(String(p.userId))) {
          await ChatParticipant.create({
            chatId: chat.id,
            userId: p.userId,
            role: p.role,
          });
        }
      }

      return res.json({ chatId: chat.id, orderId });
    } catch (e) {
      console.error("getOrCreateDeliveryChat error:", e);
      return res.status(500).json({ message: "Server error" });
    }
  }

  async markMessagesRead(req, res) {
    const { chatId } = req.params;
    const { userId } = req.body;

    try {
      await ChatMessage.update(
        { isRead: true },
        {
          where: {
            chatId,
            isRead: false,
            senderId: { [Op.ne]: userId },
          },
        }
      );

      return res.json({ success: true });
    } catch (err) {
      console.error("❌ Ошибка при обновлении isRead:", err);
      return res.status(500).json({ message: "Ошибка при обновлении" });
    }
  }

  async getOneChat(req, res) {
    const { chatId } = req.params;

    try {
      const chat = await Chat.findOne({
        where: { id: chatId },
        include: [
          {
            model: ChatParticipant,
            as: "participants",
            include: [
              {
                model: User,
                as: "user",
                attributes: ["id", "firstName"],
              },
            ],
          },
          {
            model: ChatMessage,
            as: "messages",
            order: [["createdAt", "DESC"]],
          },
        ],
      });

      if (!chat) {
        return res.status(404).json({ message: "Чат не найден" });
      }

      return res.json(chat);
    } catch (err) {
      console.error("❌ Ошибка при получении чата:", err);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async getMessages(req, res) {
    const { chatId } = req.params;
    const messages = await ChatMessage.findAll({
      where: { chatId },
      order: [["createdAt", "ASC"]],
    });
    res.json(messages);
  }

  async getUserChats(req, res) {
    try {
      const { userId } = req.params;
      const scope = String(req.query.scope || "support").toLowerCase();

      const user = await User.findByPk(userId, { attributes: ["id", "role"] });
      if (!user)
        return res.status(404).json({ message: "Пользователь не найден" });

      const commonIncludes = [
        {
          model: ChatParticipant,
          as: "participants",
          include: [
            { model: User, as: "user", attributes: ["id", "firstName"] },
          ],
        },
        {
          model: ChatMessage,
          as: "messages",
          separate: true,
          limit: 1,
          order: [["createdAt", "DESC"]],
        },
      ];

      if (String(user.role || "").toLowerCase() === "admin") {
        const allChats = await Chat.findAll({
          include: commonIncludes,
          order: [["updatedAt", "DESC"]],
        });
        return res.json(allChats);
      }

      const participants = await ChatParticipant.findAll({
        where: { userId },
        attributes: ["chatId"],
        raw: true,
      });

      const chatIds = participants.map((p) => p.chatId);
      if (!chatIds.length) return res.json([]);

      const whereBase = {
        id: { [Op.in]: chatIds },
      };

      const where =
        scope === "all"
          ? {
              ...whereBase,
            }
          : { ...whereBase, type: "support" };

      const chats = await Chat.findAll({
        where,
        include: commonIncludes,
        order: [["updatedAt", "DESC"]],
      });

      return res.json(chats);
    } catch (e) {
      console.error("getUserChats error:", e);
      return res.status(500).json({ message: "Server error" });
    }
  }

  async sendMessage(req, res) {
    const { chatId } = req.params;
    const { senderId, senderRole, text } = req.body;

    if (!chatId || !senderId || !senderRole || !text) {
      return res.status(400).json({ message: "Недостаточно данных" });
    }

    // ✅ проверяем участника
    const ok = await ChatParticipant.findOne({
      where: { chatId, userId: senderId },
    });
    if (!ok) return res.status(403).json({ message: "Forbidden" });

    try {
      const message = await ChatMessage.create({
        chatId,
        senderId,
        senderRole,
        text,
      });

      return res.json(message);
    } catch (error) {
      console.error("❌ Ошибка при сохранении сообщения:", error);
      return res.status(500).json({ message: "Ошибка при создании сообщения" });
    }
  }
}

module.exports = new ChatController();
