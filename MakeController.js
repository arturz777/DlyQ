const {
  VehicleMake,
  VehicleModel,
  DeviceCompatibility,
} = require("../models/models");

const toIntOrZero = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};

class MakeController {
  async getAll(req, res) {
    try {
      const makes = await VehicleMake.findAll({
        order: [
          ["displayOrder", "ASC"],
          ["id", "ASC"],
        ],
        attributes: ["id", "name", "displayOrder"],
      });
      res.json(makes);
    } catch (e) {
      console.error("getAll makes error:", e);
      res.status(500).json({ message: "Ошибка загрузки марок" });
    }
  }

  async create(req, res) {
    try {
      let { name, displayOrder } = req.body;
      name = (name || "").trim();
      if (!name)
        return res.status(400).json({ message: "Поле 'name' обязательно" });

      const exists = await VehicleMake.findOne({ where: { name } });
      if (exists)
        return res.status(409).json({ message: "Такая марка уже существует" });

      const make = await VehicleMake.create({
        name,
        displayOrder: toIntOrZero(displayOrder),
      });

      res.status(201).json(make);
    } catch (e) {
      console.error("create make error:", e);
      res.status(500).json({ message: "Ошибка при создании марки" });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      let { name, displayOrder } = req.body;

      const make = await VehicleMake.findByPk(id);
      if (!make) return res.status(404).json({ message: "Марка не найдена" });

      const upd = {};
      if (typeof name === "string") {
        name = name.trim();
        if (!name)
          return res
            .status(400)
            .json({ message: "Поле 'name' не может быть пустым" });
        const exists = await VehicleMake.findOne({ where: { name } });
        if (exists && exists.id !== Number(id)) {
          return res
            .status(409)
            .json({ message: "Такая марка уже существует" });
        }
        upd.name = name;
      }
      if (displayOrder !== undefined) {
        upd.displayOrder = toIntOrZero(displayOrder);
      }

      await make.update(upd);
      res.json(make);
    } catch (e) {
      console.error("update make error:", e);
      res.status(500).json({ message: "Ошибка при обновлении марки" });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      const make = await VehicleMake.findByPk(id);
      if (!make) return res.status(404).json({ message: "Марка не найдена" });

      const modelsCount = await VehicleModel.count({ where: { makeId: id } });
      if (modelsCount > 0) {
        return res
          .status(409)
          .json({ message: "Сначала удалите/перенесите модели этой марки" });
      }

      await DeviceCompatibility.destroy({ where: { makeId: id } });

      await make.destroy();
      res.json({ message: "Марка удалена" });
    } catch (e) {
      console.error("delete make error:", e);
      res.status(500).json({ message: "Ошибка при удалении марки" });
    }
  }
}

module.exports = new MakeController();
