const Router = require("express");
const router = new Router();

const {
  getMaintenance,
  setMaintenance,
  getShopConfig,
  setShopConfig,
  getDeliveryPricing,
  setDeliveryPricing,
} = require("../controllers/configController");

router.get("/maintenance", getMaintenance);
router.post("/maintenance", setMaintenance);

router.get("/shop", getShopConfig);
router.post("/shop", setShopConfig);

router.get("/delivery", getDeliveryPricing);
router.post("/delivery", setDeliveryPricing);

module.exports = router;
