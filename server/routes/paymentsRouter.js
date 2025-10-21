const express = require("express");
const Stripe = require("stripe");

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

router.post("/create-intent", async (req, res) => {
  try {
    const { amount, currency = "eur", metadata = {}, receipt_email } = req.body;

    if (!Number.isInteger(amount) || amount < 50) {
      return res.status(400).json({ message: "Bad amount (cents >= 50)" });
    }

    const intent = await stripe.paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: { enabled: true },
      metadata,
      receipt_email, 
    });

    res.json({ clientSecret: intent.client_secret, id: intent.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "PI create failed" });
  }
});

module.exports = router;
