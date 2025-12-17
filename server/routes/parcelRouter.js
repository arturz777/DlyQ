const Router = require("express");
const router = new Router();
const parcelController = require("../controllers/parcelController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/quote", parcelController.quote);

router.post("/create", authMiddleware, parcelController.create);

module.exports = router;
