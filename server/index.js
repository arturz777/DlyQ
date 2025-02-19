// server/index.js
require("dotenv").config();
const express = require("express");
const http = require("http"); // Добавляем HTTP-сервер
const { Server } = require("socket.io"); // Импортируем WebSocket
const sequelize = require("./db");
const models = require("./models/models");
const cors = require("cors");
const fileUpload = require("express-fileupload");
const router = require("./routes/index");
const errorHandler = require("./middleware/ErrorHandlingMiddleware");
const path = require("path");
const setupCleanupTask = require("./tasks");
const courierRouter = require("./routes/courierRouter");
const warehouseRouter = require("./routes/warehouseRouter");
const orderRouter = require("./routes/orderRouter");

setupCleanupTask();

const PORT = process.env.PORT || 5000;
const app = express();

const server = http.createServer(app); // Создаем HTTP-сервер
const io = new Server(server, {
  cors: {
    origin: "*", // Разрешаем доступ с любого источника (можно указать точный URL клиента)
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.resolve(__dirname, "static")));
app.use(fileUpload({}));
app.use("/api", router);
app.use("/api/couriers", courierRouter);
app.use("/api/warehouse", warehouseRouter);
app.set("io", io);
app.use("/api/order", orderRouter);

server.listen(PORT, () => console.log(`🚀 Сервер запущен на порту ${PORT}`));

// Подключение сокетов
io.on("connection", (socket) => {
  console.log("🟢 Клиент подключился:", socket.id);

  socket.on("disconnect", () => {
    console.log("🔴 Клиент отключился:", socket.id);
  });
});

// Функция для отправки новых заказов в реальном времени
const notifyNewOrder = (order) => {
  io.emit("newOrder", order);
};

// Обработка ошибок, последний Middleware
app.use(errorHandler);

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
// await sequelize.sync({ alter: true });
