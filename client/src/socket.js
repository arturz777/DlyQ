import { io } from "socket.io-client";

const raw = process.env.REACT_APP_API_URL || "";
const socketUrl = raw.replace(/\/+$/, "").replace(/\/api$/, "");
export const socket = io(socketUrl, {
  transports: ["websocket"],
  withCredentials: true,
  autoConnect: true,
  auth: {
    token: localStorage.getItem("token"),
  },
});
