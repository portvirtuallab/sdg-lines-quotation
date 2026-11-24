/* The transatlantic service, and the Mediterranean-to-Americas distances it
 * makes possible.
 *
 * Distances here follow the convention the network already uses, which is not
 * the one I first assumed: the Distances table is not a sum of service legs.
 * Damietta to Port Said is 96 miles in that table and there is no leg between
 * them on any service. It is the distance a ship sails between two ports,
 * worked out on its own, while Routes separately says which service you board
 * and where you change.
 *
 * So these are built from waypoints a ship actually passes - Gibraltar for the
 * Atlantic, the Panama Canal for the Pacific - rather than from the rotation.
 */
const fs = require('fs');
const path = require('path');

const net = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'network.json'), 'utf8'));
const tar = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'tariffs.json'), 'utf8'));
const PORT = Object.fromEntries(tar.Ports.map((p) => [p.port, p]));

const SPEED = 18; // knots, the network's service speed
const CALL = 12; // hours alongside, the network's convention

/* Waypoints. Not ports: a ship passes them, works no cargo, and cannot be
   quoted to or from them. */
const GIBRALTAR = { lat: 35.95, lon: -5.65 };
const CRISTOBAL = { lat: 9.35, lon: -79.9 };
const BALBOA = { lat: 8.95, lon: -79.57 };
const CANAL_NM = 44;

