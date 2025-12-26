const ApiError = require("../error/ApiError");
const { Op } = require("sequelize");
const {
  MenuItem,
  MenuCategory,
  Seller,
  Translation,
} = require("../models/models");

class foodCatalogController {
  async search(req, res, next) {
    try {
      const qRaw = (req.query.q || "").trim();
      if (!qRaw) return res.json({ items: [], sellers: [] });

      const limit = Math.min(Number(req.query.limit) || 20, 50);
      const like = `%${qRaw}%`;

      const trRows = await Translation.findAll({
        attributes: ["key"],
        where: {
          text: { [Op.iLike]: like },
          key: { [Op.like]: "menu_item_%" },
        },
        limit: 500,
      });

      const idsFromTr = Array.from(
        new Set(
          trRows
            .map((r) => {
              const m = String(r.key).match(
                /^menu_item_(\d+)\.(name|description)$/
              );
              return m ? Number(m[1]) : null;
            })
            .filter(Boolean)
        )
      );

      const or = [
        { name: { [Op.iLike]: like } },
        { description: { [Op.iLike]: like } },
      ];

      if (idsFromTr.length) {
        or.push({ id: { [Op.in]: idsFromTr } });
      }

      const items = await MenuItem.findAll({
        where: {
          isActive: { [Op.ne]: false },
          isAvailable: { [Op.ne]: false },
          [Op.or]: or,
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

      const keys = items.flatMap((it) => [
        `menu_item_${it.id}.name`,
        `menu_item_${it.id}.description`,
      ]);

      const trs = await Translation.findAll({
        where: { key: { [Op.in]: keys } },
      });

      const tmap = {};
      trs.forEach((t) => {
        const m = t.key.match(/^menu_item_(\d+)\.(name|description)$/);
        if (!m) return;
        const itemId = m[1];
        const field = m[2];
        if (!tmap[itemId]) tmap[itemId] = { name: {}, description: {} };
        tmap[itemId][field][t.lang] = t.text;
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
          translations: tmap[String(json.id)] || { name: {}, description: {} },
          seller: sellerById.get(Number(json.sellerId)) || null,
        };
      });

      const sellerTrRows = await Translation.findAll({
        attributes: ["key"],
        where: {
          text: { [Op.iLike]: like },
          key: { [Op.like]: "seller_%.kind" },
        },
        limit: 500,
      });

      const sellerIdsFromTr = Array.from(
        new Set(
          sellerTrRows
            .map((r) => String(r.key).match(/^seller_(\d+)\.kind$/)?.[1])
            .filter(Boolean)
            .map(Number)
        )
      );

      const sellersOr = [
        { name: { [Op.iLike]: like } },
        { kind: { [Op.iLike]: like } },
      ];

      if (sellerIdsFromTr.length) {
        sellersOr.push({ id: { [Op.in]: sellerIdsFromTr } });
      }

      const sellers = await Seller.findAll({
        where: {
          isActive: { [Op.ne]: false },
          [Op.or]: sellersOr,
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
