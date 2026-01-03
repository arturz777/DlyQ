const chatSocket = require("./chatSocket");
const orderSocket = require("./orderSocket");
const warehouseSocket = require("./warehouseSocket");

module.exports = function registerSockets(io) {
  io.on("connection", (socket) => {
    console.log("🔌 socket connected:", socket.id);

    chatSocket(io, socket);
    orderSocket(io, socket);
    warehouseSocket(io, socket);

    socket.on("disconnect", () => {
      console.log("❌ socket disconnected:", socket.id);
    });
  });
};
