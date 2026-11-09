/* Finds sailings in the published schedule (Sailings tab): direct calls on one vessel, or via the hub. */
(function (root) {
  "use strict";
  const parse = s => { const m = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{1,2}):(\d{2})/.exec(s || ""); return m ? new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]) : null; };
  const DAY = 864e5, MAX_VOYAGE = 45 * DAY;

  function build(sailings) {
    const byVessel = {};
    sailings.forEach(s => {
      const etd = parse(s.etd_from_local), eta = parse(s.eta_to_local);
      if (!etd || !eta || etd.getFullYear() < 2000) return;
      (byVessel[s.vessel] = byVessel[s.vessel] || []).push({ ...s, etd, eta });
    });
    Object.values(byVessel).forEach(l => l.sort((a, b) => a.etd - b.etd));
    return byVessel;
  }

  function voyages(idx, from, to, after, limit) {
    const out = [];
    Object.entries(idx).forEach(([vessel, legs]) => {
      legs.forEach((leg, i) => {
        if (leg.from !== from || leg.etd < after) return;
        for (let j = i; j < legs.length && legs[j].etd - leg.etd < MAX_VOYAGE; j++) {
          if (legs[j].to === to) { out.push({ vessel, tripcode: leg.tripcode, service: leg.service, etd: leg.etd, eta: legs[j].eta, legs: [{ vessel, from, to, etd: leg.etd, eta: legs[j].eta, tripcode: leg.tripcode, terminal: leg.terminal }] }); break; }
          if (j > i && legs[j].from === from) break; // vessel came back to origin first
        }
      });
    });
    return out.sort((a, b) => a.eta - b.eta).slice(0, limit || 5);
  }

  function find(idx, from, to, after, via, hub) {
    let opts = voyages(idx, from, to, after, 6);
    const h = via || (opts.length ? null : hub);
    if (h && h !== from && h !== to) {
      voyages(idx, from, h, after, 4).forEach(a => {
        const b = voyages(idx, h, to, new Date(a.eta.getTime() + 12 * 36e5), 1)[0];
        if (b) opts.push({ vessel: a.vessel + " / " + b.vessel, tripcode: a.tripcode + " / " + b.tripcode, service: a.service + " + " + b.service,
          etd: a.etd, eta: b.eta, via: h, legs: [...a.legs, ...b.legs] });
      });
    }
    // de-duplicate identical departures, keep earliest arrival, then sort by departure
    const seen = new Set();
    opts = opts.sort((a, b) => a.eta - b.eta).filter(o => { const k = o.etd.getTime() + o.vessel; if (seen.has(k)) return false; seen.add(k); return true; });
    return opts.sort((a, b) => a.etd - b.etd).slice(0, 4).map(o => ({ ...o, days: Math.max(1, Math.round((o.eta - o.etd) / DAY)) }));
  }

  root.SDGSchedule = { build, find, parse };
})(window);
