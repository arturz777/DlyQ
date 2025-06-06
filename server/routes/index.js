///server/routes/index.js
const Router = require('express')
const router = new Router()
const deviceRouter = require('./deviceRouter')
const userRouter = require('./userRouter')
const brandRouter = require('./brandRouter')
const typeRouter = require('./typeRouter')
const orderController = require('../controllers/orderController');
const subtypeRouter = require('./subtypeRouter');
const orderRouter = require('./orderRouter');
const courierRouter = require("./courierRouter");
const warehouseRouter = require("./warehouseRouter");
const translationRoutes = require("./translationRoutes");
const chatRouter = require("./chatRouter");

router.use('/user', userRouter)
router.use('/type', typeRouter)
router.use('/brand', brandRouter)
router.use('/device', deviceRouter)
router.post('/create', orderController.createOrder);
router.use('/subtype', subtypeRouter);
router.use('/order', orderRouter);
router.use("/couriers", courierRouter);
router.use("/warehouse", warehouseRouter);
router.use("/translations", translationRoutes);
router.use("/chat", chatRouter);

module.exports = router
