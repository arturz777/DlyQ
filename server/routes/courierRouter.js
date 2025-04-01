const Router = require("express");
const router = new Router();
const courierController = require("../controllers/courierController");
const authMiddleware = require("../middleware/authMiddleware");
const checkRole = require('../middleware/checkRoleMiddleware');


router.get("/orders", authMiddleware, courierController.getActiveOrders);
router.post("/orders/:id/accept", authMiddleware, courierController.acceptOrder);
router.post("/status", authMiddleware, courierController.toggleCourierStatus);
router.post("/orders/:id/complete", authMiddleware, courierController.completeDelivery);
router.post("/orders/:id/status", authMiddleware, courierController.updateDeliveryStatus);
router.post("/update-location", authMiddleware, courierController.updateCourierLocation);
router.get('/couriers', authMiddleware, courierController.getAllCouriers);



module.exports = router;
