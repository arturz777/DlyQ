const ApiError = require("../error/ApiError");
const { Op } = require("sequelize");
const { MenuItem, MenuCategory, Seller } = require("../models/models");

class foodCatalogController {
  async search(req, res, next) {
    try {
      const qRaw = (req.query.q || "").trim();
      if (!qRaw) return res.json({ items: [], sellers: [] });

      const limit = Math.min(Number(req.query.limit) || 20, 50);
      const like = `%${qRaw}%`;

      const items = await MenuItem.findAll({
        where: {
          isActive: { [Op.ne]: false },
          isAvailable: { [Op.ne]: false },
          [Op.or]: [
            { name: { [Op.iLike]: like } },
            { description: { [Op.iLike]: like } },
          ],
        },
        include: [
          { model: MenuCategory, as: "category", attributes: ["id", "name"] },
        ],
        order: [
          ["displayOrder", "ASC"],
          ["id", "ASC"],
        ],
        limit,
      });

      const sellerIds = Array.from(
        new Set(items.map((x) => x.sellerId))
      ).filter(Boolean);

      const sellersFromItems = sellerIds.length
        ? await Seller.findAll({
            where: { id: sellerIds, isActive: true },
            attributes: ["id", "name", "img", "kind", "slug"],
          })
        : [];

      const sellerById = new Map(
        sellersFromItems.map((s) => [Number(s.id), s])
      );

      const itemsWithSeller = items.map((it) => {
        const json = it.toJSON();
        return {
          ...json,
          seller: sellerById.get(Number(json.sellerId)) || null,
        };
      });

      const sellers = await Seller.findAll({
        where: {
          isActive: { [Op.ne]: false },
          [Op.or]: [
            { name: { [Op.iLike]: like } },
            { kind: { [Op.iLike]: like } },
          ],
        },
        attributes: ["id", "name", "img", "kind", "slug"],
        order: [["id", "ASC"]],
        limit,
      });

      return res.json({ items: itemsWithSeller, sellers });
    } catch (e) {
      next(ApiError.badRequest(e.message));
    }
  }
}

module.exports = new foodCatalogController();
