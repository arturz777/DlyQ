const { ChatMessage } = require("../models/models");

module.exports = function (io) {
  io.on("connection", (socket) => {
    console.log("💬 Новый сокет подключен:", socket.id);

    socket.on("joinChat", (chatId) => {
      socket.join(`chat_${chatId}`);
      console.log(`🔗 Socket ${socket.id} присоединился к чату ${chatId}`);
    });

    socket.on("joinAdminNotifications", () => {
      socket.join("admin_notifications");
      console.log(`🛎️ Socket ${socket.id} присоединился к admin_notifications`);
    });

    socket.on("sendMessage", async (data) => {
      const { chatId, senderId, senderRole, text } = data;
      console.log("📨 Пришло сообщение от клиента:", data);

      try {
        const newMessage = await ChatMessage.create({
          chatId,
          senderId,
          senderRole,
          text,
          isRead: false,
        });

         console.log("✅ Сохранили сообщение в БД:", newMessage); 

        io.to(`chat_${chatId}`).emit("receiveMessage", newMessage);
        io.to("admin_notifications").emit("newChatMessage", newMessage);
      } catch (err) {
        console.error("❌ Ошибка при создании сообщения:", err);
      }
    });

    socket.on("readMessages", ({ chatId, userId }) => {
      io.emit("readMessages", { chatId, userId });
    });

    socket.on("disconnect", () => {
      console.log("❌ Socket отключился:", socket.id);
    });
  });
};
