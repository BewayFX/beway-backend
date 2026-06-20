# Béway Strategy V3 — Membership & Billing Backend

This is the real, deployable backend behind the dashboard: it takes monthly
payments through Stripe, tracks who's paid, and lets you flip any member's
EA access on or off. The MT4 EA checks a small `License.key` file that this
system generates per member.

## How the pieces fit together

```
Signup page → POST /api/checkout → Stripe Checkout (monthly subscription)
                                          │
Stripe sends events to ───────────► POST /api/webhook
                                          │
                                   members.db updated
                                          │
Admin dashboard ──► GET /api/admin/members            (list + status)
                 ──► POST /api/admin/members/:id/toggle (kill switch)
                 ──► GET /api/admin/members/:id/license (download License.key)
                                          │
                                   You email License.key to the member →
                                   they drop it in MQL4/Files/ →
                                   EA reads it on chart load
```

## 1. Stripe setup (one-time)

1. Create a Stripe account at https://dashboard.stripe.com if you don't have one.
2. **Product catalog → Add product** — e.g. "Béway Strategy V3 Membership",
   recurring price, billed **monthly**. Copy the resulting `price_xxx` ID.
3. **Developers → API keys** — copy your **Secret key** (`sk_test_...` while
   testing, `sk_live_...` once you go live).
4. **Developers → Webhooks → Add endpoint** — URL will be
   `https://YOUR-DOMAIN/api/webhook`, events to send:
   `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`,
   `customer.subscription.deleted`. Copy the **Signing secret** (`whsec_...`).

## 2. Configure

```bash
cp .env.example .env
```

Fill in `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_MONTHLY_PRICE_ID`,
`SUCCESS_URL`, `CANCEL_URL`, and generate two random secrets:

```bash
openssl rand -hex 32   # → LICENSE_SECRET
openssl rand -hex 24   # → ADMIN_KEY
```

`ADMIN_KEY` is the password your dashboard uses to talk to this backend —
keep it private, never put it in frontend code that ships to the public.

## 3. Run locally

```bash
npm install
npm start
```

Server starts on `http://localhost:3000`. Test it's alive:

```bash
curl http://localhost:3000/health
```

## 4. Where to host it (recommendation)

You need a host that can run a small always-on Node process and persist a
file (`members.db`). Easiest options, roughly in order of simplicity:

- **Railway** (railway.app) — connect this folder as a GitHub repo, it
  detects Node automatically, set your `.env` values as environment
  variables in the dashboard, done. Free tier is enough to start.
- **Render** (render.com) — same idea, "Web Service" from a repo.
- A small **VPS** (DigitalOcean, Hetzner) if you want full control — run
  with `pm2` so it restarts on crash/reboot.

Whichever you pick, after deploying:
- Point the Stripe webhook URL at your live domain (`/api/webhook`).
- Update `SUCCESS_URL` / `CANCEL_URL` to real pages on your site.
- Point the admin dashboard's "API base URL" + admin key at this deployment.

> Note: `better-sqlite3` stores data in a single file on disk. That's fine
> for Railway/Render/VPS persistent disks. If you outgrow it, swap `db.js`
> for Postgres (e.g. Railway's managed Postgres) — the rest of the code
> doesn't need to change much since all DB access goes through that file.

## 5. Day-to-day use

- New members sign up through your checkout page → they land in the
  dashboard automatically once Stripe confirms payment.
- Each month, Stripe charges them automatically and fires `invoice.paid` —
  no action needed from you, `billing_status` stays `active`.
- Payment fails → `billing_status` becomes `past_due` automatically.
  Stripe will retry the charge per your Stripe dashboard's retry settings.
- Want to cut someone off regardless of payment (e.g. abuse, refund,
  manual reason)? Use the dashboard's On/Off toggle — that's the
  `manual_override` column, independent of Stripe.
- To actually update what their EA sees: open their row → **Download
  License.key** → email it to them → they replace the file in their
  MT4 `Files` folder. (See the EA section in the main reply for how it
  checks this file.)

## Security notes

- Never expose `ADMIN_KEY`, `STRIPE_SECRET_KEY`, or `LICENSE_SECRET` in
  any frontend/browser code — they belong only in this backend's `.env`.
- The `License.key` checksum is a lightweight tamper deterrent, not strong
  cryptography (MQL4 has no built-in crypto library). It will stop casual
  file editing but not a determined reverse-engineer with access to the
  compiled `.ex4`. Stripe's own fraud/chargeback tools are your real
  protection against payment abuse.
