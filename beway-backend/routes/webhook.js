const express = require('express');
const Stripe = require('stripe');
const db = require('../db');

const router = express.Router();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// IMPORTANT: this route must receive the *raw* request body for Stripe's
// signature check to work — see the express.raw() middleware wired up
// for this path in server.js (do not use express.json() on this route).
router.post('/webhook', async (req, res) => {
  let event;
  try {
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const setStatus = (customerId, billing_status, subscriptionId, periodEnd) => {
    db.prepare(
      `UPDATE members
       SET billing_status = ?,
           stripe_subscription_id = COALESCE(?, stripe_subscription_id),
           current_period_end = COALESCE(?, current_period_end),
           updated_at = datetime('now')
       WHERE stripe_customer_id = ?`
    ).run(billing_status, subscriptionId, periodEnd, customerId);
  };

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      setStatus(session.customer, 'active', session.subscription, null);
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object;
      const periodEnd = invoice.lines?.data?.[0]?.period?.end
        ? new Date(invoice.lines.data[0].period.end * 1000).toISOString()
        : null;
      setStatus(invoice.customer, 'active', invoice.subscription, periodEnd);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      setStatus(invoice.customer, 'past_due', invoice.subscription, null);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      setStatus(sub.customer, 'canceled', sub.id, null);
      break;
    }

    default:
      // Ignore other event types
      break;
  }

  res.json({ received: true });
});

module.exports = router;
