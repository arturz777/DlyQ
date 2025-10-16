const { Setting } = require('../models/models');
const MAINT_KEY = 'maintenance';

async function getMaintenance(req, res, next) {
  try {
    const row = await Setting.findByPk(MAINT_KEY);
    const value = row?.value || { enabled: false };
    res.json({ enabled: !!value.enabled });
  } catch (e) { next(e); }
}

async function setMaintenance(req, res, next) {
  try {
    const enabled = !!(req.body && req.body.enabled);
    const value = { enabled, updatedAt: new Date().toISOString() };
    await Setting.upsert({ key: MAINT_KEY, value });
    res.json({ enabled });
  } catch (e) { next(e); }
}

module.exports = { getMaintenance, setMaintenance };
