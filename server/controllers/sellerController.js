const ApiError = require("../error/ApiError");
const {
  Seller,
  SellerUser,
  User,
  Warehouse,
  Translation,
} = require("../models/models");
const { Op } = require("sequelize");
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

const SUPPORTED_LANGS = ["ru", "en", "est"];

const parseTranslations = (raw) => {
  if (!raw) return null;

  let obj = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object") return null;

  const normLangMap = (m) => {
    if (!m || typeof m !== "object") return null;
    const out = {};
    for (const l of SUPPORTED_LANGS) {
      if (m[l] !== undefined) {
        const v = typeof m[l] === "string" ? m[l].trim() : "";
        if (v) out[l] = v;
      }
    }
    return out;
  };

  const out = {};
  if (obj.kind) out.kind = normLangMap(obj.kind);
  return out;
};

const readTranslationsMap = async (keys = [], transaction = undefined) => {
  const uniq = Array.from(new Set((keys || []).filter(Boolean)));
  if (!uniq.length) return {};

  const rows = await Translation.findAll({
    attributes: ["key", "lang", "text"],
    where: { key: { [Op.in]: uniq } },
    transaction,
  });

  const map = {};
  for (const r of rows) {
    if (!map[r.key]) map[r.key] = {};
    map[r.key][r.lang] = r.text;
  }
  return map;
};

const syncTranslationsForKey = async (key, langMap, transaction) => {
  if (!key || !langMap || typeof langMap !== "object") return;

  for (const lang of SUPPORTED_LANGS) {
    if (langMap[lang] === undefined) continue;

    const text = typeof langMap[lang] === "string" ? langMap[lang].trim() : "";

    const where = { key, lang };

    if (!text) {
      await Translation.destroy({ where, transaction });
      continue;
    }

    const [row, created] = await Translation.findOrCreate({
      where,
      defaults: { text },
      transaction,
    });

    if (!created && row.text !== text) {
      row.text = text;
      await row.save({ transaction });
    }
  }
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

      const keys = sellers.map((s) => `seller_${s.id}.kind`);
      const tmap = await readTranslationsMap(keys);

      const sellerIds = sellers.map((s) => s.id);

      const owners = await SellerUser.findAll({
        where: {
          sellerId: { [Op.in]: sellerIds },
          roleInSeller: "owner",
        },
        attributes: ["sellerId", "userId"],
      });

      const ownerBySellerId = new Map(
        owners.map((o) => [Number(o.sellerId), Number(o.userId)])
      );

      return res.json(
        sellers.map((s) => ({
          ...s.toJSON(),
          ownerUserId: ownerBySellerId.get(Number(s.id)) || null,
          translations: {
            kind: tmap[`seller_${s.id}.kind`] || {},
          },
        }))
      );
    } catch (e) {
      next(e);
    }
  }

  async getOne(req, res, next) {
    try {
      const { idOrSlug } = req.params;

      let seller = /^\d+$/.test(idOrSlug)
        ? await Seller.findByPk(Number(idOrSlug))
        : await Seller.findOne({ where: { slug: idOrSlug } });

      if (!seller) return next(ApiError.notFound("Магазин не найден"));

      const key = `seller_${seller.id}.kind`;
      const tmap = await readTranslationsMap([key]);

      const owner = await SellerUser.findOne({
        where: { sellerId: seller.id, roleInSeller: "owner" },
        attributes: ["userId"],
      });

      return res.json({
        ...seller.toJSON(),
        ownerUserId: owner?.userId || null,
        translations: { kind: tmap[key] || {} },
      });
    } catch (e) {
      next(e);
    }
  }

  async create(req, res, next) {
    const t = await sequelize.transaction();
    try {
      const {
        name,
        slug,
        isActive,
        kind,
        img,
        ownerUserId,
        address,
        pickupLat,
        pickupLng,
      } = req.body;

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

      const latNum =
        pickupLat == null || pickupLat === "" ? null : Number(pickupLat);
      const lngNum =
        pickupLng == null || pickupLng === "" ? null : Number(pickupLng);

      if (
        (latNum != null || lngNum != null) &&
        (!Number.isFinite(latNum) || !Number.isFinite(lngNum))
      ) {
        throw ApiError.badRequest("pickupLat/pickupLng должны быть числами");
      }

      if ((latNum == null) !== (lngNum == null)) {
        throw ApiError.badRequest(
          "Нужно указать и pickupLat, и pickupLng (или оставить оба пустыми)"
        );
      }

      const seller = await Seller.create(
        {
          name: finalName,
          slug: finalSlug || null,
          kind: kind ? String(kind).trim() : null,
          img: img ?? null,
          isActive: isActiveNorm,
          address: address ? String(address).trim() : null,
          pickupLat: latNum,
          pickupLng: lngNum,
        },
        { transaction: t }
      );

      const parsed = parseTranslations(req.body.translations);

      if (parsed?.kind) {
        await syncTranslationsForKey(
          `seller_${seller.id}.kind`,
          parsed.kind,
          t
        );
      }

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
      const {
        name,
        slug,
        isActive,
        kind,
        img,
        ownerUserId,
        address,
        pickupLat,
        pickupLng,
      } = req.body;

      const seller = await Seller.findByPk(Number(id), { transaction: t });
      if (!seller) throw ApiError.notFound("Магазин не найден");

      if (pickupLat !== undefined || pickupLng !== undefined) {
        let nextLat =
          pickupLat === undefined
            ? seller.pickupLat
            : pickupLat == null || pickupLat === ""
            ? null
            : Number(pickupLat);

        let nextLng =
          pickupLng === undefined
            ? seller.pickupLng
            : pickupLng == null || pickupLng === ""
            ? null
            : Number(pickupLng);

        if (nextLat !== null && !Number.isFinite(nextLat))
          throw ApiError.badRequest("pickupLat должен быть числом");
        if (nextLng !== null && !Number.isFinite(nextLng))
          throw ApiError.badRequest("pickupLng должен быть числом");

        if ((nextLat == null) !== (nextLng == null))
          throw ApiError.badRequest(
            "Нужно указать и pickupLat, и pickupLng (или оставить оба пустыми)"
          );

        seller.pickupLat = nextLat;
        seller.pickupLng = nextLng;
      }

      if (name !== undefined) seller.name = String(name).trim();

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

      const activeNorm = parseBool(isActive, null);
      if (activeNorm !== null) seller.isActive = activeNorm;

      if (kind !== undefined) seller.kind = kind ? String(kind).trim() : null;
      if (img !== undefined) seller.img = img || null;

      if (address !== undefined)
        seller.address = address ? String(address).trim() : null;

      await seller.save({ transaction: t });

      const parsed = parseTranslations(req.body.translations);

      if (parsed?.kind) {
        await syncTranslationsForKey(
          `seller_${seller.id}.kind`,
          parsed.kind,
          t
        );
      }

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
        if (!uid) throw ApiError.badRequest("ownerUserId должен быть числом");

        const user = await User.findByPk(uid, { transaction: t });
        if (!user)
          throw ApiError.badRequest("ownerUserId: пользователь не найден");

        await SellerUser.destroy({
          where: {
            sellerId: seller.id,
            roleInSeller: "owner",
            userId: { [Op.ne]: uid },
          },
          transaction: t,
        });

        const [link] = await SellerUser.findOrCreate({
          where: { sellerId: seller.id, userId: uid },
          defaults: { roleInSeller: "owner" },
          transaction: t,
        });

        if (link.roleInSeller !== "owner") {
          link.roleInSeller = "owner";
          await link.save({ transaction: t });
        }

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
      if (!seller) throw ApiError.notFound("Магазин не найден");

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
