/* Replays every shipment the old Google Forms system quoted, against this engine in legacy mode.
   Usage: node tools/validate.js

   What this checks: that the pricing RULES still reproduce the old sheet - the surcharges, the BAF
   ladder, the THC lookup, the port additionals, the ETS, the per-unit behaviour.

   What it cannot check: whether the freight curve is still the right one. The expectations in
   test-cases.json were recomputed at the current tariff, so a change to the curve moves both sides
   of the comparison together and this suite stays green. tools/anchors.test.js exists for that. */
const path = require("path");
const E = require(path.join(__dirname, "..", "js", "engine.js"));
const db = Object.assign({}, require(path.join(__dirname, "..", "data", "network.json")), require(path.join(__dirname, "..", "data", "tariffs.json")));
const T = require(path.join(__dirname, "test-cases.json"));
const ix = E.index(db);
let ok = 0, okA = 0; const bad = [], badA = [];
for (const t of T.freight) {
  try { const q = E.quoteFreight(ix, { ...t, mode: "legacy" }); Math.abs(q.total - t.exp.total) < 0.05 ? ok++ : bad.push(`${t.exp.qno} ${t.from}-${t.to} ${q.total} vs ${t.exp.total}`); }
  catch (e) { bad.push(`${t.exp.qno} ${e.message}`); }
}
for (const t of T.arrival) {
  try { const q = E.quoteArrival(ix, { ...t, mode: "legacy" }); Math.abs(q.total - t.exp.total) < 0.05 ? okA++ : badA.push(`${t.exp.qno} ${t.port} DG=${t.dangerous} ${q.total} vs ${t.exp.total}`); }
  catch (e) { badA.push(`${t.exp.qno} ${e.message}`); }
}
console.log(`Freight quotations: ${ok}/${T.freight.length} identical to the recorded expectations`); bad.forEach(b => console.log("  ", b));
console.log(`Arrival charges:    ${okA}/${T.arrival.length} identical to the recorded expectations`); badA.forEach(b => console.log("  ", b));
