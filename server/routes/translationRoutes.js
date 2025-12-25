const Router = require("express");
const router = new Router();
const { Translation } = require("../models/models");

const normLang = (lang) =>
  String(lang || "")
    .trim()
    .toLowerCase();

router.get("/", async (req, res) => {
  try {
    const translations = await Translation.findAll();
    res.json(translations);
  } catch (err) {
    console.error("❌ Ошибка API:", err.message);
    res.status(500).json({ error: "Ошибка получения переводов" });
  }
});

router.put("/", async (req, res) => {
  try {
    const { key, lang, text } = req.body;

    if (!key || !lang) {
      return res.status(400).json({ error: "key и lang обязательны" });
    }

    const row = {
      key: String(key).trim(),
      lang: normLang(lang),
      text: String(text ?? "").trim(),
    };

    await Translation.upsert(row);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Ошибка обновления перевода:", err.message);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { key, lang, text } = req.body;

    const row = {
      key: String(key).trim(),
      lang: normLang(lang),
      text: String(text ?? "").trim(),
    };

    const existing = await Translation.findOne({
      where: { key: row.key, lang: row.lang },
    });
    if (existing)
      return res.status(400).json({ error: "Перевод уже существует" });

    const newTranslation = await Translation.create(row);
    res.json(newTranslation);
  } catch (err) {
    console.error("Ошибка добавления перевода:", err.message);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

module.exports = router;
