const Router = require("express");
const router = new Router();
const foodCatalogController = require("../controllers/foodCatalogController");

router.get("/search", foodCatalogController.search);

module.exports = router;
