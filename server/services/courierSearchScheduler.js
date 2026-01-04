const { Op } = require("sequelize");
const { Order } = require("../models/models");
const { sendOrderToNextCourier } = require("./orderDistributionService");

const SEARCH_BEFORE_READY_SEC = 7 * 60;
const timers = new Map();

function parseProcessingTimeToSec(processingTime) {
  if (!processingTime) return 0;

  const s = String(processingTime).trim();
  const [value, unitRaw] = s.split(/\s+/);
  const num = parseInt(value, 10);
  const unit = (unitRaw || "").toLowerCase();

  if (!Number.isFinite(num)) return 0;
  if (unit.startsWith("min") || unit.startsWith("мин")) return num * 60;
  if (unit.startsWith("day") || unit.startsWith("д")) return num * 24 * 60 * 60;

  return 0;
}

function dispatchAtMs(order) {
  const startMs = order.processingStartTime
    ? new Date(order.processingStartTime).getTime()
    : Date.now();

  const durationSec = parseProcessingTimeToSec(order.processingTime);
  const readyAtMs = startMs + durationSec * 1000;

  return readyAtMs - SEARCH_BEFORE_READY_SEC * 1000;
}

function shouldStart(order, nowMs = Date.now()) {
  if (order.status === "Ready for pickup") return true;

  if (!order.processingTime || !order.processingStartTime) return true;

  return dispatchAtMs(order) <= nowMs;
}

function clearTimer(orderId) {
  const t = timers.get(orderId);
  if (t) clearTimeout(t);
  timers.delete(orderId);
}

async function scheduleCourierSearch(order, io) {
  if (!order?.id) return;

  clearTimer(order.id);

  const fresh = await Order.findByPk(order.id, {
    attributes: [
      "id",
      "status",
      "courierId",
      "offerCourierId",
      "offerExpiresAt",
      "processingTime",
      "processingStartTime",
    ],
  });
  if (!fresh) return;
  if (fresh.courierId) return;

  if (shouldStart(fresh)) {
    await sendOrderToNextCourier(fresh, { io });
    return;
  }

  const delay = Math.max(0, dispatchAtMs(fresh) - Date.now());
  const timeout = setTimeout(() => {
    sendOrderToNextCourier(fresh, { io }).catch((e) =>
      console.error("scheduleCourierSearch -> send error:", e)
    );
  }, delay);

  timers.set(fresh.id, timeout);
}

module.exports = {
  scheduleCourierSearch,
  shouldStart,
};
