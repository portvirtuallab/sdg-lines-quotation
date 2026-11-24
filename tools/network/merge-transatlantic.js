/* Merges the transatlantic service into the Desk's snapshot.
   Append-only and safe to run twice: rows are keyed the way the sheet keys
   them, so a second run replaces rather than duplicates. */
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', '..', 'data');
const add = JSON.parse(fs.readFileSync(path.join(__dirname, 'transatlantic.json'), 'utf8'));
const net = JSON.parse(fs.readFileSync(path.join(DATA, 'network.json'), 'utf8'));

const KEY = {
  Services: (r) => r.service,
  ServiceLegs: (r) => r.service + '|' + r.seq,
  Vessels: (r) => r.vessel,
  PortTerminals: (r) => r.port + '|' + r.service,
  Distances: (r) => r.from + '|' + r.to,
  Routes: (r) => r.from + '|' + r.to,
};

for (const table of Object.keys(KEY)) {
  const key = KEY[table];
  const into = net[table];
  const index = new Map(into.map((row, i) => [key(row), i]));
  let added = 0;
  let replaced = 0;
  for (const row of add[table]) {
    const k = key(row);
    if (index.has(k)) {
      into[index.get(k)] = row;
      replaced++;
    } else {
      index.set(k, into.length);
      into.push(row);
      added++;
    }
  }
  console.log(
    table.padEnd(15),
    String(added).padStart(4),
    'added ',
    String(replaced).padStart(3),
    'replaced ',
    String(into.length).padStart(5),
    'total',
  );
}

/* network.json ships minified, as the build writes it. Keeping that means the
   diff shows the rows that changed rather than a reformat of all of them. */
fs.writeFileSync(path.join(DATA, 'network.json'), JSON.stringify(net));
console.log('\nnetwork.json written,', fs.statSync(path.join(DATA, 'network.json')).size, 'bytes');
