const { ChatMessage, ChatParticipant } = require("../models/models");

module.exports = function chatSocket(io, socket) {
  socket.on("joinChat", async ({ chatId, userId }) => {
    if (!chatId || !userId) return;

    const participant = await ChatParticipant.findOne({
      where: { chatId, userId },
    });
    if (!participant) return;

    socket.data.userId = userId;
    socket.data.chatRoles = socket.data.chatRoles || {};
    socket.data.chatRoles[chatId] = participant.role;

    socket.join(`chat_${chatId}`);
  });

  socket.on("joinAdminNotifications", () => {
    socket.join("admin_notifications");
  });

  socket.on("sendMessage", async (data) => {
    const { chatId, text } = data;

    try {
      const senderId = socket.data.userId || data.senderId;
      if (!chatId || !senderId) {
        return socket.emit("sendMessageError", { message: "No sender/chatId" });
      }

      socket.data.userId = senderId; // запоминаем

      socket.data.chatRoles = socket.data.chatRoles || {};
      let senderRole = socket.data.chatRoles[chatId];

      if (!senderRole) {
        const p = await ChatParticipant.findOne({
          where: { chatId, userId: senderId },
        });
        if (!p) {
          return socket.emit("sendMessageError", {
            message: "Not participant",
          });
        }
        senderRole = p.role;
        socket.data.chatRoles[chatId] = senderRole;
      }

      const cleanText = String(text || "").trim();
      if (!cleanText) return;

      const newMessage = await ChatMessage.create({
        chatId,
        senderId,
        senderRole,
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

  socket.on("readMessages", ({ chatId, userId }) => {
    io.to(`chat_${chatId}`).emit("readMessages", { chatId, userId });
  });
};
