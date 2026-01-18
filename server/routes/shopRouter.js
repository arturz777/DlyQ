const Router = require("express");
const router = new Router();

const { Setting } = require("../models/models");

function timeToMinutes(v) {
  if (!v || typeof v !== "string") return null;
  const m = v.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function getTallinnNow() {
  const now = new Date();
  const talStr = now.toLocaleString("en-US", { timeZone: "Europe/Tallinn" });
  return new Date(talStr);
}

function pickShopSchedule(workHours, day) {
  if (!workHours) return null;
  if (day === 0) return workHours.sunday;
  if (day === 6) return workHours.saturday;
  return workHours.weekdays;
}

function isOpenBySchedule(schedule, nowMinutes) {
  if (!schedule) return true;

  const start = timeToMinutes(schedule.start);
  const end = timeToMinutes(schedule.end);

  if (start == null || end == null) return true;
  if (start === end) return false;

  if (end < start) return nowMinutes >= start || nowMinutes < end;

  return nowMinutes >= start && nowMinutes < end;
}

const SHOP_KEY = "shop";
const DEFAULT_WORK_HOURS = {
  weekdays: { start: "10:00", end: "22:00" },
  saturday: { start: "10:00", end: "22:00" },
  sunday: { start: "10:00", end: "14:00" },
};

router.get("/status", async (req, res, next) => {
  try {
    const row = await Setting.findByPk(SHOP_KEY);
    const cfg = row?.value || {};

    const forceClosed = !!cfg.forceClosed;
    const workHours = cfg.workHours || DEFAULT_WORK_HOURS;

    const now = getTallinnNow();
    const day = now.getDay();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const schedule = pickShopSchedule(workHours, day);
    const isOpen = !forceClosed && isOpenBySchedule(schedule, nowMinutes);

    res.json({
      isOpen,
      isStoreClosed: !isOpen,
      workHours,
      forceClosed,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
