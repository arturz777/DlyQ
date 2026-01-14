const {
  Chat,
  ChatMessage,
  ChatParticipant,
  User,
} = require("../models/models");

const { t } = require("../utils/translations");

const isAdminRole = (role) => String(role || "").toLowerCase() === "admin";

module.exports = function chatSocket(io, socket) {
  socket.on("joinChat", async ({ chatId, userId }) => {
    try {
      if (!chatId || !userId) return;

      const user = await User.findByPk(userId, {
        attributes: ["id", "role"],
        raw: true,
      });
      if (!user) return;

      let participant = await ChatParticipant.findOne({
        where: { chatId, userId },
        attributes: ["role"],
        raw: true,
      });

      if (!participant && isAdminRole(user.role)) {
        const chat = await Chat.findByPk(chatId, {
          attributes: ["id", "type"],
          raw: true,
        });
        if (!chat) return;

        if (chat.type === "support") {
          await ChatParticipant.findOrCreate({
            where: { chatId, userId },
            defaults: { chatId, userId, role: "admin" },
          });

          participant = { role: "admin" };
        } else {
          return;
        }
      }

      if (!participant) return;

      socket.data.userId = userId;
      socket.data.chatRoles = socket.data.chatRoles || {};
      socket.data.chatRoles[chatId] = participant.role;

      socket.join(`chat_${chatId}`);
    } catch (e) {
      console.error("❌ joinChat error:", e);
    }
  });

  socket.on("joinAdminNotifications", () => {
    socket.join("admin_notifications");
  });

  socket.on("sendMessage", async (data) => {
    const { chatId, text, senderId } = data;

    try {
      if (!chatId || !senderId) {
        return socket.emit("sendMessageError", { message: "No sender/chatId" });
      }

      const cleanText = String(text || "").trim();
      if (!cleanText) return;

      if (
        socket.data.userId &&
        String(socket.data.userId) !== String(senderId)
      ) {
        return socket.emit("sendMessageError", {
          code: "BAD_SENDER",
          message: "Sender mismatch",
        });
      }

      const chat = await Chat.findByPk(chatId, {
        attributes: ["id", "type", "closedAt"],
        raw: true,
      });
      if (!chat) return;

      if (chat.closedAt) {
        return socket.emit("sendMessageError", {
          code: "CHAT_CLOSED",
          chatId,
          message: "Chat is closed",
        });
      }

      let p = await ChatParticipant.findOne({
        where: { chatId, userId: senderId },
        attributes: ["role"],
        raw: true,
      });

      if (!p) {
        const u = await User.findByPk(senderId, {
          attributes: ["role"],
          raw: true,
        });
        if (isAdminRole(u?.role) && chat.type === "support") {
          await ChatParticipant.findOrCreate({
            where: { chatId, userId: senderId },
            defaults: { chatId, userId: senderId, role: "admin" },
          });
          p = { role: "admin" };
        }
      }

      if (!p) {
        return socket.emit("sendMessageError", {
          code: "NOT_PARTICIPANT",
          chatId,
          message: "Not participant",
        });
      }

      const newMessage = await ChatMessage.create({
        chatId,
        senderId,
        senderRole: p.role,
        text: cleanText,
        isRead: false,
      });

      io.to(`chat_${chatId}`).emit("receiveMessage", newMessage);
      io.to("admin_notifications").emit("newChatMessage", newMessage);
    } catch (err) {
      console.error("❌ sendMessage error:", err);
      socket.emit("sendMessageError", { message: "Failed to send message" });
    }
  });

  socket.on("closeChat", async ({ chatId, senderId, lang }) => {
    try {
      if (!chatId || !senderId) return;

      const u = await User.findByPk(senderId, {
        attributes: ["role"],
        raw: true,
      });
      if (!isAdminRole(u?.role)) return;

      const chat = await Chat.findByPk(chatId);
      if (!chat) return;
      if (chat.closedAt) return;

      if (chat.type !== "support") return;

      chat.closedAt = new Date();

      if (chat.type === "support" && chat.supportKey) {
        chat.supportKey = `${chat.supportKey}:closed:${chat.id}`;
      }

      await chat.save();

      const CLOSED_TEXT = t("chat_closed_thanks", lang);

      const systemMsg = await ChatMessage.create({
        chatId,
        senderId,
        senderRole: "system",
        text: CLOSED_TEXT,
        isRead: false,
      });

      io.to(`chat_${chatId}`).emit("receiveMessage", systemMsg);
      io.to("admin_notifications").emit("newChatMessage", systemMsg);

      io.to(`chat_${chatId}`).emit("chatClosed", {
        chatId,
        closedAt: chat.closedAt,
      });

      io.to("admin_notifications").emit("chatClosed", {
        chatId,
        closedAt: chat.closedAt,
      });
    } catch (e) {
      console.error("❌ closeChat error:", e);
    }
  });

  socket.on("readMessages", ({ chatId, userId }) => {
    io.to(`chat_${chatId}`).emit("readMessages", { chatId, userId });
  });
};
