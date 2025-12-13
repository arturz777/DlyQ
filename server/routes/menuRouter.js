const Router = require("express");
const router = new Router();

const authMiddleware = require("../middleware/authMiddleware");
const checkSellerAccess = require("../middleware/checkSellerAccess");
const checkSellerResourceAccess = require("../middleware/checkSellerResourceAccess");

const { MenuCategory, MenuItem } = require("../models/models");

const menuCategoryController = require("../controllers/menuCategoryController");
const menuItemController = require("../controllers/menuItemController");

router.get("/categories", menuCategoryController.getAll);
router.get("/items", menuItemController.getAll);

const sellerCreateGuard = [authMiddleware, checkSellerAccess()];

const categoryAccess = [
  authMiddleware,
  checkSellerResourceAccess(MenuCategory, {
    notFoundMessage: "Категория не найдена",
  }),
];

const itemAccess = [
  authMiddleware,
  checkSellerResourceAccess(MenuItem, {
    notFoundMessage: "Блюдо не найдено",
  }),
];

router.post("/categories", ...sellerCreateGuard, menuCategoryController.create);
router.put("/categories/:id", ...categoryAccess, menuCategoryController.update);
router.patch(
  "/categories/:id/deactivate",
  ...categoryAccess,
  menuCategoryController.deactivate
);

router.post("/items", ...sellerCreateGuard, menuItemController.create);
router.put("/items/:id", ...itemAccess, menuItemController.update);
router.patch(
  "/items/:id/availability",
  ...itemAccess,
  menuItemController.toggleAvailability
);
router.patch(
  "/items/:id/deactivate",
  ...itemAccess,
  menuItemController.deactivate
);

module.exports = router;
