const { MenuItem, Translation } = require("../models/models");
const { Op } = require("sequelize");
const ApiError = require("../error/ApiError");
const { supabase } = require("../config/supabaseClient");
const uuid = require("uuid");

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
        }),
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

async function uploadImageIfAny(req, prevUrl = null) {
  if (!req.files || !req.files.img) return prevUrl;

  if (prevUrl) {
    const oldFileName = prevUrl.split("/").pop();
    await supabase.storage.from("images").remove([oldFileName]);
  }

  const { img } = req.files;
  const fileName = `${uuid.v4()}${img.name.substring(
    img.name.lastIndexOf("."),
  )}`;

  const { error } = await supabase.storage
    .from("images")
    .upload(fileName, img.data, { contentType: img.mimetype });

  if (error) throw new Error("Ошибка загрузки изображения в Supabase");

  return `https://esjsdctbiuzornxbktjb.supabase.co/storage/v1/object/public/images/${fileName}`;
}

class MenuItemController {
  async create(req, res, next) {
    try {
      const {
        sellerId,
        categoryId,
        name,
        description,
        price,
        isAvailable,
        isActive,
        displayOrder,
        translations,
      } = req.body;

      if (!sellerId) return next(ApiError.badRequest("sellerId обязателен"));
      if (!name || !name.trim())
        return next(ApiError.badRequest("Введите название блюда"));

      const p = Number(price);
      if (!Number.isFinite(p) || p <= 0)
        return next(ApiError.badRequest("Цена некорректна"));

      const imgUrl = await uploadImageIfAny(req, null);

      const item = await MenuItem.create({
        sellerId: Number(sellerId),
        categoryId: categoryId ? Number(categoryId) : null,
        name: name.trim(),
        description: description ? description.trim() : null,
        price: p,
        img: imgUrl,
        isAvailable:
          isAvailable !== undefined ? String(isAvailable) === "true" : true,
        isActive: isActive !== undefined ? String(isActive) === "true" : true,
        displayOrder: displayOrder ? Number(displayOrder) : 0,
      });

      const parsed = parseTranslations(translations) || {};

      await syncTranslationsForKey(`menu_item_${item.id}.name`, {
        ...(parsed.name || {}),
        ru: name.trim(),
      });

      await syncTranslationsForKey(`menu_item_${item.id}.description`, {
        ...(parsed.description || {}),
        ...(description && description.trim()
          ? { ru: description.trim() }
          : {}),
      });

      const tmap = await readTranslationsMap([
        `menu_item_${item.id}.name`,
        `menu_item_${item.id}.description`,
      ]);

      return res.status(201).json({
        ...item.toJSON(),
        translations: {
          name: tmap[`menu_item_${item.id}.name`] || {},
          description: tmap[`menu_item_${item.id}.description`] || {},
        },
      });
    } catch (e) {
      console.error("❌ MenuItem.create:", e.message);
      return next(ApiError.badRequest(e.message));
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      let {
        name,
        description,
        price,
        categoryId,
        isAvailable,
        isActive,
        displayOrder,
        translations,
      } = req.body;

      const item = await MenuItem.findByPk(id);
      if (!item) return res.status(404).json({ message: "Блюдо не найдено" });

      if (!name || !name.trim()) name = item.name;

      let p = item.price;
      if (price !== undefined) {
        const np = Number(price);
        if (!Number.isFinite(np) || np <= 0) {
          return res.status(400).json({ message: "Цена некорректна" });
        }
        p = np;
      }

      const imgUrl = await uploadImageIfAny(req, item.img);

      await item.update({
        name: name.trim(),
        description:
          description !== undefined
            ? description
              ? description.trim()
              : null
            : item.description,
        price: p,
        categoryId:
          categoryId !== undefined
            ? categoryId
              ? Number(categoryId)
              : null
            : item.categoryId,
        img: imgUrl,
        isAvailable:
          isAvailable !== undefined
            ? String(isAvailable) === "true"
            : item.isAvailable,
        isActive:
          isActive !== undefined ? String(isActive) === "true" : item.isActive,
        displayOrder:
          displayOrder !== undefined ? Number(displayOrder) : item.displayOrder,
      });

      const parsed = parseTranslations(translations) || {};

      await syncTranslationsForKey(`menu_item_${id}.name`, {
        ...(parsed.name || {}),
        ru: item.name.trim(),
      });

      await syncTranslationsForKey(`menu_item_${id}.description`, {
        ...(parsed.description || {}),
        ...(item.description && item.description.trim()
          ? { ru: item.description.trim() }
          : {}),
      });

      const tmap = await readTranslationsMap([
        `menu_item_${id}.name`,
        `menu_item_${id}.description`,
      ]);

      return res.json({
        ...item.toJSON(),
        translations: {
          name: tmap[`menu_item_${id}.name`] || {},
          description: tmap[`menu_item_${id}.description`] || {},
        },
      });
    } catch (e) {
      console.error("❌ MenuItem.update:", e.message);
      return res
        .status(500)
        .json({ message: "Ошибка сервера при редактировании блюда." });
    }
  }

  async getAll(req, res) {
    try {
      const { sellerId } = req.query;
      if (!sellerId)
        return res.status(400).json({ message: "sellerId обязателен" });

      const items = await MenuItem.findAll({
        where: { sellerId: Number(sellerId) },
        order: [
          ["displayOrder", "ASC"],
          ["id", "ASC"],
        ],
      });

      const ids = items.map((i) => i.id);
      const keys = ids.flatMap((id) => [
        `menu_item_${id}.name`,
        `menu_item_${id}.description`,
      ]);

      const translations = await Translation.findAll({
        where: { key: { [Op.in]: keys } },
      });

      const map = {};
      translations.forEach((t) => {
        const m = t.key.match(/^menu_item_(\d+)\.(name|description)$/);
        if (!m) return;

        const itemId = m[1];
        const field = m[2];

        if (!map[itemId]) map[itemId] = { name: {}, description: {} };
        map[itemId][field][t.lang] = t.text;
      });

      const out = items.map((i) => ({
        ...i.toJSON(),
        translations: map[i.id] || { name: {}, description: {} },
      }));

      return res.json(out);
    } catch (e) {
      console.error("❌ MenuItem.getAll:", e.message);
      return res.status(500).json({ message: "Ошибка при получении блюд." });
    }
  }

  async toggleAvailability(req, res) {
    try {
      const { id } = req.params;
      const { isAvailable } = req.body;

      const item = await MenuItem.findByPk(id);
      if (!item) return res.status(404).json({ message: "Блюдо не найдено" });

      await item.update({ isAvailable: String(isAvailable) === "true" });
      return res.json({
        message: "Доступность обновлена",
        id: item.id,
        isAvailable: item.isAvailable,
      });
    } catch (e) {
      console.error("❌ MenuItem.toggleAvailability:", e.message);
      return res
        .status(500)
        .json({ message: "Ошибка при обновлении доступности" });
    }
  }

  async deactivate(req, res) {
    try {
      const { id } = req.params;
      const item = await MenuItem.findByPk(id);
      if (!item) return res.status(404).json({ message: "Блюдо не найдено" });

      await item.update({ isActive: false });
      return res.json({ message: "Блюдо деактивировано", id: item.id });
    } catch (e) {
      console.error("❌ MenuItem.deactivate:", e.message);
      return res.status(500).json({ message: "Ошибка при деактивации блюда" });
    }
  }
}

module.exports = new MenuItemController();
