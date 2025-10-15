require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const sequelize = require("./db");
const models = require("./models/models");
const cors = require("cors");
const fileUpload = require("express-fileupload");
const router = require("./routes/index");
const errorHandler = require("./middleware/ErrorHandlingMiddleware");
const path = require("path");
const setupCleanupTask = require("./tasks");
const geoRouter = require("./routes/geoRouter");
const courierRouter = require("./routes/courierRouter");
const warehouseRouter = require("./routes/warehouseRouter");
const orderRouter = require("./routes/orderRouter");
const chatRouter = require("./routes/chatRouter");
const cookieParser = require("cookie-parser");

setupCleanupTask();

const PORT = process.env.PORT || 5000;
const app = express();

const allowedOrigins = [
  "https://dlyq.ee",
  "https://www.dlyq.ee",
];

app.use((req, res, next) => {
  res.header("Vary", "Origin");
  next();
});

const corsOptions = {
  origin(origin, cb) {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error("CORS blocked: " + origin));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.set("trust proxy", 1);

app.use(express.json());
app.use(express.static(path.resolve(__dirname, "static")));
app.use(fileUpload({}));
app.use(cookieParser());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin(origin, cb) {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("CORS (socket): " + origin));
    },
    credentials: true,
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
});
app.set("io", io);

io.on("connection", (socket) => {
  console.log("🟢 Клиент подключился:", socket.id);
  socket.on("disconnect", () => {
    console.log("🔴 Клиент отключился:", socket.id);
  });
});
app.use("/api/geo", geoRouter);
app.use("/api", router);
app.use("/api/couriers", courierRouter);
app.use("/api/warehouse", warehouseRouter);
app.use("/api/order", orderRouter);
app.use("/api/chat", chatRouter);

const chatSocket = require("./sockets/chatSocket");
chatSocket(io);

const notifyNewOrder = (order) => {
  io.emit("newOrder", order);
};

app.use(errorHandler);

server.listen(PORT, () => console.log(`🚀 Сервер запущен на порту ${PORT}`));

const start = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync();
  } catch (e) {
    console.log(e);
  }
};
start();

module.exports = { io, notifyNewOrder };
