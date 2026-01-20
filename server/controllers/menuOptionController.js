const { MenuOption, MenuOptionGroup, Translation } = require("../models/models");
const { Op } = require("sequelize");
const ApiError = require("../error/ApiError");

const normLang = (lang) => String(lang || "").trim().toLowerCase();

function parseTranslations(v) {
  if (!v) return null;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s || s === "null" || s === "undefined") return null;
    try { return JSON.parse(s); } catch { return null; }
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
    const text = typeof textRaw === "string" ? textRaw.trim() : String(textRaw).trim();

    if (!text) ops.push(Translation.destroy({ where: { key, lang } }));
    else ops.push(Translation.upsert({ key, lang, text }));
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

class MenuOptionController {
  async create(req, res, next) {
    try {
      const {
        groupId,
        title,
        priceDelta,
        displayOrder,
        isActive,
        isDefault,
        translations,
      } = req.body;

      if (!groupId) return next(ApiError.badRequest("groupId required"));
      if (!title || !title.trim()) return next(ApiError.badRequest("title required"));

      const group = await MenuOptionGroup.findByPk(groupId);
      if (!group) return next(ApiError.badRequest("group not found"));

      const pd = priceDelta !== undefined && priceDelta !== "" ? Number(priceDelta) : 0;
      if (!Number.isFinite(pd)) return next(ApiError.badRequest("priceDelta invalid"));

      const opt = await MenuOption.create({
        groupId: Number(groupId),
        title: title.trim(),
        priceDelta: pd,
        displayOrder: displayOrder ? Number(displayOrder) : 0,
        isActive: isActive !== undefined ? String(isActive) === "true" : true,
        isDefault: isDefault !== undefined ? String(isDefault) === "true" : false,
      });

      const parsed = parseTranslations(translations) || {};
      await syncTranslationsForKey(`menu_option_${opt.id}.title`, {
        ...(parsed.title || {}),
        ru: opt.title,
      });

      const tmap = await readTranslationsMap([`menu_option_${opt.id}.title`]);

      return res.status(201).json({
        ...opt.toJSON(),
        translations: { title: tmap[`menu_option_${opt.id}.title`] || {} },
      });
    } catch (e) {
      console.error("MenuOption.create:", e);
      return next(ApiError.badRequest(e.message));
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      let { title, priceDelta, displayOrder, isActive, isDefault, translations } = req.body;

      const opt = await MenuOption.findByPk(id);
      if (!opt) return res.status(404).json({ message: "Option not found" });

      let pd = opt.priceDelta;
      if (priceDelta !== undefined) {
        const np = priceDelta === "" ? 0 : Number(priceDelta);
        if (!Number.isFinite(np)) return res.status(400).json({ message: "priceDelta invalid" });
        pd = np;
      }

      await opt.update({
        title: title !== undefined ? (title ? title.trim() : opt.title) : opt.title,
        priceDelta: pd,
        displayOrder: displayOrder !== undefined ? Number(displayOrder) : opt.displayOrder,
        isActive: isActive !== undefined ? String(isActive) === "true" : opt.isActive,
        isDefault: isDefault !== undefined ? String(isDefault) === "true" : opt.isDefault,
      });

      const parsed = parseTranslations(translations) || {};
      await syncTranslationsForKey(`menu_option_${opt.id}.title`, {
        ...(parsed.title || {}),
        ru: opt.title,
      });

      const tmap = await readTranslationsMap([`menu_option_${opt.id}.title`]);

      return res.json({
        ...opt.toJSON(),
        translations: { title: tmap[`menu_option_${opt.id}.title`] || {} },
      });
    } catch (e) {
      console.error("MenuOption.update:", e);
      return res.status(500).json({ message: "Server error" });
    }
  }

  async deactivate(req, res) {
    try {
      const { id } = req.params;
      const opt = await MenuOption.findByPk(id);
      if (!opt) return res.status(404).json({ message: "Option not found" });

      await opt.update({ isActive: false });
      return res.json({ message: "Option deactivated", id: opt.id });
    } catch (e) {
      console.error("MenuOption.deactivate:", e);
      return res.status(500).json({ message: "Server error" });
    }
  }
}

module.exports = new MenuOptionController();
