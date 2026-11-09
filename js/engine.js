/* SDG Lines quotation engine. Pure functions, no DOM. Works in the browser (window.SDGEngine) and in Node (require). */
(function (root) {
  "use strict";
  const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
  const CAT_INDEX = { A: 0, B: 1, C: 2, D: 3 };

  function index(db) {
    const by = (arr, key) => Object.fromEntries(arr.map(x => [x[key], x]));
    const settings = Object.fromEntries(db.Settings.map(s => [s.key, s.value]));
    const dist = {};
    db.Distances.forEach(d => { (dist[d.from] = dist[d.from] || {})[d.to] = d; });
    const routes = {};
    db.Routes.forEach(r => { (routes[r.from] = routes[r.from] || {})[r.to] = r; });
    const curve = db.FreightCurve.map(c => [Number(c.nm), Number(c.base_feu_eur)]).sort((a, b) => a[0] - b[0]);
    return { db, settings, ports: by(db.Ports, "port"), equipment: by(db.Equipment, "equipment"), thc: by(db.THC, "equipment"),
      surcharges: by(db.Surcharges, "code"), dist, routes, curve };
  }

  /* Base sea freight per FEU from the distance curve (linear interpolation between published points). */
  function baseFreight(ix, nm) {
    const c = ix.curve;
    if (!c.length) return 0;
    if (nm <= c[0][0]) { const s = (c[1][1] - c[0][1]) / (c[1][0] - c[0][0]); return c[0][1] + (nm - c[0][0]) * s; }
    for (let i = 1; i < c.length; i++) {
      if (nm <= c[i][0]) { const [x0, y0] = c[i - 1], [x1, y1] = c[i]; return y0 + (nm - x0) * (y1 - y0) / (x1 - x0); }
    }
    const n = c.length, s = (c[n - 1][1] - c[n - 2][1]) / (c[n - 1][0] - c[n - 2][0]);
    return c[n - 1][1] + (nm - c[n - 1][0]) * s;
  }

  const sur = (ix, code, cat) => Number(ix.surcharges[code][cat]) || 0;
  /* Does this charge count towards the total? The Surcharges tab decides, through
     its in_total column; a code it does not list - ocean freight, BAF - counts.
     Today two codes say no: AMS, and customs clearance, which is a third-party
     cost shown so the operation is complete and not a service the carrier sells.

     Legacy mode ignores all of this on purpose. The old system put both of them
     in the total, and legacy exists to reproduce what the old system did, errors
     included. Honouring the column here would make the replay disagree with the
     405 quotations it is checked against, which is the one thing it must not do. */
  const inTotal = (ix, code, legacy) => {
    if (legacy) return true;
    const row = ix.surcharges[code];
    return !row || row.in_total === undefined || row.in_total === "" ? true
      : !(row.in_total === false || String(row.in_total).toUpperCase() === "FALSE");
  };

  function route(ix, from, to) {
    const d = ix.dist[from] && ix.dist[from][to];
    const r = ix.routes[from] && ix.routes[from][to];
    return { nm: d ? Number(d.nm) : null, road_km: d && d.road_km ? Number(d.road_km) : null, via: r ? r.via : "", service: r ? r.first_service : "" };
  }

  function ets(ix, emissionsKg, units) {
    const S = ix.settings;
    let v = emissionsKg / 1000 * Number(S.eua_price_eur_t) * units;
    const fee = v < Number(S.ets_fee_threshold_eur) ? Number(S.ets_admin_fee_eur) : 0;
    return { cost: r2(v), fee, total: r2(v + fee) };
  }

  /* Container / RORO freight quotation. opts: {from,to,equipment,units,vgm,ams,dangerous,mode} */
  function quoteFreight(ix, o) {
    const S = ix.settings, mode = o.mode || S.freight_mode || "corrected", legacy = mode === "legacy";
    const q = Math.max(1, Number(o.units) || 1);
    const eq = ix.equipment[o.equipment]; if (!eq) throw new Error("Unknown equipment: " + o.equipment);
    const po = ix.ports[o.from], pd = ix.ports[o.to]; if (!po || !pd) throw new Error("Unknown port");
    const cat = po.category, step = Math.pow(Number(S.baf_category_step), CAT_INDEX[cat]);
    const rt = route(ix, o.from, o.to); if (rt.nm == null) throw new Error("No distance for " + o.from + "–" + o.to);
    const lines = [];
    /* in_total comes from the Surcharges tab. A charge with in_total = FALSE is
       shown on the quotation but does not count towards it: AMS is the only one
       today. Anything the tab does not mention counts, which is the safe default
       for ocean freight and BAF. Returns the amount that reaches the total, so a
       line outside it cannot be added by accident at the call site. */
    const add = (code, label, perUnit, mult, group, note) => {
      const amount = r2(perUnit * mult);
      const counts = inTotal(ix, code, legacy);
      lines.push({ code, label, unit_price: r2(perUnit), qty: mult, amount, group, in_total: counts, note: note || "" });
      return counts ? amount : 0;
    };

    const feu = r2(baseFreight(ix, rt.nm));
    const bafUnit = r2(Number(eq.baf_base_A) * step);
    let freight, baf;
    if (legacy) { freight = add("OCEAN_FREIGHT", "Ocean freight", feu, 1, "freight"); baf = add("BAF", "BAF", bafUnit, 1, "freight"); }
    else { freight = add("OCEAN_FREIGHT", "Ocean freight", feu * Number(eq.freight_factor), q, "freight", `Base FEU €${feu.toFixed(2)} × factor ${eq.freight_factor}`); baf = add("BAF", "BAF", bafUnit, q, "freight"); }

    const thcU = Number(ix.thc[o.equipment][cat]);
    add("THC", "THC (origin)", thcU, q, "surcharge");
    const pct = Number(S.port_additional_pct);
    add("PORT_ADDITIONAL", "Port additionals", r2(thcU * pct), legacy ? q * q : q, "surcharge");
    add("PORT_TAXES", "Port taxes", sur(ix, "PORT_TAXES", cat), q, "surcharge");
    if (o.vgm) add("VGM", "VGM", sur(ix, "VGM", cat), q, "surcharge");
    add("DOCUMENTATION", "Documentation", sur(ix, "DOCUMENTATION", cat), 1, "surcharge");
    add("ISPS", "ISPS", sur(ix, "ISPS", cat), q, "surcharge");
    add("LOGISTIC_MANAGEMENT", "Logistic management", sur(ix, "LOGISTIC_MANAGEMENT", cat), 1, "surcharge");
    add("SEAL", "Seal", sur(ix, "SEAL", cat), q, "surcharge");
    if (o.ams && !legacy) add("AMS", "AMS - Manifest", sur(ix, "AMS", cat), 1, "surcharge");
    if (o.dangerous) add("IMO", "IMO (dangerous goods)", sur(ix, "IMO", cat), q, "surcharge", o.imoClass ? "Class " + o.imoClass : "");
    if (Number(eq.plugin_per_day)) add("PLUGIN", "Plug-in", Number(eq.plugin_per_day) * Number(S.plugin_days_included), legacy ? 1 : q, "surcharge", `${S.plugin_days_included} days included`);

    const emUnit = rt.nm * Number(eq.emission_factor) / 1000;           // kg CO2e per unit
    const emissions = legacy ? emUnit : emUnit * q;
    const e = ets(ix, emUnit, q);
    add("ETS", "ETS", e.total, 1, "surcharge", e.fee ? `includes €${e.fee} fee` : "");
    add("CUSTOM_CLEARANCE", "Customs clearance", sur(ix, "CUSTOM_CLEARANCE", cat), 1, "surcharge",
      "not a carrier service; shown so the operation is complete");
    /* Control was withdrawn from the tariff. Legacy still bills it: the 405
       recorded quotations have it, and the replay has to match them. */
    if (legacy) add("CONTROL", "Control", sur(ix, "CONTROL", cat), q, "surcharge");

    const totFreight = r2(lines.filter(l => l.group === "freight" && l.in_total !== false).reduce((s, l) => s + l.amount, 0));
    const totSur = r2(lines.filter(l => l.group === "surcharge" && l.in_total !== false).reduce((s, l) => s + l.amount, 0));
    const truck = emissions * Number(S.truck_co2_ratio);
    return {
      type: "freight", mode, from: o.from, to: o.to, via: rt.via, service: rt.service, nm: rt.nm, km: Math.round(rt.nm * 1.852), road_km: rt.road_km,
      equipment: eq.equipment, group: eq.group, units: q, category: cat, base_feu: feu, lines,
      total_freight: totFreight, total_surcharges: totSur, total: r2(totFreight + totSur),
      co2: { sea_kg: Math.round(emissions), truck_kg: Math.round(truck), saving_kg: Math.round(truck) - Math.round(emissions), ets_cost: e.cost, ets_fee: e.fee }
    };
  }

  /* Arrival charges at the port of discharge. opts: {port,equipment,units,dangerous,mode} */
  function quoteArrival(ix, o) {
    const S = ix.settings, legacy = (o.mode || S.freight_mode) === "legacy";
    const q = Math.max(1, Number(o.units) || 1), p = ix.ports[o.port], eq = ix.equipment[o.equipment];
    if (!p || !eq) throw new Error("Unknown port or equipment");
    const cat = p.category, lines = [];
    const add = (code, label, u, m, note) => {
      const amount = r2(u * m);
      lines.push({ code, label, unit_price: r2(u), qty: m, amount, group: "cost", in_total: inTotal(ix, code, legacy), note: note || "" });
    };
    const thcU = Number(ix.thc[o.equipment][cat]);
    add("THC", "THC (destination)", thcU, q);
    add("PORT_ADDITIONAL", "Port additionals", r2(thcU * Number(S.port_additional_pct)), legacy ? 1 : q);
    add("PORT_TAXES", "Port taxes", sur(ix, "PORT_TAXES", cat), q);
    add("DOCUMENTATION", "Documentation", sur(ix, "DOCUMENTATION", cat), 1);
    add("LOGISTIC_MANAGEMENT", "Logistic management", sur(ix, "LOGISTIC_MANAGEMENT", cat), 1);
    if (o.dangerous) add("IMO", "IMO (dangerous goods)", sur(ix, "IMO", cat), legacy ? 1 : q);
    add("CUSTOM_CLEARANCE", "Customs clearance", sur(ix, "CUSTOM_CLEARANCE", cat), 1,
      "not a carrier service; shown so the operation is complete");
    if (Number(eq.plugin_per_day) && !legacy) add("PLUGIN", "Plug-in (per day, if needed)", Number(eq.plugin_per_day), 0, "informative");
    const total = r2(lines.filter(l => l.in_total !== false).reduce((s, l) => s + l.amount, 0));
    return { type: "arrival", mode: legacy ? "legacy" : "corrected", port: o.port, equipment: eq.equipment, units: q, category: cat, lines, total };
  }

  const api = { index, baseFreight, route, quoteFreight, quoteArrival, r2 };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.SDGEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
