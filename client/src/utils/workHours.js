export const WORK_HOURS = {
  weekdays: { start: 10, end: 22 },  // Пн-Пт 9:00-22:00
  saturday: { start: 10, end: 22 }, // Сб 10:00-22:00
  sunday: { start: 10, end: 22 },   // Вс 10:00-22:00
};

let forceClosed = false;

export const isShopOpenNow = () => {
  if (forceClosed) return false; // Принудительное закрытие

  const now = new Date();
  const hours = now.getHours();
  const day = now.getDay(); // 0 (Вс) - 6 (Сб)

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

  // 💡 Поддержка ночных смен (например, с 10:00 до 2:00)
  if (schedule.end < schedule.start) {
    return hours >= schedule.start || hours < schedule.end;
  } else {
    return hours >= schedule.start && hours < schedule.end;
  }
};

// Функции для управления принудительным закрытием
export const setShopForceClosed = (isClosed) => {
  forceClosed = isClosed;
  console.log(`Магазин ${isClosed ? 'принудительно закрыт' : 'открыт по расписанию'}`);
};

export const isShopForcedClosed = () => forceClosed;
