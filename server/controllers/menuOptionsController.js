const {
  MenuItem,
  MenuOptionGroup,
  MenuOption,
  Translation,
} = require("../models/models");
const { Op } = require("sequelize");

async function readTranslationsMap(keys) {
  const rows = await Translation.findAll({ where: { key: { [Op.in]: keys } } });
  const out = {};
  rows.forEach((r) => {
    if (!out[r.key]) out[r.key] = {};
    out[r.key][r.lang] = r.text;
  });
  return out;
}

class MenuOptionsController {
  async getItemOptions(req, res) {
    const { id } = req.params;

    const item = await MenuItem.findByPk(id);
    if (!item) return res.status(404).json({ message: "Блюдо не найдено" });

    const groups = await MenuOptionGroup.findAll({
      where: { menuItemId: Number(id), isActive: true },
      include: [
        {
          model: MenuOption,
          as: "options",
          where: { isActive: true },
          required: false,
        },
      ],
      order: [
        ["displayOrder", "ASC"],
        ["id", "ASC"],

        // сортировка ВНУТРИ options
        [{ model: MenuOption, as: "options" }, "displayOrder", "ASC"],
        [{ model: MenuOption, as: "options" }, "id", "ASC"],
      ],
    });

    const groupKeys = groups.map((g) => `menu_option_group_${g.id}.title`);
    const optKeys = groups.flatMap((g) =>
      (g.options || []).map((o) => `menu_option_${o.id}.title`),
    );
    const tmap = await readTranslationsMap([...groupKeys, ...optKeys]);

    const payload = groups.map((g) => ({
      ...g.toJSON(),
      translations: {
        title: tmap[`menu_option_group_${g.id}.title`] || {},
      },
      options: (g.options || []).map((o) => ({
        ...o.toJSON(),
        translations: {
          title: tmap[`menu_option_${o.id}.title`] || {},
        },
      })),
    }));

    return res.json(payload);
  }
}

module.exports = new MenuOptionsController();
