const ApiError = require("../error/ApiError");
const { Seller, SellerUser, User, Warehouse } = require("../models/models");
const sequelize = require("../db");

const makeSlug = (name = "") =>
  String(name)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const parseBool = (v, def = null) => {
  if (v === undefined || v === null) return def;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  if (s === "true" || s === "1") return true;
  if (s === "false" || s === "0") return false;
  return def;
};

class SellerController {
  async getAll(req, res, next) {
    try {
      const { onlyActive } = req.query;

      const where = {};
      if (onlyActive === "1" || onlyActive === "true") {
        where.isActive = true;
      }

      const sellers = await Seller.findAll({
        where,
        order: [["id", "ASC"]],
      });

      return res.json(sellers);
    } catch (e) {
      next(e);
    }
  }

  async getOne(req, res, next) {
    try {
      const { idOrSlug } = req.params;

      let seller = null;

      if (/^\d+$/.test(idOrSlug)) {
        seller = await Seller.findByPk(Number(idOrSlug));
      } else {
        seller = await Seller.findOne({ where: { slug: idOrSlug } });
      }

      if (!seller) {
        return next(ApiError.notFound("Магазин не найден"));
      }

      return res.json(seller);
    } catch (e) {
      next(e);
    }
  }

  async create(req, res, next) {
    const t = await sequelize.transaction();
    try {
      const { name, slug, isActive, kind, img, ownerUserId } = req.body;

      if (!name) {
        throw ApiError.badRequest("Название магазина обязательно");
      }

      const finalName = String(name).trim();
      const finalSlug = slug ? String(slug).trim() : makeSlug(finalName);
      const isActiveNorm = parseBool(isActive, true);

      if (finalSlug) {
        const exists = await Seller.findOne({
          where: { slug: finalSlug },
          transaction: t,
        });
        if (exists) {
          throw ApiError.badRequest("Такой slug уже занят");
        }
      }

      const seller = await Seller.create(
        {
          name: finalName,
          slug: finalSlug || null,
          kind: kind ?? null,
          img: img ?? null,
          isActive: isActiveNorm,
        },
        { transaction: t }
      );

      await Warehouse.findOrCreate({
        where: { sellerId: seller.id },
        defaults: {
          name: `Склад: ${seller.name}`,
          status: "active",
          sellerId: seller.id,
        },
        transaction: t,
      });

      if (ownerUserId) {
        const uid = Number(ownerUserId);
        if (!uid) {
          throw ApiError.badRequest("ownerUserId должен быть числом");
        }

        const user = await User.findByPk(uid, { transaction: t });
        if (!user) {
          throw ApiError.badRequest("ownerUserId: пользователь не найден");
        }

        await SellerUser.findOrCreate({
          where: { sellerId: seller.id, userId: uid },
          defaults: { roleInSeller: "owner" },
          transaction: t,
        });

        const roleUpper = String(user.role || "").toUpperCase();
        if (roleUpper !== "ADMIN" && roleUpper !== "SELLER") {
          user.role = "SELLER";
          await user.save({ transaction: t });
        }
      }

      await t.commit();
      return res.json(seller);
    } catch (e) {
      await t.rollback();
      return next(e);
    }
  }

  async update(req, res, next) {
    const t = await sequelize.transaction();
    try {
      const { id } = req.params;
      const { name, slug, isActive, kind, img, ownerUserId } = req.body;

      const seller = await Seller.findByPk(Number(id), { transaction: t });
      if (!seller) {
        throw ApiError.notFound("Магазин не найден");
      }

      if (name !== undefined) {
        seller.name = String(name).trim();
      }

      if (slug !== undefined) {
        const finalSlug = slug ? String(slug).trim() : null;

        if (finalSlug) {
          const exists = await Seller.findOne({
            where: { slug: finalSlug },
            transaction: t,
          });
          if (exists && exists.id !== seller.id) {
            throw ApiError.badRequest("Такой slug уже занят");
          }
        }

        seller.slug = finalSlug;
      }

      if (kind !== undefined) {
        seller.kind = kind || null;
      }

      if (img !== undefined) {
        seller.img = img || null;
      }

      const activeNorm = parseBool(isActive, null);
      if (activeNorm !== null) {
        seller.isActive = activeNorm;
      }

      await seller.save({ transaction: t });

      const [wh] = await Warehouse.findOrCreate({
        where: { sellerId: seller.id },
        defaults: {
          name: `Склад: ${seller.name}`,
          status: "active",
          sellerId: seller.id,
        },
        transaction: t,
      });

      const nextName = `Склад: ${seller.name}`;
      if (wh.name !== nextName) {
        wh.name = nextName;
        await wh.save({ transaction: t });
      }

      if (ownerUserId) {
        const uid = Number(ownerUserId);
        if (!uid) {
          throw ApiError.badRequest("ownerUserId должен быть числом");
        }

        const user = await User.findByPk(uid, { transaction: t });
        if (!user) {
          throw ApiError.badRequest("ownerUserId: пользователь не найден");
        }

        await SellerUser.findOrCreate({
          where: { sellerId: seller.id, userId: uid },
          defaults: { roleInSeller: "owner" },
          transaction: t,
        });

        const roleUpper = String(user.role || "").toUpperCase();
        if (roleUpper !== "ADMIN" && roleUpper !== "SELLER") {
          user.role = "SELLER";
          await user.save({ transaction: t });
        }
      }

      await t.commit();
      return res.json(seller);
    } catch (e) {
      await t.rollback();
      return next(e);
    }
  }

  async deactivate(req, res, next) {
    const t = await sequelize.transaction();
    try {
      const { id } = req.params;

      const seller = await Seller.findByPk(Number(id), { transaction: t });
      if (!seller) {
        throw ApiError.notFound("Магазин не найден");
      }

      seller.isActive = false;
      await seller.save({ transaction: t });

      await t.commit();
      return res.json({ message: "Магазин деактивирован", seller });
    } catch (e) {
      await t.rollback();
      return next(e);
    }
  }
}

module.exports = new SellerController();
