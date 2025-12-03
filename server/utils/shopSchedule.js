const WORK_HOURS = {
  weekdays: { start: 10, end: 22 },
  saturday: { start: 10, end: 22 },
  sunday: { start: 10, end: 22 },
};

let forceClosed = false;

function isShopOpenNow() {
  if (forceClosed) return false;

  const now = new Date();
  const hours = now.getHours();
  const day = now.getDay();

  let schedule;
  switch (day) {
    case 0:
      schedule = WORK_HOURS.sunday;
      break;
    case 6:
      schedule = WORK_HOURS.saturday;
      break;
    default:
      schedule = WORK_HOURS.weekdays;
  }

  if (schedule.end < schedule.start) {
    return hours >= schedule.start || hours < schedule.end;
  } else {
    return hours >= schedule.start && hours < schedule.end;
  }
}

function setShopForceClosed(isClosed) {
  forceClosed = isClosed;
  console.log(
    `Магазин ${isClosed ? "принудительно закрыт" : "открыт по расписанию"}`
  );
}

function isShopForcedClosed() {
  return forceClosed;
}

module.exports = {
  WORK_HOURS,
  isShopOpenNow,
  setShopForceClosed,
  isShopForcedClosed,
};
