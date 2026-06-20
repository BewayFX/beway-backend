require('dotenv').config();
const express = require('express');
const cors = require('cors');

const webhookRoutes = require('./routes/webhook');
const checkoutRoutes = require('./routes/checkout');
const adminRoutes = require('./routes/admin');

const app = express();

app.use(cors());

// Stripe webhook needs the raw body, so it's mounted BEFORE express.json()
app.use('/api', webhookRoutes);

app.use(express.json());
app.use('/api', checkoutRoutes);
app.use('/api/admin', adminRoutes);

app.get('/health', (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Beway membership backend listening on :${port}`));
