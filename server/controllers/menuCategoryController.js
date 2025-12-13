const ApiError = require("../error/ApiError");
const { MenuCategory } = require("../models/models");

class MenuCategoryController {
  async getAll(req, res, next) {
    try {
      const sellerId = Number(req.query.sellerId);
      if (!sellerId) return next(ApiError.badRequest("sellerId обязателен"));

      const rows = await MenuCategory.findAll({
        where: { sellerId, isActive: true },
        order: [
          ["displayOrder", "ASC"],
          ["id", "ASC"],
        ],
      });

      return res.json(rows);
    } catch (e) {
      next(e);
    }
  }

  async create(req, res, next) {
    try {
      const { sellerId, name, displayOrder, isActive } = req.body;

      const sid = Number(sellerId);
      if (!sid) return next(ApiError.badRequest("sellerId обязателен"));
      if (!name) return next(ApiError.badRequest("name обязателен"));

      const active =
        isActive !== undefined
          ? String(isActive).toLowerCase() === "true"
          : true;

      const row = await MenuCategory.create({
        sellerId: sid,
        name: String(name).trim(),
        displayOrder: Number(displayOrder) || 0,
        isActive: active,
      });

      return res.json(row);
    } catch (e) {
      next(ApiError.badRequest(e.message));
    }
  }

  async update(req, res, next) {
    try {
      const id = Number(req.params.id);
      const { name, displayOrder, isActive } = req.body;

      const row = await MenuCategory.findByPk(id);
      if (!row) return next(ApiError.notFound("Категория не найдена"));

      if (name !== undefined) row.name = String(name).trim();
      if (displayOrder !== undefined) {
        row.displayOrder = Number(displayOrder) || 0;
      }

      if (isActive !== undefined) {
        row.isActive = String(isActive).toLowerCase() === "true";
      }

      await row.save();
      return res.json(row);
    } catch (e) {
      next(ApiError.badRequest(e.message));
    }
  }

  async deactivate(req, res, next) {
    try {
      const id = Number(req.params.id);

      const row = await MenuCategory.findByPk(id);
      if (!row) return next(ApiError.notFound("Категория не найдена"));

      row.isActive = false;
      await row.save();

      return res.json({ message: "Категория скрыта", category: row });
    } catch (e) {
      next(e);
    }
  }
}

module.exports = new MenuCategoryController();
