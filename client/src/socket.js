import { io } from "socket.io-client";

export const socket = io(process.env.REACT_APP_API_URL, {
  withCredentials: true,
  transports: ["websocket", "polling"],
});

socket.on("connect", () => console.log("✅ socket connected", socket.id));
socket.on("disconnect", (r) => console.log("❌ socket disconnected", r));
socket.on("connect_error", (e) => console.log("🚫 connect_error", e.message));

