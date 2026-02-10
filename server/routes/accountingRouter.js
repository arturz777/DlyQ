const router = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const checkRoleMiddleware = require("../middleware/checkRoleMiddleware");
const accountingController = require("../controllers/accountingController");

router.get(
  "/couriers",
  authMiddleware,
  checkRoleMiddleware("ADMIN"),
  accountingController.getCourierAccounting,
);

router.get(
  "/income/shop",
  authMiddleware,
  checkRoleMiddleware("ADMIN"),
  accountingController.getIncomeShop,
);

router.get(
  "/income/sellers",
  authMiddleware,
  checkRoleMiddleware("ADMIN"),
  accountingController.getIncomeSellers,
);

router.get(
  "/income/couriers/:courierId/orders",
  authMiddleware,
  checkRoleMiddleware("ADMIN"),
  accountingController.getCourierIncomeOrders,
);

router.get(
  "/payouts",
  authMiddleware,
  checkRoleMiddleware("ADMIN"),
  accountingController.getPayoutStatuses,
);
router.post(
  "/payouts",
  authMiddleware,
  checkRoleMiddleware("ADMIN"),
  accountingController.setPayoutStatus,
);

module.exports = router;
