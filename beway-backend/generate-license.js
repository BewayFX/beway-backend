// generate-license.js
//
// Quick manual License.key generator — handy for testing the EA's license
// check before wiring up the full backend, or for one-off manual licensing.
//
// Usage:
//   node generate-license.js "Jane Trader" jane@example.com ACTIVE 2026-07-20 your-license-secret
//
// Then copy the printed output into MQL4/Files/License.key in your
// MetaTrader 4 data folder (Terminal -> File -> Open Data Folder -> MQL4 -> Files).

const { buildLicenseFile } = require('./lib/license');

const [, , name, email, status, expiresOn, secret] = process.argv;

if (!name || !email || !status || !expiresOn || !secret) {
  console.log('Usage: node generate-license.js "Full Name" email@example.com ACTIVE 2026-07-20 your-license-secret');
  process.exit(1);
}

const fileText = buildLicenseFile({ name, email, status, expiresOn, secret });
console.log('\n--- Save the following as License.key ---\n');
console.log(fileText);
