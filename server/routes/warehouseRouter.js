const Router = require("express");
const router = new Router();
const warehouseController = require("../controllers/warehouseController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.get(
  "/orders",
  authMiddleware,
  roleMiddleware("WAREHOUSE"),
  warehouseController.getWarehouseOrders
);

router.post(
  "/orders/:id/accept",
  authMiddleware,
  roleMiddleware("WAREHOUSE"),
  warehouseController.acceptOrder
);

router.post(
  "/orders/:id/complete",
  authMiddleware,
  roleMiddleware("WAREHOUSE"),
  warehouseController.completeOrder
);

router.post(
  "/push-token",
  authMiddleware,
  roleMiddleware("WAREHOUSE"),
  warehouseController.savePushToken
);

module.exports = router;
