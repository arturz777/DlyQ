const { ChatMessage } = require("../models/models");

module.exports = function chatSocket(io, socket) {
  socket.on("joinChat", (chatId) => {
    socket.join(`chat_${chatId}`);
    console.log(`🔗 ${socket.id} joined chat_${chatId}`);
  });

  socket.on("joinAdminNotifications", () => {
    socket.join("admin_notifications");
    console.log(`🛎️ ${socket.id} joined admin_notifications`);
  });

  socket.on("sendMessage", async (data) => {
    const { chatId, senderId, senderRole, text } = data;

    try {
      const newMessage = await ChatMessage.create({
        chatId,
        senderId,
        senderRole,
        text,
        isRead: false,
      });

      io.to(`chat_${chatId}`).emit("receiveMessage", newMessage);
      io.to("admin_notifications").emit("newChatMessage", newMessage);
    } catch (err) {
      console.error("❌ sendMessage error:", err);
    }
  });

  socket.on("readMessages", ({ chatId, userId }) => {
    io.emit("readMessages", { chatId, userId });
  });
};
