module.exports = function orderSocket(io, socket) {
  socket.on("joinOrderRoom", ({ orderId }) => {
    console.log("➡️ joinOrderRoom request:", socket.id, orderId, "rooms(before):", [...socket.rooms]);

    if (!orderId) return;

    for (const r of [...socket.rooms]) {
  if (typeof r === "string" && r.startsWith("order:")) socket.leave(r);
}

    const room = `order:${orderId}`;
    socket.join(room);

    console.log("✅ joinOrderRoom:", socket.id, room, "rooms(after):", [...socket.rooms]);
  });

  socket.on("leaveOrderRoom", ({ orderId }) => {
    console.log("⬅️ leaveOrderRoom:", socket.id, orderId, "rooms(before):", [...socket.rooms]);
    if (!orderId) return;
    const room = `order:${orderId}`;
    socket.leave(room);
    console.log("👋 left:", socket.id, room, "rooms(after):", [...socket.rooms]);
  });
};

