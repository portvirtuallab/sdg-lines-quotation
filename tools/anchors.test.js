/* Checks the freight curve against a fixed snapshot of the old workbook.
   Usage: node tools/anchors.test.js

   Why this exists
   ---------------
   tools/validate.js replays 643 quotations and passes 643. It cannot notice a
   change to the freight curve, because the expectations in test-cases.json were
   recomputed with that same curve: move the curve and both sides of the
   comparison move together.

   This file compares the curve against something it cannot influence - 36
   distances read out of the old workbook in September 2026, before the
   re-rating. It is not a pass/fail on the prices themselves: the current curve
   is deliberately not the September one. What it asserts is that the difference
   stays a UNIFORM re-rating. A flat percentage is a tariff decision. A curve
   that has drifted at one end and not the other is a mistake, and that is the
   thing worth catching.

   When the tariff is re-rated again, update EXPECTED_RATIO to the new figure
   and say in the commit message why it moved. */

const path = require('path');
const { FreightCurve } = require(path.join(__dirname, '..', 'data', 'tariffs.json'));

/* Base freight per FEU, in euros, by nautical miles. Read from the cached
   values of BOOKINGS!Studio and BOOKINGS!"Form responses 1" in the September
   2026 export of the old workbook. Not maintained: it is a fixed point of
   reference, and that is the whole of its usefulness. */
const SEPTEMBER_2026 = [
  [163, 664.2978], [279, 688.8702], [352, 704.2591], [516, 731.604],
  [539, 735.2664], [626, 748.8012], [645, 751.6947], [652, 752.7554],
  [702, 760.2523], [1042, 808.0999], [1316, 843.5346], [1543, 871.2498],
  [1545, 871.4882], [1621, 880.4755], [1668, 885.9665], [1829, 904.4098],
  [1842, 905.8752], [1896, 911.9263], [1897, 912.0378], [1898, 912.1493],
  [2274, 952.7609], [2282, 953.5983], [2403, 966.1385], [2544, 980.4654],
  [2701, 996.0757], [2935, 1018.7156], [4030, 1137.3633], [5117, 1274.2751],
  [5153, 1278.8094], [5216, 1286.7445], [5813, 1361.939], [7778, 1609.4383],
  [8386, 1686.0182], [8667, 1721.4113], [8852, 1744.7127], [10000, 1889.3077],
];

/* The current curve as a fraction of the September one. Update deliberately. */
const EXPECTED_RATIO = 0.98383;

/* How far any single distance may sit from that ratio. A real re-rating is
   flat to well inside this; the measured spread is 0.001 percentage points. */
const TOLERANCE = 0.0005;

const curve = [...FreightCurve].sort((a, b) => a.nm - b.nm);

/* ------------------------------------------------------------------ *
 * A charge marked in_total = FALSE must not reach the total.
 *
 * The same blind spot as the curve: test-cases.json was produced by the
 * engine, so whatever the engine did with AMS became the expectation. It
 * was adding it, against the Surcharges tab and against VALIDATION.md,
 * and 643/643 stayed green. None of the 643 cases asks for AMS.
 * ------------------------------------------------------------------ */
function checkInTotal() {
  const E = require(path.join(__dirname, '..', 'js', 'engine.js'));
  const db = Object.assign(
    {},
    require(path.join(__dirname, '..', 'data', 'network.json')),
    require(path.join(__dirname, '..', 'data', 'tariffs.json')),
  );
  const ix = E.index(db);
  const shipment = {
    from: 'BARCELONA', to: 'DAMIETTA',
    equipment: '20 feet Reefer', units: 3, vgm: true, dangerous: false,
  };

  const without = E.quoteFreight(ix, Object.assign({}, shipment, { ams: false }));
  const with_ = E.quoteFreight(ix, Object.assign({}, shipment, { ams: true }));
  const line = with_.lines.find((l) => l.code === 'AMS');

  const problems = [];
  if (!line) problems.push('  AMS was requested but no AMS line was produced.');
  if (line && line.in_total !== false) {
    problems.push('  The AMS line does not carry in_total = false.');
  }
  if (Math.abs(with_.total - without.total) > 0.005) {
    problems.push(
      '  Asking for AMS moved the total by ' +
        (with_.total - without.total).toFixed(2) +
        ' euro. A charge the Surcharges tab excludes must not change it.',
    );
  }

  /* And every quotation's total must be the sum of the lines that count. */
  const counted = with_.lines
    .filter((l) => l.in_total !== false)
    .reduce((t, l) => t + l.amount, 0);
  if (Math.abs(counted - with_.total) > 0.005) {
    problems.push(
      '  The total is ' + with_.total.toFixed(2) + ' but the lines that count add up to ' +
        counted.toFixed(2) + '.',
    );
  }

  console.log('\nCharges excluded from the total');
  if (problems.length) {
    problems.forEach((p) => console.log(p));
    return false;
  }
  console.log('  OK - AMS is printed and does not reach the total.');
  return true;
}

