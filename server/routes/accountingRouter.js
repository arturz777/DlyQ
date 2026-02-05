const router = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const checkRoleMiddleware = require("../middleware/checkRoleMiddleware");
const accountingController = require("../controllers/accountingController");

router.get(
  "/couriers",
  authMiddleware,
  checkRoleMiddleware("ADMIN"),
  accountingController.getCourierAccounting
);

module.exports = router;
