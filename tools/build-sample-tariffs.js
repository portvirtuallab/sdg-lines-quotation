/* Builds data/tariffs-sample.json, the tariff set the Desk is given when
 * nobody has entered a course code.
 *
 * It holds the ports and the freight curve, which are enough to show a route,
 * its distance and what ocean freight on it starts at. It does not hold the
 * surcharges, the terminal handling or the equipment factors, so a total
 * cannot be assembled from it.
 *
 * This file is what the page loads as its offline fallback, in place of the
 * full tariffs it used to load. Apps Script applies the same reduction at the
 * server in sampleOf_(), and the two have to agree, so the shape here is kept
 * deliberately identical to that function's.
 *
 * Usage: node tools/build-sample-tariffs.js
 */
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'data');
const full = JSON.parse(fs.readFileSync(path.join(DATA, 'tariffs.json'), 'utf8'));

/* The same four keys Access.gs sends: how long a quotation is valid, the hub,
   and which pricing mode is in force. Nothing that carries a price. */
const SHOWN_SETTINGS = new Set([
  'freight_validity_days',
  'arrival_validity_days',
  'hub_port',
  'freight_mode',
]);

const sample = {
  sample: true,
  generated_at: new Date().toISOString(),
  Ports: full.Ports,
  FreightCurve: full.FreightCurve,
  Settings: full.Settings.filter((row) => SHOWN_SETTINGS.has(row.key)),
  Equipment: [],
  THC: [],
  Surcharges: [],
};

fs.writeFileSync(path.join(DATA, 'tariffs-sample.json'), JSON.stringify(sample, null, 2) + '\n');

/* A sample that still contains a price is not a sample. This is cheap to
   check and expensive to get wrong, so it is checked every time. */
const text = JSON.stringify(sample);
const leaks = [];
for (const row of full.Surcharges) {
  if (text.includes('"' + row.code + '"')) leaks.push('surcharge ' + row.code);
}
if (sample.THC.length) leaks.push('terminal handling');
if (sample.Equipment.length) leaks.push('equipment factors');
for (const key of ['eua_price_eur_t', 'baf_category_step', 'port_additional_pct']) {
  if (text.includes(key)) leaks.push('setting ' + key);
}
if (leaks.length) {
  console.error('the sample still carries: ' + leaks.join(', '));
  process.exit(1);
}

console.log('data/tariffs-sample.json written');
console.log('  ports           ', sample.Ports.length);
console.log('  freight curve   ', sample.FreightCurve.length, 'points');
console.log('  settings        ', sample.Settings.map((s) => s.key).join(', ') || 'none');
console.log('  surcharges, THC and equipment factors: none, which is the point');
