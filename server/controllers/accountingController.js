const { Op, fn, col, literal } = require("sequelize");
const { Order, Courier, Seller } = require("../models/models");
const { Setting, AccountingPayout } = require("../models/models");

const DONE_STATUSES = ["Delivered", "Completed"];

const COURIER_KEY = "courier";
const DEFAULT_SHOP_COMMISSION_FLAT = 0.3;

function parseISODateOnly(s) {
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

async function getShopCourierCommissionFlat() {
  const row = await Setting.findByPk(COURIER_KEY);
  const v = row?.value?.shopCommissionFlat;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : DEFAULT_SHOP_COMMISSION_FLAT;
}

function toDateStart(s) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function rangeFromQuery(q) {
  const from = q.from ? toDateStart(q.from) : null;
  const to = q.to ? toDateStart(q.to) : null;

  const month = q.month ? Number(q.month) : null;
  const year = q.year ? Number(q.year) : null;

  if (!from && !to && month && year) {
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 1, 0, 0, 0));
    return { start, end };
  }

  if (from || to) return { start: from, end: to };

  const now = new Date();
  const day = now.getUTCDay();
  const diffToMon = (day + 6) % 7;
  const start = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - diffToMon,
      0,
      0,
      0,
    ),
  );
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  return { start, end };
}

function applyRange(where, start, end) {
  if (start) where.updatedAt = { ...(where.updatedAt || {}), [Op.gte]: start };
  if (end) where.updatedAt = { ...(where.updatedAt || {}), [Op.lt]: end };
}

