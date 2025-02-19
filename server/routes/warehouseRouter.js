const Router = require("express");
const router = new Router();
const warehouseController = require("../controllers/warehouseController");
const authMiddleware = require("../middleware/authMiddleware"); // ✅ Добавляем authMiddleware

// ✅ Используем authMiddleware (как в курьере)
router.get("/orders", authMiddleware, warehouseController.getWarehouseOrders);
router.post("/orders/:id/accept", authMiddleware, warehouseController.acceptOrder);
router.post("/orders/:id/complete", authMiddleware, warehouseController.completeOrder);

module.exports = router;
