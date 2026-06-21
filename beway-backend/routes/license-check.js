const express = require('express');
const db = require('../db');
const { deriveLicenseStatus } = require('../lib/license');

const router = express.Router();

// GET /api/license-check/:token
//
// This is what the EA itself calls (via MQL4's WebRequest) every time it
// wants to confirm a member's access — no LicenseSecret needed on the
// client side at all, since the answer comes straight from this server
// over HTTPS. Each member has their own private token (instead of one
// shared secret embedded in every copy of the EA), so even if one
// client's token leaked, it would only ever affect that one client.
//
// Response is plain text, same simple key=value style as the offline
// License.key file, so the EA can reuse the same small parser for both.
router.get('/license-check/:token', (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE access_token = ?').get(req.params.token);

  res.setHeader('Content-Type', 'text/plain');

  if (!member) {
    return res.status(404).send('Status=INACTIVE\r\nReason=Unknown license token\r\n');
  }

  const { status, expiresOn } = deriveLicenseStatus(member);
  res.send(
    [`Name=${member.name}`, `Status=${status}`, `ExpiresOn=${expiresOn}`, ''].join('\r\n')
  );
});

module.exports = router;
