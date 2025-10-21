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
const geoRouter = require('./routes/geoRouter');
const courierRouter = require("./routes/courierRouter");
const warehouseRouter = require("./routes/warehouseRouter");
const orderRouter = require("./routes/orderRouter");
const chatRouter = require("./routes/chatRouter");
const cookieParser = require('cookie-parser');
const Stripe = require("stripe");  
const paymentsRouter = require("./routes/paymentsRouter.js");

setupCleanupTask();

const PORT = process.env.PORT || 5000;
const app = express();

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const sig = req.headers["stripe-signature"];
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );

      if (event.type === "payment_intent.succeeded") {
        const pi = event.data.object;
      }

      res.json({ received: true });
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'https://dlyq-staging.netlify.app',
    methods: ["GET", "POST"],
    credentials: true
  },
});


app.use(cors({
  origin: 'https://dlyq-staging.netlify.app',
  credentials: true           
}));
app.use(express.json());
app.use(express.static(path.resolve(__dirname, "static")));
app.use(fileUpload({}));
app.use(cookieParser());
app.use('/api/geo', geoRouter);
app.use("/api", router);
app.use("/api/couriers", courierRouter);
app.use("/api/warehouse", warehouseRouter);
app.set("io", io);
app.use("/api/order", orderRouter);
app.use("/api/chat", chatRouter);
app.use("/api/payments", paymentsRouter);

server.listen(PORT, () => console.log(`🚀 Сервер запущен на порту ${PORT}`));

io.on("connection", (socket) => {
  console.log("🟢 Клиент подключился:", socket.id);

  socket.on("disconnect", () => {
    console.log("🔴 Клиент отключился:", socket.id);
  });
});

const chatSocket = require("./sockets/chatSocket");
chatSocket(io);

const notifyNewOrder = (order) => {
  io.emit("newOrder", order);
};

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
