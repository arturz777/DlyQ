function getTallinnLocalParts(date = new Date()) {
  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Tallinn",
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const parts = dtf.formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;

  const hour = Number(get("hour"));
  const minute = Number(get("minute"));

  const wd = get("weekday");
  const map = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const day = map[wd] ?? 1;

  return { day, minutesOfDay: hour * 60 + minute };
}

function parseHHMM(s) {
  const m = String(s || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]),
    mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function isActive(win, nowParts) {
  if (!win?.enabled) return false;

  const start = parseHHMM(win.start);
  const end = parseHHMM(win.end);
  if (start == null || end == null) return false;

  const t = nowParts.minutesOfDay;

  if (start <= end) return t >= start && t <= end;
  return t >= start || t <= end;
}

function getActivePeak(cfg, date = new Date()) {
  const windows = Array.isArray(cfg?.peakWindows) ? cfg.peakWindows : [];
  const now = getTallinnLocalParts(date);

  let best = { multiplier: 1, source: null };

  for (const w of windows) {
    if (!isActive(w, now)) continue;
    const m = Number(w.multiplier ?? 1) || 1;
    if (m > best.multiplier) best = { multiplier: m, source: w.id || null };
  }

  return best;
}

module.exports = { getActivePeak };
