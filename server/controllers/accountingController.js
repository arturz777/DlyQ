const { Op } = require("sequelize");
const { Order, Courier } = require("../models/models");

const COMMISSION_SHOP_FLAT = 0.3;

const DONE_STATUSES = ["Delivered", "Completed"];

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

  if (from || to) {
    return { start: from, end: to };
  }

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

class AccountingController {
  async getCourierAccounting(req, res) {
    try {
      const { start, end } = rangeFromQuery(req.query);

      const where = {
        courierId: { [Op.ne]: null },
        status: { [Op.in]: DONE_STATUSES },
      };

      if (start)
        where.updatedAt = { ...(where.updatedAt || {}), [Op.gte]: start };
      if (end) where.updatedAt = { ...(where.updatedAt || {}), [Op.lt]: end };

      const orders = await Order.findAll({
        where,
        attributes: [
          "id",
          "courierId",
          "orderType",
          "courierFee",
          "courierCommission",
          "updatedAt",
        ],
        raw: true,
      });

      const courierIds = Array.from(
        new Set(orders.map((o) => o.courierId)),
      ).filter(Boolean);

      const couriers = await Courier.findAll({
        where: { id: { [Op.in]: courierIds } },
        attributes: ["id", "name"],
        raw: true,
      });

      const courierMap = new Map(couriers.map((c) => [Number(c.id), c]));

      const byCourier = new Map();

      for (const o of orders) {
        const cid = Number(o.courierId);
        if (!byCourier.has(cid)) {
          byCourier.set(cid, {
            courierId: cid,
            courierName: courierMap.get(cid)?.name || `Courier #${cid}`,
            ordersCount: 0,
            payoutTotal: 0,
            commissionTotal: 0,
          });
        }

        const row = byCourier.get(cid);
        row.ordersCount += 1;

        const payout = Number(o.courierFee || 0);
        row.payoutTotal += payout;

        if (o.orderType === "parcel") {
          row.commissionTotal += Number(o.courierCommission || 0);
        } else {
          row.commissionTotal += COMMISSION_SHOP_FLAT;
        }
      }

      const items = Array.from(byCourier.values()).map((x) => ({
        courierId: x.courierId,
        courierName: x.courierName,
        ordersCount: x.ordersCount,
        sumDeliveryPrice: Number(x.payoutTotal.toFixed(2)),
        sumCourierFee: Number(x.payoutTotal.toFixed(2)),
        sumCommission: Number(x.commissionTotal.toFixed(2)),
      }));

      const totals = items.reduce(
        (acc, x) => {
          acc.ordersCount += x.ordersCount;
          acc.sumCourierFee += x.sumCourierFee;
          acc.sumCommission += x.sumCommission;
          return acc;
        },
        { ordersCount: 0, sumCourierFee: 0, sumCommission: 0 },
      );

      totals.sumCourierFee = Number(totals.sumCourierFee.toFixed(2));
      totals.sumCommission = Number(totals.sumCommission.toFixed(2));

      return res.json({
        range: { start, end },
        items,
        totals,
      });
    } catch (e) {
      console.error("getCourierAccounting error:", e);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }
}

module.exports = new AccountingController();
