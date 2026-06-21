const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const requireAdmin = require('../lib/requireAdmin');
const { buildLicenseFile, deriveLicenseStatus } = require('../lib/license');

const router = express.Router();
router.use(requireAdmin);

// GET /api/admin/members — list everyone, newest first
router.get('/members', (req, res) => {
  const members = db.prepare('SELECT * FROM members ORDER BY created_at DESC').all();
  res.json({ members });
});

// POST /api/admin/members/:id/toggle  { on: true|false }
// This is the manual kill switch — independent of Stripe billing status.
// Flip it off and the member's License.key will read INACTIVE next time
// they (or your distribution step) regenerate it.
router.post('/members/:id/toggle', (req, res) => {
  const { id } = req.params;
  const { on } = req.body;
  const value = on ? 'on' : 'off';

  const result = db
    .prepare("UPDATE members SET manual_override = ?, updated_at = datetime('now') WHERE id = ?")
    .run(value, id);

  if (result.changes === 0) return res.status(404).json({ error: 'Member not found' });

  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
  res.json({ member });
});

// GET /api/admin/members/:id/license — returns the License.key file contents
// Send this text to the member (email attachment) to drop into
// MQL4/Files/License.key in their MetaTrader data folder.
router.get('/members/:id/license', (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!member) return res.status(404).json({ error: 'Member not found' });

  const { status, expiresOn } = deriveLicenseStatus(member);
  const fileText = buildLicenseFile({
    name: member.name,
    email: member.email,
    status,
    expiresOn,
    secret: process.env.LICENSE_SECRET,
  });

  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', 'attachment; filename="License.key"');
  res.send(fileText);
});

// POST /api/admin/members/:id/rotate-token
// Generates a brand new access token for this member, instantly invalidating
// their old one — use this if a client's token ever leaks or gets shared.
router.post('/members/:id/rotate-token', (req, res) => {
  const newToken = crypto.randomBytes(16).toString('hex');
  const result = db
    .prepare("UPDATE members SET access_token = ?, updated_at = datetime('now') WHERE id = ?")
    .run(newToken, req.params.id);

  if (result.changes === 0) return res.status(404).json({ error: 'Member not found' });

  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  res.json({ member });
});

// DELETE /api/admin/members/:id — remove a member record entirely
router.delete('/members/:id', (req, res) => {
  db.prepare('DELETE FROM members WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
