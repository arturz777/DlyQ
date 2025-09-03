const {
  VehicleModel,
  VehicleMake,
  DeviceCompatibility,
} = require("../models/models");
const { Op } = require("sequelize");

class ModelController {
  async create(req, res) {
    try {
      let { name, makeId } = req.body;
      name = (name || "").trim();

      if (!name || !makeId) {
        return res
          .status(400)
          .json({ message: "Поля 'name' и 'makeId' обязательны" });
      }

      const make = await VehicleMake.findByPk(makeId);
      if (!make) return res.status(404).json({ message: "Марка не найдена" });

      const exists = await VehicleModel.findOne({ where: { makeId, name } });
      if (exists) {
        return res
          .status(409)
          .json({ message: "Такая модель уже существует в этой марке" });
      }

      const model = await VehicleModel.create({ name, makeId });
      return res.status(201).json(model);
    } catch (e) {
      console.error("create model error:", e);
      return res.status(500).json({ message: "Ошибка при создании модели" });
    }
  }

  async getByMake(req, res) {
    try {
      const { makeId } = req.query;
      if (!makeId)
        return res.status(400).json({ message: "makeId обязателен" });

      const models = await VehicleModel.findAll({
        where: { makeId },
        order: [["name", "ASC"]],
      });
      return res.json(models);
    } catch (e) {
      console.error("getByMake error:", e);
      return res.status(500).json({ message: "Ошибка загрузки моделей" });
    }
  }

  async getAll(req, res) {
    try {
      const { q, makeId } = req.query;
      const where = {};
      if (makeId) where.makeId = makeId;
      if (q) where.name = { [Op.iLike]: `%${q.trim()}%` };

      const models = await VehicleModel.findAll({
        where,
        order: [
          ["makeId", "ASC"],
          ["name", "ASC"],
        ],
      });
      return res.json(models);
    } catch (e) {
      console.error("getAll models error:", e);
      return res
        .status(500)
        .json({ message: "Ошибка загрузки списка моделей" });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      let { name, makeId } = req.body;

      const model = await VehicleModel.findByPk(id);
      if (!model) return res.status(404).json({ message: "Модель не найдена" });

      const upd = {};
      if (typeof name === "string") upd.name = name.trim();
      if (makeId !== undefined) {
        const make = await VehicleMake.findByPk(makeId);
        if (!make) return res.status(404).json({ message: "Марка не найдена" });
        upd.makeId = makeId;
      }

      if (upd.name || upd.makeId) {
        const newName = upd.name ?? model.name;
        const newMakeId = upd.makeId ?? model.makeId;

        const exists = await VehicleModel.findOne({
          where: {
            makeId: newMakeId,
            name: newName,
            id: { [Op.ne]: id },
          },
        });
        if (exists) {
          return res
            .status(409)
            .json({ message: "Такая модель уже существует в этой марке" });
        }

        await model.update(upd);
      }

      return res.json(model);
    } catch (e) {
      console.error("update model error:", e);
      return res.status(500).json({ message: "Ошибка при обновлении модели" });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      const model = await VehicleModel.findByPk(id);
      if (!model) return res.status(404).json({ message: "Модель не найдена" });

      await DeviceCompatibility.destroy({ where: { modelId: id } });

      await VehicleModel.destroy({ where: { id } });
      return res.json({ message: "Модель удалена" });
    } catch (e) {
      console.error("delete model error:", e);
      return res.status(500).json({ message: "Ошибка при удалении модели" });
    }
  }
}

module.exports = new ModelController();
