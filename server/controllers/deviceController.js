const uuid = require("uuid");
const path = require("path");
const {
  Device,
  DeviceInfo,
  SubType,
  Type,
  Translation,
} = require("../models/models");
const ApiError = require("../error/ApiError");
const { Op } = require("sequelize");
const fs = require("fs");
const { supabase } = require("../config/supabaseClient");

class DeviceController {
  // Создание устройства
  async create(req, res, next) {
    try {
      let {
        name,
        price,
        brandId,
        typeId,
        subtypeId,
        info,
        quantity,
        options,
        translations,
      } = req.body;

      // Проверяем, что обязательные поля заполнены
      if (!name || !price || !brandId || !typeId) {
        return res.status(400).json({
          message:
            "Обязательные поля (name, price, brandId, typeId) должны быть заполнены.",
        });
      }

      // Проверка и обработка изображения
      if (!req.files || !req.files.img) {
        return res
          .status(400)
          .json({ message: "Необходимо загрузить изображение устройства." });
      }

      const { img } = req.files;
      const fileName = `${uuid.v4()}${path.extname(img.name)}`;

      // 📌 Загружаем изображение в Supabase Storage
      const { data, error } = await supabase.storage
        .from("images")
        .upload(fileName, img.data, { contentType: img.mimetype });

      if (error) {
        throw new Error("Ошибка загрузки изображения в Supabase Storage");
      }

      // 📌 Получаем публичный URL
      const publicURL = `https://ujsitjkochexlcqrwxan.supabase.co/storage/v1/object/public/images/${fileName}`;

      let thumbnails = [];
      if (req.files && req.files.thumbnails) {
        const images = Array.isArray(req.files.thumbnails)
          ? req.files.thumbnails
          : [req.files.thumbnails];

        thumbnails = await Promise.all(
          images.map(async (image) => {
            const thumbFileName = `${uuid.v4()}${path.extname(image.name)}`;

            // Загружаем миниатюру в Supabase Storage
            const { data, error } = await supabase.storage
              .from("images")
              .upload(thumbFileName, image.data, {
                contentType: image.mimetype,
              });

            if (error) {
              console.error("Ошибка загрузки миниатюры в Supabase:", error);
              return null;
            }

            // Получаем публичный URL загруженного изображения
            return `https://ujsitjkochexlcqrwxan.supabase.co/storage/v1/object/public/images/${thumbFileName}`;
          })
        );

        // Удаляем `null`, если какие-то изображения не загрузились
        thumbnails = thumbnails.filter((url) => url !== null);
      }

      options = options ? JSON.parse(options) : [];

      // ✅ Если есть опции, пересчитываем `quantity`
      if (options.length > 0) {
        quantity = options.reduce((sum, option) => {
          return (
            sum +
            option.values.reduce(
              (optSum, v) => optSum + (Number(v.quantity) || 0),
              0
            )
          );
        }, 0);
      }

      // ✅ Если есть опции, суммируем их количество для установки `quantity`
      if (options.length > 0) {
        quantity = options.reduce((sum, option) => {
          return (
            sum +
            option.values.reduce(
              (optSum, v) => optSum + (Number(v.quantity) || 0),
              0
            )
          );
        }, 0);
      }

      const device = await Device.create({
        name,
        price,
        brandId,
        typeId,
        subtypeId: subtypeId || null,
        img: publicURL,
        thumbnails,
        options,
        quantity: quantity || 0,
      });

      if (info) {
        info = JSON.parse(info);
        await Promise.all(
          info.map((i) =>
            DeviceInfo.create({
              title: i.title,
              description: i.description,
              deviceId: device.id,
            })
          )
        );
      }

      if (translations) {
        translations = JSON.parse(translations);
        const translationEntries = [];
    
        // ✅ Название и описание устройства
        Object.entries(translations.name || {}).forEach(([lang, text]) => {
            if (text) {
                translationEntries.push({
                    key: `device_${device.id}.name`,
                    lang,
                    text,
                });
            }
        });
    
        Object.entries(translations.description || {}).forEach(([lang, text]) => {
            if (text) {
                translationEntries.push({
                    key: `device_${device.id}.description`,
                    lang,
                    text,
                });
            }
        });
    
        if (translations.info && Array.isArray(translations.info)) {
          translations.info.forEach((info, index) => {
            Object.entries(info.title || {}).forEach(([lang, text]) => {
              if (text) {
                translationEntries.push({
                  key: `device_${device.id}.info.${index}.title`,
                  lang,
                  text,
                });
              }
            });
            Object.entries(info.description || {}).forEach(([lang, text]) => {
              if (text) {
                translationEntries.push({
                  key: `device_${device.id}.info.${index}.description`,
                  lang,
                  text,
                });
              }
            });
          });
        }
    
        // ✅ Опции (варианты выбора)
        if (translations.options && Array.isArray(translations.options)) {
            translations.options.forEach((option, optionIndex) => {
                // 🔥 Правильный способ обработки `name` (проход по языкам)
                Object.entries(option.name || {}).forEach(([lang, text]) => {
                    if (text) {
                        translationEntries.push({
                            key: `device_${device.id}.option.${optionIndex}.name`,
                            lang,
                            text,
                        });
                    }
                });
    
                if (option.values && Array.isArray(option.values)) {
                  option.values.forEach((value, valueIndex) => {
                      // ✅ Если `value.text` нет, используем сам `value`
                      const valueTranslations = value.text || value;
              
                      Object.entries(valueTranslations).forEach(([lang, text]) => {
                          if (text) {
                              translationEntries.push({
                                  key: `device_${device.id}.option.${optionIndex}.value.${valueIndex}`,
                                  lang,
                                  text,
                              });
                            }
                        });
                    });
                }
            });
        }
    
        if (translationEntries.length > 0) {
            await Translation.bulkCreate(translationEntries);
        }
    }
    
    return res.json(device);
    
    } catch (e) {
      next(ApiError.badRequest(e.message));
    }
  }

