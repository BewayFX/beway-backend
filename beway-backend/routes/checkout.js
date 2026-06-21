const express = require('express');
const Stripe = require('stripe');
const crypto = require('crypto');
const db = require('../db');

const router = express.Router();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// POST /api/checkout  { name, email }
// Public endpoint your signup page calls. Creates (or reuses) a Stripe
// customer + a Checkout Session for the recurring monthly price, and
// returns the URL to redirect the new member to.
router.post('/checkout', async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'name and email are required' });
    }

    let member = db.prepare('SELECT * FROM members WHERE email = ?').get(email);

    let customerId = member?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ name, email });
      customerId = customer.id;
    }

    if (!member) {
      db.prepare(
        `INSERT INTO members (name, email, access_token, stripe_customer_id, billing_status, manual_override)
         VALUES (?, ?, ?, ?, 'pending', 'on')`
      ).run(name, email, crypto.randomBytes(16).toString('hex'), customerId);
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: process.env.STRIPE_MONTHLY_PRICE_ID, quantity: 1 }],
      success_url: process.env.SUCCESS_URL,
      cancel_url: process.env.CANCEL_URL,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('checkout error', err);
    res.status(500).json({ error: 'Could not start checkout' });
  }
});

module.exports = router;
