const router = require("express").Router();
const courierController = require("../controllers/courierController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const checkRoleMiddleware = require("../middleware/checkRoleMiddleware");

router.get(
  "/orders",
  authMiddleware,
  roleMiddleware("COURIER"),
  courierController.getActiveOrders
);

router.post(
  "/orders/:id/accept",
  authMiddleware,
  roleMiddleware("COURIER"),
  courierController.acceptOrder
);

router.get(
  "/orders/:id/self-pick-info",
  authMiddleware,
  roleMiddleware("COURIER"),
  courierController.selfPickInfo
);

router.post(
  "/orders/:id/self-pick",
  authMiddleware,
  roleMiddleware("COURIER"),
  courierController.selfPick
);

router.get(
  "/self-pick-candidates",
  authMiddleware,
  roleMiddleware("COURIER"),
  courierController.selfPickCandidates
);

router.post(
  "/status",
  authMiddleware,
  roleMiddleware("COURIER"),
  courierController.toggleCourierStatus
);

router.post(
  "/orders/:id/complete",
  authMiddleware,
  roleMiddleware("COURIER"),
  courierController.completeDelivery
);

router.post(
  "/orders/:id/status",
  authMiddleware,
  roleMiddleware("COURIER"),
  courierController.updateDeliveryStatus
);

router.post(
  "/update-location",
  authMiddleware,
  roleMiddleware("COURIER"),
  courierController.updateCourierLocation
);

router.get(
  "/me",
  authMiddleware,
  roleMiddleware("COURIER"),
  courierController.getSelf
);

router.post(
  "/push-token",
  authMiddleware,
  roleMiddleware("COURIER"),
  courierController.savePushToken
);

router.post(
  "/orders/:id/decline",
  authMiddleware,
  roleMiddleware("COURIER"),
  courierController.declineOrder
);

router.get(
  "/couriers",
  authMiddleware,
  checkRoleMiddleware("ADMIN"),
  courierController.getAllCouriers
);

router.get(
  "/history",
  authMiddleware,
  roleMiddleware("COURIER"),
  courierController.getHistory
);

router.get(
  "/finance",
  authMiddleware,
  roleMiddleware("COURIER"),
  courierController.getFinance
);

module.exports = router;