  async getAll(req, res) {
    try {
        let { brandId, typeId, subtypeId, limit, page } = req.query;
        page = page || 1;
        limit = limit || 9;
        const offset = page * limit - limit;

        const where = {};
        if (brandId) where.brandId = brandId;
        if (typeId) where.typeId = typeId;
        if (subtypeId) where.subtypeId = subtypeId;

        const devices = await Device.findAndCountAll({
            where,
            limit,
            offset,
            include: [
                { model: SubType, as: "subtype" },
                { model: Type },
                { model: DeviceInfo, as: "info" },
            ],
        });

        const deviceIds = devices.rows.map((d) => d.id);
        const translations = await Translation.findAll({
            where: {
                key: {
                    [Op.or]: deviceIds.map((id) => ({ [Op.like]: `device_${id}.%` })),
                },
            },
        });

        // ✅ Формируем объект переводов
        const translatedSpecs = {};
        translations.forEach((t) => {
            const keyParts = t.key.split(".");
            const deviceId = keyParts[0].replace("device_", "");
            const section = keyParts[1];
            const optionIndex = keyParts[2]; // Теперь четкое разделение индексов
            const field = keyParts[3];
            const valueIndex = keyParts[4]; // Добавляем обработку индекса значений

            if (!translatedSpecs[deviceId]) translatedSpecs[deviceId] = {};

            if (section === "info") {
                // ✅ Обрабатываем переводы характеристик
                if (!translatedSpecs[deviceId].info) translatedSpecs[deviceId].info = [];
                if (!translatedSpecs[deviceId].info[optionIndex]) {
                    translatedSpecs[deviceId].info[optionIndex] = { title: {}, description: {} };
                }
                translatedSpecs[deviceId].info[optionIndex][field][t.lang] = t.text;

            } else if (section === "option") {
                // ✅ Обрабатываем переводы опций
                if (!translatedSpecs[deviceId].options) translatedSpecs[deviceId].options = [];
                if (!translatedSpecs[deviceId].options[optionIndex]) {
                    translatedSpecs[deviceId].options[optionIndex] = { name: {}, values: [] };
                }

                if (field === "name") {
                    translatedSpecs[deviceId].options[optionIndex].name[t.lang] = t.text;
                } else if (field === "value" && valueIndex !== undefined) {
                    if (!translatedSpecs[deviceId].options[optionIndex].values[valueIndex]) {
                        translatedSpecs[deviceId].options[optionIndex].values[valueIndex] = {};
                    }
                    translatedSpecs[deviceId].options[optionIndex].values[valueIndex][t.lang] = t.text;
                }
            } else {
                // ✅ Обрабатываем общие переводы (name, description)
                if (!translatedSpecs[deviceId][section]) translatedSpecs[deviceId][section] = {};
                translatedSpecs[deviceId][section][t.lang] = t.text;
            }
        });

        // ✅ Добавляем переводы к каждому устройству
        devices.rows.forEach((device) => {
            device.dataValues.translations = translatedSpecs[device.id] || {};
        });

        return res.json(devices);
    } catch (error) {
        console.error("❌ Ошибка при получении устройств:", error.message);
        return res.status(500).json({ message: "Ошибка при получении устройств" });
    }
}


