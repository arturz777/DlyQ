module.exports = function orderSocket(io, socket) {
  socket.on("joinOrderRoom", ({ orderId }) => {
    if (!orderId) return;

    // оставляем только одну order-комнату
    for (const r of socket.rooms) {
      if (typeof r === "string" && r.startsWith("order:")) socket.leave(r);
    }

    const room = `order:${orderId}`;
    socket.join(room);
    console.log("✅ joinOrderRoom:", socket.id, room);
  });

  socket.on("leaveOrderRoom", ({ orderId }) => {
    if (!orderId) return;
    const room = `order:${orderId}`;
    socket.leave(room);
    console.log("👋 leaveOrderRoom:", socket.id, room);
  });
};
