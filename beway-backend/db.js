const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'members.db'));

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    billing_status TEXT NOT NULL DEFAULT 'pending',   -- pending | active | past_due | canceled
    manual_override TEXT NOT NULL DEFAULT 'on',        -- on | off  (the EA kill switch)
    current_period_end TEXT,                           -- ISO date string
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

module.exports = db;