const R = 3440.065;
const rad = (x) => (x * Math.PI) / 180;
function gc(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* A great circle is the distance a bird flies. A ship gives coasts and
   shallows a berth, so every leg carries a margin: a small one on open water,
   a larger one where a coast or a strait forces a detour. Both figures are
   taken from the network's own Mediterranean legs. */
const OPEN_OCEAN = 1.03;
const COASTAL = 1.1;

const r0 = (n) => Math.round(n);

/* ------------------------------------------------------- the rotation --- */

/* Three of these six legs already exist elsewhere in the network. They are
   reused at their existing length, so the same water never measures two
   different distances depending on which service you ask. */
const EXISTING = {};
for (const leg of net.ServiceLegs) EXISTING[leg.from + '|' + leg.to] = leg.nm;
const reuse = (from, to) => EXISTING[from + '|' + to] || EXISTING[to + '|' + from] || null;

const SERVICE = 'TATL';

const ROTATION = [
  ['BARCELONA', 'VALENCIA', reuse('BARCELONA', 'VALENCIA')],
  ['VALENCIA', 'TANGER MED', r0(gc(PORT['VALENCIA'], PORT['TANGER MED']) * COASTAL)],
  ['TANGER MED', 'NEW YORK', r0(gc(PORT['TANGER MED'], PORT['NEW YORK']) * OPEN_OCEAN)],
  ['NEW YORK', 'HALIFAX', reuse('NEW YORK', 'HALIFAX')],
  ['HALIFAX', 'TANGER MED', r0(gc(PORT['HALIFAX'], PORT['TANGER MED']) * OPEN_OCEAN)],
  ['TANGER MED', 'BARCELONA', reuse('TANGER MED', 'BARCELONA')],
];
for (const leg of ROTATION) {
  if (leg[2] == null) throw new Error('no distance for ' + leg[0] + ' to ' + leg[1]);
}

const roundTrip = ROTATION.reduce((sum, l) => sum + l[2], 0);
const cycleDays = (roundTrip / SPEED + ROTATION.length * CALL) / 24;
const vesselCount = Math.ceil(cycleDays / 7);

const hhmm = (h) => Math.floor(h) + ':' + String(Math.round((h % 1) * 60)).padStart(2, '0');

const ServiceLegs = ROTATION.map(([from, to, nm], i) => ({
  service: SERVICE,
  seq: i + 1,
  from,
  to,
  nm,
  transit: hhmm(nm / SPEED),
  time_in_port: '12:00',
  speed_kn: SPEED,
}));

const Services = [
  {
    service: SERVICE,
    description: 'Western Mediterranean to the North American Atlantic coast',
    speed_kn: SPEED,
    rotation: ROTATION.map((l) => l[0]).join(' - ') + ' - BARCELONA',
    round_trip_nm: roundTrip,
  },
];

const Vessels = Array.from({ length: vesselCount }, (_, i) => ({
  vessel: 'TATL 0' + (i + 1) + ' (name pending)',
  speed_kn: SPEED,
  time_in_port: '12:00',
  service: SERVICE,
}));

/* A terminal per call. Barcelona and Tanger Med are called twice on the
   rotation; the tab keys on port and service, so each appears once. Where the
   network already names a terminal for a port, that one is used rather than a
   second name for the same quay. */
const CALLS = ['BARCELONA', 'VALENCIA', 'TANGER MED', 'NEW YORK', 'HALIFAX'];
const knownTerminal = {};
for (const t of net.PortTerminals) if (!knownTerminal[t.port]) knownTerminal[t.port] = t.terminal;
const PortTerminals = CALLS.map((port) => ({
  port,
  service: SERVICE,
  terminal: knownTerminal[port] || 'To be confirmed',
  time_in_port: '12:00',
  shipping_agent: PORT[port].agent,
}));

/* ------------------------------------------- the distances it unlocks --- */

/* Which side of the Americas a port is on. The Pacific ones are reached from
   Europe through the canal, which is why they are flagged rather than simply
   measured in a straight line - that line crosses North America. */
const AMERICAS = {
  'NEW YORK': 'atlantic',
  HALIFAX: 'atlantic',
  CARTAGENA: 'atlantic',
  'LOS ANGELES': 'pacific',
  VANCOUVER: 'pacific',
};

/* Ports that face the open Atlantic or the North Sea do not pass Gibraltar to
   reach America: Rotterdam sails west, not south. Measuring every crossing
   through the strait put Rotterdam to New York at 4,409 miles when the water
   between them is about 3,300. */
const OPEN_WATER_REGIONS = new Set(['Northern Europe', 'Atlantic', 'Middle Africa']);
const facesAtlantic = (port) => OPEN_WATER_REGIONS.has(PORT[port].region);

/* Distance is measured port to port, the way the rest of the table is: the
   water a ship covers, not the sum of a rotation's legs. Rotterdam to
   Barcelona is 2,237 miles in that table where the straight line is 640,
   because the straight line crosses France.

   Routes is where the service and the transhipment port are recorded, and the
   two are allowed to differ: a box from Barcelona to Cartagena changes vessel
   at New York, while the water between those two ports is what it is. */
function crossing(euPort, amPort) {
  const start = PORT[euPort];
  const west = facesAtlantic(euPort) ? 0 : gc(start, GIBRALTAR) * COASTAL;
  const from = facesAtlantic(euPort) ? start : GIBRALTAR;

  if (AMERICAS[amPort] === 'atlantic') {
    return west + gc(from, PORT[amPort]) * OPEN_OCEAN;
  }
  /* The Pacific coast is reached through the canal. */
  return (
    west + gc(from, CRISTOBAL) * OPEN_OCEAN + CANAL_NM + gc(BALBOA, PORT[amPort]) * OPEN_OCEAN
  );
}

/* A port east of Suez has two ways round to America, and a real router takes
   the shorter. Busan reaches New York across the Pacific and through the canal
   in less water than it does by Suez and Gibraltar. */
const SUEZ = { lat: 30.0, lon: 32.55 };
const EAST_OF_SUEZ = new Set(['Red Sea', 'Southern Asia', 'Eastern Asia']);
function shorterWay(euPort, amPort) {
  const viaGibraltar = crossing(euPort, amPort);
  if (!EAST_OF_SUEZ.has(PORT[euPort].region)) return viaGibraltar;

  /* Eastward, across the Pacific. A Pacific coast port is reached straight
     across; an Atlantic one needs the canal after the crossing. */
  const start = PORT[euPort];
  const viaPacific =
    AMERICAS[amPort] === 'pacific'
      ? gc(start, PORT[amPort]) * OPEN_OCEAN
      : gc(start, BALBOA) * OPEN_OCEAN + CANAL_NM + gc(CRISTOBAL, PORT[amPort]) * OPEN_OCEAN;

  return Math.min(viaGibraltar, viaPacific);
}

const americanPorts = Object.keys(AMERICAS);
const europeanPorts = tar.Ports.map((p) => p.port).filter((p) => !AMERICAS[p]);

const TATL_CALLS = new Set(CALLS);
const AM_ATLANTIC = new Set(['NEW YORK', 'HALIFAX']);
/* Which service a port already sits on, for a shipment that has to reach the
   transatlantic before it can cross. */
const firstServiceOf = {};
for (const r of net.Routes) if (!firstServiceOf[r.from]) firstServiceOf[r.from] = r.first_service;

const have = new Set(net.Distances.map((d) => d.from + '|' + d.to));
const Distances = [];
const Routes = [];

for (const eu of europeanPorts) {
  for (const am of americanPorts) {
    const nm = r0(shorterWay(eu, am));

    /* Where a shipment changes vessel. From a port the transatlantic calls at
       it does not change at all to reach New York or Halifax; from anywhere
       else it joins the crossing at Barcelona. A Pacific destination means a
       second change at New York, and the table records the change that
       matters operationally rather than pretending there is only one. */
    const joinsAt = TATL_CALLS.has(eu) ? '' : 'BARCELONA';

    const westbound = {
      from: eu,
      to: am,
      via: AM_ATLANTIC.has(am) ? joinsAt : 'NEW YORK',
      first_service: TATL_CALLS.has(eu) ? SERVICE : firstServiceOf[eu] || SERVICE,
      nm,
    };
    const eastbound = {
      from: am,
      to: eu,
      via: AM_ATLANTIC.has(am) ? joinsAt : 'NEW YORK',
      first_service: AM_ATLANTIC.has(am) ? SERVICE : 'AM-INT',
      nm,
    };

    for (const row of [westbound, eastbound]) {
      if (have.has(row.from + '|' + row.to)) continue;
      Distances.push({ from: row.from, to: row.to, nm, road_km: '' });
      Routes.push(row);
    }
  }
}

fs.writeFileSync(
  path.join(__dirname, 'transatlantic.json'),
  JSON.stringify({ Services, ServiceLegs, Vessels, PortTerminals, Distances, Routes }, null, 2) +
    '\n',
);

console.log('TATL rotation');
for (const l of ServiceLegs) {
  console.log(('  ' + l.seq + '. ' + l.from + ' -> ' + l.to).padEnd(38), String(l.nm).padStart(5), 'nm');
}
console.log(
  '  round trip'.padEnd(38),
  String(roundTrip).padStart(5),
  'nm  ',
  cycleDays.toFixed(2),
  'days  ',
  vesselCount,
  'vessels',
);
console.log('\ntransit from Barcelona');
let acc = 0;
let hours = 0;
for (const l of ServiceLegs) {
  acc += l.nm;
  hours += l.nm / SPEED;
  console.log('  ' + l.to.padEnd(14), String(acc).padStart(5), 'nm ', (hours / 24).toFixed(2), 'days');
  hours += CALL;
  if (l.to === 'HALIFAX') break;
}
console.log('\nnew pairs:', Distances.length, 'distances,', Routes.length, 'routes');
if (Distances.length === 0) {
  console.log('(the network already holds every pair, so there was nothing to add)');
}
console.log('sample:');
for (const pair of [
  ['BARCELONA', 'NEW YORK'],
  ['BARCELONA', 'LOS ANGELES'],
  ['BEIRUT', 'NEW YORK'],
  ['ROTTERDAM', 'NEW YORK'],
  ['BARCELONA', 'CARTAGENA'],
]) {
  /* On a second run the pairs are already in the network, so the sample falls
     back to what is there. A builder that crashes when its work is already
     done is a builder nobody runs twice. */
  const rt =
    Routes.find((x) => x.from === pair[0] && x.to === pair[1]) ||
    net.Routes.find((x) => x.from === pair[0] && x.to === pair[1]);
  if (!rt) {
    console.log('  ' + (pair[0] + ' -> ' + pair[1]).padEnd(28), 'no route');
    continue;
  }
  console.log(
    '  ' + (pair[0] + ' -> ' + pair[1]).padEnd(28),
    String(rt.nm).padStart(6),
    'nm  via',
    (rt.via || 'direct').padEnd(10),
    'on',
    rt.first_service,
  );
}
