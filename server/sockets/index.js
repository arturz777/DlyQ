const chatSocket = require("./chatSocket");
const orderSocket = require("./orderSocket");
const warehouseSocket = require("./warehouseSocket");

module.exports = function registerSockets(io) {
  io.on("connection", (socket) => {
    console.log("🔌 connect", socket.id, "transport:", socket.conn.transport?.name);

    socket.conn.on("upgrade", (transport) => {
      console.log("⬆️ upgraded", socket.id, "to:", transport.name);
    });

    socket.conn.on("close", (reason) => {
      console.log("🧨 engine close", socket.id, "reason:", reason);
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ disconnect", socket.id, "reason:", reason, "transport:", socket.conn.transport?.name);
    });

    // ✅ ВАЖНО: подключаем обработчики событий
    chatSocket(io, socket);
    orderSocket(io, socket);
    warehouseSocket(io, socket);
  });
};