/* ------------------------------------------------------------------ *
 * Two tariff decisions, taken in November 2026.
 *
 *  - Customs clearance is not a service the carrier sells. It stays on the
 *    document so the operation is complete, and out of the total.
 *  - Control was withdrawn altogether.
 *
 * Legacy mode must be untouched by both: it reproduces the old system, which
 * billed them. If this test and the 643 ever disagree, read that paragraph
 * again before changing either one.
 * ------------------------------------------------------------------ */
function checkNovemberTariff() {
  const E = require(path.join(__dirname, '..', 'js', 'engine.js'));
  const db = Object.assign(
    {},
    require(path.join(__dirname, '..', 'data', 'network.json')),
    require(path.join(__dirname, '..', 'data', 'tariffs.json')),
  );
  const ix = E.index(db);
  const base = {
    from: 'BARCELONA', to: 'DAMIETTA',
    equipment: '20 feet Reefer', units: 3, vgm: true, dangerous: false,
  };

  const now = E.quoteFreight(ix, base);
  const old = E.quoteFreight(ix, Object.assign({}, base, { mode: 'legacy' }));
  const arrival = E.quoteArrival(ix, {
    port: 'BARCELONA', equipment: '20 feet Container (Dry Cargo)', units: 1,
  });

  const find = (q, code) => q.lines.find((l) => l.code === code);
  const problems = [];

  if (find(now, 'CONTROL')) problems.push('  Control is still being quoted. It was withdrawn.');
  if (!find(old, 'CONTROL')) problems.push('  Legacy stopped billing Control, so the replay will drift.');

  for (const [q, what] of [[now, 'a freight quotation'], [arrival, 'an arrival quotation']]) {
    const cc = find(q, 'CUSTOM_CLEARANCE');
    if (!cc) problems.push('  Customs clearance is missing from ' + what + '. It should be shown.');
    else if (cc.in_total !== false) {
      problems.push('  Customs clearance counts towards the total on ' + what + '.');
    }
  }

  const oldCc = find(old, 'CUSTOM_CLEARANCE');
  if (!oldCc || oldCc.in_total === false) {
    problems.push('  Legacy stopped counting customs clearance, so the replay will drift.');
  }

  /* Whatever the rules, the arithmetic on the page has to close. */
  for (const [q, what] of [[now, 'corrected'], [old, 'legacy'], [arrival, 'arrival']]) {
    const counted = q.lines.filter((l) => l.in_total !== false).reduce((s, l) => s + l.amount, 0);
    if (Math.abs(counted - q.total) > 0.005) {
      problems.push(
        '  The ' + what + ' total is ' + q.total.toFixed(2) +
          ' but its counting lines add up to ' + counted.toFixed(2) + '.',
      );
    }
  }

  console.log('');
  console.log('November 2026 tariff decisions');
  if (problems.length) {
    problems.forEach((p) => console.log(p));
    return false;
  }
  console.log('  OK - Control withdrawn, customs clearance informative, legacy unchanged.');
  return true;
}

function baseFeu(nm) {
  if (nm <= curve[0].nm) return curve[0].base_feu_eur;
  if (nm >= curve[curve.length - 1].nm) return curve[curve.length - 1].base_feu_eur;
  for (let i = 1; i < curve.length; i++) {
    if (nm > curve[i].nm) continue;
    const low = curve[i - 1];
    const high = curve[i];
    const ratio = (nm - low.nm) / (high.nm - low.nm);
    return low.base_feu_eur + ratio * (high.base_feu_eur - low.base_feu_eur);
  }
}

const off = [];
let min = Infinity;
let max = -Infinity;

for (const [nm, september] of SEPTEMBER_2026) {
  const ratio = baseFeu(nm) / september;
  min = Math.min(min, ratio);
  max = Math.max(max, ratio);
  if (Math.abs(ratio - EXPECTED_RATIO) > TOLERANCE) {
    off.push(
      `  ${String(nm).padStart(6)} NM: ${baseFeu(nm).toFixed(2)} against ${september.toFixed(2)}` +
        ` = ${(ratio * 100).toFixed(3)} %, expected ${(EXPECTED_RATIO * 100).toFixed(3)} %`,
    );
  }
}

console.log(`Freight curve against the September 2026 workbook, ${SEPTEMBER_2026.length} distances`);
console.log(
  `  ratio ${(min * 100).toFixed(3)} % to ${(max * 100).toFixed(3)} %` +
    ` (spread ${((max - min) * 100).toFixed(3)} pp), expected ${(EXPECTED_RATIO * 100).toFixed(3)} %`,
);

if (off.length) {
  console.log(`\n${off.length} distance(s) outside the tolerance:`);
  off.forEach((line) => console.log(line));
  console.log(
    '\nEither the curve was edited at some distances and not others, which is a mistake,\n' +
      'or the tariff was re-rated, in which case update EXPECTED_RATIO and say why.',
  );
  process.exit(1);
}

console.log('  OK - the difference is a uniform re-rating, not drift.');

let green = checkInTotal();
if (!checkNovemberTariff()) green = false;
if (!green) process.exit(1);
