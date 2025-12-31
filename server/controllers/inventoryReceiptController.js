const sequelize = require("../db");
const {
  InventoryReceipt,
  InventoryReceiptItem,
  Device,
  DeviceVariant,
} = require("../models/models");

const parseSel = (it) => {
  const tryJson = (x) => {
    if (!x) return null;
    if (typeof x === "string") {
      try {
        return JSON.parse(x);
      } catch {
        return null;
      }
    }
    return x;
  };

  let sel =
    tryJson(it.selectedOptions) ||
    tryJson(it.selected) ||
    tryJson(it.meta) ||
    null;

  if (!sel && it.optionName && it.optionValue != null) {
    sel = { [it.optionName]: it.optionValue };
  }

  return sel && typeof sel === "object" ? sel : null;
};

const normVal = (x) =>
  x && typeof x === "object" && "value" in x ? x.value : x;

const normalizeInt = (v) =>
  v === null || v === undefined || v === "" ? null : Number(v);

class InventoryReceiptController {
  async create(req, res) {
    const { receiptAt, supplier, note, items = [] } = req.body || {};

    const kindRaw = (req.body.kind || "IN").toString().toUpperCase();
    const kind = kindRaw === "OUT" ? "OUT" : "IN";
    const sign = kind === "OUT" ? -1 : 1;

    const when = receiptAt ? new Date(receiptAt) : new Date();

    const pad = (x) => String(x).padStart(2, "0");
    const dayKey = `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(
      when.getDate()
    )}`;

    const createdBy = req.user?.id || null;

    const t = await sequelize.transaction();
    try {
      const where = { dayKey, kind };
      if (createdBy) where.createdBy = createdBy;

      let receipt = await InventoryReceipt.findOne({
        where,
        order: [["id", "DESC"]],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!receipt) {
        receipt = await InventoryReceipt.create(
          {
            kind,
            dayKey,
            receiptAt: when,
            supplier: supplier || null,
            note: note || null,
            createdBy,
          },
          { transaction: t }
        );
      } else {
        const patch = {};
        if (supplier && !receipt.supplier) patch.supplier = supplier;
        if (note && !receipt.note) patch.note = note;

        patch.receiptAt = when;

        await receipt.update(patch, { transaction: t });
      }

      for (const it of items) {
        const deviceId = normalizeInt(it.deviceId);
        const variantId = normalizeInt(it.variantId);
        const quantity = Number(it.quantity ?? 0);
        const inputPrice = Number(it.purchasePrice);
        const inputVat = it.purchaseHasVAT;
        const hasInputPrice = Number.isFinite(inputPrice) && inputPrice > 0;
        const hasInputVat = inputVat === true || inputVat === false;

        if (!deviceId || quantity <= 0) {
          throw new Error("Неверные данные item (deviceId/quantity)");
        }

        let effPrice = hasInputPrice ? inputPrice : undefined;
        let effVat = hasInputVat ? inputVat : undefined;

        if (effPrice === undefined || effVat === undefined) {
          if (variantId) {
            const v = await DeviceVariant.findByPk(variantId, {
              transaction: t,
            });
            if (!v) throw new Error(`Вариант не найден (id=${variantId})`);
            if (v.deviceId && Number(v.deviceId) !== Number(deviceId)) {
              throw new Error(
                `variantId=${variantId} не принадлежит deviceId=${deviceId}`
              );
            }

            if (effPrice === undefined && Number(v.purchasePrice) > 0) {
              effPrice = Number(v.purchasePrice);
            }
            if (effVat === undefined && v.purchaseHasVAT != null) {
              effVat = !!v.purchaseHasVAT;
            }
          }

          if (effPrice === undefined || effVat === undefined) {
            const d = await Device.findByPk(deviceId, { transaction: t });
            if (!d) throw new Error(`Товар не найден (id=${deviceId})`);

            if (effPrice === undefined && Number(d.purchasePrice) > 0) {
              effPrice = Number(d.purchasePrice);
            }
            if (effVat === undefined && d.purchaseHasVAT != null) {
              effVat = !!d.purchaseHasVAT;
            }
          }
        }

        const finalPrice = Number.isFinite(effPrice) ? effPrice : 0;
        const finalVat = effVat === true;

        await InventoryReceiptItem.create(
          {
            receiptId: receipt.id,
            deviceId,
            variantId: variantId || null,
            quantity,
            purchasePrice: finalPrice,
            purchaseHasVAT: finalVat,
          },
          { transaction: t }
        );

        const deltaQty = sign * quantity;

        if (variantId) {
          if (deltaQty < 0) {
            const v = await DeviceVariant.findByPk(variantId, {
              transaction: t,
              lock: t.LOCK.UPDATE,
            });
            const cur = Number(v?.quantity || 0);
            if (cur + deltaQty < 0) {
              throw new Error(
                `Недостаточно остатка у варианта (id=${variantId}). Сейчас: ${cur}`
              );
            }
          }

          await DeviceVariant.increment(
            { quantity: deltaQty },
            { where: { id: variantId }, transaction: t }
          );

          await Device.increment(
            { quantity: deltaQty },
            { where: { id: deviceId }, transaction: t }
          );

          if (kind === "IN") {
            const updateFields = {};
            if (hasInputPrice) updateFields.purchasePrice = finalPrice;
            if (hasInputVat) updateFields.purchaseHasVAT = finalVat;

            if (Object.keys(updateFields).length) {
              await DeviceVariant.update(updateFields, {
                where: { id: variantId },
                transaction: t,
              });
            }
          }
        } else {
          if (deltaQty < 0) {
            const d = await Device.findByPk(deviceId, {
              transaction: t,
              lock: t.LOCK.UPDATE,
            });
            const cur = Number(d?.quantity || 0);
            if (cur + deltaQty < 0) {
              throw new Error(
                `Недостаточно остатка у товара (id=${deviceId}). Сейчас: ${cur}`
              );
            }
          }

          await Device.increment(
            { quantity: deltaQty },
            { where: { id: deviceId }, transaction: t }
          );

          if (kind === "IN") {
            const updateFields = {};
            if (hasInputPrice) updateFields.purchasePrice = finalPrice;
            if (hasInputVat) updateFields.purchaseHasVAT = finalVat;

            if (Object.keys(updateFields).length) {
              await Device.update(updateFields, {
                where: { id: deviceId },
                transaction: t,
              });
            }
          }
        }
      }

      await t.commit();
      return res.json(receipt);
    } catch (e) {
      await t.rollback();
      console.error(e);
      return res.status(400).json({ message: e.message || "Create failed" });
    }
  }

  async list(req, res) {
    try {
      const limit = Math.min(Number(req.query.limit || 50), 200);
      const offset = Math.max(Number(req.query.offset || 0), 0);

      const rows = await InventoryReceipt.findAll({
        order: [["receiptAt", "DESC"]],
        limit,
        offset,
        attributes: [
          "id",
          "kind",
          "receiptAt",
          "supplier",
          "note",
        ],
        include: [
          {
            model: InventoryReceiptItem,
            as: "items",
            attributes: ["id", "quantity", "purchasePrice", "purchaseHasVAT"],
          },
        ],
      });

      return res.json(rows);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ message: "List failed" });
    }
  }

  async getOne(req, res) {
    try {
      const id = Number(req.params.id);
      const receipt = await InventoryReceipt.findByPk(id, {
        include: [
          {
            model: InventoryReceiptItem,
            as: "items",
            include: [
              { model: Device, as: "device" },
              { model: DeviceVariant, as: "variant" },
            ],
          },
        ],
      });

      if (!receipt) return res.status(404).json({ message: "Not found" });
      return res.json(receipt);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ message: "Get failed" });
    }
  }

  async remove(req, res) {
    const t = await sequelize.transaction();
    try {
      const id = Number(req.params.id);

      const receipt = await InventoryReceipt.findByPk(id, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!receipt) {
        await t.rollback();
        return res.status(404).json({ message: "Not found" });
      }

      const items = await InventoryReceiptItem.findAll({
        where: { receiptId: id },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      const kind =
        (receipt.kind || "IN").toString().toUpperCase() === "OUT"
          ? "OUT"
          : "IN";
      const sign = kind === "OUT" ? 1 : -1;

      for (const it of items) {
        const qty = Number(it.quantity || 0);
        const deltaQty = sign * qty;

        if (it.variantId) {
          await DeviceVariant.increment(
            { quantity: deltaQty },
            { where: { id: it.variantId }, transaction: t }
          );

          await Device.increment(
            { quantity: deltaQty },
            { where: { id: it.deviceId }, transaction: t }
          );
        } else {
          await Device.increment(
            { quantity: deltaQty },
            { where: { id: it.deviceId }, transaction: t }
          );
        }
      }

      await InventoryReceiptItem.destroy({
        where: { receiptId: id },
        transaction: t,
      });
      await InventoryReceipt.destroy({ where: { id }, transaction: t });

      await t.commit();
      return res.json({ ok: true });
    } catch (e) {
      await t.rollback();
      console.error(e);
      return res.status(500).json({ message: "Delete failed" });
    }
  }
}

module.exports = new InventoryReceiptController();
