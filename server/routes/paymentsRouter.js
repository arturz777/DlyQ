const express = require("express");
const Stripe = require("stripe");
const authMiddleware = require("../middleware/authMiddleware");
const { User } = require("../models/models");
const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

async function getOrCreateStripeCustomerForUser(user, fallbackEmail) {
  if (!user) {
    const c = await stripe.customers.create({
      email: fallbackEmail || undefined,
    }); 
    return c.id;
  }

  const dbUser = await User.findByPk(user.id);

  if (dbUser?.stripeCustomerId) {
    return dbUser.stripeCustomerId;
  }

  const c = await stripe.customers.create({
    email: dbUser?.email || user.email || fallbackEmail || undefined,
    name:
      [dbUser?.firstName || user.firstName, dbUser?.lastName || user.lastName]
        .filter(Boolean)
        .join(" ") || undefined,
    phone: dbUser?.phone || user.phone || undefined,
  });

  await User.update({ stripeCustomerId: c.id }, { where: { id: user.id } });
  return c.id;
}

router.post("/set-default", authMiddleware, async (req, res) => {
  try {
    const { pmId } = req.body;
    if (!pmId) return res.status(400).json({ message: "pmId required" });

    const dbUser = await User.findByPk(req.user.id);
    const customerId = dbUser?.stripeCustomerId;
    if (!customerId) return res.status(400).json({ message: "No customer" });

    const pm = await stripe.paymentMethods.retrieve(pmId);
    if (pm.customer && pm.customer !== customerId) {
      return res
        .status(400)
        .json({ message: "This PM belongs to another customer" });
    }
    if (!pm.customer) {
      await stripe.paymentMethods.attach(pmId, { customer: customerId });
    }

    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: pmId },
    });

    return res.json({ ok: true, customerId, pmId });
  } catch (e) {
    console.error("set-default error:", e);
    return res.status(500).json({ message: "set-default failed" });
  }
});

router.post("/setup-intent", authMiddleware, async (req, res) => {
  try {
    const { email } = req.body || {};

    const customerId = await getOrCreateStripeCustomerForUser(req.user, email);

    const si = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      usage: "off_session",
    });

    return res.json({ clientSecret: si.client_secret });
  } catch (e) {
    console.error("setup-intent error:", e);
    return res.status(500).json({ message: "SetupIntent create failed" });
  }
});

router.post("/create-intent", authMiddleware, async (req, res) => {
  try {
    const {
      amount,
      currency = "eur",
      receipt_email,
      metadata,
    } = req.body || {};
    if (!amount || !Number.isInteger(amount)) {
      return res
        .status(400)
        .json({ message: "amount (integer, in cents) required" });
    }

    const dbUser = await User.findByPk(req.user.id);
    const customerId =
      dbUser?.stripeCustomerId ||
      (await getOrCreateStripeCustomerForUser(req.user, receipt_email));

    const pi = await stripe.paymentIntents.create({
      amount,
      currency,
      customer: customerId,
      receipt_email: receipt_email || undefined,
      metadata: metadata || undefined,
      automatic_payment_methods: { enabled: true },
    });

    return res.json({ clientSecret: pi.client_secret, paymentIntentId: pi.id });
  } catch (e) {
    console.error("create-intent error:", e);
    return res.status(500).json({ message: "PaymentIntent create failed" });
  }
});

router.get("/payment-methods", authMiddleware, async (req, res) => {
  try {
    const dbUser = await User.findByPk(req.user.id);
    const customerId = dbUser?.stripeCustomerId;
    if (!customerId) return res.json({ customerId: null, cards: [] });

    const list = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
      limit: 10,
    });

    const cards = list.data.map((pm) => ({
      id: pm.id,
      brand: pm.card.brand,
      last4: pm.card.last4,
      exp_month: pm.card.exp_month,
      exp_year: pm.card.exp_year,
    }));

    res.json({ customerId, cards });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e.message });
  }
});

router.post("/detach-pm", authMiddleware, async (req, res) => {
  try {
    const { pmId } = req.body;
    if (!pmId) return res.status(400).json({ message: "pmId required" });

    const dbUser = await User.findByPk(req.user.id);
    const customerId = dbUser?.stripeCustomerId;
    if (!customerId) return res.status(400).json({ message: "No customer" });

    const pm = await stripe.paymentMethods.retrieve(pmId);
    if (pm.customer !== customerId) {
      return res.status(403).json({ message: "Not your payment method" });
    }

    await stripe.paymentMethods.detach(pmId);

    const list = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
      limit: 10,
    });

    const cust = await stripe.customers.retrieve(customerId);
    let newDefault = cust.invoice_settings?.default_payment_method || null;
    if (newDefault === pmId) {
      newDefault = list.data[0]?.id || null;
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: newDefault },
      });
    }

    const cards = list.data.map((x) => ({
      id: x.id,
      brand: x.card.brand,
      last4: x.card.last4,
      exp_month: x.card.exp_month,
      exp_year: x.card.exp_year,
    }));

    return res.json({ ok: true, cards, newDefault });
  } catch (e) {
    console.error("detach-pm error:", e);
    return res.status(400).json({ message: e.message });
  }
});

module.exports = router;
