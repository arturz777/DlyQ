const router = require("express").Router();
const sellerController = require("../controllers/sellerController");
const authMiddleware = require("../middleware/authMiddleware");
const checkRole = require("../middleware/checkRoleMiddleware");
const checkSellerAccess = require("../middleware/checkSellerAccess");

router.get("/", sellerController.getAll);
router.get("/:idOrSlug", sellerController.getOne);

router.post("/", authMiddleware, checkRole("ADMIN"), sellerController.create);

router.get(
  "/:id/can-manage",
  authMiddleware,
  checkSellerAccess({ paramName: "id" }),
  (req, res) => {
    res.json({ ok: true });
  }
);

router.put(
  "/:id",
  authMiddleware,
  checkSellerAccess({ paramName: "id" }),
  sellerController.update
);

router.patch(
  "/:id/deactivate",
  authMiddleware,
  checkSellerAccess({ paramName: "id" }),
  sellerController.deactivate
);

module.exports = router;
