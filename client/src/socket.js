import { io } from "socket.io-client";

export const socket = io(process.env.REACT_APP_API_URL, {
  withCredentials: true,
  transports: ["websocket"],      // 👈 важно
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 2000,
});

