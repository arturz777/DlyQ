module.exports = function warehouseSocket(io, socket) {
  socket.on("joinWarehouseRoom", ({ sellerId }) => {
    console.log("➡️ joinWarehouseRoom request:", socket.id, sellerId, "rooms(before):", [...socket.rooms]);

    for (const r of socket.rooms) {
      if (typeof r === "string" && r.startsWith("warehouse:")) socket.leave(r);
    }

    const room = sellerId ? `warehouse:seller:${sellerId}` : "warehouse:main";
    socket.join(room);

    console.log("✅ joinWarehouseRoom:", socket.id, room, "rooms(after):", [...socket.rooms]);
  });
};

