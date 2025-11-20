const Router = require("express");
const router = new Router();
const courierController = require("../controllers/courierController");
const authMiddleware = require("../middleware/authMiddleware");
const checkRole = require("../middleware/checkRoleMiddleware");
const { Courier } = require("../models/models");
const { sendTestPush } = require("../services/pushService");

router.get("/orders", authMiddleware, courierController.getActiveOrders);
router.post(
  "/orders/:id/accept",
  authMiddleware,
  courierController.acceptOrder
);
router.post("/status", authMiddleware, courierController.toggleCourierStatus);
router.post(
  "/orders/:id/complete",
  authMiddleware,
  courierController.completeDelivery
);
router.post(
  "/orders/:id/status",
  authMiddleware,
  courierController.updateDeliveryStatus
);
router.post(
  "/update-location",
  authMiddleware,
  courierController.updateCourierLocation
);
router.get(
  "/couriers",
  authMiddleware,
  checkRole("ADMIN"),
  courierController.getAllCouriers
);
router.get("/me", authMiddleware, courierController.getSelf);
router.post("/push-token", authMiddleware, courierController.savePushToken);
router.post("/test-push", authMiddleware, async (req, res) => {
  try {
    const courierId = req.user.id;

    const courier = await Courier.findByPk(courierId);
    if (!courier || !courier.expoPushToken) {
      return res
        .status(400)
        .json({ message: "У курьера нет сохранённого FCM токена" });
    }

    const token = courier.expoPushToken;

    const ok = await sendTestPush(token);

    return res.json({ ok });
  } catch (err) {
    console.error("❌ Ошибка тестового FCM пуша:", err);
    return res
      .status(500)
      .json({ message: "Ошибка при отправке тестового пуша" });
  }
});

module.exports = router;
