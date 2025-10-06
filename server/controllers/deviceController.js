const uuid = require("uuid");
const path = require("path");
const {
  Device,
  DeviceVariant,
  DeviceInfo,
  DeviceSubType,
  SubType,
  Type,
  DeviceType,
  Translation,
  VehicleMake,
  VehicleModel,
  DeviceCompatibility,
} = require("../models/models");
const ApiError = require("../error/ApiError");
const { Op, fn, col, literal } = require("sequelize");
const fs = require("fs");
const { supabase } = require("../config/supabaseClient");

const getVal = (x) =>
  x && typeof x === "object" && "value" in x ? x.value : x;

const makeVariantKey = (selected = {}) =>
  Object.keys(selected)
    .sort()
    .map((k) => `${k}:${String(getVal(selected[k]))}`)
    .join("|");

const parseMaybeJSON = (x) => {
  if (x == null) return {};
  if (typeof x === "string") {
    try {
      return JSON.parse(x);
    } catch {
      return {};
    }
  }
  return x;
};

const resolveVariantImage = (imgToken, mainUrl, thumbs = []) => {
  if (!imgToken) return null;
  const s = String(imgToken);
  if (s === "gallery:main") return mainUrl;
  const m = s.match(/^gallery:thumb:(\d+)$/);
  if (m) {
    const idx = Number(m[1]);
    return thumbs[idx] || null;
  }
  return s;
};