  // Получение одного устройства
  async getOne(req, res) {
    try {
      const { id } = req.params;

      const device = await Device.findOne({
        where: { id },
        include: [
          { model: DeviceInfo, as: "info" }, // Включаем характеристики устройства
          { model: SubType, as: "subtype" }, // Включаем подтип
          { model: Type }, // Включаем тип
        ],
      });

      if (!device) {
        return res.status(404).json({ message: "Устройство не найдено" });
      }

      const translations = await Translation.findAll({
        where: { key: { [Op.like]: `device_${id}.%` } },
      });
      
      const translatedSpecs = {};
      translations.forEach((t) => {
        const key = t.key.replace(`device_${id}.`, "");
        const keyParts = key.split(".");
      
        // ✅ Обрабатываем переводы характеристик (info)
        if (key.startsWith("info")) {
          const index = keyParts[1];
          const type = keyParts[2]; // title или description
      
          if (!translatedSpecs.info) {
            translatedSpecs.info = {};
          }
      
          if (!translatedSpecs.info[index]) {
            translatedSpecs.info[index] = { title: {}, description: {} };
          }
      
          if (type === "title") {
            translatedSpecs.info[index].title[t.lang] = t.text;
          } else if (type === "description") {
            translatedSpecs.info[index].description[t.lang] = t.text;
          }
        }
      
        // ✅ Обрабатываем переводы опций (options)
        else if (key.startsWith("option")) {
          const optionIndex = keyParts[1];
          const type = keyParts[2];
          const valueIndex = keyParts[3];
      
          if (!translatedSpecs.options) {
            translatedSpecs.options = {};
          }
          if (!translatedSpecs.options[optionIndex]) {
            translatedSpecs.options[optionIndex] = { name: {}, values: [] };
          }
      
          if (type === "name") {
            translatedSpecs.options[optionIndex].name[t.lang] = t.text;
          } else if (type === "value" && valueIndex !== undefined) {
            if (!translatedSpecs.options[optionIndex].values[valueIndex]) {
              translatedSpecs.options[optionIndex].values[valueIndex] = {};
            }
            translatedSpecs.options[optionIndex].values[valueIndex][t.lang] =
              t.text;
          }
        }
      
        // ✅ Обрабатываем остальные переводы
        else {
          if (!translatedSpecs[key]) {
            translatedSpecs[key] = {};
          }
          translatedSpecs[key][t.lang] = t.text;
        }
      });
      
      if (device.info && Array.isArray(device.info)) {
  device.info.forEach((infoItem, index) => {
    if (!translatedSpecs.info) return; // Если нет переводов, пропускаем

    const translatedItem = translatedSpecs.info[index];

    if (translatedItem) {
      infoItem.dataValues.translations = {
        title: translatedItem?.title || {},
        description: translatedItem?.description || {},
      };
      
    } else {
      infoItem.translations = { title: {}, description: {} };
    }
  });
}

      if (device.options && Array.isArray(device.options)) {
        device.options.forEach((option, optionIndex) => {
          if (translatedSpecs.options && translatedSpecs.options[optionIndex]) {
            option.translations = {
              name: translatedSpecs.options[optionIndex].name || {},
              values: [],
            };
      
            option.values.forEach((value, valueIndex) => {
              if (translatedSpecs.options[optionIndex].values[valueIndex]) {
                option.translations.values[valueIndex] =
                  translatedSpecs.options[optionIndex].values[valueIndex];
              }
            });
          }
        });
      }

      return res.json({
        ...device.dataValues,
        translations: translatedSpecs || {},
      });
      
    } catch (error) {
      console.error("❌ Ошибка при получении устройства:", error.message);
      return res
        .status(500)
        .json({ message: "Ошибка при получении устройства" });
    }
  }

 
  async update(req, res, next) {
    try {
      const { id } = req.params;
      const {
        name,
        price,
        brandId,
        typeId,
        subtypeId,
        info,
        options,
        quantity,
        translations,
      } = req.body;

      let existingImages = req.body.existingImages
        ? JSON.parse(req.body.existingImages)
        : [];

      const device = await Device.findOne({ where: { id } });
      if (!device)
        return res.status(404).json({ message: "Устройство не найдено" });

      let fileName = device.img;
      let thumbnails = Array.isArray(device.thumbnails)
        ? [...device.thumbnails]
        : [];

      const files = req.files || {};
      const img = files.img || null;

      // ✅ Обновление главного изображения
      if (img) {
        if (device.img) {
          const oldFileName = device.img.split("/").pop();
          await supabase.storage.from("images").remove([oldFileName]);
        }

        const newFileName = `${uuid.v4()}${path.extname(img.name)}`;
        const { error } = await supabase.storage
          .from("images")
          .upload(newFileName, img.data, { contentType: img.mimetype });

        if (error) {
          return res.status(500).json({
            message: "Ошибка загрузки нового изображения в Supabase",
            error,
          });
        }

        fileName = `https://ujsitjkochexlcqrwxan.supabase.co/storage/v1/object/public/images/${newFileName}`;
      }

      // ✅ Удаление старых миниатюр
      if (existingImages.length === 0) {
        const imagesToDelete = thumbnails.map((img) => img.split("/").pop());
        if (imagesToDelete.length > 0) {
          await supabase.storage.from("images").remove(imagesToDelete);
        }
        thumbnails = [];
      } else {
        const imagesToDelete = thumbnails
          .filter((img) => !existingImages.includes(img))
          .map((img) => img.split("/").pop());
        if (imagesToDelete.length > 0) {
          await supabase.storage.from("images").remove(imagesToDelete);
        }
        thumbnails = existingImages.filter((img) => img !== fileName);
      }

      // ✅ Добавляем новые миниатюры
      if (req.files && req.files.thumbnails) {
        const images = Array.isArray(req.files.thumbnails)
          ? req.files.thumbnails
          : [req.files.thumbnails];

        const newThumbnails = await Promise.all(
          images.map(async (image) => {
            const thumbFileName = `${uuid.v4()}${path.extname(image.name)}`;
            const { error } = await supabase.storage
              .from("images")
              .upload(thumbFileName, image.data, {
                contentType: image.mimetype,
              });

            if (error) {
              console.error("Ошибка загрузки миниатюры в Supabase:", error);
              return null;
            }

            return `https://ujsitjkochexlcqrwxan.supabase.co/storage/v1/object/public/images/${thumbFileName}`;
          })
        );

        thumbnails = [
          ...thumbnails,
          ...newThumbnails.filter((url) => url !== null),
        ];

        options = options ? JSON.parse(options) : [];

        // ✅ Если у товара есть `options`, пересчитываем `quantity`
        if (options.length > 0) {
          quantity = options.reduce((sum, option) => {
            return (
              sum +
              option.values.reduce(
                (optSum, v) => optSum + (Number(v.quantity) || 0),
                0
              )
            );
          }, 0);
        }
      }

      await Translation.destroy({
        where: { key: { [Op.like]: `device_${id}.%` } }
    });

    let translationEntries = [];

    if (translations) {
        const parsedTranslations = JSON.parse(translations);

        // Обрабатываем переводы названия устройства
        Object.entries(parsedTranslations.name || {}).forEach(([lang, text]) => {
            if (text) {
                translationEntries.push({
                    key: `device_${id}.name`,
                    lang,
                    text,
                });
            }
        });

        // Обрабатываем переводы описания
        Object.entries(parsedTranslations.description || {}).forEach(([lang, text]) => {
            if (text) {
                translationEntries.push({
                    key: `device_${id}.description`,
                    lang,
                    text,
                });
            }
        });

// ✅ Обрабатываем переводы значений опций (ИСПРАВЛЕНО)
if (parsedTranslations.options && Array.isArray(parsedTranslations.options)) {
  parsedTranslations.options.forEach((option, optionIndex) => {
      // 🔹 Обновление названия опции (это уже работает)
      Object.entries(option.name || {}).forEach(([lang, text]) => {
          if (text) {
              translationEntries.push({
                  key: `device_${id}.option.${optionIndex}.name`,
                  lang,
                  text,
              });
          }
      });

      // 🔹 Теперь корректно обрабатываем переводы значений опций
      if (option.values && Array.isArray(option.values)) {
          option.values.forEach((value, valueIndex) => {
              Object.entries(value || {}).forEach(([lang, text]) => {
                  if (text) {
                      translationEntries.push({
                          key: `device_${id}.option.${optionIndex}.value.${valueIndex}`,
                          lang,
                          text,
                      });
                  }
              });
          });
      }
  });
}


    
        if (parsedTranslations.info && Array.isArray(parsedTranslations.info)) {
          parsedTranslations.info.forEach((info, index) => {
              Object.entries(info.title || {}).forEach(([lang, text]) => {
                  if (text) {
                      translationEntries.push({
                          key: `device_${id}.info.${index}.title`,
                          lang,
                          text,
                      });
                  }
              });
              Object.entries(info.description || {}).forEach(([lang, text]) => {
                  if (text) {
                      translationEntries.push({
                          key: `device_${id}.info.${index}.description`,
                          lang,
                          text,
                      });
                  }
              });
          });
      }
  }

    

    if (translationEntries.length > 0) {
        await Translation.bulkCreate(translationEntries);
    }

      // ✅ Обновляем устройство
      await Device.update(
        {
          name,
          price,
          brandId,
          typeId,
          subtypeId: subtypeId || null,
          img: fileName,
          thumbnails,
          options: options ? JSON.parse(options) : [],
          quantity: quantity || 0,
        },
        { where: { id } }
      );

      // ✅ Обновляем характеристики устройства
      if (info) {
        const parsedInfo = JSON.parse(info);
        await DeviceInfo.destroy({ where: { deviceId: id } });
        await Promise.all(
          parsedInfo.map((i) => DeviceInfo.create({ ...i, deviceId: id }))
        );
      }


      const updatedDevice = await Device.findOne({ where: { id } });
      return res.json(updatedDevice);
    } catch (error) {
      next(ApiError.badRequest(error.message));
    }
  }

