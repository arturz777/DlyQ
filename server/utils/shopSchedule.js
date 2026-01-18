const { Setting } = require("../models/models");

const SHOP_KEY = "shop";

const DEFAULT_WORK_HOURS = {
  weekdays: { start: "10:00", end: "22:00" },
  saturday: { start: "10:00", end: "22:00" },
  sunday: { start: "10:00", end: "22:00" },
};

function getTallinnNow() {
  const now = new Date();
  const talStr = now.toLocaleString("en-US", { timeZone: "Europe/Tallinn" });
  return new Date(talStr);
}

function timeToMinutes(v) {
  if (!v || typeof v !== "string") return null;
  const m = v.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function pickSchedule(workHours, day) {
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

async function getShopSettings() {
  const row = await Setting.findByPk(SHOP_KEY);
  const v = row?.value || {};
  const workHours = { ...DEFAULT_WORK_HOURS, ...(v.workHours || {}) };
  const forceClosed = !!v.forceClosed;
  return { workHours, forceClosed };
}

async function isShopOpenNow() {
  const { workHours, forceClosed } = await getShopSettings();
  if (forceClosed) return false;

  const now = getTallinnNow();
  const day = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const schedule = pickSchedule(workHours, day);
  return isOpenBySchedule(schedule, nowMinutes);
}

module.exports = {
  DEFAULT_WORK_HOURS,
  getTallinnNow,
  isShopOpenNow,
  getShopSettings,
};