class DeviceController {
  async create(req, res, next) {
    try {
      let {
        name,
        price,
        oldPrice,
        brandId,
        typeId,
        subtypeId,
        info,
        quantity,
        description,
        options,
        translations,
        isNew,
        discount,
        recommended,
        purchasePrice,
        expiryKind,
        expiryDate,
        snoozeUntil,
      } = req.body;

      if (!req.files || !req.files.img) {
        return res
          .status(400)
          .json({ message: "Необходимо загрузить изображение устройства." });
      }

      const { img } = req.files;
      const fileName = `${uuid.v4()}${path.extname(img.name)}`;
      const { data, error } = await supabase.storage
        .from("images")
        .upload(fileName, img.data, { contentType: img.mimetype });

      if (error) {
        throw new Error("Ошибка загрузки изображения в Supabase Storage");
      }

      const publicURL = `https://esjsdctbiuzornxbktjb.supabase.co/storage/v1/object/public/images/${fileName}`;

      let thumbnails = [];
      if (req.files && req.files.thumbnails) {
        const images = Array.isArray(req.files.thumbnails)
          ? req.files.thumbnails
          : [req.files.thumbnails];

        thumbnails = await Promise.all(
          images.map(async (image) => {
            const thumbFileName = `${uuid.v4()}${path.extname(image.name)}`;

            const { data, error } = await supabase.storage
              .from("images")
              .upload(thumbFileName, image.data, {
                contentType: image.mimetype,
              });

            if (error) {
              console.error("Ошибка загрузки миниатюры в Supabase:", error);
              return null;
            }

            return `https://esjsdctbiuzornxbktjb.supabase.co/storage/v1/object/public/images/${thumbFileName}`;
          })
        );

        thumbnails = thumbnails.filter((url) => url !== null);
      }

      let parsedOptions = options ? JSON.parse(options) : [];
      let parsedVariants = req.body.variants
        ? JSON.parse(req.body.variants)
        : [];

      let totalQty;
      if (Array.isArray(parsedVariants) && parsedVariants.length) {
        totalQty = parsedVariants.reduce(
          (s, v) => s + (Number(v.quantity) || 0),
          0
        );
      } else if (Array.isArray(parsedOptions) && parsedOptions.length) {
        totalQty = parsedOptions.reduce(
          (sum, option) =>
            sum +
            (option.values || []).reduce(
              (optSum, v) => optSum + (Number(v.quantity) || 0),
              0
            ),
          0
        );
      } else {
        totalQty = Number(quantity) || 0;
      }

      if (discount === "true" && !oldPrice) {
        oldPrice = price;
      }

      const purchasePriceNum =
        purchasePrice !== undefined &&
        purchasePrice !== null &&
        purchasePrice !== ""
          ? Number(purchasePrice)
          : null;

      expiryKind = expiryKind || null;
      expiryDate = expiryDate || null;
      snoozeUntil = snoozeUntil || null;

      if (!name || !price || !typeId) {
        return res.status(400).json({
          message:
            "Обязательные поля (name, price, typeId) должны быть заполнены.",
        });
      }

      const device = await Device.create({
        name,
        price,
        oldPrice: oldPrice || null,
        brandId: brandId || null,
        typeId,
        subtypeId: subtypeId || null,
        img: publicURL,
        thumbnails,
        options: parsedOptions,
        quantity: totalQty,
        description,
        expiryKind,
        expiryDate,
        snoozeUntil,
        isNew: isNew === "true",
        discount: discount === "true",
        recommended: recommended === "true",
        purchasePrice: purchasePriceNum,
        purchaseHasVAT: req.body.purchaseHasVAT === "true",
      });

      const primaryId = subtypeId || null;
      let subtypeIdsArr = [];
      if (req.body.subtypeIds) {
        try {
          subtypeIdsArr = JSON.parse(req.body.subtypeIds) || [];
        } catch {}
      }

      const allSubtypes = new Set(subtypeIdsArr.filter(Boolean));
      if (primaryId) allSubtypes.add(Number(primaryId));

      if (allSubtypes.size) {
        const rows = Array.from(allSubtypes).map((stId) => ({
          deviceId: device.id,
          subtypeId: Number(stId),
          isPrimary: primaryId ? Number(stId) === Number(primaryId) : false,
        }));

        await DeviceSubType.bulkCreate(rows, { ignoreDuplicates: true });
      }

      try {
        const parsedTypeIds = req.body.typeIds
          ? JSON.parse(req.body.typeIds)
          : [];
        const extraTypeIds = new Set(
          (Array.isArray(parsedTypeIds) ? parsedTypeIds : [])
            .map(Number)
            .filter(Number.isInteger)
        );

        const allSubtypeIdsArr = Array.from(allSubtypes);
        if (allSubtypeIdsArr.length) {
          const subtypesRows = await SubType.findAll({
            where: { id: allSubtypeIdsArr },
          });
          const subtypeTypeIds = new Set(subtypesRows.map((s) => s.typeId));

          const primaryTypeId = typeId ? Number(typeId) : null;
          for (const tid of subtypeTypeIds) {
            if (tid && tid !== primaryTypeId) extraTypeIds.add(tid);
          }
        }

        if (typeof device.setTypes === "function") {
          await device.setTypes([...extraTypeIds]);
        } else {
          await DeviceType.destroy({ where: { deviceId: device.id } });
          if (extraTypeIds.size) {
            await DeviceType.bulkCreate(
              [...extraTypeIds].map((tid) => ({
                deviceId: device.id,
                typeId: tid,
              })),
              { ignoreDuplicates: true }
            );
          }
        }
      } catch (e) {
        console.error("Не удалось сохранить доп. типы:", e.message);
      }

      if (expiryKind === "use_by" && expiryDate) {
        const today = new Date().toISOString().slice(0, 10);
        if (expiryDate < today) {
          return res.status(400).json({
            message: "Для use_by дата годности не может быть в прошлом.",
          });
        }
      }

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

        Object.entries(translations.name || {}).forEach(([lang, text]) => {
          if (text) {
            translationEntries.push({
              key: `device_${device.id}.name`,
              lang,
              text,
            });
          }
        });

        Object.entries(translations.description || {}).forEach(
          ([lang, text]) => {
            if (text) {
              translationEntries.push({
                key: `device_${device.id}.description`,
                lang,
                text,
              });
            }
          }
        );

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

        if (translations.options && Array.isArray(translations.options)) {
          translations.options.forEach((option, optionIndex) => {
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

      try {
        const { compat, isUniversal } = req.body;

        if (isUniversal === "true") {
          await DeviceCompatibility.create({
            deviceId: device.id,
            isUniversal: true,
            makeId: null,
            modelId: null,
            yearFrom: null,
            yearTo: null,
          });
        } else if (compat) {
          let arr = [];
          try {
            arr = JSON.parse(compat);
          } catch {
            arr = [];
          }
          if (Array.isArray(arr) && arr.length) {
            const rows = arr.map((c) => ({
              deviceId: device.id,
              makeId: c.makeId ?? null,
              modelId: c.modelId ?? null,
              yearFrom: c.yearFrom ?? null,
              yearTo: c.yearTo ?? null,
              isUniversal: false,
            }));
            await DeviceCompatibility.bulkCreate(rows);
          }
        }
      } catch (e) {
        console.error("Ошибка сохранения совместимости:", e.message);
      }

      if (Array.isArray(parsedVariants) && parsedVariants.length) {
        const rows = parsedVariants.map((v) => {
          const normalizedSelected = Object.fromEntries(
            Object.entries(v.selected || {}).map(([k, val]) => [k, getVal(val)])
          );
          return {
            deviceId: device.id,
            key: makeVariantKey(normalizedSelected),
            selected: JSON.stringify(normalizedSelected),
            sku: v.sku || null,
            price: v.price === "" ? null : v.price ?? null,
            oldPrice: v.oldPrice === "" ? null : v.oldPrice ?? null,
            quantity: Number(v.quantity) || 0,
            image: resolveVariantImage(v.image, publicURL, thumbnails),
            isActive: v.isActive !== false,
          };
        });
        await DeviceVariant.bulkCreate(rows, { ignoreDuplicates: true });
      }

      return res.json(device);
    } catch (e) {
      next(ApiError.badRequest(e.message));
    }
  }

  async getAll(req, res) {
    try {
      let {
        brandId,
        typeId,
        subtypeId,
        limit,
        page,
        isNew,
        discount,
        recommended,
        makeId,
        modelId,
      } = req.query;

      const toInt = (v) => {
        const n = Number(v);
        return Number.isInteger(n) && n > 0 ? n : undefined;
      };

      brandId = toInt(brandId);
      typeId = toInt(typeId);
      subtypeId = toInt(subtypeId);
      makeId = toInt(makeId);
      modelId = toInt(modelId);
      page = Number(page) || 1;
      limit = Number(limit) || 9;
      const offset = page * limit - limit;

      const where = {};
      if (brandId != null) where.brandId = brandId;
      if (isNew !== undefined) where.isNew = isNew === "true";
      if (discount !== undefined) where.discount = discount === "true";
      if (recommended !== undefined) where.recommended = recommended === "true";

      const include = [
        { model: DeviceVariant, as: "variants", required: false },
        { model: SubType, as: "subtype" },
        { model: Type },
        { model: DeviceInfo, as: "info" },
        {
          model: Type,
          as: "types",
          through: { attributes: [] },
          required: false,
        },
        {
          model: SubType,
          as: "subtypes",
          through: { attributes: [] },
          required: false,
        },
      ];

      if (typeId != null) {
        where[Op.and] = where[Op.and] || [];
        where[Op.and].push({
          [Op.or]: [
            { typeId },
            { "$types.id$": typeId },
            { "$subtypes.typeId$": typeId },
          ],
        });
      }

      if (subtypeId != null) {
        where[Op.and] = where[Op.and] || [];
        where[Op.and].push({
          [Op.or]: [{ subtypeId }, { "$subtypes.id$": subtypeId }],
        });
      }

      const compatInclude = {
        model: DeviceCompatibility,
        as: "compat",
        required: false,
        include: [
          { model: VehicleMake, as: "make", attributes: ["id", "name"] },
          {
            model: VehicleModel,
            as: "model",
            attributes: ["id", "name", "makeId"],
          },
        ],
      };

      if (modelId != null) {
        compatInclude.required = true;
        compatInclude.where = { [Op.or]: [{ modelId }, { isUniversal: true }] };
      } else if (makeId != null) {
        compatInclude.required = true;
        compatInclude.where = { [Op.or]: [{ makeId }, { isUniversal: true }] };
      }

      include.push(compatInclude);

      const devices = await Device.findAndCountAll({
        where,
        limit,
        offset,
        include,
        distinct: true,
        subQuery: false,
      });

      devices.rows.forEach((d) => {
        const vars = d.dataValues.variants || d.variants || [];
        vars.forEach((v) => {
          v.dataValues.selected = parseMaybeJSON(v.dataValues.selected);
        });
      });

      const todayStr = new Date().toISOString().slice(0, 10);
      devices.rows.forEach((d) => {
        const v = d.dataValues;
        if (v.expiryDate) {
          const ms = new Date(v.expiryDate) - new Date(todayStr);
          v.daysToExpire = Math.floor(ms / 86400000);
        } else {
          v.daysToExpire = null;
        }
      });

      const deviceIds = devices.rows.map((d) => d.id);
      let translations = [];
      if (deviceIds.length > 0) {
        translations = await Translation.findAll({
          where: {
            key: {
              [Op.or]: deviceIds.map((id) => ({ [Op.like]: `device_${id}.%` })),
            },
          },
        });
      }

      const translatedSpecs = {};
      translations.forEach((t) => {
        const keyParts = t.key.split(".");
        const deviceId = keyParts[0].replace("device_", "");
        const section = keyParts[1];
        const optionIndex = keyParts[2];
        const field = keyParts[3];
        const valueIndex = keyParts[4];

        if (!translatedSpecs[deviceId]) translatedSpecs[deviceId] = {};

        if (section === "info") {
          if (!translatedSpecs[deviceId].info)
            translatedSpecs[deviceId].info = [];
          if (!translatedSpecs[deviceId].info[optionIndex]) {
            translatedSpecs[deviceId].info[optionIndex] = {
              title: {},
              description: {},
            };
          }
          translatedSpecs[deviceId].info[optionIndex][field][t.lang] = t.text;
        } else if (section === "option") {
          if (!translatedSpecs[deviceId].options)
            translatedSpecs[deviceId].options = [];
          if (!translatedSpecs[deviceId].options[optionIndex]) {
            translatedSpecs[deviceId].options[optionIndex] = {
              name: {},
              values: [],
            };
          }

          if (field === "name") {
            translatedSpecs[deviceId].options[optionIndex].name[t.lang] =
              t.text;
          } else if (field === "value" && valueIndex !== undefined) {
            if (
              !translatedSpecs[deviceId].options[optionIndex].values[valueIndex]
            ) {
              translatedSpecs[deviceId].options[optionIndex].values[
                valueIndex
              ] = {};
            }
            translatedSpecs[deviceId].options[optionIndex].values[valueIndex][
              t.lang
            ] = t.text;
          }
        } else {
          if (!translatedSpecs[deviceId][section])
            translatedSpecs[deviceId][section] = {};
          translatedSpecs[deviceId][section][t.lang] = t.text;
        }
      });

      devices.rows.forEach((device) => {
        device.dataValues.translations = translatedSpecs[device.id] || {};
      });

      return res.json(devices);
    } catch (error) {
      console.error("❌ Ошибка при получении устройств:", error.message);
      return res
        .status(500)
        .json({ message: "Ошибка при получении устройств" });
    }
  }

  async getOne(req, res) {
    try {
      const { id } = req.params;

      const device = await Device.findOne({
        where: { id },
        include: [
          { model: DeviceVariant, as: "variants" },
          { model: DeviceInfo, as: "info" },
          { model: SubType, as: "subtype" },
          { model: Type },
          { model: Type, as: "types", through: { attributes: [] } },
          {
            model: SubType,
            as: "subtypes",
            through: { attributes: ["isPrimary"] },
          },
          {
            model: DeviceCompatibility,
            as: "compat",
            include: [
              { model: VehicleMake, as: "make", attributes: ["id", "name"] },
              { model: VehicleModel, as: "model", attributes: ["id", "name"] },
            ],
          },
        ],
      });

      if (!device) {
        return res.status(404).json({ message: "Устройство не найдено" });
      }

      const allSubtypeIds = (device.subtypes || []).map((s) => s.id);

      const translations = await Translation.findAll({
        where: { key: { [Op.like]: `device_${id}.%` } },
      });

      const translatedSpecs = {};
      translations.forEach((t) => {
        const key = t.key.replace(`device_${id}.`, "");
        const keyParts = key.split(".");

        if (key.startsWith("info")) {
          const index = keyParts[1];
          const type = keyParts[2];

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
        } else if (key.startsWith("option")) {
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
        } else {
          if (!translatedSpecs[key]) {
            translatedSpecs[key] = {};
          }
          translatedSpecs[key][t.lang] = t.text;
        }
      });

      if (device.info && Array.isArray(device.info)) {
        device.info.forEach((infoItem, index) => {
          if (!translatedSpecs.info) return;

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

      if (device && Array.isArray(device.dataValues.variants)) {
        device.dataValues.variants.forEach((v) => {
          v.dataValues.selected = parseMaybeJSON(v.dataValues.selected);
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
      let {
        name,
        price,
        oldPrice,
        brandId,
        typeId,
        subtypeId,
        info,
        options,
        quantity,
        description,
        translations,
        isNew,
        discount,
        recommended,
        purchasePrice,
        expiryKind,
        expiryDate,
        snoozeUntil,
      } = req.body;

      expiryKind =
        expiryKind === "use_by" || expiryKind === "best_before"
          ? expiryKind
          : null;
      expiryDate = expiryDate || null;
      snoozeUntil = snoozeUntil || null;

      if (expiryKind === "use_by" && expiryDate) {
        const today = new Date().toISOString().slice(0, 10);
        if (expiryDate < today) {
          return res.status(400).json({
            message: "Для use_by дата годности не может быть в прошлом.",
          });
        }
      }

      let existingImages = req.body.existingImages
        ? JSON.parse(req.body.existingImages)
        : [];

      const device = await Device.findOne({ where: { id } });
      if (!device)
        return res.status(404).json({ message: "Устройство не найдено" });

      let parsedOptions = options ? JSON.parse(options) : [];
      let parsedVariants = req.body.variants
        ? JSON.parse(req.body.variants)
        : [];

      if (discount === "true" && !oldPrice) {
        oldPrice = price;
      }

      if (discount === "false") {
        oldPrice = null;
      }

      let fileName = device.img;
      let thumbnails = Array.isArray(device.thumbnails)
        ? [...device.thumbnails]
        : [];

      const files = req.files || {};
      const img = files.img || null;

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

        fileName = `https://esjsdctbiuzornxbktjb.supabase.co/storage/v1/object/public/images/${newFileName}`;
      }

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

            return `https://esjsdctbiuzornxbktjb.supabase.co/storage/v1/object/public/images/${thumbFileName}`;
          })
        );

        thumbnails = [
          ...thumbnails,
          ...newThumbnails.filter((url) => url !== null),
        ];
      }

      let totalQty;
      if (Array.isArray(parsedVariants) && parsedVariants.length) {
        totalQty = parsedVariants.reduce(
          (s, v) => s + (Number(v.quantity) || 0),
          0
        );
      } else if (Array.isArray(parsedOptions) && parsedOptions.length) {
        totalQty = parsedOptions.reduce(
          (sum, option) =>
            sum +
            (option.values || []).reduce(
              (optSum, v) => optSum + (Number(v.quantity) || 0),
              0
            ),
          0
        );
      } else {
        totalQty = Number(quantity) || 0;
      }

      await Translation.destroy({
        where: { key: { [Op.like]: `device_${id}.%` } },
      });

      let translationEntries = [];

      if (translations) {
        const parsedTranslations = JSON.parse(translations);

        Object.entries(parsedTranslations.name || {}).forEach(
          ([lang, text]) => {
            if (text) {
              translationEntries.push({
                key: `device_${id}.name`,
                lang,
                text,
              });
            }
          }
        );

        Object.entries(parsedTranslations.description || {}).forEach(
          ([lang, text]) => {
            if (text) {
              translationEntries.push({
                key: `device_${id}.description`,
                lang,
                text,
              });
            }
          }
        );

        if (
          parsedTranslations.options &&
          Array.isArray(parsedTranslations.options)
        ) {
          parsedTranslations.options.forEach((option, optionIndex) => {
            Object.entries(option.name || {}).forEach(([lang, text]) => {
              if (text) {
                translationEntries.push({
                  key: `device_${id}.option.${optionIndex}.name`,
                  lang,
                  text,
                });
              }
            });

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

      const purchasePriceNum =
        purchasePrice !== undefined &&
        purchasePrice !== null &&
        purchasePrice !== ""
          ? Number(purchasePrice)
          : null;

      await Device.update(
        {
          name,
          price,
          oldPrice,
          brandId: brandId || null,
          typeId,
          subtypeId: subtypeId || null,
          img: fileName,
          thumbnails,
          options: parsedOptions,
          quantity: totalQty,
          description,
          expiryKind,
          expiryDate,
          snoozeUntil,
          isNew: isNew === "true",
          discount: discount === "true",
          recommended: recommended === "true",
          purchasePrice: purchasePriceNum,
          purchaseHasVAT: req.body.purchaseHasVAT === "true",
        },
        { where: { id } }
      );

      const primaryId = subtypeId || null;
      let subtypeIdsArr = [];
      if (req.body.subtypeIds) {
        try {
          subtypeIdsArr = JSON.parse(req.body.subtypeIds) || [];
        } catch {}
      }
      const allSubtypes = new Set(subtypeIdsArr.filter(Boolean));
      if (primaryId) allSubtypes.add(Number(primaryId));

      await DeviceSubType.destroy({ where: { deviceId: id } });

      if (allSubtypes.size) {
        const rows = Array.from(allSubtypes).map((stId) => ({
          deviceId: Number(id),
          subtypeId: Number(stId),
          isPrimary: primaryId ? Number(stId) === Number(primaryId) : false,
        }));
        await DeviceSubType.bulkCreate(rows);
      }

      try {
        const parsedTypeIds = req.body.typeIds
          ? JSON.parse(req.body.typeIds)
          : [];
        const extraTypeIds = new Set(
          (Array.isArray(parsedTypeIds) ? parsedTypeIds : [])
            .map(Number)
            .filter(Number.isInteger)
        );

        const allSubtypeIdsArr = Array.from(allSubtypes);
        if (allSubtypeIdsArr.length) {
          const subtypesRows = await SubType.findAll({
            where: { id: allSubtypeIdsArr },
          });
          const subtypeTypeIds = new Set(subtypesRows.map((s) => s.typeId));

          const primaryTypeId = typeId ? Number(typeId) : null;
          for (const tid of subtypeTypeIds) {
            if (tid && tid !== primaryTypeId) extraTypeIds.add(tid);
          }
        }

        if (typeof device.setTypes === "function") {
          await device.setTypes([...extraTypeIds]);
        } else {
          await DeviceType.destroy({ where: { deviceId: id } });
          if (extraTypeIds.size) {
            await DeviceType.bulkCreate(
              [...extraTypeIds].map((tid) => ({
                deviceId: Number(id),
                typeId: tid,
              })),
              { ignoreDuplicates: true }
            );
          }
        }
      } catch (e) {
        console.error("Не удалось обновить доп. типы:", e.message);
      }

      if (info) {
        const parsedInfo = JSON.parse(info);
        await DeviceInfo.destroy({ where: { deviceId: id } });
        await Promise.all(
          parsedInfo.map((i) => DeviceInfo.create({ ...i, deviceId: id }))
        );
      }

      const updatedDevice = await Device.findOne({ where: { id } });

      try {
        await DeviceCompatibility.destroy({ where: { deviceId: id } });

        const { compat, isUniversal } = req.body;

        if (isUniversal === "true") {
          await DeviceCompatibility.create({
            deviceId: id,
            isUniversal: true,
            makeId: null,
            modelId: null,
            yearFrom: null,
            yearTo: null,
          });
        } else if (compat) {
          let arr = [];
          try {
            arr = JSON.parse(compat);
          } catch {
            arr = [];
          }
          if (Array.isArray(arr) && arr.length) {
            const rows = arr.map((c) => ({
              deviceId: id,
              makeId: c.makeId ?? null,
              modelId: c.modelId ?? null,
              yearFrom: c.yearFrom ?? null,
              yearTo: c.yearTo ?? null,
              isUniversal: false,
            }));
            await DeviceCompatibility.bulkCreate(rows);
          }
        }
      } catch (e) {
        console.error("Ошибка обновления совместимости:", e.message);
      }

      await DeviceVariant.destroy({ where: { deviceId: id } });
      if (Array.isArray(parsedVariants) && parsedVariants.length) {
        const rows = parsedVariants.map((v) => {
          const normalizedSelected = Object.fromEntries(
            Object.entries(v.selected || {}).map(([k, val]) => [k, getVal(val)])
          );
          return {
            deviceId: Number(id),
            key: makeVariantKey(normalizedSelected),
            selected: JSON.stringify(normalizedSelected),
            sku: v.sku || null,
            price: v.price === "" ? null : v.price ?? null,
            oldPrice: v.oldPrice === "" ? null : v.oldPrice ?? null,
            quantity: Number(v.quantity) || 0,
            image: resolveVariantImage(v.image, fileName, thumbnails),
            isActive: v.isActive !== false,
          };
        });
        await DeviceVariant.bulkCreate(rows, { ignoreDuplicates: true });
      }

      return res.json(updatedDevice);
    } catch (error) {
      console.error("❌ Ошибка в update:", error);
      next(ApiError.badRequest(error.message));
    }
  }

  async getNewDevices(req, res) {
    try {
      const { limit = 10 } = req.query;

      const devices = await Device.findAll({
        where: { isNew: true },
        limit: parseInt(limit),
        order: [["createdAt", "DESC"]],
        include: [
          { model: SubType, as: "subtype" },
          { model: Type },
          { model: DeviceInfo, as: "info" },
        ],
      });

      if (!devices.length) return res.json([]);

      const deviceIds = devices.map((d) => d.id);
      const translations = await Translation.findAll({
        where: {
          key: {
            [Op.or]: deviceIds.map((id) => `device_${id}.%`),
          },
        },
      });

      const devicesWithTranslations = devices.map((device) => {
        const deviceTranslations = {};
        translations
          .filter((t) => t.key.startsWith(`device_${device.id}.`))
          .forEach((t) => {
            const [_, field] = t.key.split(`device_${device.id}.`);
            if (!field) return;
            deviceTranslations[field] = deviceTranslations[field] || {};
            deviceTranslations[field][t.lang] = t.text;
          });

        return {
          ...device.get({ plain: true }),
          translations: deviceTranslations,
        };
      });

      res.json(devicesWithTranslations);
    } catch (error) {
      console.error("❌ getNewDevices error:", error);
      res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async updateNewStatus(req, res) {
    try {
      const { id, isNew } = req.body;

      const device = await Device.findByPk(id);
      if (!device) {
        return res.status(404).json({ message: "Товар не найден" });
      }

      device.isNew = isNew === "true";
      await device.save();

      return res.json({ message: `Товар ${id} обновлён`, isNew: device.isNew });
    } catch (error) {
      return res.status(500).json({ message: "Ошибка при обновлении статуса" });
    }
  }

  async getDiscountedDevices(req, res) {
    try {
      let { limit } = req.query;
      limit = limit ? parseInt(limit) : 10;

      const devices = await Device.findAndCountAll({
        where: { discount: true },
        limit,
        order: [["createdAt", "DESC"]],
      });

      return res.json({ count: devices.count, devices: devices.rows });
    } catch (error) {
      console.error("❌ Ошибка загрузки товаров со скидками:", error);
      return res
        .status(500)
        .json({ message: "Ошибка сервера при загрузке товаров со скидками" });
    }
  }

  async getRecommendedDevices(req, res) {
    try {
      let { limit } = req.query;
      limit = limit ? parseInt(limit) : 10;

      const devices = await Device.findAndCountAll({
        where: { recommended: true },
        limit,
        order: [["createdAt", "DESC"]],
      });

      return res.json({ count: devices.count, devices: devices.rows });
    } catch (error) {
      console.error("❌ Ошибка загрузки рекомендованных товаров:", error);
      return res.status(500).json({
        message: "Ошибка сервера при загрузке рекомендованных товаров",
      });
    }
  }

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
        const fileName = device.img.split("/").pop();
        const { error } = await supabase.storage
          .from("images")
          .remove([fileName]);
        if (error)
          console.error(
            "Ошибка при удалении главного изображения из Supabase:",
            error
          );
      }

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

   async filter(req, res) {
    try {
      const toInt = (v) => {
        const n = Number(v);
        return Number.isInteger(n) && n > 0 ? n : undefined;
      };

      const stripAttrsDeep = (inc) => {
        const arr = Array.isArray(inc) ? inc : [];
        return arr.map((i) => ({
          ...i,
          attributes: [],
          include: stripAttrsDeep(i.include),
        }));
      };

      let {
        brandId,
        typeId,
        subtypeId,
        makeId,
        modelId,
        isNew,
        discount,
        recommended,
        page,
        limit,
      } = req.query;

      brandId = toInt(brandId);
      typeId = toInt(typeId);
      subtypeId = toInt(subtypeId);
      makeId = toInt(makeId);
      modelId = toInt(modelId);
      page = Number(page) || 1;
      limit = Number(limit) || 9;
      const offset = page * limit - limit;

      const baseWhere = {};
      if (brandId != null) baseWhere.brandId = brandId;
      if (isNew !== undefined) baseWhere.isNew = isNew === "true";
      if (discount !== undefined) baseWhere.discount = discount === "true";
      if (recommended !== undefined)
        baseWhere.recommended = recommended === "true";

      if (typeId != null) {
        baseWhere[Op.and] = baseWhere[Op.and] || [];
        baseWhere[Op.and].push({
          [Op.or]: [
            { typeId },
            { "$types.id$": typeId },
            { "$subtypes.typeId$": typeId },
          ],
        });
      }

      if (subtypeId != null) {
        baseWhere[Op.and] = baseWhere[Op.and] || [];
        baseWhere[Op.and].push({
          [Op.or]: [{ subtypeId }, { "$subtypes.id$": subtypeId }],
        });
      }

      const compatInclude = {
        model: DeviceCompatibility,
        as: "compat",
        required: false,
        include: [
          { model: VehicleMake, as: "make", attributes: ["id", "name"] },
          {
            model: VehicleModel,
            as: "model",
            attributes: ["id", "name", "makeId"],
          },
        ],
      };
      if (modelId != null) {
        compatInclude.required = true;
        compatInclude.where = { [Op.or]: [{ modelId }, { isUniversal: true }] };
      } else if (makeId != null) {
        compatInclude.required = true;
        compatInclude.where = { [Op.or]: [{ makeId }, { isUniversal: true }] };
      }

      const baseInclude = [
        { model: SubType, as: "subtype" },
        { model: Type },
        { model: DeviceInfo, as: "info" },
        {
          model: Type,
          as: "types",
          through: { attributes: [] },
          required: false,
        },
        {
          model: SubType,
          as: "subtypes",
          through: { attributes: [] },
          required: false,
        },
        compatInclude,
      ];

      const devices = await Device.findAndCountAll({
        where: baseWhere,
        limit,
        offset,
        include: baseInclude,
        distinct: true,
        subQuery: false,
      });

      const todayStr = new Date().toISOString().slice(0, 10);
      devices.rows.forEach((d) => {
        const v = d.dataValues;
        if (v.expiryDate) {
          const ms = new Date(v.expiryDate) - new Date(todayStr);
          v.daysToExpire = Math.floor(ms / 86400000);
        } else {
          v.daysToExpire = null;
        }
      });

      const deviceIds = devices.rows.map((d) => d.id);
      let translations = [];
      if (deviceIds.length > 0) {
        translations = await Translation.findAll({
          where: {
            key: {
              [Op.or]: deviceIds.map((id) => ({ [Op.like]: `device_${id}.%` })),
            },
          },
        });
      }
      const translatedSpecs = {};
      translations.forEach((t) => {
        const keyParts = t.key.split(".");
        const deviceId = keyParts[0].replace("device_", "");
        const section = keyParts[1];
        const optionIdx = keyParts[2];
        const field = keyParts[3];
        const valueIdx = keyParts[4];

        if (!translatedSpecs[deviceId]) translatedSpecs[deviceId] = {};

        if (section === "info") {
          if (!translatedSpecs[deviceId].info)
            translatedSpecs[deviceId].info = [];
          if (!translatedSpecs[deviceId].info[optionIdx]) {
            translatedSpecs[deviceId].info[optionIdx] = {
              title: {},
              description: {},
            };
          }
          translatedSpecs[deviceId].info[optionIdx][field][t.lang] = t.text;
        } else if (section === "option") {
          if (!translatedSpecs[deviceId].options)
            translatedSpecs[deviceId].options = [];
          if (!translatedSpecs[deviceId].options[optionIdx]) {
            translatedSpecs[deviceId].options[optionIdx] = {
              name: {},
              values: [],
            };
          }
          if (field === "name") {
            translatedSpecs[deviceId].options[optionIdx].name[t.lang] = t.text;
          } else if (field === "value" && valueIdx !== undefined) {
            if (
              !translatedSpecs[deviceId].options[optionIdx].values[valueIdx]
            ) {
              translatedSpecs[deviceId].options[optionIdx].values[valueIdx] =
                {};
            }
            translatedSpecs[deviceId].options[optionIdx].values[valueIdx][
              t.lang
            ] = t.text;
          }
        } else {
          if (!translatedSpecs[deviceId][section])
            translatedSpecs[deviceId][section] = {};
          translatedSpecs[deviceId][section][t.lang] = t.text;
        }
      });
      devices.rows.forEach((d) => {
        d.dataValues.translations = translatedSpecs[d.id] || {};
      });

      const whereNoSubtype = { ...baseWhere };
      if (whereNoSubtype[Op.and]) {
        whereNoSubtype[Op.and] = whereNoSubtype[Op.and].filter((cond) => {
          return (
            !cond[Op.or] ||
            !cond[Op.or].some((x) => x.subtypeId || x["$subtypes.id$"])
          );
        });
        if (whereNoSubtype[Op.and].length === 0) delete whereNoSubtype[Op.and];
      }

      const primarySubtypes = await Device.findAll({
        where: whereNoSubtype,
        include: stripAttrsDeep(baseInclude),
        attributes: [
          [col("device.subtypeId"), "subtypeId"],
          [fn("COUNT", fn("DISTINCT", col("device.id"))), "count"],
        ],
        group: [col("device.subtypeId")],
        having: literal('"device"."subtypeId" IS NOT NULL'),
        raw: true,
      });

      const m2mSubtypes = await Device.findAll({
        where: whereNoSubtype,
        include: [
          ...stripAttrsDeep(baseInclude).filter((i) => i.as !== "subtypes"),
          {
            model: SubType,
            as: "subtypes",
            through: { attributes: [] },
            required: true,
            attributes: [],
          },
        ],
        attributes: [
          [col("subtypes.id"), "id"],
          [fn("COUNT", fn("DISTINCT", col("device.id"))), "count"],
        ],
        group: [col("subtypes.id")],
        raw: true,
      });

      const subtypeCounts = new Map();

      for (const r of primarySubtypes) {
        const id = Number(r.subtypeId);
        const c = Number(r.count || 0);
        if (id) subtypeCounts.set(id, (subtypeCounts.get(id) || 0) + c);
      }

      for (const r of m2mSubtypes) {
        const id = Number(r.id);
        const c = Number(r.count || 0);
        if (id) subtypeCounts.set(id, (subtypeCounts.get(id) || 0) + c);
      }

      const subtypeIds = Array.from(subtypeCounts.keys());
      let allSubtypes = [];
      if (subtypeIds.length) {
        allSubtypes = await SubType.findAll({
          where: {
            id: { [Op.in]: subtypeIds },
            ...(typeId != null ? { typeId } : {}),
          },
          order: [
            ["displayOrder", "ASC"],
            ["id", "ASC"],
          ],
        });
      }

      const subtypesFacet = allSubtypes.length
        ? allSubtypes.map((s) => ({
            id: s.id,
            name: s.name,
            typeId: s.typeId,
            displayOrder: s.displayOrder,
            count: subtypeCounts.get(s.id) || 0,
          }))
        : [];

      const whereNoBrand = { ...baseWhere };
      if (whereNoBrand.brandId != null) delete whereNoBrand.brandId;

      const brandsRows = await Device.findAll({
        where: whereNoBrand,
        include: stripAttrsDeep(baseInclude),
        attributes: [
          [col("device.brandId"), "brandId"],
          [fn("COUNT", fn("DISTINCT", col("device.id"))), "count"],
        ],
        group: [col("device.brandId")],
        having: literal('"device"."brandId" IS NOT NULL'),
        raw: true,
      });

      const brandsFacet = brandsRows
        .map((r) => ({ id: Number(r.brandId), count: Number(r.count || 0) }))
        .filter((b) => b.id);

      return res.json({
        rows: devices.rows,
        count: devices.count,
        facets: {
          subtypes: subtypesFacet,
          brands: brandsFacet,
        },
      });
    } catch (error) {
      console.error("❌ Ошибка filter:", error);
      return res.status(500).json({ message: "Ошибка фильтра" });
    }
  }

    async adjustStock(req, res) {
    try {
      const { id } = req.params;
      const { delta, selectedOptions } = req.body;

      const deltaInt = parseInt(delta, 10);
      if (!id || !Number.isInteger(deltaInt) || deltaInt === 0) {
        return res
          .status(400)
          .json({ message: "Нужны id и целочисленный delta (не 0)" });
      }

      const device = await Device.findByPk(id);
      if (!device) return res.status(404).json({ message: "Товар не найден" });

      const variants = await DeviceVariant.findAll({ where: { deviceId: id } });
      if (variants.length > 0) {
        if (!selectedOptions || Object.keys(selectedOptions).length === 0) {
          return res
            .status(400)
            .json({ message: "Нужно selectedOptions для варианта" });
        }

        const clean = Object.fromEntries(
          Object.entries(selectedOptions).map(([k, v]) => [k, getVal(v)])
        );
        const key = makeVariantKey(clean);

        const variant = variants.find((v) => v.key === key);
        if (!variant) {
          return res
            .status(400)
            .json({ message: "Такого варианта не существует" });
        }

        const newQty = (Number(variant.quantity) || 0) + deltaInt;
        if (newQty < 0) {
          return res
            .status(400)
            .json({ message: "Недостаточно остатка у выбранного варианта" });
        }

        variant.quantity = newQty;
        await variant.save();

        const totalQty = variants.reduce(
          (s, v) =>
            s + (Number(v.id === variant.id ? newQty : v.quantity) || 0),
          0
        );
        device.quantity = totalQty;
        await device.save();

        return res.json({ device, updatedVariant: variant });
      }

      let options = [];
      const raw = device.options;
      if (Array.isArray(raw)) options = raw;
      else if (typeof raw === "string") {
        try {
          options = JSON.parse(raw) || [];
        } catch {}
      } else if (raw && typeof raw === "object")
        options = Array.isArray(raw) ? raw : [];

      const applyToOptions = options.length > 0;

      if (applyToOptions) {
        if (!selectedOptions || Object.keys(selectedOptions).length === 0) {
          return res.status(400).json({
            message: "У этого товара есть опции. Укажи selectedOptions.",
          });
        }

        const [optName, sel] = Object.entries(selectedOptions)[0];
        const selValue = sel && typeof sel === "object" ? sel.value : sel;

        const opt = options.find((o) => o.name === optName);
        if (!opt) {
          return res
            .status(400)
            .json({ message: `Опция "${optName}" не найдена` });
        }

        const val = (opt.values || []).find((v) => v.value === selValue);
        if (!val) {
          return res.status(400).json({
            message: `Значение "${selValue}" в опции "${optName}" не найдено`,
          });
        }

        const newQty = (Number(val.quantity) || 0) + deltaInt;
        if (newQty < 0) {
          return res
            .status(400)
            .json({ message: "Недостаточно остатка по выбранной опции" });
        }
        val.quantity = newQty;

        const totalQty = options.reduce((sum, o) => {
          const add = Array.isArray(o.values)
            ? o.values.reduce((s, v) => s + (Number(v.quantity) || 0), 0)
            : 0;
          return sum + add;
        }, 0);

        device.options = options;
        device.quantity = totalQty;
        await device.save();
        return res.json(device);
      } else {
        const newQty = (Number(device.quantity) || 0) + deltaInt;
        if (newQty < 0) {
          return res.status(400).json({ message: "Недостаточно остатка" });
        }
        device.quantity = newQty;
        await device.save();
        return res.json(device);
      }
    } catch (e) {
      console.error("adjustStock error:", e);
      return res.status(500).json({ message: "Ошибка изменения остатков" });
    }
  }

  async search(req, res, next) {
    try {
      const { q } = req.query;
      if (!q)
        return res.status(400).json({ message: "Параметр поиска не указан" });

     const devices = await Device.findAll({
        where: { name: { [Op.iLike]: `%${q}%` } },
        order: [
          [literal(`CASE WHEN "name" ILIKE '${q}%' THEN 0 ELSE 1 END`), "ASC"],
          ["name", "ASC"],
        ],
      });

      const translations = await Translation.findAll({
        where: {
          key: {
            [Op.and]: [
              { [Op.like]: `device_%.name` },
              { [Op.notLike]: `%.option.%` },
            ],
          },
          text: { [Op.iLike]: `%${q}%` },
        },
        attributes: ["key", "lang", "text"],
      });

      const translationMap = {};
      translations.forEach(({ key, lang, text }) => {
        const deviceId = key.match(/\d+/)?.[0];
        if (!deviceId) return;

        if (!translationMap[deviceId]) translationMap[deviceId] = { name: {} };
        translationMap[deviceId].name[lang] = text;
      });

      const translatedDeviceIds = Object.keys(translationMap);

      const translatedDevices = await Device.findAll({
        where: { id: { [Op.in]: translatedDeviceIds } },
      });

      translatedDevices.forEach((device) => {
        device.dataValues.translations = translationMap[device.id] || {};
      });

      devices.forEach((device) => {
        device.dataValues.translations = translationMap[device.id] || {};
      });

      const allDevices = [...devices, ...translatedDevices].filter(
        (value, index, self) =>
          index === self.findIndex((d) => d.id === value.id)
      );

      return res.json(allDevices);
    } catch (error) {
      console.error("❌ Ошибка при поиске:", error);
      next(ApiError.internal("Ошибка сервера при выполнении поиска"));
    }
  }

  async checkStock(req, res) {
    try {
      const { deviceId, quantity, selectedOptions } = req.body;
      const device = await Device.findByPk(deviceId, {
        include: [{ model: DeviceVariant, as: "variants" }],
      });

      if (!device)
        return res.json({ status: "error", message: "Товар не найден" });
      if (Array.isArray(device.variants) && device.variants.length) {
        if (!selectedOptions || !Object.keys(selectedOptions).length) {
          return res.json({ status: "error", message: "Нужно выбрать опции" });
        }
        const key = makeVariantKey(selectedOptions);
        const variant = device.variants.find((v) => v.key === key);
        if (!variant)
          return res.json({
            status: "error",
            message: "Такой вариант недоступен",
          });

        const available = Number(variant.quantity) || 0;
        if (available < Number(quantity)) {
          return res.json({
            status: "error",
            message: "Недостаточно на складе",
            quantity: available,
          });
        }
        return res.json({
          status: "success",
          message: "Товар в наличии",
          quantity: available,
          variantId: variant.id,
        });
      }

      let availableQuantity = Number(device.quantity) || 0;
      let parsedOptions = [];
      if (typeof device.options === "string")
        parsedOptions = JSON.parse(device.options);
      else if (Array.isArray(device.options)) parsedOptions = device.options;

      if (parsedOptions.length > 0 && selectedOptions) {
        for (const [optionName, selectedValue] of Object.entries(
          selectedOptions
        )) {
          const option = parsedOptions.find((opt) => opt.name === optionName);
          if (!option) continue;
          const value = option.values.find(
            (val) => val.value === selectedValue.value
          );
          if (!value)
            return res.json({
              status: "error",
              message: `Опция ${selectedValue.value} не найдена.`,
            });
          availableQuantity = Number(value.quantity) || 0;
        }
      }

      if (availableQuantity < Number(quantity)) {
        return res.json({
          status: "error",
          message: "Недостаточно на складе",
          quantity: availableQuantity,
        });
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
