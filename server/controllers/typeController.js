const { Type, Translation } = require("../models/models");
const { Op } = require("sequelize");
const ApiError = require("../error/ApiError");
const { supabase } = require("../config/supabaseClient");
const uuid = require("uuid");

class TypeController {
  async create(req, res, next) {
    try {
      const { name, img, translations } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Поле 'name' обязательно" });
      }

      let imgUrl = null;
      if (req.files && req.files.img) {
        const { img } = req.files;
        const fileName = `${uuid.v4()}${img.name.substring(
          img.name.lastIndexOf(".")
        )}`;

        const { error } = await supabase.storage
          .from("images")
          .upload(fileName, img.data, { contentType: img.mimetype });

        if (error) {
          throw new Error("Ошибка загрузки изображения в Supabase");
        }

        imgUrl = `https://ujsitjkochexlcqrwxan.supabase.co/storage/v1/object/public/images/${fileName}`;
      }

      const type = await Type.create({ name, img: imgUrl });

      if (translations) {
        const parsedTranslations = JSON.parse(translations);
        const translationEntries = [];

        Object.entries(parsedTranslations.name || {}).forEach(
          ([lang, text]) => {
            if (text) {
              translationEntries.push({
                key: `type_${type.id}.name`,
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

      return res.status(201).json(type);
    } catch (error) {
      console.error("Ошибка при создании типа:", error.message);
      next(ApiError.badRequest(error.message));
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      let { name, translations } = req.body;

      const type = await Type.findOne({ where: { id } });
      if (!type) {
        return res.status(404).json({ message: "Тип не найден" });
      }

      if (!name || name.trim() === "") {
        name = type.name;
      }

      let imgUrl = type.img;

      if (req.files && req.files.img) {
        if (type.img) {
          const oldFileName = type.img.split("/").pop();
          await supabase.storage.from("images").remove([oldFileName]);
        }

        const { img } = req.files;
        const newFileName = `${uuid.v4()}${img.name.substring(
          img.name.lastIndexOf(".")
        )}`;

        const { error } = await supabase.storage
          .from("images")
          .upload(newFileName, img.data, { contentType: img.mimetype });

        if (error) {
          throw new Error("Ошибка загрузки нового изображения в Supabase");
        }

        imgUrl = `https://ujsitjkochexlcqrwxan.supabase.co/storage/v1/object/public/images/${newFileName}`;
      }

      await type.update({ name, img: imgUrl });

      if (translations) {
        let parsedTranslations = translations;
        if (typeof translations === "string") {
          try {
            parsedTranslations = JSON.parse(translations);
          } catch (error) {
            console.error("❌ Ошибка парсинга translations:", error.message);
            return res
              .status(400)
              .json({ message: "Ошибка парсинга translations" });
          }
        }

        const translationEntries = Object.entries(parsedTranslations.name || {})
          .filter(([lang, text]) => text && typeof text === "string")
          .map(([lang, text]) => ({
            key: `type_${id}.name`,
            lang,
            text,
          }));

        if (translationEntries.length > 0) {
          await Translation.destroy({ where: { key: `type_${id}.name` } });
          await Translation.bulkCreate(translationEntries);
        } else {
          console.log(
            "⚠️ Переводы пустые или некорректные, ничего не обновляем."
          );
        }
      }

      return res.status(200).json(type);
    } catch (error) {
      console.error("❌ Ошибка при редактировании типа:", error.message);
      return res
        .status(500)
        .json({ message: "Ошибка сервера при редактировании типа." });
    }
  }

  async getAll(req, res) {
    try {
      const types = await Type.findAll();

      const typeIds = types.map((t) => t.id);

      const translations = await Translation.findAll({
        where: {
          key: {
            [Op.or]: typeIds.map((id) => `type_${id}.name`),
          },
        },
      });

      const translationMap = {};
      translations.forEach((t) => {
        const typeId = t.key.replace("type_", "").replace(".name", "");
        if (!translationMap[typeId]) translationMap[typeId] = { name: {} };
        translationMap[typeId].name[t.lang] = t.text;
      });

      const typesWithTranslations = types.map((type) => {
        const translations = translationMap[type.id] || { name: {} };
        console.log(`Type ID: ${type.id}, Translations:`, translations); // 🔥 Дебаг
        return {
          ...type.toJSON(),
          translations,
        };
      });

      return res.json(typesWithTranslations);
    } catch (error) {
      console.error("Ошибка при получении типов:", error.message);
      return res.status(500).json({ message: "Ошибка при получении типов." });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      const type = await Type.findOne({ where: { id } });

      if (!type) {
        return res.status(404).json({ message: "Тип не найден" });
      }

      if (type.img) {
        const fileName = type.img.split("/").pop();
        await supabase.storage.from("images").remove([fileName]);
      }

      await Translation.destroy({
        where: { key: `type_${id}.name` },
      });

      await Type.destroy({ where: { id } });

      return res.status(200).json({ message: "Тип успешно удален" });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Ошибка при удалении типа" });
    }
  }
}

module.exports = new TypeController();
