const Router = require("express");
const router = new Router();

const controller = require("../controllers/inventoryReceiptController");

router.post("/receipts", /*checkRole("ADMIN"),*/ controller.create);
router.get("/receipts", /*checkRole("ADMIN"),*/ controller.list);
router.get("/receipts/:id", /*checkRole("ADMIN"),*/ controller.getOne);
router.delete("/receipts/:id", /*checkRole("ADMIN"),*/ controller.remove);
router.post(
  "/writeoffs",
  (req, res, next) => {
    req.body.kind = "OUT";
    next();
  },
  controller.create
);

module.exports = router;
