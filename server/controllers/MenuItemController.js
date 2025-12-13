const ApiError = require("../error/ApiError");
const { MenuItem, MenuCategory } = require("../models/models");

const uuid = require("uuid");
const path = require("path");
const { supabase } = require("../config/supabaseClient");

const mustEnv = (n) => {
  const v = (process.env[n] ?? "").trim();
  if (!v) throw new Error(`${n} is not set`);
  return v;
};

const SUPABASE_URL = mustEnv("SUPABASE_URL");

const SUPABASE_IMAGE_BUCKET =
  process.env.SUPABASE_IMAGE_BUCKET || process.env.SUPABASE_BUCKET || "images";

const PUBLIC_BUCKET_BASE = `${SUPABASE_URL.replace(
  /\/+$/,
  ""
)}/storage/v1/object/public/${SUPABASE_IMAGE_BUCKET}`;

class MenuItemController {
  async getAll(req, res, next) {
    try {
      const sellerId = Number(req.query.sellerId);
      if (!sellerId) return next(ApiError.badRequest("sellerId обязателен"));

      const rows = await MenuItem.findAll({
        where: { sellerId, isActive: true },
        include: [{ model: MenuCategory, as: "category" }],
        order: [
          ["displayOrder", "ASC"],
          ["id", "ASC"],
        ],
      });

      return res.json(rows);
    } catch (e) {
      next(e);
    }
  }

  async create(req, res, next) {
    try {
      const {
        sellerId,
        categoryId,
        name,
        description,
        price,
        displayOrder,
        isAvailable,
      } = req.body;

      const sid = Number(sellerId);
      if (!sid) return next(ApiError.badRequest("sellerId обязателен"));
      if (!name) return next(ApiError.badRequest("name обязателен"));
      if (price == null) return next(ApiError.badRequest("price обязателен"));

      let cid = categoryId ? Number(categoryId) : null;

      if (cid) {
        const cat = await MenuCategory.findOne({
          where: { id: cid, sellerId: sid, isActive: true },
        });
        if (!cat) {
          return next(
            ApiError.badRequest("categoryId не принадлежит магазину")
          );
        }
      }

      let imgUrl = null;

      if (req.files && req.files.img) {
        const img = req.files.img;

        const fileName = `menu/${uuid.v4()}${path.extname(img.name)}`;

        const { error } = await supabase.storage
          .from(SUPABASE_IMAGE_BUCKET)
          .upload(fileName, img.data, { contentType: img.mimetype });

        if (error) {
          throw new Error("Ошибка загрузки изображения блюда в Supabase");
        }

        imgUrl = `${PUBLIC_BUCKET_BASE}/${fileName}`;
      } else if (req.body.img) {
        imgUrl = req.body.img;
      }

      const row = await MenuItem.create({
        sellerId: sid,
        categoryId: cid,
        name: String(name).trim(),
        description: description || null,
        price,
        img: imgUrl,
        displayOrder: Number(displayOrder) || 0,
        isAvailable: typeof isAvailable === "boolean" ? isAvailable : true,
        isActive: true,
      });

      return res.json(row);
    } catch (e) {
      next(ApiError.badRequest(e.message));
    }
  }

  async update(req, res, next) {
    try {
      const id = Number(req.params.id);
      const row = await MenuItem.findByPk(id);
      if (!row) return next(ApiError.notFound("Блюдо не найдено"));

      const {
        categoryId,
        name,
        description,
        price,
        img,
        displayOrder,
        isAvailable,
        isActive,
      } = req.body;

      if (categoryId !== undefined) {
        const cid = categoryId ? Number(categoryId) : null;

        if (cid) {
          const cat = await MenuCategory.findOne({
            where: { id: cid, sellerId: row.sellerId, isActive: true },
          });
          if (!cat) {
            return next(
              ApiError.badRequest("categoryId не принадлежит магазину")
            );
          }
        }

        row.categoryId = cid;
      }

      if (name !== undefined) row.name = String(name).trim();
      if (description !== undefined) row.description = description || null;
      if (price !== undefined) row.price = price;
      if (displayOrder !== undefined)
        row.displayOrder = Number(displayOrder) || 0;
      if (typeof isAvailable === "boolean") row.isAvailable = isAvailable;
      if (typeof isActive === "boolean") row.isActive = isActive;
      if (req.files && req.files.img) {
        const file = req.files.img;

        const fileName = `menu/${uuid.v4()}${path.extname(file.name)}`;

        const { error } = await supabase.storage
          .from(SUPABASE_IMAGE_BUCKET)
          .upload(fileName, file.data, { contentType: file.mimetype });

        if (error) {
          throw new Error("Ошибка загрузки изображения блюда в Supabase");
        }

        row.img = `${PUBLIC_BUCKET_BASE}/${fileName}`;
      } else if (img !== undefined) {
        row.img = img || null;
      }

      await row.save();
      return res.json(row);
    } catch (e) {
      next(ApiError.badRequest(e.message));
    }
  }

  async toggleAvailability(req, res, next) {
    try {
      const id = Number(req.params.id);
      const { isAvailable } = req.body;

      const row = await MenuItem.findByPk(id);
      if (!row) return next(ApiError.notFound("Блюдо не найдено"));

      row.isAvailable = !!isAvailable;
      await row.save();

      return res.json(row);
    } catch (e) {
      next(e);
    }
  }

  async deactivate(req, res, next) {
    try {
      const id = Number(req.params.id);

      const row = await MenuItem.findByPk(id);
      if (!row) return next(ApiError.notFound("Блюдо не найдено"));

      row.isActive = false;
      await row.save();

      return res.json({ message: "Блюдо скрыто", item: row });
    } catch (e) {
      next(e);
    }
  }
}

module.exports = new MenuItemController();
