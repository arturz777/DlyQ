const { SubType } = require("../models/models"); // Импорт модели SubType
const ApiError = require("../error/ApiError");

class SubtypeController {
  // Создание подтипа
  async create(req, res) {
    try {
      const { name, typeId } = req.body;

      // Проверяем, что обязательные поля заполнены
      if (!name || !typeId) {
        return res
          .status(400)
          .json({ message: "Поля 'name' и 'typeId' обязательны для заполнения." });
      }

      // Создаем подтип
      const subtype = await SubType.create({ name, typeId });
      return res.json(subtype);
    } catch (error) {
      console.error("Ошибка при создании подтипа:", error.message);
      return res.status(500).json({ message: "Ошибка при создании подтипа." });
    }
  }

  // Получение всех подтипов
  async getAll(req, res) {
    try {
      const subtypes = await SubType.findAll(); // Получаем все подтипы
      return res.json(subtypes);
    } catch (error) {
      console.error("Ошибка при получении всех подтипов:", error.message);
      return res.status(500).json({ message: "Ошибка при получении подтипов." });
    }
  }

  // Получение подтипов по типу
  async getByType(req, res) {
    try {
      const { typeId } = req.params;

      // Проверяем, что typeId передан
      if (!typeId) {
        return res.status(400).json({ message: "Параметр 'typeId' обязателен." });
      }

      // Получаем подтипы по typeId
      const subtypes = await SubType.findAll({ where: { typeId } });
      return res.json(subtypes);
    } catch (error) {
      console.error("Ошибка при получении подтипов по типу:", error.message);
      return res.status(500).json({ message: "Ошибка при получении подтипов по типу." });
    }
  }

  // Обновление подтипа
  async update(req, res) {
    try {
      const { id } = req.params;
      const { name, typeId } = req.body;

      // Проверяем, что id передан
      if (!id) {
        return res.status(400).json({ message: "Параметр 'id' обязателен." });
      }

      // Проверяем, что поля для обновления переданы
      if (!name && !typeId) {
        return res.status(400).json({ message: "Поля 'name' или 'typeId' должны быть переданы для обновления." });
      }

      // Обновляем подтип
      const [updatedRows] = await SubType.update({ name, typeId }, { where: { id } });

      if (updatedRows === 0) {
        return res.status(404).json({ message: "Подтип с указанным id не найден." });
      }

      return res.json({ message: "Подтип обновлён успешно." });
    } catch (error) {
      console.error("Ошибка при обновлении подтипа:", error.message);
      return res.status(500).json({ message: "Ошибка при обновлении подтипа." });
    }
  }

  // Удаление подтипа
  async delete(req, res) {
    try {
      const { id } = req.params;

      // Проверяем, что id передан
      if (!id) {
        return res.status(400).json({ message: "Параметр 'id' обязателен." });
      }

      const deletedRows = await SubType.destroy({ where: { id } });

      if (deletedRows === 0) {
        return res.status(404).json({ message: "Подтип с указанным id не найден." });
      }

      return res.json({ message: "Подтип удалён успешно." });
    } catch (error) {
      console.error("Ошибка при удалении подтипа:", error.message);
      return res.status(500).json({ message: "Ошибка при удалении подтипа." });
    }
  }
}

module.exports = new SubtypeController(); // Экспортируем экземпляр контроллера