  // Удаление устройства
  async delete(req, res) {
    try {
      const { id } = req.params;
      const device = await Device.findOne({ where: { id } });

      if (!device)
        return res.status(404).json({ message: "Устройство не найдено" });

      await Translation.destroy({
        where: { key: { [Op.like]: `device_${id}.%` } },
      });

      const imagePath = path.resolve(__dirname, "..", "static", device.img);

      if (device.img) {
        const fileName = device.img.split("/").pop(); // Получаем имя файла
        const { error } = await supabase.storage
          .from("images")
          .remove([fileName]);
        if (error)
          console.error(
            "Ошибка при удалении главного изображения из Supabase:",
            error
          );
      }

      // Удаляем миниатюры (thumbnails) из Supabase Storage
      if (device.thumbnails && device.thumbnails.length > 0) {
        const filesToDelete = device.thumbnails.map((url) =>
          url.split("/").pop()
        );
        const { error } = await supabase.storage
          .from("images")
          .remove(filesToDelete);
        if (error)
          console.error("Ошибка при удалении миниатюр из Supabase:", error);
      }

      await Device.destroy({ where: { id } });

      return res.status(200).json({ message: "Устройство успешно удалено" });
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Ошибка при удалении устройства" });
    }
  }

  // Поиск устройств
  async search(req, res, next) {
    try {
      const { q } = req.query;
      if (!q)
        return res.status(400).json({ message: "Параметр поиска не указан" });

      const devices = await Device.findAll({
        where: {
          name: {
            [Op.iLike]: `%${q}%`,
          },
        },
      });

      return res.json(devices);
    } catch (error) {
      next(ApiError.internal("Ошибка сервера при выполнении поиска"));
    }
  }

