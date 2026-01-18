const Router = require("express");
const router = new Router();
const {
  getMaintenance,
  setMaintenance,
  getShopConfig,
  setShopConfig,
} = require("../controllers/configController");

router.get("/maintenance", getMaintenance);
router.post("/maintenance", setMaintenance);

router.get("/shop", getShopConfig);
router.post("/shop", setShopConfig);

module.exports = router;
