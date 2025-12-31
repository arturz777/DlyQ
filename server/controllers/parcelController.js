const { Order } = require("../models/models");
const {
  sendOrderToNextCourier,
} = require("../services/orderDistributionService");
const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const COMMISSION_RATE = 0.2;

const PARCEL_PRICING = {
  base: 3.0,
  perKm: 0.5,
  min: 3,
};

function round2(n) {
  return Number((Math.round(Number(n) * 100) / 100).toFixed(2));
}

function calcGross(distanceKm) {
  const d = Math.max(0, Number(distanceKm) || 0);
  const raw = PARCEL_PRICING.base + d * PARCEL_PRICING.perKm;
  return round2(Math.max(PARCEL_PRICING.min, raw));
}

function calcPayout(gross) {
  const g = round2(gross);
  const commission = round2(g * COMMISSION_RATE);
  const net = round2(g - commission);
  return { gross: g, commission, net, rate: COMMISSION_RATE };
}

function mustNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function calcBase(distance) {
  const baseCost = 2;
  const distanceCost = distance * 0.5;
  return Number((baseCost + distanceCost).toFixed(2));
}

class ParcelController {
  async quote(req, res) {
    try {
      const { pickupLat, pickupLng, deliveryLat, deliveryLng } = req.body;

      const aLat = mustNumber(pickupLat);
      const aLng = mustNumber(pickupLng);
      const bLat = mustNumber(deliveryLat);
      const bLng = mustNumber(deliveryLng);

      if ([aLat, aLng, bLat, bLng].some((x) => x == null)) {
        return res
          .status(400)
          .json({ message: "Координаты должны быть числами" });
      }

      const dist = distanceKm(aLat, aLng, bLat, bLng);

      const price = calcGross(dist);
      const payout = calcPayout(price);

      return res.json({
        distanceKm: Number(dist.toFixed(2)),
        price,
        courierFee: payout.net,
        courierFeeGross: payout.gross,
        courierCommission: payout.commission,
        courierCommissionRate: payout.rate,
      });
    } catch (e) {
      console.error("parcel quote error:", e);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async create(req, res) {
    try {
      const { paymentIntentId, formData, pickup, delivery, comment } = req.body;

      if (!paymentIntentId) {
        return res.status(400).json({ message: "paymentIntentId is required" });
      }

      const aLat = mustNumber(pickup?.lat);
      const aLng = mustNumber(pickup?.lng);
      const bLat = mustNumber(delivery?.lat);
      const bLng = mustNumber(delivery?.lng);

      const pickupAddress = String(pickup?.address || "").trim();
      const deliveryAddress = String(delivery?.address || "").trim();

      if ([aLat, aLng, bLat, bLng].some((x) => x == null)) {
        return res.status(400).json({ message: "Неверные координаты" });
      }
      if (!pickupAddress || !deliveryAddress) {
        return res.status(400).json({ message: "Нужны адреса A и B" });
      }

      const dist = distanceKm(aLat, aLng, bLat, bLng);

      const price = calcGross(dist);
      const payout = calcPayout(price);

      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (!pi || !pi.id)
        return res.status(400).json({ message: "PaymentIntent not found" });
      if ((pi.currency || "").toLowerCase() !== "eur") {
        return res.status(400).json({ message: "Unsupported currency" });
      }
      if (pi.status !== "succeeded") {
        return res
          .status(402)
          .json({ message: `Payment not completed: ${pi.status}` });
      }

      const expectedCents = Math.round(price * 100);
      if (pi.amount !== expectedCents) {
        return res.status(400).json({
          message: "Amount mismatch",
          expected: expectedCents,
          actual: pi.amount,
        });
      }

      if (Order.rawAttributes?.paymentIntentId) {
        const exists = await Order.findOne({
          where: { paymentIntentId: pi.id },
        }).catch(() => null);
        if (exists) {
          return res
            .status(409)
            .json({ message: "Order already exists", orderId: exists.id });
        }
      }

      const userId = req.user ? req.user.id : null;

      const orderDetails = [
        {
          name: "Доставка посылки",
          count: 1,
          price: 0,
          isParcelItem: true,
          pickupAddress,
          deliveryAddress,
        },
      ];

      const orderData = {
        orderType: "parcel",
        userId,
        sellerId: null,

        totalPrice: Number(price),
        deliveryPrice: Number(price),
        courierFee: Number(courierFee),

        status: "Waiting for courier",
        warehouseStatus: "none",
        courierId: null,

        pickupAddress,
        pickupLat: aLat,
        pickupLng: aLng,

        deliveryAddress,
        deliveryLat: bLat,
        deliveryLng: bLng,

        productName: "Доставка посылки",
        orderDetails: JSON.stringify(orderDetails),
        formData: JSON.stringify({
          ...(formData || {}),
          comment: comment || "",
        }),
      };

      if (Order.rawAttributes?.courierFeeGross)
        orderData.courierFeeGross = Number(payout.gross);

      if (Order.rawAttributes?.courierCommission)
        orderData.courierCommission = Number(payout.commission);

      if (Order.rawAttributes?.courierCommissionRate)
        orderData.courierCommissionRate = Number(payout.rate);

      if (Order.rawAttributes?.paymentIntentId)
        orderData.paymentIntentId = pi.id;
      if (Order.rawAttributes?.paymentStatus)
        orderData.paymentStatus = pi.status;
      if (Order.rawAttributes?.currency) orderData.currency = "EUR";
      if (Order.rawAttributes?.amountCents)
        orderData.amountCents = expectedCents;

      const order = await Order.create(orderData);

      try {
        await sendOrderToNextCourier(order);
      } catch (e) {
        console.error("sendOrderToNextCourier error:", e);
      }

      return res.status(201).json(order);
    } catch (e) {
      console.error("parcel create error:", e);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }
}

module.exports = new ParcelController();