  async checkStock(req, res) {
    try {
      const { deviceId, quantity, selectedOptions } = req.body;
      const device = await Device.findByPk(deviceId);

      if (!device) {
        return res.json({ status: "error", message: "Товар не найден" });
      }

      let availableQuantity = device.quantity;
      let parsedOptions = [];

      if (typeof device.options === "string") {
        parsedOptions = JSON.parse(device.options);
      } else if (Array.isArray(device.options)) {
        parsedOptions = device.options;
      }

      if (parsedOptions.length > 0 && selectedOptions) {
        for (const [optionName, selectedValue] of Object.entries(
          selectedOptions
        )) {
          const option = parsedOptions.find((opt) => opt.name === optionName);
          if (!option) continue;

          const value = option.values.find(
            (val) => val.value === selectedValue.value
          );
          if (!value) {
            return res.json({
              status: "error",
              message: `Опция ${selectedValue.value} не найдена.`,
            });
          }
          availableQuantity = value.quantity;
        }
      }

      if (availableQuantity < quantity) {
      }

      return res.json({
        status: "success",
        message: "Товар в наличии",
        quantity: availableQuantity,
      });
    } catch (error) {
      console.error("Ошибка при проверке наличия товара:", error);
      return res.json({
        status: "error",
        message: "Ошибка сервера при проверке наличия товара.",
      });
    }
  }
}

module.exports = new DeviceController();