class AccountingController {
  async getPayoutStatuses(req, res) {
    try {
      const kind = req.query.kind;
      const from = parseISODateOnly(req.query.from);
      const to = parseISODateOnly(req.query.to);

      if (!["courier", "seller"].includes(kind)) {
        return res.status(400).json({ message: "Bad kind" });
      }
      if (!from || !to) {
        return res.status(400).json({ message: "Bad from/to" });
      }

      const rows = await AccountingPayout.findAll({
        where: {
          kind,
          rangeStart: from,
          rangeEnd: to,
        },
        attributes: ["entityId", "isPaid", "paidAt", "paidBy"],
        raw: true,
      });

      const map = {};
      for (const r of rows) map[String(r.entityId)] = !!r.isPaid;

      return res.json({ kind, from, to, map, rows });
    } catch (e) {
      console.error("getPayoutStatuses error:", e);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async setPayoutStatus(req, res) {
    try {
      const kind = req.body.kind;
      const entityId = Number(req.body.entityId);
      const from = parseISODateOnly(req.body.from);
      const to = parseISODateOnly(req.body.to);
      const isPaid = !!req.body.isPaid;

      if (!["courier", "seller"].includes(kind)) {
        return res.status(400).json({ message: "Bad kind" });
      }
      if (!entityId || entityId < 1) {
        return res.status(400).json({ message: "Bad entityId" });
      }
      if (!from || !to) {
        return res.status(400).json({ message: "Bad from/to" });
      }

      const patch = {
        isPaid,
        paidAt: isPaid ? new Date() : null,
        paidBy: isPaid ? req.user?.id || null : null,
      };

      const [row, created] = await AccountingPayout.findOrCreate({
        where: { kind, entityId, rangeStart: from, rangeEnd: to },
        defaults: { kind, entityId, rangeStart: from, rangeEnd: to, ...patch },
      });

      if (!created) {
        await row.update(patch);
      }

      return res.json({
        ok: true,
        kind,
        entityId,
        from,
        to,
        isPaid: !!row.isPaid,
        paidAt: row.paidAt || null,
      });
    } catch (e) {
      console.error("setPayoutStatus error:", e);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async getCourierAccounting(req, res) {
    try {
      const { start, end } = rangeFromQuery(req.query);

      const where = {
        courierId: { [Op.ne]: null },
        status: { [Op.in]: DONE_STATUSES },
      };
      applyRange(where, start, end);

      const row = await Setting.findByPk(COURIER_KEY);
      const shopPercent = Number(row?.value?.shopCommissionPercent ?? 10);
      const fallbackRate = Number.isFinite(shopPercent) ? shopPercent / 100 : 0;

      const effectivePrice = literal(
        `COALESCE("order"."deliveryPriceOverride", "order"."deliveryPrice")`,
      );

      const rateExpr = literal(
        `COALESCE("order"."courierCommissionRate", ${fallbackRate})`,
      );

      const commissionExpr = literal(
        `(COALESCE("order"."deliveryPriceOverride", "order"."deliveryPrice") * COALESCE("order"."courierCommissionRate", ${fallbackRate}))`,
      );

      const bonusExpr = literal(`COALESCE("order"."courierBonus", 0)`);

      const payoutExpr = literal(
        `((COALESCE("order"."deliveryPriceOverride", "order"."deliveryPrice") - ` +
          `(COALESCE("order"."deliveryPriceOverride", "order"."deliveryPrice") * COALESCE("order"."courierCommissionRate", ${fallbackRate}))) + ` +
          `COALESCE("order"."courierBonus", 0))`,
      );

      const rows = await Order.findAll({
        where,
        attributes: [
          "courierId",
          [fn("COUNT", col("order.id")), "ordersCount"],
          [fn("COALESCE", fn("SUM", effectivePrice), 0), "sumCourierFeeGross"],
          [fn("COALESCE", fn("SUM", commissionExpr), 0), "sumCommission"],
          [fn("COALESCE", fn("SUM", bonusExpr), 0), "sumBonus"],
          [fn("COALESCE", fn("SUM", payoutExpr), 0), "sumCourierPayout"],
        ],
        include: [
          {
            model: Courier,
            attributes: ["id", "name", "iban"],
            required: false,
          },
        ],
        group: ["order.courierId", "courier.id"],
        raw: true,
      });

      const items = (rows || []).map((r) => ({
        courierId: Number(r.courierId),
        courierName: r["courier.name"] || `Courier #${r.courierId}`,
        iban: r["courier.iban"] || null,
        ordersCount: Number(r.ordersCount || 0),
        sumCourierFeeGross: Number(
          Number(r.sumCourierFeeGross || 0).toFixed(2),
        ),
        sumCommission: Number(Number(r.sumCommission || 0).toFixed(2)),
        sumBonus: Number(Number(r.sumBonus || 0).toFixed(2)),
        sumCourierPayout: Number(Number(r.sumCourierPayout || 0).toFixed(2)),
      }));

      const totals = items.reduce(
        (acc, x) => {
          acc.ordersCount += x.ordersCount;
          acc.sumCourierFeeGross += x.sumCourierFeeGross;
          acc.sumCommission += x.sumCommission;
          acc.sumBonus += x.sumBonus;
          acc.sumCourierPayout += x.sumCourierPayout;
          return acc;
        },
        {
          ordersCount: 0,
          sumCourierFeeGross: 0,
          sumCommission: 0,
          sumBonus: 0,
          sumCourierPayout: 0,
        },
      );

      Object.keys(totals).forEach((k) => {
        if (k !== "ordersCount")
          totals[k] = Number(Number(totals[k]).toFixed(2));
      });

      return res.json({ range: { start, end }, items, totals });
    } catch (e) {
      console.error("getCourierAccounting error:", e);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async getIncomeShop(req, res) {
    try {
      const { start, end } = rangeFromQuery(req.query);

      const where = {
        status: { [Op.in]: DONE_STATUSES },
        orderType: "shop",
        sellerId: null,
      };

      if (start)
        where.updatedAt = { ...(where.updatedAt || {}), [Op.gte]: start };
      if (end) where.updatedAt = { ...(where.updatedAt || {}), [Op.lt]: end };

      const row = await Order.findOne({
        where,
        attributes: [
          [fn("COUNT", col("id")), "ordersCount"],
          [fn("COALESCE", fn("SUM", col("totalPrice")), 0), "sumTotal"],
          [fn("COALESCE", fn("SUM", col("deliveryPrice")), 0), "sumDelivery"],
        ],
        raw: true,
      });

      const ordersCount = Number(row?.ordersCount || 0);
      const sumTotal = Number(row?.sumTotal || 0);
      const sumDelivery = Number(row?.sumDelivery || 0);
      const sumGoods = sumTotal - sumDelivery;

      return res.json({
        range: { start, end },
        ordersCount,
        sumTotal: Number(sumTotal.toFixed(2)),
        sumDelivery: Number(sumDelivery.toFixed(2)),
        sumGoods: Number(sumGoods.toFixed(2)),
      });
    } catch (e) {
      console.error("getIncomeShop error:", e);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async getIncomeSellers(req, res) {
    try {
      const { start, end } = rangeFromQuery(req.query);

      const where = {
        status: { [Op.in]: DONE_STATUSES },
        sellerId: { [Op.ne]: null },
      };
      if (start)
        where.updatedAt = { ...(where.updatedAt || {}), [Op.gte]: start };
      if (end) where.updatedAt = { ...(where.updatedAt || {}), [Op.lt]: end };

      const rows = await Order.findAll({
        where,
        attributes: [
          "sellerId",
          [fn("COUNT", col("order.id")), "ordersCount"],
          [fn("COALESCE", fn("SUM", col("totalPrice")), 0), "sumTotal"],
          [fn("COALESCE", fn("SUM", col("deliveryPrice")), 0), "sumDelivery"],
          [fn("COALESCE", fn("SUM", col("courierFee")), 0), "sumCourierFee"],
          [
            fn("COALESCE", fn("SUM", col("courierCommission")), 0),
            "sumCourierCommission",
          ],

          [
            fn(
              "COALESCE",
              fn(
                "SUM",
                literal(`("order"."totalPrice" - "order"."deliveryPrice")`),
              ),
              0,
            ),
            "sumGoods",
          ],

          [
            fn(
              "COALESCE",
              fn(
                "SUM",
                literal(
                  `("order"."totalPrice" - "order"."deliveryPrice") * (COALESCE("seller"."commission_percent", 20) / 100.0)`,
                ),
              ),
              0,
            ),
            "sumSellerCommission",
          ],
        ],
        include: [
          {
            model: Seller,
            attributes: ["id", "name", "commissionPercent", "iban"],
            required: false,
          },
        ],
        group: ["sellerId", "seller.id"],
        raw: true,
      });

      const items = (rows || []).map((r) => {
        const sumTotal = Number(r.sumTotal || 0);
        const sumDelivery = Number(r.sumDelivery || 0);
        const sumGoods = Number(r.sumGoods || sumTotal - sumDelivery || 0);

        const sumSellerCommission = Number(r.sumSellerCommission || 0);
        const toSeller = sumGoods - sumSellerCommission;

        return {
          sellerId: Number(r.sellerId),
          sellerName: r["seller.name"] || `Seller #${r.sellerId}`,
          iban: r["seller.iban"] || null,
          commissionPercent: Number(r["seller.commissionPercent"] ?? 20),
          ordersCount: Number(r.ordersCount || 0),
          sumTotal: Number(sumTotal.toFixed(2)),
          sumDelivery: Number(sumDelivery.toFixed(2)),
          sumGoods: Number(sumGoods.toFixed(2)),
          sumSellerCommission: Number(sumSellerCommission.toFixed(2)),
          sumToSeller: Number(toSeller.toFixed(2)),
          sumCourierFee: Number(Number(r.sumCourierFee || 0).toFixed(2)),
          sumCourierCommission: Number(
            Number(r.sumCourierCommission || 0).toFixed(2),
          ),
        };
      });

      return res.json({ range: { start, end }, items });
    } catch (e) {
      console.error("getIncomeSellers error:", e);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async getCourierIncomeOrders(req, res) {
    try {
      const { start, end } = rangeFromQuery(req.query);
      const courierId = Number(req.params.courierId);

      if (!courierId) return res.status(400).json({ message: "Bad courierId" });

      const where = {
        courierId,
        status: { [Op.in]: DONE_STATUSES },
      };
      if (start)
        where.updatedAt = { ...(where.updatedAt || {}), [Op.gte]: start };
      if (end) where.updatedAt = { ...(where.updatedAt || {}), [Op.lt]: end };

      const items = await Order.findAll({
        where,
        order: [["updatedAt", "DESC"]],
        attributes: [
          "id",
          "orderType",
          "sellerId",
          "totalPrice",
          "deliveryPrice",
          "courierFee",
          "courierCommission",
          "updatedAt",
        ],
        raw: true,
      });

      return res.json({ range: { start, end }, courierId, items });
    } catch (e) {
      console.error("getCourierIncomeOrders error:", e);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }
}

module.exports = new AccountingController();
