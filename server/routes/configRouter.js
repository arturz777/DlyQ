const Router = require("express");
const router = new Router();

const {
  getMaintenance,
  setMaintenance,
  getShopConfig,
  setShopConfig,
  getDeliveryPricing,
  setDeliveryPricing,
  getCourierConfig,
  setCourierConfig,
} = require("../controllers/configController");

router.get("/maintenance", getMaintenance);
router.post("/maintenance", setMaintenance);

router.get("/shop", getShopConfig);
router.post("/shop", setShopConfig);

router.get("/delivery", getDeliveryPricing);
router.post("/delivery", setDeliveryPricing);

router.get("/courier", getCourierConfig);
router.post("/courier", setCourierConfig);

module.exports = router;
