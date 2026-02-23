const chatSocket = require("./chatSocket");
const orderSocket = require("./orderSocket");
const warehouseSocket = require("./warehouseSocket");
const userSocket = require("./userSocket");

module.exports = function registerSockets(io) {
  io.on("connection", (socket) => {

     socket.on("joinCourierRoom", ({ courierId }) => {
      if (courierId) socket.join(`courier:${courierId}`);
    });

    userSocket(io, socket);
    chatSocket(io, socket);
    orderSocket(io, socket);
    warehouseSocket(io, socket);

    socket.on("disconnect", () => {
    });
  });
};
