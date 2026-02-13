const { Setting } = require("../models/models");

const MAINT_KEY = "maintenance";
const SHOP_KEY = "shop";
const DELIVERY_KEY = "delivery_pricing";
const COURIER_KEY = "courier";

const DEFAULT_COURIER = {
  shopCommissionPercent: 10,
  parcelCommissionPercent: 20,
};

const DEFAULT_SHOP = {
  forceClosed: false,
  workHours: {
    weekdays: { start: "10:00", end: "22:00" },
    saturday: { start: "10:00", end: "22:00" },
    sunday: { start: "10:00", end: "14:00" },
  },
};

const DEFAULT_DELIVERY = {
  baseCost: 2,
  perKm: 0.5,
  discountStepEur: 30,
  discountAmount: 2,
  minCost: 0,

  peakWindows: [
    {
      id: "lunch",
      enabled: true,
      start: "12:00",
      end: "15:00",
      multiplier: 1.2,
    },
    {
      id: "dinner",
      enabled: true,
      start: "17:00",
      end: "21:00",
      multiplier: 1.3,
    },
    {
      id: "special",
      enabled: false,
      start: "00:00",
      end: "23:59",
      multiplier: 1.0,
      note: "праздник",
    },
  ],
};

async function getCourierConfig(req, res, next) {
  try {
    const row = await Setting.findByPk(COURIER_KEY);
    const value = row?.value || DEFAULT_COURIER;
    res.json({ ...DEFAULT_COURIER, ...value });
  } catch (e) {
    next(e);
  }
}

async function setCourierConfig(req, res, next) {
  try {
    const row = await Setting.findByPk(COURIER_KEY);
    const prev = row?.value || DEFAULT_COURIER;

    const shopCommissionPercent = Number(
      String(
        req.body?.shopCommissionPercent ?? prev.shopCommissionPercent,
      ).replace(",", "."),
    );
    const parcelCommissionPercent = Number(
      String(
        req.body?.parcelCommissionPercent ?? prev.parcelCommissionPercent,
      ).replace(",", "."),
    );

    const value = {
      ...prev,
      shopCommissionPercent: Number.isFinite(shopCommissionPercent)
        ? shopCommissionPercent
        : prev.shopCommissionPercent,
      parcelCommissionPercent: Number.isFinite(parcelCommissionPercent)
        ? parcelCommissionPercent
        : prev.parcelCommissionPercent,
      updatedAt: new Date().toISOString(),
    };

    await Setting.upsert({ key: COURIER_KEY, value });
    res.json(value);
  } catch (e) {
    next(e);
  }
}

async function getDeliveryPricing(req, res, next) {
  try {
    const row = await Setting.findByPk(DELIVERY_KEY);
    const merged = { ...DEFAULT_DELIVERY, ...(row?.value || {}) };

    if (!Array.isArray(merged.peakWindows)) {
      merged.peakWindows = DEFAULT_DELIVERY.peakWindows;
    }

    return res.json(merged);
  } catch (e) {
    return next(e);
  }
}

async function setDeliveryPricing(req, res, next) {
  try {
    const row = await Setting.findByPk(DELIVERY_KEY);
    const prev = row?.value || DEFAULT_DELIVERY;

    const peakWindows = Array.isArray(req.body?.peakWindows)
      ? req.body.peakWindows.map((w) => ({
          id: String(w.id),
          enabled: !!w.enabled,
          start: w.start,
          end: w.end,
          multiplier: Number(String(w.multiplier).replace(",", ".")) || 1,
          note: w.note || "",
        }))
      : prev.peakWindows;

    const value = {
      ...prev,
      baseCost: Number(req.body?.baseCost ?? prev.baseCost),
      perKm: Number(req.body?.perKm ?? prev.perKm),
      discountStepEur: Number(
        req.body?.discountStepEur ?? prev.discountStepEur,
      ),
      discountAmount: Number(req.body?.discountAmount ?? prev.discountAmount),
      minCost: Number(req.body?.minCost ?? prev.minCost),
      peakWindows,
      updatedAt: new Date().toISOString(),
    };

    await Setting.upsert({ key: DELIVERY_KEY, value });
    res.json(value);
  } catch (e) {
    next(e);
  }
}

async function getShopConfig(req, res, next) {
  try {
    const row = await Setting.findByPk(SHOP_KEY);
    const value = row?.value || DEFAULT_SHOP;
    res.json({
      forceClosed: !!value.forceClosed,
      workHours: value.workHours || DEFAULT_SHOP.workHours,
    });
  } catch (e) {
    next(e);
  }
}

async function setShopConfig(req, res, next) {
  try {
    const row = await Setting.findByPk(SHOP_KEY);
    const prev = row?.value || DEFAULT_SHOP;

    const forceClosed =
      req.body?.forceClosed == null
        ? !!prev.forceClosed
        : !!req.body.forceClosed;

    const workHours =
      req.body?.workHours || prev.workHours || DEFAULT_SHOP.workHours;

    const value = {
      ...prev,
      forceClosed,
      workHours,
      updatedAt: new Date().toISOString(),
    };

    await Setting.upsert({ key: SHOP_KEY, value });

    res.json({ forceClosed: !!value.forceClosed, workHours: value.workHours });
  } catch (e) {
    next(e);
  }
}

async function getMaintenance(req, res, next) {
  try {
    const row = await Setting.findByPk(MAINT_KEY);
    const value = row?.value || { enabled: false };
    res.json({ enabled: !!value.enabled });
  } catch (e) {
    next(e);
  }
}

async function setMaintenance(req, res, next) {
  try {
    const enabled = !!(req.body && req.body.enabled);
    const value = { enabled, updatedAt: new Date().toISOString() };
    await Setting.upsert({ key: MAINT_KEY, value });
    res.json({ enabled });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  getMaintenance,
  setMaintenance,
  getShopConfig,
  setShopConfig,
  getDeliveryPricing,
  setDeliveryPricing,
  getCourierConfig,
  setCourierConfig,
};
