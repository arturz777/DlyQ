const { ChatMessage, ChatParticipant } = require("../models/models");

module.exports = function chatSocket(io, socket) {
  console.log("💬 chat socket init:", socket.id);

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
      const senderId = socket.data.userId;
      const senderRole = socket.data.chatRoles?.[chatId];

      if (!senderId || !senderRole) {
        const p = await ChatParticipant.findOne({
          where: { chatId, userId: senderId },
        });
        if (!p) {
          return socket.emit("sendMessageError", {
            message: "Not participant / no sender",
          });
        }
        socket.data.chatRoles = socket.data.chatRoles || {};
        socket.data.chatRoles[chatId] = p.role;
      }

      const cleanText = String(text || "").trim();
      if (!cleanText) return;

      const newMessage = await ChatMessage.create({
        chatId,
        senderId: socket.data.userId,
        senderRole: socket.data.chatRoles[chatId],
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
