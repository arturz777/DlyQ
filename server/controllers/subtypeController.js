const { SubType, Translation } = require("../models/models");
const ApiError = require("../error/ApiError");
const { Op } = require("sequelize");

class SubtypeController {
  // Создание подтипа
  async create(req, res) {
    try {
      const { name, typeId, translations } = req.body;

      // Проверяем, что обязательные поля заполнены
      if (!name || !typeId) {
        return res
          .status(400)
          .json({
            message: "Поля 'name' и 'typeId' обязательны для заполнения.",
          });
      }

      // Создаем подтип
      const subtype = await SubType.create({ name, typeId });

      if (translations) {
        const parsedTranslations = JSON.parse(translations);
        const translationEntries = [];

        Object.entries(parsedTranslations.name || {}).forEach(
          ([lang, text]) => {
            if (text) {
              translationEntries.push({
                key: `subtype_${subtype.id}.name`,
                lang,
                text,
              });
            }
          }
        );

        if (translationEntries.length > 0) {
          await Translation.bulkCreate(translationEntries);
        }
      }

      return res.json(subtype);
    } catch (error) {
      console.error("Ошибка при создании подтипа:", error.message);
      return res.status(500).json({ message: "Ошибка при создании подтипа." });
    }
  }

  async getAll(req, res) {
    try {
      const subtypes = await SubType.findAll();

      const subtypeIds = subtypes.map((s) => s.id);
      const translations = await Translation.findAll({
        where: {
          key: {
            [Op.or]: subtypeIds.map((id) => `subtype_${id}.name`),
          },
        },
      });

      const translationMap = {};
      translations.forEach((t) => {
        const subtypeId = t.key.replace("subtype_", "").replace(".name", "");
        if (!translationMap[subtypeId])
          translationMap[subtypeId] = { name: {} };
        translationMap[subtypeId].name[t.lang] = t.text;
      });

      const subtypesWithTranslations = subtypes.map((subtype) => ({
        ...subtype.toJSON(),
        translations: translationMap[subtype.id] || {},
      }));

      return res.json(subtypesWithTranslations);
    } catch (error) {
      console.error("Ошибка при получении подтипов:", error.message);
      return res
        .status(500)
        .json({ message: "Ошибка при получении подтипов." });
    }
  }

  async getByType(req, res) {
    try {
      const { typeId } = req.params;

      if (!typeId) {
        return res
          .status(400)
          .json({ message: "Параметр 'typeId' обязателен." });
      }

      // Получаем подтипы по типу
      const subtypes = await SubType.findAll({ where: { typeId } });

      if (!subtypes.length) {
        return res.json([]);
      }

      // Получаем все переводы для этих подтипов
      const subtypeIds = subtypes.map((s) => s.id);
      const translations = await Translation.findAll({
        where: {
          key: {
            [Op.or]: subtypeIds.map((id) => `subtype_${id}.name`),
          },
        },
      });

      // Создаём карту переводов
      const translationMap = {};
      translations.forEach((t) => {
        const subtypeId = t.key.replace("subtype_", "").replace(".name", "");
        if (!translationMap[subtypeId])
          translationMap[subtypeId] = { name: {} };
        translationMap[subtypeId].name[t.lang] = t.text;
      });

      // Добавляем переводы к подтипам
      const subtypesWithTranslations = subtypes.map((subtype) => ({
        ...subtype.toJSON(),
        translations: translationMap[subtype.id] || {},
      }));

      return res.json(subtypesWithTranslations);
    } catch (error) {
      console.error("Ошибка при получении подтипов по типу:", error.message);
      return res
        .status(500)
        .json({ message: "Ошибка при получении подтипов по типу." });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const { name, typeId, translations } = req.body;

      if (!id) {
        return res.status(400).json({ message: "Параметр 'id' обязателен." });
      }

      if (!name && !typeId) {
        return res
          .status(400)
          .json({
            message:
              "Поля 'name' или 'typeId' должны быть переданы для обновления.",
          });
      }

      const [updatedRows] = await SubType.update(
        { name, typeId },
        { where: { id } }
      );

      if (updatedRows === 0) {
        return res
          .status(404)
          .json({ message: "Подтип с указанным id не найден." });
      }

      if (translations) {
        let parsedTranslations;
        if (typeof translations === "string") {
          try {
            parsedTranslations = JSON.parse(translations);
          } catch (error) {
            console.error("Ошибка парсинга translations:", error.message);
            return res
              .status(400)
              .json({ message: "Ошибка парсинга translations." });
          }
        } else {
          parsedTranslations = translations;
        }

        // Формируем записи для обновления переводов
        const translationEntries = Object.entries(parsedTranslations.name || {})
          .filter(([lang, text]) => text && typeof text === "string")
          .map(([lang, text]) => ({
            key: `subtype_${id}.name`,
            lang,
            text,
          }));

        // Удаляем старые переводы и добавляем новые
        if (translationEntries.length > 0) {
          await Translation.destroy({ where: { key: `subtype_${id}.name` } });
          await Translation.bulkCreate(translationEntries);
        }
      }

      return res.json({ message: "Подтип обновлён успешно." });
    } catch (error) {
      console.error("Ошибка при обновлении подтипа:", error.message);
      return res
        .status(500)
        .json({ message: "Ошибка при обновлении подтипа." });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;

      // Проверяем, что id передан
      if (!id) {
        return res.status(400).json({ message: "Параметр 'id' обязателен." });
      }

      // Удаляем подтип
      const deletedRows = await SubType.destroy({ where: { id } });

      // Если подтип не найден
      if (deletedRows === 0) {
        return res
          .status(404)
          .json({ message: "Подтип с указанным id не найден." });
      }

      // Удаляем связанные переводы
      await Translation.destroy({ where: { key: `subtype_${id}.name` } });

      return res.json({ message: "Подтип удалён успешно." });
    } catch (error) {
      console.error("Ошибка при удалении подтипа:", error.message);
      return res.status(500).json({ message: "Ошибка при удалении подтипа." });
    }
  }
}

module.exports = new SubtypeController();
