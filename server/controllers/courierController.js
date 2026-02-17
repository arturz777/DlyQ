const { Op, fn, col, literal } = require("sequelize");
const fetch = require("node-fetch");
const {
  Order,
  Courier,
  OrderDecline,
  Seller,
  User,
  Chat,
  ChatParticipant,
  Setting,
} = require("../models/models");
const {
  sendOrderToNextCourier,
} = require("../services/orderDistributionService");
const { scheduleCourierSearch } = require("../services/courierSearchScheduler");

const WAREHOUSE = {
  id: 0,
  name: "DlyQ Market",
  kind: "market",
  lat: 59.51372,
  lng: 24.828888,
};

const RADAR_STATUSES = ["Waiting for courier", "Ready for pickup"];

const MAX_VISIBLE_SEC = 60 * 60;

function parseHHMMtoMinutes(v) {
  if (!v) return null;
  const m = String(v)
    .trim()
    .match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

function inWindowMinutes(nowMin, startMin, endMin) {
  if (startMin == null || endMin == null) return false;
  if (startMin <= endMin) return nowMin >= startMin && nowMin <= endMin; // обычное окно
  return nowMin >= startMin || nowMin <= endMin; // через полночь
}

async function readDeliveryPricingValue() {
  const keys = ["delivery", "delivery_pricing", "deliveryPricing"];
  for (const key of keys) {
    const row = await Setting.findByPk(key, {
      attributes: ["value"],
      raw: true,
    });
    if (row?.value) return row.value;
  }
  return null;
}

async function buildHighDemandPayloadFromSettings(date = new Date()) {
  const t = getTallinnMinutesOfDay(date);

  const row = await Setting.findByPk("delivery_pricing", {
    attributes: ["value"],
    raw: true,
  });

  const v = row?.value || {};
  const windows = Array.isArray(v.peakWindows) ? v.peakWindows : [];

  let mult = 1;
  let source = null;

  for (const w of windows) {
    if (!w || !w.enabled) continue;

    const startMin = parseHHMMtoMinutes(w.start);
    const endMin = parseHHMMtoMinutes(w.end);
    if (!inWindowMinutes(t, startMin, endMin)) continue;

    const m = Number(w.multiplier || 1);
    if (Number.isFinite(m) && m > mult) {
      mult = m;
      source = w.id || "peak_window";
    }
  }

  return {
    highDemand: mult > 1,
    peakMultiplier: mult,
    peakSource: source,
  };
}

function getTallinnMinutesOfDay(date = new Date()) {
  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Tallinn",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });

  const parts = dtf.formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;

  const hh = Number(get("hour"));
  const mm = Number(get("minute"));
  return hh * 60 + mm;
}

function buildHighDemandPayload(date = new Date()) {
  const t = getTallinnMinutesOfDay(date);

  let mult = 1;

  const inRange = (start, end) => t >= start && t <= end;

  if (inRange(8 * 60, 10 * 60 + 30)) mult = Math.max(mult, 1.2);
  if (inRange(18 * 60, 22 * 60)) mult = Math.max(mult, 1.5);

  return {
    highDemand: mult > 1,
    peakMultiplier: mult,
    peakSource: mult > 1 ? "time_window" : null,
  };
}

function parseProcessingTimeToSec(processingTime) {
  if (!processingTime) return null;
  const s = String(processingTime).trim().toLowerCase();

  const m = s.match(
    /(\d+)\s*(d|day|days|д|дн|дня|дней|h|hr|hour|hours|ч|час|часа|часов|m|min|minute|minutes|м|мин|минут)?/,
  );
  if (!m) return null;

  const num = Number(m[1]);
  if (!num) return null;

  const unit = m[2] || "m";

  if (["d", "day", "days", "д", "дн", "дня", "дней"].includes(unit))
    return num * 24 * 60 * 60;
  if (["h", "hr", "hour", "hours", "ч", "час", "часа", "часов"].includes(unit))
    return num * 60 * 60;
  return num * 60;
}

function getPrepLeftSec(order, nowMs) {
  const durSec = parseProcessingTimeToSec(order?.processingTime);
  const startMs = order?.processingStartTime
    ? new Date(order.processingStartTime).getTime()
    : order?.updatedAt
      ? new Date(order.updatedAt).getTime()
      : order?.createdAt
        ? new Date(order.createdAt).getTime()
        : null;

  if (!durSec || !startMs) return null;
  const endMs = startMs + durSec * 1000;
  return Math.floor((endMs - nowMs) / 1000);
}

async function countNearOnlineCouriersMeters(
  pickupLat,
  pickupLng,
  nearRadiusKm,
  excludeCourierId,
) {
  const couriers = await Courier.findAll({
    where: {
      status: "online",
      currentLat: { [Op.ne]: null },
      currentLng: { [Op.ne]: null },
      ...(excludeCourierId ? { id: { [Op.ne]: excludeCourierId } } : {}),
    },
    attributes: ["id", "currentLat", "currentLng"],
    raw: true,
  });

  let count = 0;
  for (const c of couriers) {
    const d = haversineKm(
      Number(c.currentLat),
      Number(c.currentLng),
      Number(pickupLat),
      Number(pickupLng),
    );
    if (d <= nearRadiusKm) count++;
  }
  return count;
}

async function resolveSellerPickup(sellerId) {
  const s = await Seller.findByPk(sellerId, {
    attributes: ["id", "pickupLat", "pickupLng", "name", "kind"],
    raw: true,
  });
  return s || null;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function countNearOnlineCouriers(
  pickupLat,
  pickupLng,
  nearRadiusKm,
  excludeCourierId,
) {
  const couriers = await Courier.findAll({
    where: {
      status: "online",
      currentLat: { [Op.ne]: null },
      currentLng: { [Op.ne]: null },
      ...(excludeCourierId ? { id: { [Op.ne]: excludeCourierId } } : {}),
    },
    attributes: ["id", "currentLat", "currentLng"],
    raw: true,
  });

  let count = 0;
  for (const c of couriers) {
    const d = haversineKm(
      Number(c.currentLat),
      Number(c.currentLng),
      Number(pickupLat),
      Number(pickupLng),
    );
    if (d <= nearRadiusKm) count++;
  }
  return count;
}

async function resolvePickupPoint(order) {
  if (order.orderType === "parcel") {
    return {
      lat: order.pickupLat,
      lng: order.pickupLng,
    };
  }

  if (!order.sellerId) {
    return {
      lat: order.pickupLat ?? WAREHOUSE.lat,
      lng: order.pickupLng ?? WAREHOUSE.lng,
    };
  }

  const s = order.sellerId
    ? await Seller.findByPk(order.sellerId, {
        attributes: ["pickupLat", "pickupLng", "address"],
        raw: true,
      })
    : null;

  return {
    lat: order.pickupLat ?? s?.pickupLat ?? null,
    lng: order.pickupLng ?? s?.pickupLng ?? null,
  };
}

const PARCEL_FLOW = [
  "Accepted",
  "Arrived at pickup",
  "In transit",
  "Arrived at destination",
  "Delivered",
];

const PARCEL_STATUSES = new Set(PARCEL_FLOW);

const COURIER_ACTIVE_STATUSES = [
  "Waiting for courier",
  "Ready for pickup",
  "Picked up",
  "Accepted",
  "Arrived at pickup",
  "In transit",
  "Arrived at destination",
];

async function courierHasActiveOrder(courierId, excludeOrderId = null) {
  const where = {
    courierId,
    status: { [Op.in]: COURIER_ACTIVE_STATUSES },
  };
  if (excludeOrderId) where.id = { [Op.ne]: excludeOrderId };

  const active = await Order.findOne({
    where,
    attributes: ["id", "status"],
    raw: true,
  });

  return active;
}

function calcAcceptRate(sent, acc) {
  sent = Number(sent || 0);
  acc = Number(acc || 0);
  if (sent <= 0) return 100;
  return Math.max(0, Math.min(100, Math.floor((acc / sent) * 100)));
}

function buildCustomerName(u) {
  if (!u) return null;
  const parts = [];
  if (u.firstName) parts.push(u.firstName);
  if (u.lastName) parts.push(u.lastName);
  const full = parts.join(" ").trim();
  if (full) return full;
  if (u.email) return u.email;
  return null;
}

function canMoveParcel(from, to) {
  const i = PARCEL_FLOW.indexOf(from);
  return i !== -1 && PARCEL_FLOW[i + 1] === to;
}

function buildCourierName(user) {
  const parts = [];
  if (user.firstName) parts.push(user.firstName);
  if (user.lastName) parts.push(user.lastName);
  const full = parts.join(" ").trim();

  if (full) return full;
  if (user.email) return user.email;
  return `Courier #${user.id}`;
}

function safeParse(v, fallback) {
  if (v == null) return fallback;
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return fallback;
    }
  }
  if (typeof v === "object") return v;
  return fallback;
}

