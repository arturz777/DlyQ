const { MenuCategory, Translation } = require("../models/models");
const { Op } = require("sequelize");
const ApiError = require("../error/ApiError");

function parseTranslations(v) {
  if (!v) return null;

  if (typeof v === "string") {
    const s = v.trim();
    if (!s || s === "null" || s === "undefined") return null;
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  }

  if (typeof v === "object") return v;
  return null;
}

const normLang = (lang) =>
  String(lang || "")
    .trim()
    .toLowerCase();

async function syncTranslationsForKey(key, map, transaction = undefined) {
  if (!map || typeof map !== "object") return;

  const ops = [];

  for (const [langRaw, textRaw] of Object.entries(map)) {
    const lang = normLang(langRaw);
    if (!lang) continue;

    if (textRaw === null || textRaw === undefined) continue;

    const text =
      typeof textRaw === "string" ? textRaw.trim() : String(textRaw).trim();

    if (!text) {
      ops.push(
        Translation.destroy({
          where: { key, lang },
          transaction,
        })
      );
    } else {
      ops.push(Translation.upsert({ key, lang, text }, { transaction }));
    }
  }

  await Promise.all(ops);
}

async function readTranslationsMap(keys) {
  const rows = await Translation.findAll({
    where: { key: { [Op.in]: keys } },
  });

  const out = {};
  rows.forEach((r) => {
    if (!out[r.key]) out[r.key] = {};
    out[r.key][r.lang] = r.text;
  });

  return out;
}

class MenuCategoryController {
  async create(req, res, next) {
    try {
      const { sellerId, name, isActive, displayOrder, translations } = req.body;

      if (!sellerId) return next(ApiError.badRequest("sellerId обязателен"));
      if (!name || !name.trim())
        return next(ApiError.badRequest("Введите название категории"));

      const category = await MenuCategory.create({
        sellerId: Number(sellerId),
        name: name.trim(),
        isActive: isActive !== undefined ? String(isActive) === "true" : true,
        displayOrder: displayOrder ? Number(displayOrder) : 0,
      });

      const parsed = parseTranslations(translations) || {};

      await syncTranslationsForKey(`menu_category_${id}.name`, {
        ...(parsed.name || {}),
        ru: category.name.trim(),
      });

      const tmap = await readTranslationsMap([
        `menu_category_${category.id}.name`,
      ]);

      return res.status(201).json({
        ...category.toJSON(),
        translations: {
          name: tmap[`menu_category_${category.id}.name`] || {},
        },
      });
    } catch (e) {
      console.error("❌ MenuCategory.create:", e.message);
      return next(ApiError.badRequest(e.message));
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      let { name, isActive, displayOrder, translations } = req.body;

      const category = await MenuCategory.findByPk(id);
      if (!category)
        return res.status(404).json({ message: "Категория не найдена" });

      if (!name || !name.trim()) name = category.name;

      await category.update({
        name: name.trim(),
        isActive:
          isActive !== undefined
            ? String(isActive) === "true"
            : category.isActive,
        displayOrder:
          displayOrder !== undefined
            ? Number(displayOrder)
            : category.displayOrder,
      });

      const parsed = parseTranslations(translations) || {};

      await syncTranslationsForKey(`menu_category_${category.id}.name`, {
        ...(parsed.name || {}),
        ru: category.name.trim(),
      });

      const tmap = await readTranslationsMap([`menu_category_${id}.name`]);

      return res.json({
        ...category.toJSON(),
        translations: {
          name: tmap[`menu_category_${id}.name`] || {},
        },
      });
    } catch (e) {
      console.error("❌ MenuCategory.update:", e.message);
      return res
        .status(500)
        .json({ message: "Ошибка сервера при редактировании категории." });
    }
  }

  async getAll(req, res) {
    try {
      const { sellerId } = req.query;
      if (!sellerId)
        return res.status(400).json({ message: "sellerId обязателен" });

      const categories = await MenuCategory.findAll({
        where: { sellerId: Number(sellerId) },
        order: [
          ["displayOrder", "ASC"],
          ["id", "ASC"],
        ],
      });

      const ids = categories.map((c) => c.id);
      const keys = ids.map((id) => `menu_category_${id}.name`);

      const translations = await Translation.findAll({
        where: { key: { [Op.in]: keys } },
      });

      const map = {};
      translations.forEach((t) => {
        const id = t.key.replace("menu_category_", "").replace(".name", "");
        if (!map[id]) map[id] = { name: {} };
        map[id].name[t.lang] = t.text;
      });

      const out = categories.map((c) => ({
        ...c.toJSON(),
        translations: map[c.id] || { name: {} },
      }));

      return res.json(out);
    } catch (e) {
      console.error("❌ MenuCategory.getAll:", e.message);
      return res
        .status(500)
        .json({ message: "Ошибка при получении категорий." });
    }
  }

  async deactivate(req, res) {
    try {
      const { id } = req.params;
      const category = await MenuCategory.findByPk(id);
      if (!category)
        return res.status(404).json({ message: "Категория не найдена" });

      await category.update({ isActive: false });
      return res.json({ message: "Категория деактивирована", id: category.id });
    } catch (e) {
      console.error("❌ MenuCategory.deactivate:", e.message);
      return res
        .status(500)
        .json({ message: "Ошибка при деактивации категории" });
    }
  }
}

module.exports = new MenuCategoryController();
