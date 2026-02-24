const chatSocket = require("./chatSocket");
const orderSocket = require("./orderSocket");
const warehouseSocket = require("./warehouseSocket");
const userSocket = require("./userSocket");
const courierSocket = require("./courierSocket");

module.exports = function registerSockets(io) {
  io.on("connection", (socket) => {
    courierSocket(io, socket);
    userSocket(io, socket);
    chatSocket(io, socket);
    orderSocket(io, socket);
    warehouseSocket(io, socket);
  });
};
