const { MenuOptionGroup, MenuItem, Translation } = require("../models/models");
const { Op } = require("sequelize");
const ApiError = require("../error/ApiError");

const normLang = (lang) =>
  String(lang || "")
    .trim()
    .toLowerCase();

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

async function syncTranslationsForKey(key, map) {
  if (!map || typeof map !== "object") return;

  const ops = [];
  for (const [langRaw, textRaw] of Object.entries(map)) {
    const lang = normLang(langRaw);
    if (!lang) continue;

    if (textRaw === null || textRaw === undefined) continue;
    const text =
      typeof textRaw === "string" ? textRaw.trim() : String(textRaw).trim();

    if (!text) {
      ops.push(Translation.destroy({ where: { key, lang } }));
    } else {
      ops.push(Translation.upsert({ key, lang, text }));
    }
  }
  await Promise.all(ops);
}

async function readTranslationsMap(keys) {
  const rows = await Translation.findAll({ where: { key: { [Op.in]: keys } } });
  const out = {};
  rows.forEach((r) => {
    if (!out[r.key]) out[r.key] = {};
    out[r.key][r.lang] = r.text;
  });
  return out;
}

class MenuOptionGroupController {
  async create(req, res, next) {
    try {
      const {
        menuItemId,
        title,
        type,
        isRequired,
        minSelect,
        maxSelect,
        displayOrder,
        isActive,
        translations,
      } = req.body;

      if (!menuItemId) return next(ApiError.badRequest("menuItemId required"));
      if (!title || !title.trim())
        return next(ApiError.badRequest("title required"));

      const item = await MenuItem.findByPk(menuItemId);
      if (!item) return next(ApiError.badRequest("menu item not found"));

      const group = await MenuOptionGroup.create({
        menuItemId: Number(menuItemId),
        title: title.trim(),
        type: type === "multi" ? "multi" : "single",
        isRequired: String(isRequired) === "true" || isRequired === true,
        minSelect:
          minSelect !== undefined && minSelect !== ""
            ? Number(minSelect)
            : null,
        maxSelect:
          maxSelect !== undefined && maxSelect !== ""
            ? Number(maxSelect)
            : null,
        displayOrder: displayOrder ? Number(displayOrder) : 0,
        isActive: isActive !== undefined ? String(isActive) === "true" : true,
      });

      const parsed = parseTranslations(translations) || {};
      await syncTranslationsForKey(`menu_option_group_${group.id}.title`, {
        ...(parsed.title || {}),
        ru: group.title,
      });

      const tmap = await readTranslationsMap([
        `menu_option_group_${group.id}.title`,
      ]);

      return res.status(201).json({
        ...group.toJSON(),
        translations: {
          title: tmap[`menu_option_group_${group.id}.title`] || {},
        },
      });
    } catch (e) {
      console.error("MenuOptionGroup.create:", e);
      return next(ApiError.badRequest(e.message));
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;

      let {
        title,
        type,
        isRequired,
        minSelect,
        maxSelect,
        displayOrder,
        isActive,
        translations,
      } = req.body;

      const group = await MenuOptionGroup.findByPk(id);
      if (!group) return res.status(404).json({ message: "Group not found" });

      await group.update({
        title:
          title !== undefined
            ? title
              ? title.trim()
              : group.title
            : group.title,
        type:
          type !== undefined
            ? type === "multi"
              ? "multi"
              : "single"
            : group.type,
        isRequired:
          isRequired !== undefined
            ? String(isRequired) === "true"
            : group.isRequired,
        minSelect:
          minSelect !== undefined
            ? minSelect === ""
              ? null
              : Number(minSelect)
            : group.minSelect,
        maxSelect:
          maxSelect !== undefined
            ? maxSelect === ""
              ? null
              : Number(maxSelect)
            : group.maxSelect,
        displayOrder:
          displayOrder !== undefined
            ? Number(displayOrder)
            : group.displayOrder,
        isActive:
          isActive !== undefined ? String(isActive) === "true" : group.isActive,
      });

      const parsed = parseTranslations(translations) || {};
      await syncTranslationsForKey(`menu_option_group_${group.id}.title`, {
        ...(parsed.title || {}),
        ru: group.title,
      });

      const tmap = await readTranslationsMap([
        `menu_option_group_${group.id}.title`,
      ]);

      return res.json({
        ...group.toJSON(),
        translations: {
          title: tmap[`menu_option_group_${group.id}.title`] || {},
        },
      });
    } catch (e) {
      console.error("MenuOptionGroup.update:", e);
      return res.status(500).json({ message: "Server error" });
    }
  }

  async deactivate(req, res) {
    try {
      const { id } = req.params;
      const group = await MenuOptionGroup.findByPk(id);
      if (!group) return res.status(404).json({ message: "Group not found" });

      await group.update({ isActive: false });
      return res.json({ message: "Group deactivated", id: group.id });
    } catch (e) {
      console.error("MenuOptionGroup.deactivate:", e);
      return res.status(500).json({ message: "Server error" });
    }
  }
}

module.exports = new MenuOptionGroupController();
