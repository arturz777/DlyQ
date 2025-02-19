const uuid = require("uuid");
const path = require("path");
const { Device, DeviceInfo, SubType, Type } = require("../models/models");
const ApiError = require("../error/ApiError");
const { Op } = require("sequelize");
const fs = require("fs");

class DeviceController {
  // Создание устройства
  async create(req, res, next) {
    try {
      let { name, price, brandId, typeId, subtypeId, info, quantity } = req.body;

      // Проверяем, что обязательные поля заполнены
      if (!name || !price || !brandId || !typeId) {
        return res
          .status(400)
          .json({ message: "Обязательные поля (name, price, brandId, typeId) должны быть заполнены." });
      }

      // Проверка и обработка изображения
      if (!req.files || !req.files.img) {
        return res.status(400).json({ message: "Необходимо загрузить изображение устройства." });
      }

      const { img } = req.files;
      const fileName = uuid.v4() + path.extname(img.name);
      img.mv(path.resolve(__dirname, "..", "static", fileName));

      let thumbnails = [];
      if (req.files.thumbnails) {
        const images = Array.isArray(req.files.thumbnails) ? req.files.thumbnails : [req.files.thumbnails];

        thumbnails = images.map((image) => {
          const thumbFileName = uuid.v4() + path.extname(image.name);
          image.mv(path.resolve(__dirname, "..", "static", thumbFileName));
          return thumbFileName;
        });
      }

      let { options } = req.body;
      options = options ? JSON.parse(options) : [];

      // Создаем устройство
      const device = await Device.create({
        name,
        price,
        brandId,
        typeId,
        subtypeId: subtypeId || null, // Устанавливаем null, если не передан подтип
        img: fileName,
        thumbnails,
        options,
        quantity: quantity || 0,
      });
      

      // Обработка дополнительной информации (характеристики)
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

      return res.json(device);
    } catch (e) {
      next(ApiError.badRequest(e.message));
    }
  }

  // Получение списка устройств
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
          { model: SubType, as: "subtype" }, // Включаем подтип
          { model: Type }, // Включаем тип
        ],
      });

      return res.json(devices);
    } catch (error) {
      console.error("Ошибка при получении устройств:", error.message);
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

      return res.json(device);
    } catch (error) {
      console.error("Ошибка при получении устройства:", error.message);
      return res.status(500).json({ message: "Ошибка при получении устройства" });
    }
  }

  // Обновление устройства
  async update(req, res, next) {
    try {
      const { id } = req.params;
      const { name, price, brandId, typeId, subtypeId, info, options, quantity  } = req.body;
      const { img } = req.files || {};

      const device = await Device.findOne({ where: { id } });
      if (!device) return res.status(404).json({ message: "Устройство не найдено" });

      let fileName = device.img;
      let thumbnails = Array.isArray(device.thumbnails) ? [...device.thumbnails] : [];

      let existing = req.body.existingImages || [];
        if (!Array.isArray(existing)) {
            try {
                existing = JSON.parse(existing);
            } catch (err) {
                existing = [];
            }
        }

        // Удаляем только файлы, которые отсутствуют в existing
        thumbnails = thumbnails.filter((thumb) => {
            if (!existing.includes(thumb)) {
                const filePath = path.resolve(__dirname, "..", "static", thumb);
                if (fs.existsSync(filePath)) {
                    fs.unlink(filePath, (err) => {
                        if (err) console.error("Ошибка удаления файла:", err);
                    });
                }
                return false; // Удаляем из массива
            }
            return true;
        });

      // Если загружено новое изображение
      if (img) {
        if (device.img) {
            const oldFilePath = path.resolve(__dirname, "..", "static", device.img);
            if (fs.existsSync(oldFilePath)) {
                fs.unlink(oldFilePath, (err) => {
                    if (err) console.error("Ошибка удаления старого главного фото:", err);
                });
            }
        }

        fileName = uuid.v4() + path.extname(img.name);
        img.mv(path.resolve(__dirname, "..", "static", fileName));
    }

    if (req.files && req.files.thumbnails) {
      const images = Array.isArray(req.files.thumbnails) ? req.files.thumbnails : [req.files.thumbnails];

      images.forEach((image) => {
          if (thumbnails.length < 5) { // Ограничение в 5 миниатюр
              const thumbFileName = uuid.v4() + path.extname(image.name);
              image.mv(path.resolve(__dirname, "..", "static", thumbFileName));
              thumbnails.push(thumbFileName);
          } else {
              console.warn("⚠ Миниатюр уже 5, новые не добавляются");
          }
      });
  }

      // Обновляем устройство
      await Device.update(
        { name, price, brandId, typeId, subtypeId: subtypeId || null, img: fileName, thumbnails, options: JSON.parse(options), quantity: quantity !== undefined ? quantity : device.quantity,  },
        { where: { id } }
      );

      // Обновляем характеристики устройства
      if (info) {
        const parsedInfo = JSON.parse(info);
        await DeviceInfo.destroy({ where: { deviceId: id } });
        await Promise.all(
          parsedInfo.map((i) =>
            DeviceInfo.create({ ...i, deviceId: id })
          )
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
      if (!device) return res.status(404).json({ message: "Устройство не найдено" });

      const imagePath = path.resolve(__dirname, "..", "static", device.img);

      // Удаляем изображение
      fs.unlink(imagePath, (err) => {
        if (err) console.error("Ошибка при удалении изображения:", err);
      });

      await Device.destroy({ where: { id } });

      return res.status(200).json({ message: "Устройство успешно удалено" });
    } catch (error) {
      return res.status(500).json({ message: "Ошибка при удалении устройства" });
    }
  }

  // Поиск устройств
  async search(req, res, next) {
    try {
      const { q } = req.query;
      if (!q) return res.status(400).json({ message: "Параметр поиска не указан" });

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
      const { deviceId, quantity } = req.body; // ✅ Исправлено: теперь получаем quantity
      const device = await Device.findByPk(deviceId);
  
      if (!device) {
        return res.status(404).json({ message: "Товар не найден" });
      }
  
      if (device.quantity < quantity) { // ✅ Проверяем, хватает ли количества
        return res.status(400).json({ message: "Недостаточно товара на складе" });
      }
  
      return res.json({ message: "Товар в наличии", quantity: device.quantity });
    } catch (error) {
      console.error("Ошибка при проверке наличия товара:", error);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }
  

}

module.exports = new DeviceController();
