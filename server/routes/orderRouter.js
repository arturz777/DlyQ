const Router = require('express');
const router = new Router();
const orderController = require('../controllers/orderController');
const authMiddleware = require('../middleware/authMiddleware');
const checkRole = require('../middleware/checkRoleMiddleware');


router.post('/create', authMiddleware, orderController.createOrder);
router.get('/user', authMiddleware, orderController.getUserOrders);
router.put('/update-status', authMiddleware, orderController.updateOrderStatus);
router.get('/active', authMiddleware, orderController.getActiveOrder);
router.get("/delivery-cost", orderController.getDeliveryCost);
router.get('/admin', authMiddleware, checkRole("ADMIN"), orderController.getAllOrdersForAdmin);
router.put('/:id/status', authMiddleware, checkRole("ADMIN"), orderController.adminUpdateOrderStatus);
router.put('/:id/assign-courier', authMiddleware, checkRole("ADMIN"), orderController.assignCourier);




module.exports = router;
