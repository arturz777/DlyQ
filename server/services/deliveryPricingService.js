const { Config } = require("../models/models");

const DEFAULTS = {
  baseCost: 2,
  perKm: 0.5,
  discountStepEur: 30,
  discountAmount: 2,
  minCost: 0,
};

async function getDeliveryPricing() {
  const row = await Config.findOne({
    where: { key: "delivery_pricing" },
    raw: true,
  }).catch(() => null);
  const v = row?.value && typeof row.value === "object" ? row.value : {};
  return { ...DEFAULTS, ...v };
}

function calculateDeliveryBase(distanceKm, pricing) {
  const base = Number(pricing.baseCost || 0);
  const perKm = Number(pricing.perKm || 0);
  const cost = base + Number(distanceKm || 0) * perKm;
  return Number(cost.toFixed(2));
}

function calculateDeliveryCost(totalPrice, distanceKm, pricing) {
  const base = calculateDeliveryBase(distanceKm, pricing);

  const step = Number(pricing.discountStepEur || 0);
  const disc = Number(pricing.discountAmount || 0);

  const discount =
    step > 0 ? Math.floor(Number(totalPrice || 0) / step) * disc : 0;
  const min = Number(pricing.minCost ?? 0);

  const cost = Math.max(min, base - discount);
  return Number(cost.toFixed(2));
}

module.exports = {
  getDeliveryPricing,
  calculateDeliveryBase,
  calculateDeliveryCost,
};
