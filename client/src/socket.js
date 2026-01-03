import { io } from "socket.io-client";

export const socket = io(process.env.REACT_APP_API_URL, {
  transports: ["websocket"],
  withCredentials: true,
  autoConnect: true,
});

socket.on("connect", () => {
  console.log("✅ socket connected:", socket.id);
});

socket.on("disconnect", (reason) => {
  console.log("❌ socket disconnect:", reason);
});

socket.on("connect_error", (err) => {
  console.log("🔥 socket connect_error:", err.message);
});
