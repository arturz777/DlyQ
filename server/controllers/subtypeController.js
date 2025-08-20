const { SubType, Translation } = require("../models/models");
const ApiError = require("../error/ApiError");
const { Op } = require("sequelize");

class SubtypeController {
  async create(req, res) {
    try {
      const { name, typeId, translations, displayOrder } = req.body;

      if (!name || !typeId) {
        return res.status(400).json({
          message: "Поля 'name' и 'typeId' обязательны для заполнения.",
        });
      }

      let order = parseInt(displayOrder);
      if (!Number.isInteger(order)) {
        const max = await SubType.max("displayOrder", { where: { typeId } });
        order = Number.isInteger(max) ? max + 1 : 0;
      }

      const subtype = await SubType.create({
        name,
        typeId,
        displayOrder: order,
      });

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
      const subtypes = await SubType.findAll({
        order: [
          ["displayOrder", "ASC"],
          ["id", "ASC"],
        ],
      });

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

      const subtypes = await SubType.findAll({
        where: { typeId },
        order: [
          ["displayOrder", "ASC"],
          ["id", "ASC"],
        ],
      });

      if (!subtypes.length) {
        return res.json([]);
      }

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
      console.error("Ошибка при получении подтипов по типу:", error.message);
      return res
        .status(500)
        .json({ message: "Ошибка при получении подтипов по типу." });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const { name, typeId, translations, displayOrder } = req.body;

      if (!id) {
        return res.status(400).json({ message: "Параметр 'id' обязателен." });
      }

      if (!name && !typeId && displayOrder === undefined && !translations) {
        return res.status(400).json({
          message:
            "Передайте хотя бы одно из полей: name, typeId, displayOrder или translations.",
        });
      }

      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (typeId !== undefined) updateData.typeId = typeId;
      if (displayOrder !== undefined) {
        const v = parseInt(displayOrder, 10);
        if (!Number.isInteger(v)) {
          return res
            .status(400)
            .json({ message: "displayOrder должен быть целым числом." });
        }
        updateData.displayOrder = v;
      }

      if (Object.keys(updateData).length > 0) {
        const [updatedRows] = await SubType.update(updateData, {
          where: { id },
        });
        if (updatedRows === 0) {
          return res
            .status(404)
            .json({ message: "Подтип с указанным id не найден." });
        }
      } else {
        const exists = await SubType.findByPk(id, { attributes: ["id"] });
        if (!exists) {
          return res
            .status(404)
            .json({ message: "Подтип с указанным id не найден." });
        }
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

        const translationEntries = Object.entries(parsedTranslations.name || {})
          .filter(([lang, text]) => text && typeof text === "string")
          .map(([lang, text]) => ({
            key: `subtype_${id}.name`,
            lang,
            text,
          }));

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

      if (!id) {
        return res.status(400).json({ message: "Параметр 'id' обязателен." });
      }

      const deletedRows = await SubType.destroy({ where: { id } });

      if (deletedRows === 0) {
        return res
          .status(404)
          .json({ message: "Подтип с указанным id не найден." });
      }

      await Translation.destroy({ where: { key: `subtype_${id}.name` } });

      return res.json({ message: "Подтип удалён успешно." });
    } catch (error) {
      console.error("Ошибка при удалении подтипа:", error.message);
      return res.status(500).json({ message: "Ошибка при удалении подтипа." });
    }
  }
}

module.exports = new SubtypeController();
