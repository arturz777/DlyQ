const {
  Chat,
  ChatParticipant,
  ChatMessage,
  User,
} = require("../models/models");
const { Op } = require("sequelize");

class ChatController {
  async createChat(req, res) {
    const { type, orderId, participants } = req.body;

    let existingChat = null;

    if (type === "delivery" && orderId) {
      existingChat = await Chat.findOne({ where: { type, orderId } });
    }

    if (!existingChat) {
      const chat = await Chat.create({ type, orderId });

      for (const p of participants) {
        await ChatParticipant.create({
          chatId: chat.id,
          userId: p.userId,
          role: p.role,
        });
      }

      return res.json(chat);
    }

    return res.json(existingChat);
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
  const { userId } = req.params;

  const user = await User.findByPk(userId);

  if (!user) {
    return res.status(404).json({ message: "Пользователь не найден" });
  }

  const commonIncludes = [
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
      separate: true,
      limit: 1,
      order: [["createdAt", "DESC"]],
    },
  ];

  if (user.role?.toLowerCase() === "admin") {
    const allChats = await Chat.findAll({
      include: commonIncludes,
      order: [["updatedAt", "DESC"]],
    });

    return res.json(allChats);
  }

  const participants = await ChatParticipant.findAll({ where: { userId } });
  const chatIds = participants.map((p) => p.chatId);

  const chats = await Chat.findAll({
    where: {
      id: {
        [Op.in]: chatIds,
      },
    },
    include: commonIncludes,
    order: [["updatedAt", "DESC"]],
  });

  res.json(chats);
}

  async sendMessage(req, res) {
    const { chatId, senderId, senderRole, text } = req.body;

    if (!chatId || !senderId || !senderRole || !text) {
      return res.status(400).json({ message: "Недостаточно данных" });
    }

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
