module.exports = function userSocket(io, socket) {
  socket.on("joinUserRoom", ({ userId }) => {
    if (!userId) return;

    for (const r of socket.rooms) {
      if (typeof r === "string" && r.startsWith("user:")) socket.leave(r);
    }

    const room = `user:${userId}`;
    socket.join(room);
  });
};
