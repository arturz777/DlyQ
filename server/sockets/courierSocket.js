module.exports = function courierSocket(io, socket) {
  socket.on("joinCourierRoom", ({ courierId }) => {
    if (!courierId) return;
    socket.join(`courier:${courierId}`);
    console.log("✅ joinCourierRoom:", socket.id, `courier:${courierId}`);
  });
};
