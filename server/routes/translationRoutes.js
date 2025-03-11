const Router = require("express");
const router = new Router();
const { Translation } = require("../models/models"); // Импортируем Sequelize-модель

// Получение всех переводов
router.get("/", async (req, res) => {
  try {
    const translations = await Translation.findAll();
    res.json(translations);
  } catch (err) {
    console.error("❌ Ошибка API:", err.message);
    res.status(500).json({ error: "Ошибка получения переводов" });
  }
});

// Обновление перевода
router.put("/", async (req, res) => {
  try {
    const { key, lang, text } = req.body;
    const translation = await Translation.findOne({ where: { key, lang } });

    if (!translation) {
      return res.status(404).json({ error: "Перевод не найден" });
    }

    translation.text = text;
    await translation.save();

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Ошибка обновления перевода:", err.message);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.post("/", async (req, res) => {
	try {
	  const { key, lang, text } = req.body;
  
	  // Проверяем, существует ли уже такой перевод
	  const existing = await Translation.findOne({ where: { key, lang } });
	  if (existing) {
		return res.status(400).json({ error: "Перевод уже существует" });
	  }
  
	  const newTranslation = await Translation.create({ key, lang, text });
	  res.json(newTranslation);
	} catch (err) {
	  console.error("Ошибка добавления перевода:", err.message);
	  res.status(500).json({ error: "Ошибка сервера" });
	}
  });
  

module.exports = router;
