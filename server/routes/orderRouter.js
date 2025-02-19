// server/routes/orderRoutes.js
const Router = require('express');
const router = new Router();
const orderController = require('../controllers/orderController');
const authMiddleware = require('../middleware/authMiddleware');


router.post('/create', authMiddleware, orderController.createOrder);
router.get('/user', authMiddleware, orderController.getUserOrders);
router.put('/update-status', authMiddleware, orderController.updateOrderStatus);
router.get('/active', authMiddleware, orderController.getActiveOrder);
router.get("/delivery-cost", orderController.getDeliveryCost);


module.exports = router;