class CourierController {
  async getHighDemand(req, res) {
    try {
      const v = (await readDeliveryPricingValue()) || {};
      const windows = Array.isArray(v.peakWindows) ? v.peakWindows : [];

      const nowMin = getTallinnMinutesOfDay(new Date());

      let mult = 1;
      let source = null;

      for (const w of windows) {
        if (!w || !w.enabled) continue;

        const startMin = parseHHMMtoMinutes(w.start);
        const endMin = parseHHMMtoMinutes(w.end);
        if (!inWindowMinutes(nowMin, startMin, endMin)) continue;

        const m = Number(w.multiplier || 1);
        if (Number.isFinite(m) && m > mult) {
          mult = m;
          source = w.id || "peak_window";
        }
      }

      return res.json({
        highDemand: mult > 1,
        peakMultiplier: mult,
        peakSource: source,
      });
    } catch (e) {
      console.error("getHighDemand error:", e);
      return res.json({
        highDemand: false,
        peakMultiplier: 1,
        peakSource: null,
      });
    }
  }

  async adminSearchUsers(req, res) {
    try {
      const q = String(req.query?.query || "")
        .trim()
        .toLowerCase();

      const where = {};
      if (q) {
        where[Op.or] = [
          { email: { [Op.iLike]: `%${q}%` } },
          { phone: { [Op.iLike]: `%${q}%` } },
          { firstName: { [Op.iLike]: `%${q}%` } },
          { lastName: { [Op.iLike]: `%${q}%` } },
        ];
      }

      const users = await User.findAll({
        where,
        attributes: [
          "id",
          "email",
          "role",
          "firstName",
          "lastName",
          "phone",
          "isBlocked",
        ],
        order: [["id", "DESC"]],
        limit: 200,
        raw: true,
      });

      const ids = users.map((u) => u.id);
      const couriers = ids.length
        ? await Courier.findAll({
            where: { id: { [Op.in]: ids } },
            attributes: ["id", "name", "status", "iban", "expoPushToken"],
            raw: true,
          })
        : [];

      const courierMap = new Map(couriers.map((c) => [Number(c.id), c]));

      return res.json({
        items: users.map((u) => ({
          ...u,
          isBlocked: !!u.isBlocked,
          courier: courierMap.get(Number(u.id)) || null,
        })),
      });
    } catch (e) {
      console.error("adminSearchUsers error:", e);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async adminMakeCourier(req, res) {
    try {
      const userId = Number(req.params.userId);
      const user = await User.findByPk(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      user.role = "COURIER";
      await user.save();

      await Courier.findOrCreate({
        where: { id: userId },
        defaults: {
          id: userId,
          name: buildCourierName(user),
          status: "offline",
          offersSent: 0,
          offersAccepted: 0,
        },
      });

      return res.json({ ok: true });
    } catch (e) {
      console.error("adminMakeCourier error:", e);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async adminRemoveCourier(req, res) {
    try {
      const userId = Number(req.params.userId);
      const user = await User.findByPk(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      user.role = "USER";
      await user.save();

      await Courier.update(
        {
          status: "offline",
          expoPushToken: null,
          currentLat: null,
          currentLng: null,
        },
        { where: { id: userId } },
      );

      return res.json({ ok: true });
    } catch (e) {
      console.error("adminRemoveCourier error:", e);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async adminUpdateCourierProfile(req, res) {
    try {
      const userId = Number(req.params.userId);
      const { firstName, lastName, phone, iban } = req.body || {};

      const user = await User.findByPk(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      if (firstName != null) user.firstName = String(firstName || "").trim();
      if (lastName != null) user.lastName = String(lastName || "").trim();
      if (phone != null) user.phone = String(phone || "").trim();

      await user.save();

      const role = String(user.role || "").toUpperCase();
      if (role === "COURIER") {
        const [courier] = await Courier.findOrCreate({
          where: { id: userId },
          defaults: {
            id: userId,
            name: buildCourierName(user),
            status: "offline",
            offersSent: 0,
            offersAccepted: 0,
          },
        });

        if (iban != null) courier.iban = String(iban || "").trim();
        courier.name = buildCourierName(user);
        await courier.save();
      }

      return res.json({ ok: true });
    } catch (e) {
      console.error("adminUpdateCourierProfile error:", e);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async adminResetCourierPushToken(req, res) {
    try {
      const userId = Number(req.params.userId);

      await Courier.update({ expoPushToken: null }, { where: { id: userId } });

      return res.json({ ok: true });
    } catch (e) {
      console.error("adminResetCourierPushToken error:", e);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async adminToggleUserBlock(req, res) {
    try {
      const userId = Number(req.params.userId);
      const { isBlocked } = req.body || {};

      const user = await User.findByPk(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      user.isBlocked = !!isBlocked;
      await user.save();

      if (user.isBlocked) {
        await Courier.update({ status: "offline" }, { where: { id: userId } });
      }

      return res.json({ ok: true, isBlocked: user.isBlocked });
    } catch (e) {
      console.error("adminToggleUserBlock error:", e);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async selfPickCandidates(req, res) {
    try {
      const courierId = req.user?.id;
      if (!courierId)
        return res.status(401).json({ message: "Вы не авторизованы." });

      const ACCEPT_RADIUS_KM = 30;
      const NEAR_RADIUS_KM = 1;

      const courier = await Courier.findByPk(courierId, {
        attributes: ["id", "status", "currentLat", "currentLng"],
        raw: true,
      });

      if (!courier || courier.status !== "online") {
        return res.json({ candidates: [], reason: "offline" });
      }
      if (courier.currentLat == null || courier.currentLng == null) {
        return res.json({ candidates: [], reason: "no_geo" });
      }

      const busy = await courierHasActiveOrder(courierId);
      if (busy) {
        return res.json({
          candidates: [],
          reason: "busy",
          activeOrderId: busy.id,
        });
      }

      const freeOrders = await Order.findAll({
        where: {
          courierId: null,
          offerCourierId: null,
          status: { [Op.in]: RADAR_STATUSES },
          orderType: { [Op.ne]: "parcel" },
        },
        attributes: [
          "id",
          "sellerId",
          "status",
          "createdAt",
          "updatedAt",
          "processingTime",
          "processingStartTime",
        ],
        order: [["createdAt", "ASC"]],
        raw: true,
      });

      const nowMs = Date.now();
      const out = [];
      const bucketBySeller = new Map();

      for (const o of freeOrders) {
        const sid = o.sellerId == null ? 0 : Number(o.sellerId);

        const left = getPrepLeftSec(o, nowMs);

        const isReady =
          o.status === "Ready for pickup" || (left != null && left <= 0);

        const visible = isReady || left == null || left <= MAX_VISIBLE_SEC;
        if (!visible) continue;

        let b = bucketBySeller.get(sid);
        if (!b) {
          bucketBySeller.set(sid, { best: o, bestLeft: left, count: 1 });
          continue;
        }

        b.count += 1;

        const aLeft =
          b.best.status === "Ready for pickup" ? -1 : (b.bestLeft ?? 1e15);
        const bLeft = o.status === "Ready for pickup" ? -1 : (left ?? 1e15);

        if (bLeft < aLeft) {
          b.best = o;
          b.bestLeft = left;
        }
      }

      for (const [sellerId, pack] of bucketBySeller.entries()) {
        const order = pack.best;
        const ordersCount = pack.count;

        const s =
          Number(sellerId) === 0
            ? {
                id: 0,
                pickupLat: WAREHOUSE.lat,
                pickupLng: WAREHOUSE.lng,
                name: WAREHOUSE.name,
                kind: "market",
              }
            : await resolveSellerPickup(sellerId);

        if (!s || s.pickupLat == null || s.pickupLng == null) continue;

        const distanceKm = haversineKm(
          Number(courier.currentLat),
          Number(courier.currentLng),
          Number(s.pickupLat),
          Number(s.pickupLng),
        );

        const nearCouriers = await countNearOnlineCouriersMeters(
          s.pickupLat,
          s.pickupLng,
          NEAR_RADIUS_KM,
          courierId,
        );

        const canShow = distanceKm <= ACCEPT_RADIUS_KM && nearCouriers <= 1;

        const prepLeftSec =
          order.status === "Ready for pickup"
            ? (pack.bestLeft ?? -1)
            : pack.bestLeft;

        out.push({
          sellerId,
          sellerName: s.name,
          kind: s.kind,
          pickupLat: Number(s.pickupLat),
          pickupLng: Number(s.pickupLng),

          orderId: order.id,
          orderStatus: order.status,
          prepLeftSec,
          isReady:
            order.status === "Ready for pickup" ||
            (prepLeftSec != null && prepLeftSec <= 0),

          ordersCount,

          nearCouriers,
          distanceKm: Number(distanceKm.toFixed(2)),
          canShow,
        });
      }

      return res.json({
        acceptRadiusKm: ACCEPT_RADIUS_KM,
        nearRadiusKm: NEAR_RADIUS_KM,
        candidates: out,
      });
    } catch (e) {
      console.error("selfPickCandidates error:", e);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async selfPickInfo(req, res) {
    try {
      const courierId = req.user?.id;
      if (!courierId)
        return res.status(401).json({ message: "Вы не авторизованы." });

      const { id } = req.params;

      const ACCEPT_RADIUS_KM = 30;
      const NEAR_RADIUS_KM = 1;

      const order = await Order.findByPk(id);
      if (!order) return res.status(404).json({ message: "Заказ не найден." });

      if (order.courierId && String(order.courierId) === String(courierId)) {
      }

      const busy = await courierHasActiveOrder(courierId);
      if (busy)
        return res.json({
          canSelfPick: false,
          reason: "busy",
          activeOrderId: busy.id,
        });

      const allowedStatuses = new Set([
        "Waiting for courier",
        "Ready for pickup",
      ]);
      if (order.courierId) {
        return res.json({ canSelfPick: false, reason: "taken" });
      }
      if (!allowedStatuses.has(order.status)) {
        return res.json({ canSelfPick: false, reason: "bad_status" });
      }

      const courier = await Courier.findByPk(courierId);
      if (!courier || courier.status !== "online") {
        return res.json({ canSelfPick: false, reason: "offline" });
      }
      if (!courier.currentLat || !courier.currentLng) {
        return res.json({ canSelfPick: false, reason: "no_geo" });
      }

      const pickup = await resolvePickupPoint(order);
      if (!pickup?.lat || !pickup?.lng) {
        return res.json({ canSelfPick: false, reason: "no_pickup" });
      }

      const distanceKm = haversineKm(
        Number(courier.currentLat),
        Number(courier.currentLng),
        Number(pickup.lat),
        Number(pickup.lng),
      );

      const nearCouriers = await countNearOnlineCouriers(
        pickup.lat,
        pickup.lng,
        NEAR_RADIUS_KM,
        courierId,
      );

      const canSelfPick = distanceKm <= ACCEPT_RADIUS_KM && nearCouriers <= 1;

      return res.json({
        canSelfPick,
        distanceKm: Number(distanceKm.toFixed(2)),
        nearCouriers,
        acceptRadiusKm: ACCEPT_RADIUS_KM,
        nearRadiusKm: NEAR_RADIUS_KM,
      });
    } catch (e) {
      console.error("selfPickInfo error:", e);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async selfPick(req, res) {
    try {
      const courierId = req.user?.id;
      if (!courierId)
        return res.status(401).json({ message: "Вы не авторизованы." });

      const { id } = req.params;

      const ACCEPT_RADIUS_KM = 30;
      const NEAR_RADIUS_KM = 1;

      const order = await Order.findByPk(id);
      if (!order) return res.status(404).json({ message: "Заказ не найден." });

      if (order.courierId) {
        return res.status(409).json({ message: "Заказ уже занят." });
      }

      const allowedStatuses = new Set([
        "Waiting for courier",
        "Ready for pickup",
      ]);
      if (!allowedStatuses.has(order.status)) {
        return res
          .status(400)
          .json({ message: "Заказ не доступен для самозабора." });
      }

      const courier = await Courier.findByPk(courierId);
      if (!courier || courier.status !== "online") {
        return res.status(400).json({ message: "Нужно быть онлайн." });
      }
      if (!courier.currentLat || !courier.currentLng) {
        return res.status(400).json({ message: "Нет вашей геолокации." });
      }

      const pickup = await resolvePickupPoint(order);
      if (!pickup?.lat || !pickup?.lng) {
        return res.status(400).json({ message: "Нет координат заведения." });
      }

      const distanceKm = haversineKm(
        Number(courier.currentLat),
        Number(courier.currentLng),
        Number(pickup.lat),
        Number(pickup.lng),
      );
      if (distanceKm > ACCEPT_RADIUS_KM) {
        return res
          .status(403)
          .json({ message: `Слишком далеко (${distanceKm.toFixed(1)} км).` });
      }

      const nearCouriers = await countNearOnlineCouriers(
        pickup.lat,
        pickup.lng,
        NEAR_RADIUS_KM,
        courierId,
      );
      if (nearCouriers > 1) {
        return res
          .status(403)
          .json({ message: "Возле заведения уже достаточно курьеров." });
      }

      const busy = await courierHasActiveOrder(courierId);
      if (busy) {
        return res.status(409).json({
          message: `Нельзя взять новый заказ: у вас уже есть активный заказ #${busy.id} (${busy.status}).`,
          code: "COURIER_BUSY",
          activeOrderId: busy.id,
          activeOrderStatus: busy.status,
        });
      }

      order.courierId = courierId;
      order.acceptedAt = new Date();
      order.offerCourierId = null;
      order.offerExpiresAt = null;

      if (order.orderType === "parcel") order.status = "Accepted";
      else
        order.status =
          order.status === "Ready for pickup" ? "Ready for pickup" : "Accepted";

      await order.save();

      const io = req.app.get("io");

      let chat = await Chat.findOne({
        where: { type: "delivery", orderId: order.id },
      });
      if (!chat)
        chat = await Chat.create({ type: "delivery", orderId: order.id });

      await ChatParticipant.findOrCreate({
        where: { chatId: chat.id, userId: order.userId },
        defaults: { chatId: chat.id, userId: order.userId, role: "client" },
      });
      await ChatParticipant.findOrCreate({
        where: { chatId: chat.id, userId: courierId },
        defaults: { chatId: chat.id, userId: courierId, role: "courier" },
      });

      io.to(`order:${order.id}`).emit("deliveryChatReady", {
        orderId: order.id,
        chatId: chat.id,
      });

      io.to(`order:${order.id}`).emit("orderStatusUpdate", {
        id: order.id,
        status: order.status,
        accepted: true,
        courierId: order.courierId,
      });

      return res.json(order);
    } catch (e) {
      console.error("selfPick error:", e);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async getHistory(req, res) {
    try {
      const courierId = req.user?.id;
      if (!courierId)
        return res.status(401).json({ message: "Вы не авторизованы." });

      const { from, to } = req.query;

      const where = {
        courierId,
        status: { [Op.in]: ["Delivered", "Completed"] },
      };

      const timeField = Order.rawAttributes?.deliveredAt
        ? "deliveredAt"
        : "updatedAt";

      if (from || to) {
        where[timeField] = {};
        if (from) where[timeField][Op.gte] = new Date(from);
        if (to) where[timeField][Op.lt] = new Date(to);
      }

      const orders = await Order.findAll({
        where,
        order: [[timeField, "DESC"]],
        attributes: [
          "id",
          "orderType",
          "sellerId",
          "userId",
          "customerName",
          "customerPhone",
          "pickupAddress",
          "deliveryAddress",
          "totalPrice",
          "deliveryPrice",
          "deliveryPriceOverride",
          timeField,
          "createdAt",
        ],
        raw: true,
      });

      const sellerIds = [
        ...new Set(orders.map((o) => o.sellerId).filter(Boolean)),
      ];

      const sellers = sellerIds.length
        ? await Seller.findAll({
            where: { id: { [Op.in]: sellerIds } },
            attributes: ["id", "name", "kind"],
            raw: true,
          })
        : [];

      const sellerMap = new Map(sellers.map((s) => [Number(s.id), s]));

      const userIds = [...new Set(orders.map((o) => o.userId).filter(Boolean))];

      const users = userIds.length
        ? await User.findAll({
            where: { id: { [Op.in]: userIds } },
            attributes: ["id", "firstName", "lastName", "phone", "email"],
            raw: true,
          })
        : [];

      const userMap = new Map(users.map((u) => [Number(u.id), u]));

      return res.json(
        orders.map((o) => {
          const seller = o.sellerId ? sellerMap.get(Number(o.sellerId)) : null;
          const u = o.userId ? userMap.get(Number(o.userId)) : null;
          const deliveryClient =
            o.deliveryPriceOverride != null
              ? o.deliveryPriceOverride
              : o.deliveryPrice;

          const kind =
            o.orderType === "parcel" ? "parcel" : seller ? "seller" : "market";

          return {
            id: o.id,
            kind,
            sellerName: seller?.name || null,
            deliveredAt: o[timeField] || o.createdAt,
            pickupAddress: o.pickupAddress || null,
            deliveryAddress: o.deliveryAddress || null,
            sum: Number(deliveryClient || 0),
            customerName:
              String(o.customerName || "").trim() ||
              buildCustomerName(u) ||
              null,
            customerPhone:
              String(o.customerPhone || "").trim() || u?.phone || null,

            deliveryPrice: Number(o.deliveryPrice || 0),
            deliveryPriceOverride:
              o.deliveryPriceOverride != null
                ? Number(o.deliveryPriceOverride)
                : null,
            deliveryPriceEffective: Number(deliveryClient || 0),
          };
        }),
      );
    } catch (e) {
      console.error("getHistory error:", e);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async getFinance(req, res) {
    try {
      const courierId = req.user?.id;
      if (!courierId)
        return res.status(401).json({ message: "Вы не авторизованы." });

      const { from, to } = req.query;

      const where = {
        courierId,
        status: { [Op.in]: ["Delivered", "Completed"] },
      };

      const timeField = Order.rawAttributes?.deliveredAt
        ? "deliveredAt"
        : "updatedAt";

      if (from || to) {
        where[timeField] = {};
        if (from) where[timeField][Op.gte] = new Date(from);
        if (to) where[timeField][Op.lt] = new Date(to);
      }

      const effectiveDelivery = fn(
        "COALESCE",
        col("deliveryPriceOverride"),
        col("deliveryPrice"),
      );

      // ✅ удержание считаем ТОЛЬКО по parcel
      const withheldParcel = literal(`
      COALESCE(SUM(CASE WHEN "orderType" = 'parcel' THEN "courierCommission" ELSE 0 END), 0)
    `);

      const row = await Order.findOne({
        where,
        attributes: [
          [fn("COUNT", col("id")), "trips"],

          [
            fn("COALESCE", fn("SUM", effectiveDelivery), 0),
            "deliveryClientTotal",
          ],

          [
            fn("COALESCE", fn("SUM", col("deliveryPrice")), 0),
            "deliveryBaseTotal",
          ],

          [fn("COALESCE", fn("SUM", effectiveDelivery), 0), "gross"],

          // ✅ только parcel
          [withheldParcel, "withheld"],

          [fn("COALESCE", fn("SUM", col("courierBonus")), 0), "bonuses"],
        ],
        raw: true,
      });

      row.net = Number(row.gross || 0) - Number(row.withheld || 0);

      const courier = await Courier.findByPk(courierId, {
        attributes: ["offersSent", "offersAccepted"],
        raw: true,
      });

      const acceptRate = calcAcceptRate(
        courier?.offersSent,
        courier?.offersAccepted,
      );

      return res.json({
        trips: Number(row?.trips || 0),
        gross: Number(Number(row?.gross || 0).toFixed(2)),
        withheld: Number(Number(row?.withheld || 0).toFixed(2)),
        net: Number(Number(row?.net || 0).toFixed(2)),
        bonuses: Number(Number(row?.bonuses || 0).toFixed(2)),
        tips: 0,
        acceptRate,
        deliveryClientTotal: Number(
          Number(row?.deliveryClientTotal || 0).toFixed(2),
        ),
        deliveryBaseTotal: Number(
          Number(row?.deliveryBaseTotal || 0).toFixed(2),
        ),
      });
    } catch (e) {
      console.error("getFinance error:", e);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async savePushToken(req, res) {
    try {
      const { token } = req.body;
      const courierId = req.user?.id;

      if (!courierId) {
        console.warn("⚠️ savePushToken: нет req.user, авторизация не прошла");
        return res.status(401).json({ message: "Вы не авторизованы." });
      }

      if (!token) {
        console.warn("⚠️ savePushToken: пустой token");
        return res.status(400).json({ message: "Токен не передан." });
      }

      let courier = await Courier.findByPk(courierId);
      if (!courier) {
        courier = await Courier.create({
          id: courierId,
          name: buildCourierName(req.user),
          status: "offline",
          offersSent: 0,
          offersAccepted: 0,
        });
      }

      courier.expoPushToken = token;
      await courier.save();

      return res.json({ message: "Push-токен сохранён" });
    } catch (error) {
      console.error("❌ Ошибка сохранения push-токена:", error);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async getAllCouriers(req, res) {
    try {
      const couriers = await Courier.findAll({
        attributes: [
          "id",
          "name",
          "currentLat",
          "currentLng",
          "status",
          "expoPushToken",
        ],
      });
      res.json(couriers);
    } catch (error) {
      console.error("Ошибка получения курьеров:", error);
      res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async getSelf(req, res) {
    try {
      const courierId = req.user.id;
      if (!courierId) {
        return res.status(401).json({ message: "Вы не авторизованы." });
      }

      let courier = await Courier.findByPk(courierId);

      if (!courier) {
        courier = await Courier.create({
          id: courierId,
          name: buildCourierName(req.user),
          status: "offline",
        });
      }

      const user = await User.findByPk(courierId, {
        attributes: ["id", "firstName", "lastName", "phone", "email"],
        raw: true,
      });

      const fullName = [user?.firstName, user?.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();

      return res.json({
        id: courier.id,
        name: courier.name || fullName || buildCourierName(req.user),

        firstName: user?.firstName || null,
        lastName: user?.lastName || null,
        phone: user?.phone || null,
        email: user?.email || null,

        status: courier.status,
        currentLat: courier.currentLat,
        currentLng: courier.currentLng,
        expoPushToken: courier.expoPushToken,
      });
    } catch (error) {
      console.error("❌ Ошибка получения курьера:", error);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async getActiveOrders(req, res) {
    try {
      const courierId = req.user.id;
      if (!courierId) {
        return res.status(401).json({ message: "Вы не авторизованы." });
      }

      const courier = await Courier.findByPk(courierId);
      if (!courier || courier.status !== "online") {
        return res.json([]);
      }

      const orders = await Order.findAll({
        where: {
          status: { [Op.in]: COURIER_ACTIVE_STATUSES },
          [Op.or]: [
            { courierId: courierId },
            { courierId: null, offerCourierId: courierId },
          ],
        },

        order: [["createdAt", "DESC"]],
        attributes: [
          "id",
          "orderType",
          "status",
          "pickupAddress",
          "pickupLat",
          "pickupLng",
          "deliveryLat",
          "deliveryLng",
          "deliveryAddress",
          "orderDetails",
          "deliveryPrice",
          "deliveryPriceOverride",
          "courierBonus",
          "courierFee",
          "courierId",
          "courierFeeGross",
          "courierCommission",
          "courierCommissionRate",
          "offerExpiresAt",
          "offerCourierId",
          "sellerId",
          "userId",
          "processingTime",
          "processingStartTime",
        ],
      });

      if (orders.length === 0) {
        return res.json([]);
      }

      const sellerIds = [
        ...new Set(orders.map((o) => o.sellerId).filter(Boolean)),
      ];

      const sellers = sellerIds.length
        ? await Seller.findAll({
            where: { id: sellerIds },
            attributes: ["id", "address", "pickupLat", "pickupLng"],
          })
        : [];

      const sellerMap = new Map(sellers.map((s) => [s.id, s]));

      const userIds = [...new Set(orders.map((o) => o.userId).filter(Boolean))];

      const users = userIds.length
        ? await User.findAll({
            where: { id: { [Op.in]: userIds } },
            attributes: ["id", "firstName", "lastName", "phone", "email"],
            raw: true,
          })
        : [];

      const userMap = new Map(users.map((u) => [Number(u.id), u]));

      const formattedOrders = orders.map((order) => {
        const o = order.toJSON();
        const s = o.sellerId ? sellerMap.get(o.sellerId) : null;
        const u = o.userId ? userMap.get(Number(o.userId)) : null;

        const isParcel = o.orderType === "parcel";

        return {
          ...o,
          orderDetails: safeParse(order.orderDetails, []),
          pickupAddress: isParcel
            ? o.pickupAddress || null
            : o.pickupAddress || s?.address || null,
          pickupLat: isParcel
            ? (o.pickupLat ?? null)
            : (o.pickupLat ?? s?.pickupLat ?? null),
          pickupLng: isParcel
            ? (o.pickupLng ?? null)
            : (o.pickupLng ?? s?.pickupLng ?? null),
          customerName: o.customerName || buildCustomerName(u) || null,
          customerPhone: o.customerPhone || u?.phone || null,
          processingTime: order.processingTime,
          processingStartTime: order.processingStartTime,
        };
      });

      return res.json(formattedOrders);
    } catch (error) {
      console.error("❌ Ошибка получения активных заказов:", error);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async acceptOrder(req, res) {
    try {
      const { id } = req.params;
      const courierId = req.user.id;

      if (!courierId) {
        return res.status(401).json({ message: "Вы не авторизованы." });
      }

      let courier = await Courier.findByPk(courierId);
      if (!courier) {
        courier = await Courier.create({
          id: courierId,
          name: buildCourierName(req.user),
          status: "offline",
        });
      }

      const order = await Order.findByPk(id);

      if (!order) return res.status(404).json({ message: "Заказ не найден." });

      if (order.courierId && String(order.courierId) !== String(courierId)) {
        return res.status(400).json({ message: "Заказ уже занят." });
      }

      if (
        order.offerCourierId &&
        String(order.offerCourierId) !== String(courierId)
      ) {
        return res
          .status(400)
          .json({ message: "Этот заказ вам не предлагался." });
      }

      if (!order) {
        return res.status(404).json({ message: "Заказ не найден." });
      }

      if (
        order.status !== "Waiting for courier" &&
        order.status !== "Ready for pickup"
      ) {
        return res
          .status(400)
          .json({ message: "Заказ уже занят или не доступен для курьера." });
      }

      const prevStatus = order.status;
      const isParcel = order.orderType === "parcel";
      const user = order.userId
        ? await User.findByPk(order.userId, {
            attributes: ["id", "firstName", "lastName", "phone", "email"],
          })
        : null;

      const customerName =
        order.customerName || buildCustomerName(user) || null;
      const customerPhone = order.customerPhone || user?.phone || null;

      const busy = await courierHasActiveOrder(courierId, id);
      if (busy) {
        return res.status(409).json({
          message: `Нельзя принять заказ: у вас уже есть активный заказ #${busy.id} (${busy.status}).`,
          code: "COURIER_BUSY",
          activeOrderId: busy.id,
          activeOrderStatus: busy.status,
        });
      }

      order.courierId = courierId;
      order.acceptedAt = new Date();
      order.offerCourierId = null;
      order.offerExpiresAt = null;

      if (isParcel) {
        order.status = "Accepted";
      } else {
        order.status =
          prevStatus === "Ready for pickup" ? "Ready for pickup" : "Accepted";
      }

      await order.save();

      const io = req.app.get("io");

      let chat = await Chat.findOne({
        where: { type: "delivery", orderId: order.id },
      });
      if (!chat)
        chat = await Chat.create({ type: "delivery", orderId: order.id });

      if (!order.deliveryChatId) {
        order.deliveryChatId = chat.id;
        await order.save();
      }

      await ChatParticipant.findOrCreate({
        where: { chatId: chat.id, userId: order.userId },
        defaults: { chatId: chat.id, userId: order.userId, role: "client" },
      });
      await ChatParticipant.findOrCreate({
        where: { chatId: chat.id, userId: courierId },
        defaults: { chatId: chat.id, userId: courierId, role: "courier" },
      });

      io.to(`order:${order.id}`).emit("deliveryChatReady", {
        orderId: order.id,
        chatId: chat.id,
      });

      await Courier.increment("offersAccepted", {
        by: 1,
        where: { id: courierId },
      });

      io.to(`order:${order.id}`).emit("orderStatusUpdate", {
        id: order.id,
        status: order.status,
        accepted: true,
        courierId: order.courierId,
        courierLocation:
          courier.currentLat && courier.currentLng
            ? { lat: courier.currentLat, lng: courier.currentLng }
            : null,
      });

      let pickupAddress = null,
        pickupLat = null,
        pickupLng = null;

      if (isParcel) {
        pickupAddress = order.pickupAddress || null;
        pickupLat = order.pickupLat ?? null;
        pickupLng = order.pickupLng ?? null;
      } else {
        const s = order.sellerId ? await Seller.findByPk(order.sellerId) : null;
        pickupAddress = order.pickupAddress || s?.address || null;
        pickupLat = order.pickupLat ?? s?.pickupLat ?? null;
        pickupLng = order.pickupLng ?? s?.pickupLng ?? null;
      }

      return res.json({
        id: order.id,
        orderType: order.orderType,
        status: order.status,

        deliveryLat: order.deliveryLat,
        deliveryLng: order.deliveryLng,
        deliveryAddress: order.deliveryAddress,

        deliveryPrice: order.deliveryPrice,
        courierFee: order.courierFee,
        courierId: order.courierId,
        courierFeeGross: order.courierFeeGross,
        courierCommission: order.courierCommission,
        courierCommissionRate: order.courierCommissionRate,
        processingTime: order.processingTime,
        processingStartTime: order.processingStartTime,

        pickupAddress,
        pickupLat,
        pickupLng,
        customerName,
        customerPhone,
        userId: order.userId,
      });
    } catch (error) {
      console.error("❌ Ошибка принятия заказа:", error);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async toggleCourierStatus(req, res) {
    try {
      const { status } = req.body;
      const courierId = req.user.id;

      if (!courierId) {
        return res.status(401).json({ message: "Вы не авторизованы." });
      }

      let courier = await Courier.findByPk(courierId);

      if (!courier) {
        courier = await Courier.create({
          id: courierId,
          name: buildCourierName(req.user),
          status: "offline",
        });
      }

      courier.status = status;
      await courier.save();

      const io = req.app.get("io");
      io.emit("courierStatusUpdate", { courierId, status });

      if (status === "online") {
        try {
          const ACTIVE_STATUSES = ["Waiting for courier", "Ready for pickup"];

          const waitingOrders = await Order.findAll({
            where: {
              status: { [Op.in]: ACTIVE_STATUSES },
              courierId: null,
              offerCourierId: null,
            },
            order: [["createdAt", "ASC"]],
            attributes: [
              "id",
              "status",
              "orderType",
              "warehouseStatus",
              "processingTime",
              "processingStartTime",
              "courierId",
              "offerCourierId",
              "offerExpiresAt",
            ],
          });

          const io = req.app.get("io");

          for (const o of waitingOrders) {
            await scheduleCourierSearch(o, io);
          }
        } catch (err) {
          console.error(
            "❌ Ошибка планирования распределения при выходе курьера в онлайн:",
            err,
          );
        }
      }

      return res.json({ message: `Вы в статусе: ${status}` });
    } catch (error) {
      console.error("❌ Ошибка смены статуса курьера:", error);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async updateDeliveryStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const courierId = req.user.id;

      if (!courierId) {
        return res.status(401).json({ message: "Вы не авторизованы." });
      }

      const order = await Order.findByPk(id);
      if (!order) {
        return res.status(404).json({ message: "Заказ не найден." });
      }

      if (order.courierId !== courierId) {
        return res
          .status(403)
          .json({ message: "Этот заказ вам не принадлежит." });
      }

      const isParcel = order.orderType === "parcel";

      if (isParcel) {
        if (!PARCEL_STATUSES.has(status)) {
          return res
            .status(400)
            .json({ message: "Неверный статус для parcel" });
        }
        if (!canMoveParcel(order.status, status)) {
          return res.status(400).json({
            message: `Нельзя перейти ${order.status} → ${status}`,
          });
        }
      }

      order.status = status;

      if (isParcel && status === "In transit") {
        const estimatedTime = await calculateRouteTime(order);
        order.estimatedTime = estimatedTime;
        order.pickupStartTime = new Date();
      }

      if (!isParcel && status === "Picked up") {
        const estimatedTime = await calculateRouteTime(order);
        order.estimatedTime = estimatedTime;
        order.pickupStartTime = new Date();
      }

      await order.save();

      const io = req.app.get("io");
      io.to(`order:${order.id}`).emit("orderStatusUpdate", {
        id: order.id,
        status: order.status,
        estimatedTime: order.estimatedTime ?? null,
        pickupStartTime: order.pickupStartTime ?? null,
      });

      return res.json(order);
    } catch (error) {
      console.error("❌ Ошибка обновления статуса доставки:", error);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async completeDelivery(req, res) {
    try {
      const { id } = req.params;
      const courierId = req.user.id;

      if (!courierId) {
        return res.status(401).json({ message: "Вы не авторизованы." });
      }

      const order = await Order.findByPk(id);
      if (!order) {
        return res.status(404).json({ message: "Заказ не найден." });
      }

      if (order.courierId !== courierId) {
        return res
          .status(403)
          .json({ message: "Этот заказ вам не принадлежит." });
      }

      order.status = "Delivered";
      order.estimatedTime = null;

      if (Order.rawAttributes?.deliveredAt) {
        order.deliveredAt = new Date();
      }

      await order.save();

      const io = req.app.get("io");
      io.to(`order:${order.id}`).emit("orderStatusUpdate", {
        id: order.id,
        status: order.status,
        estimatedTime: order.estimatedTime ?? null,
        pickupStartTime: order.pickupStartTime ?? null,
      });

      try {
        const ACTIVE_STATUSES = ["Waiting for courier", "Ready for pickup"];

        const waitingOrders = await Order.findAll({
          where: {
            status: { [Op.in]: ACTIVE_STATUSES },
            courierId: null,
            offerCourierId: null,
          },
          order: [["createdAt", "ASC"]],
          attributes: [
            "id",
            "status",
            "orderType",
            "warehouseStatus",
            "processingTime",
            "processingStartTime",
            "courierId",
            "offerCourierId",
            "offerExpiresAt",
          ],
        });

        const io = req.app.get("io");

        for (const o of waitingOrders) {
          await scheduleCourierSearch(o, io);
        }
      } catch (err) {
        console.error(
          "❌ Ошибка планирования распределения после завершения доставки:",
          err,
        );
      }

      return res.json(order);
    } catch (error) {
      console.error("❌ Ошибка завершения доставки:", error);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async updateCourierLocation(req, res) {
    try {
      const { lat, lng } = req.body;
      const courierId = req.user.id;

      if (!courierId) {
        return res.status(401).json({ message: "Вы не авторизованы." });
      }

      if (lat == null || lng == null) {
        return res.status(400).json({ message: "Координаты не переданы." });
      }

      let courier = await Courier.findByPk(courierId);

      if (!courier) {
        courier = await Courier.create({
          id: courierId,
          name: buildCourierName(req.user),
          status: "offline",
        });
      }

      courier.currentLat = lat;
      courier.currentLng = lng;
      await courier.save();

      const io = req.app.get("io");

      io.to("admin_notifications").emit("courierLocationUpdate", {
        courierId,
        lat,
        lng,
      });

      const activeOrders = await Order.findAll({
        where: {
          courierId,
          status: { [Op.in]: COURIER_ACTIVE_STATUSES },
        },
        attributes: ["id"],
      });

      for (const o of activeOrders) {
        io.to(`order:${o.id}`).emit("courierLocationUpdate", {
          orderId: o.id,
          lat,
          lng,
          courierId,
        });
      }

      return res.json({ message: "Местоположение обновлено!" });
    } catch (error) {
      console.error("❌ Ошибка обновления местоположения курьера:", error);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async declineOrder(req, res) {
    try {
      const { id } = req.params;
      const courierId = req.user.id;

      if (!courierId) {
        return res.status(401).json({ message: "Вы не авторизованы." });
      }

      const order = await Order.findByPk(id);

      if (!order) {
        return res.status(404).json({ message: "Заказ не найден." });
      }

      if (String(order.offerCourierId) !== String(courierId)) {
        return res
          .status(400)
          .json({ message: "Этот заказ вам не предлагался." });
      }

      if (String(order.offerCourierId) === String(courierId)) {
        order.offerCourierId = null;
        order.offerExpiresAt = null;
        await order.save();
      }

      const io = req.app.get("io");

      await OrderDecline.findOrCreate({
        where: { orderId: order.id, courierId },
        defaults: { orderId: order.id, courierId },
      });

      await sendOrderToNextCourier(order, { io });

      return res.json({ message: "Заказ отклонён", orderId: order.id });
    } catch (error) {
      console.error("❌ Ошибка отклонения заказа курьером:", error);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  }
}

async function calculateRouteTime(order) {
  if (!order.deliveryLat || !order.deliveryLng) {
    return 15 * 60;
  }

  const courier = await Courier.findByPk(order.courierId);
  if (!courier || !courier.currentLat || !courier.currentLng) {
    return 15 * 60;
  }

  const API_KEY = "5b3ce3597851110001cf624889e39f2834a84a62aaca04f731838a64";
  const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${API_KEY}&start=${courier.currentLng},${courier.currentLat}&end=${order.deliveryLng},${order.deliveryLat}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.features && data.features.length > 0) {
      const realTime = Math.round(
        data.features[0].properties.segments[0].duration,
      );
      return realTime;
    } else {
      console.warn(
        "⚠️ Не удалось получить данные маршрута, оставляем 15 минут.",
      );
      return 15 * 60;
    }
  } catch (error) {
    console.error("❌ Ошибка получения маршрута:", error);
    return 15 * 60;
  }
}

module.exports = new CourierController();
