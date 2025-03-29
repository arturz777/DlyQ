const { Order, Warehouse } = require("../models/models");
const { Op } = require("sequelize");

class WarehouseController {
	// 📦 Получение заказов для склада
	async getWarehouseOrders(req, res) {
	  try {
		// ✅ Проверяем, есть ли склад у админа (если нет — создаем)
		let warehouse = await Warehouse.findOne({ where: { id: req.user.id } });
  
		if (!warehouse && req.user.role === "ADMIN") {
		  warehouse = await Warehouse.create({
			id: req.user.id,
			name: "Склад Админа",
			status: "active",
		  });
		}
  
		if (!warehouse) {
		  return res.status(404).json({ message: "Склад не найден." });
		}
  
    const orders = await Order.findAll({
      where: { warehouseStatus: { [Op.not]: "ready" }, warehouseId: warehouse.id },
      order: [["createdAt", "DESC"]],
  });

  const formattedOrders = orders.map((order) => ({
      ...order.toJSON(),
      orderDetails: order.orderDetails ? JSON.parse(order.orderDetails) : [],
      preorderDate: order.desiredDeliveryDate || null,
  }));

  return res.json(formattedOrders);
} catch (error) {
  return res.status(500).json({ message: "Ошибка сервера" });
}
	}

  async acceptOrder(req, res) {
    try {
      const { id } = req.params;
      const { processingTime } = req.body;
      const adminId = req.user.id; 

      let warehouse = await Warehouse.findOne({ where: { id: adminId } });

      if (!warehouse) {
        warehouse = await Warehouse.create({
          id: adminId, 
          name: "Склад №1", 
          status: "active",
        });
      }
	  
	  const order = await Order.findByPk(id);
      if (!order) {
        return res.status(404).json({ message: "Заказ не найден" });
      }

      order.warehouseStatus = "processing"; 
      order.processingTime = processingTime; 
      order.processingStartTime = new Date();
      order.warehouseId = warehouse.id; 
      order.status = "Waiting for courier"; 
      await order.save();

      const io = req.app.get("io"); 
      io.emit("warehouseOrder", order);
      io.emit("orderStatusUpdate", order); 

      
      return res.json(order);
    } catch (error) {
      console.error("❌ Ошибка обработки заказа складом:", error);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  // 📌 Завершение обработки и передача курьеру
  async completeOrder(req, res) {
    try {
      const { id } = req.params;

      const order = await Order.findByPk(id);
      if (!order) {
        return res.status(404).json({ message: "Заказ не найден" });
      }

      order.warehouseStatus = "ready"; // Меняем статус на "готов"
      order.status = "Ready for pickup";
      await order.save();

      const io = req.app.get("io"); // 🔥 Получаем WebSocket-сервер
      io.emit("orderReady", order);
      io.emit("orderStatusUpdate", { id: order.id, status: order.status });  

      return res.json(order);
    } catch (error) {
      console.error("❌ Ошибка завершения заказа:", error);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }
}

module.exports = new WarehouseController();
