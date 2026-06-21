const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'members.db'));

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    access_token TEXT UNIQUE,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    billing_status TEXT NOT NULL DEFAULT 'pending',   -- pending | active | past_due | canceled
    manual_override TEXT NOT NULL DEFAULT 'on',        -- on | off  (the EA kill switch)
    current_period_end TEXT,                           -- ISO date string
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Lightweight migration: older databases created before access_token existed
// won't have the column — add it if missing, and backfill any blank tokens.
const cols = db.prepare("PRAGMA table_info(members)").all().map((c) => c.name);
if (!cols.includes('access_token')) {
  db.exec('ALTER TABLE members ADD COLUMN access_token TEXT');
}

const crypto = require('crypto');
const needsToken = db.prepare("SELECT id FROM members WHERE access_token IS NULL OR access_token = ''").all();
const fillToken = db.prepare('UPDATE members SET access_token = ? WHERE id = ?');
for (const row of needsToken) {
  fillToken.run(crypto.randomBytes(16).toString('hex'), row.id);
}

module.exports = db;
