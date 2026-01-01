async getFinance(req, res) {
    try {
      const courierId = req.user?.id;
      if (!courierId)
        return res.status(401).json({ message: "Вы не авторизованы." });

      const { from, to } = req.query;

      const where = { courierId, status: "Delivered" };
      if (from && to) {
        where.updatedAt = { [Op.gte]: new Date(from), [Op.lt]: new Date(to) };
      }

      const row = await Order.findOne({
        where,
        attributes: [
          [fn("COUNT", col("id")), "trips"],
          [fn("COALESCE", fn("SUM", col("courierFeeGross")), 0), "gross"],
          [fn("COALESCE", fn("SUM", col("courierCommission")), 0), "withheld"],
          [fn("COALESCE", fn("SUM", col("courierFee")), 0), "net"],
        ],
        raw: true,
      });

      return res.json({
        trips: Number(row?.trips || 0),
        gross: Number(Number(row?.gross || 0).toFixed(2)),
        withheld: Number(Number(row?.withheld || 0).toFixed(2)),
        net: Number(Number(row?.net || 0).toFixed(2)),
        bonuses: 0,
        tips: 0,
        acceptRate: 100, // пока заглушка
      });
    } catch (e) {
      console.error("getFinance error:", e);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }
