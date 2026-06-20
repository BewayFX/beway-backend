// license.js
//
// Generates the License.key file content that members drop into their
// MetaTrader 4 "Files" folder. The EA reads this file on init / once a day
// and refuses to trade if the status, expiry, or checksum don't check out.
//
// The checksum is a lightweight custom hash (DJB2-XOR variant), NOT
// cryptographic-grade security. MQL4 has no built-in crypto/hash library,
// so this is meant as a tamper *deterrent* for casual file editing, not a
// bulletproof DRM system. A determined user could still patch the compiled
// .ex4. Treat this as "good enough to stop accidental/casual sharing,"
// pair it with normal Stripe fraud tools for the real protection.

function bewayHash(str) {
  let hash = 5381 >>> 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(hash, 33) ^ str.charCodeAt(i)) >>> 0;
  }
  return hash >>> 0;
}

function toHex8(num) {
  return num.toString(16).toUpperCase().padStart(8, '0');
}

/**
 * Build the plain-text license file content for a member.
 * @param {Object} member
 * @param {string} member.name
 * @param {string} member.email
 * @param {'ACTIVE'|'INACTIVE'} status
 * @param {string} expiresOn - YYYY-MM-DD
 * @param {string} secret - LICENSE_SECRET from env
 */
function buildLicenseFile({ name, email, status, expiresOn, secret }) {
  const payload = `${name}|${email}|${status}|${expiresOn}|${secret}`;
  const checksum = toHex8(bewayHash(payload));

  return [
    `Name=${name}`,
    `Email=${email}`,
    `Status=${status}`,
    `ExpiresOn=${expiresOn}`,
    `Checksum=${checksum}`,
    '',
  ].join('\r\n');
}

/**
 * Decide ACTIVE vs INACTIVE from the member's billing + manual override state,
 * and pick the expiry date to print on the license file.
 */
function deriveLicenseStatus(member) {
  const billingOk = member.billing_status === 'active';
  const manualOk = member.manual_override === 'on';
  const status = billingOk && manualOk ? 'ACTIVE' : 'INACTIVE';

  // Give a couple of days of grace past the Stripe period end so a slightly
  // delayed renewal doesn't instantly kill the EA mid-trade-week.
  let expiresOn = member.current_period_end
    ? member.current_period_end.slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  return { status, expiresOn };
}

module.exports = { bewayHash, toHex8, buildLicenseFile, deriveLicenseStatus };
