// sockets/userSocket.js
module.exports = function userSocket(io, socket) {
  socket.on("joinUserRoom", ({ userId }) => {
    if (!userId) return;

    // чтобы не висеть в старых user: комнатах
    for (const r of socket.rooms) {
      if (typeof r === "string" && r.startsWith("user:")) socket.leave(r);
    }

    const room = `user:${userId}`;
    socket.join(room);
    console.log("👤 joinUserRoom:", socket.id, room);
  });
};
