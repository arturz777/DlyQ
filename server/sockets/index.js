const chatSocket = require("./chatSocket");
const orderSocket = require("./orderSocket");
const warehouseSocket = require("./warehouseSocket");

module.exports = function registerSockets(io) {
  io.on("connection", (socket) => {
    console.log("🔌 socket connected:", socket.id, "origin:", socket.handshake.headers.origin);

    socket.onAny((event, ...args) => {
      if (["joinOrderRoom","leaveOrderRoom","joinWarehouseRoom"].includes(event)) {
        console.log("📩 onAny:", event, "from", socket.id, "args:", args);
      }
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ socket disconnected:", socket.id, "reason:", reason);
    });
  });
};

