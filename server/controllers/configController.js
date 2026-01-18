const { Setting } = require("../models/models");

const MAINT_KEY = "maintenance";
const SHOP_KEY = "shop";

const DEFAULT_SHOP = {
  forceClosed: false,
  workHours: {
    weekdays: { start: "10:00", end: "22:00" },
    saturday: { start: "10:00", end: "22:00" },
    sunday: { start: "10:00", end: "14:00" },
  },
};

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
};
