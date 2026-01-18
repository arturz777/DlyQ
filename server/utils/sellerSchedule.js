function getTallinnNow() {
  const now = new Date();
  const talStr = now.toLocaleString("en-US", { timeZone: "Europe/Tallinn" });
  return new Date(talStr);
}

function pickSchedule(workHours, day) {
  if (!workHours || typeof workHours !== "object") return null;

  switch (day) {
    case 0:
      return workHours.sunday || null;
    case 6:
      return workHours.saturday || null;
    default:
      return workHours.weekdays || null;
  }
}

function timeToMinutes(v) {
  if (!v || typeof v !== "string") return null;
  const m = v.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
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

function isSellerOpenNow(seller) {
  if (!seller) return false;
  if (seller.forceClosed) return false;

  const now = getTallinnNow();
  const day = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const schedule = pickSchedule(seller.workHours, day);
  return isOpenBySchedule(schedule, nowMinutes);
}

module.exports = { isSellerOpenNow };
