const Router = require("express");
const router = new Router();
const warehouseController = require("../controllers/warehouseController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.get(
  "/orders",
  authMiddleware,
  roleMiddleware("WAREHOUSE", "SELLER", "ADMIN"),
  warehouseController.getWarehouseOrders
);

router.post(
  "/orders/:id/accept",
  authMiddleware,
  roleMiddleware("WAREHOUSE", "SELLER", "ADMIN"),
  warehouseController.acceptOrder
);

router.post(
  "/orders/:id/complete",
  authMiddleware,
  roleMiddleware("WAREHOUSE", "SELLER", "ADMIN"),
  warehouseController.completeOrder
);

router.post(
  "/push-token",
  authMiddleware,
  roleMiddleware("WAREHOUSE", "SELLER", "ADMIN"),
  warehouseController.savePushToken
);

module.exports = router;
