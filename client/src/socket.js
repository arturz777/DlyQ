import { io } from "socket.io-client";

const raw = process.env.REACT_APP_API_URL || "";

// ВАЖНО: убираем /api если он есть (потому что для socket.io это станет namespace)
const socketUrl = raw.replace(/\/+$/, "").replace(/\/api$/, "");

export const socket = io(socketUrl, {
  transports: ["websocket"],
  withCredentials: true,
  autoConnect: true,
});

socket.on("connect", () => console.log("✅ socket connected:", socket.id));
socket.on("disconnect", (reason) => console.log("❌ socket disconnect:", reason));
socket.on("connect_error", (err) => console.log("🔥 socket connect_error:", err.message));

