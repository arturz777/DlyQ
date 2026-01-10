const { ChatMessage, ChatParticipant } = require("../models/models");

module.exports = function chatSocket(io, socket) {
  console.log("💬 chat socket init:", socket.id);

  socket.on("joinChat", async ({ chatId, userId }) => {
  if (!chatId || !userId) return;

  const ok = await ChatParticipant.findOne({ where: { chatId, userId } });
  if (!ok) return;

  socket.join(`chat_${chatId}`);
});

  socket.on("joinAdminNotifications", () => {
    socket.join("admin_notifications");
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
    io.to(`chat_${chatId}`).emit("readMessages", { chatId, userId });
  });
};
