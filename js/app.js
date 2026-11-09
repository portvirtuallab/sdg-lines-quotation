/* SDG Lines Quotation Desk — user interface */
(function () {
  "use strict";
  const E = window.SDGEngine, SCH = window.SDGSchedule, API = window.SDGApi, TR = window.SDGTraining;
  const $ = id => document.getElementById(id);
  const eur = n => "€" + Number(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const dfmt = d => d ? d.toLocaleDateString("en-GB") + " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—";
  const dshort = d => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

  let ix, sched, mode = "freight", sailOpts = [], issued = null, last = null;

  /* ---------- setup ---------- */
  function fillSelects() {
    const ports = ix.db.Ports.slice().sort((a, b) => a.name.localeCompare(b.name));
    const opts = ports.map(p => `<option value="${p.port}">${esc(p.name)} (${esc(p.country)}) · ${p.category}</option>`).join("");
    $("origin").innerHTML = opts; $("dest").innerHTML = opts;
    const groups = {};
    ix.db.Equipment.forEach(e => (groups[e.group] = groups[e.group] || []).push(e));
    $("unit").innerHTML = Object.entries(groups).map(([g, list]) => `<optgroup label="${g}">${list.map(e => `<option value="${esc(e.equipment)}">${esc(e.equipment)}</option>`).join("")}</optgroup>`).join("");
  }

  function defaults() {
    $("origin").value = "AQABA"; $("dest").value = "MARSEILLE"; $("unit").value = "40 feet Container (Dry Cargo)";
    $("qty").value = 1; setWeight();
    const first = Object.values(sched).flat().map(l => l.etd).sort((a, b) => a - b)[0];
    const today = new Date(); const start = first && first > today ? first : today;
    $("etd").value = start.toISOString().slice(0, 10);
  }
  function setWeight() { const e = ix.equipment[$("unit").value]; if (e) $("weight").value = e.default_weight_kg; }

  /* ---------- sailings ---------- */
  function refreshSailings() {
    if (mode !== "freight") return;
    const o = $("origin").value, d = $("dest").value;
    if (o === d) { sailOpts = []; $("sailings").innerHTML = `<p class="note">Choose two different ports.</p>`; return; }
    const r = E.route(ix, o, d);
    const after = new Date($("etd").value + "T00:00:00");
    sailOpts = SCH.find(sched, o, d, after, r.via, ix.settings.hub_port);
    $("sailings").innerHTML = sailOpts.length ? sailOpts.map((s, i) => `
      <label class="sail"><input type="radio" name="sail" value="${i}" ${i === 0 ? "checked" : ""}>
        <b>${esc(s.vessel)}</b><span class="tt">${s.days} days</span>
        <small>ETD ${dshort(s.etd)} → ETA ${dshort(s.eta)} · ${esc(s.tripcode)}${s.via ? " · via " + esc(ix.ports[s.via].name) : ""}</small></label>`).join("")
      : `<p class="note">No published sailing after this date. The quotation uses the route distance; ask the trainer to extend the schedule.</p>`;
  }
  const chosenSailing = () => { const r = document.querySelector('input[name="sail"]:checked'); return r ? sailOpts[+r.value] : null; };

  /* ---------- quotation ---------- */
  function build() {
    const base = { equipment: $("unit").value, units: +$("qty").value || 1, dangerous: !!$("imo").value, imoClass: $("imo").value };
    if (mode === "freight") return E.quoteFreight(ix, { ...base, from: $("origin").value, to: $("dest").value, vgm: $("vgm").checked, ams: $("ams").checked });
    return E.quoteArrival(ix, { ...base, port: $("dest").value });
  }

  function rows(lines) {
    return lines.map(l => {
      const g = TR.G[l.code];
      /* A charge the Surcharges tab excludes is shown and not counted. Saying
         so on the row is not decoration: without it the figures on screen do
         not add up to the total underneath them, and the learner is left to
         work out which line is the odd one. The document says the same. */
      const out = l.in_total === false;
      const why = g ? `<span class="why">${g.full}${l.note ? " · " + esc(l.note) : ""}. <button type="button" data-g="${l.code}">What is this?</button></span>` : "";
      const mark = out ? `<span class="out-tag">not in the total</span>` : "";
      const cls = [l.code === "ETS" ? "eco" : "", out ? "out" : ""].filter(Boolean).join(" ");
      return `<tr class="${cls}"><td>${esc(l.label.toUpperCase())}${mark}${why}</td><td class="num qty">${l.qty > 1 ? l.qty + " × " + eur(l.unit_price) : ""}</td><td class="num">${eur(l.amount)}</td></tr>`;
    }).join("");
  }
  const cell = (k, v) => `<div><span>${k}</span><strong>${esc(v)}</strong></div>`;

  function render() {
    $("flag").hidden = true;
    let q;
    try { q = build(); } catch (e) { $("flag").hidden = false; $("flag").textContent = e.message; return; }
    last = q; issued = null;
    const S = ix.settings, today = new Date(), to = new Date(today);
    to.setDate(to.getDate() + Number(mode === "freight" ? S.freight_validity_days : S.arrival_validity_days));
    const num = mode === "freight" ? `${S.quote_prefix_freight}${today.getFullYear()}····` : `${S.quote_prefix_arrival}${today.getFullYear()}····`;
    setNumber(num, true);
    $("d-valid").textContent = today.toLocaleDateString("en-GB") + " – " + to.toLocaleDateString("en-GB");
    const name = $("name").value.trim() || "Customer", comp = $("company").value.trim() || "—";

    if (q.type === "freight") {
      const po = ix.ports[q.from], pd = ix.ports[q.to], s = chosenSailing();
      $("d-service").textContent = (s ? s.service : q.service || "—").toUpperCase();
      $("d-from").innerHTML = `<div class="k">From</div><div class="port">${esc(po.name)} (${esc(po.country)}) Port</div><div class="v">ETD ${s ? dfmt(s.etd) : "—"}</div><div class="v">${esc(po.locode)} · Cat. ${po.category}</div>`;
      $("d-to").innerHTML = `<div class="k">To</div><div class="port">${esc(pd.name)} (${esc(pd.country)}) Port</div><div class="v">ETA ${s ? dfmt(s.eta) : "—"}</div><div class="v">${esc(pd.locode)} · Cat. ${pd.category}</div>`;
      $("d-tt").innerHTML = `<div class="k">Estimated transportation days</div><div class="v">${s ? s.days : "—"}</div>`;
      $("d-co2").innerHTML = `<small>You are helping to reduce the carbon footprint by saving</small><b>${q.co2.saving_kg.toLocaleString("en-GB")}</b><small>KG CO2 EQ (vs. inland transport)</small>`;
      [$("d-to"), $("d-tt"), $("d-co2"), $("b-freight")].forEach(x => x.hidden = false);
      $("d-dear").innerHTML = `Dear <b>${esc(name)}</b> · ${esc(comp)}<br>We present you our best offer for the services you have requested. Please check that all the information is correct and use the reference indicated for booking.`;
      $("d-summary").innerHTML = cell("Equipment", q.equipment) + cell("Route", [q.from, q.via, q.to].filter(Boolean).join("-")) + cell("Service", s ? s.service : q.service)
        + cell("Vessel", s ? s.vessel : "To be confirmed") + cell("Distance", `${q.nm.toLocaleString("en-GB")} NM`) + cell("Number of units", q.units)
        + cell("Agent at origin", po.agent) + cell("Terminal", s && s.legs[0].terminal ? s.legs[0].terminal : "—") + cell("Trip code", s ? s.tripcode : "—");
      $("t-freight").innerHTML = `<tr><th>Concept</th><th>Units</th><th>Amount</th></tr>` + rows(q.lines.filter(l => l.group === "freight")) + `<tr class="sub"><td>Total freight</td><td></td><td class="num">${eur(q.total_freight)}</td></tr>`;
      $("h-sur").textContent = "Surcharges";
      $("t-sur").innerHTML = rows(q.lines.filter(l => l.group === "surcharge")) + `<tr class="sub"><td>Total surcharges</td><td></td><td class="num">${eur(q.total_surcharges)}</td></tr><tr class="info"><td colspan="3">Charges shown greyed are part of the operation but are not charged by SDG Lines, so they are not in the total.</td></tr>`;
      $("d-total-l").textContent = "Total amount quotation";
    } else {
      const pd = ix.ports[q.port];
      $("d-service").textContent = "ARRIVAL CHARGES";
      $("d-from").innerHTML = `<div class="k">Port of destination</div><div class="port">${esc(pd.name)} (${esc(pd.country)}) Port</div><div class="v">${esc(pd.locode)} · Cat. ${pd.category}</div><div class="v">${esc(pd.agent)}</div>`;
      [$("d-to"), $("d-tt"), $("d-co2"), $("b-freight")].forEach(x => x.hidden = true);
      $("d-dear").innerHTML = `Dear <b>${esc(name)}</b> · ${esc(comp)}<br>Below you will find the arrival charges you have requested. This information does not represent a commitment and the amounts may vary. For a fixed amount, please contact our commercial department.`;
      $("d-summary").innerHTML = cell("Equipment", q.equipment) + cell("Port of destination", `${pd.name} (${pd.country})`) + cell("Number of units", q.units);
      $("h-sur").textContent = "Cost";
      $("t-sur").innerHTML = `<tr><th>Concept</th><th>Units</th><th>Amount</th></tr>` + rows(q.lines) + `<tr class="sub"><td>Total arrival charges</td><td></td><td class="num">${eur(q.total)}</td></tr>`;
      $("d-total-l").textContent = "Total arrival charges";
    }
    $("d-total").textContent = eur(q.total);
    $("calc").innerHTML = TR.steps(q, ix).map(s => `<li>${s}</li>`).join("");
  }

  function setNumber(n, draft) {
    ["d-qno", "d-qno2", "d-qno3"].forEach(id => $(id).textContent = draft ? n + " (draft)" : n);
    $("d-qno2").classList.toggle("draft", !!draft);
  }

  /* ---------- actions ---------- */
  async function issue(e) {
    e.preventDefault();
    if (!$("name").value.trim() || !$("company").value.trim()) { toast("Add the contact name and company before issuing.", true); return; }
    if (!API.hasApi()) { toast("Saving is not connected yet. Add the Apps Script URL in js/config.js (README, step 3).", true); return; }
    const q = last, s = chosenSailing();
    const rec = { type: q.type, mode: q.mode, customer_name: $("name").value.trim(), company: $("company").value.trim(), email: $("email").value.trim(),
      from: q.from || "", to: q.to || q.port, via: q.via || "", service: s ? s.service : q.service || "", vessel: s ? s.vessel : "", tripcode: s ? s.tripcode : "",
      etd: s ? dfmt(s.etd) : "", eta: s ? dfmt(s.eta) : "", equipment: q.equipment, units: q.units, weight_kg: +$("weight").value || "", dangerous: !!$("imo").value,
      imo_class: $("imo").value, vgm: $("vgm").checked, nm: q.nm || "", base_feu: q.base_feu || "", total_freight: q.total_freight || "", total_surcharges: q.total_surcharges || "",
      total: q.total, co2_sea_kg: q.co2 ? q.co2.sea_kg : "", co2_saving_kg: q.co2 ? q.co2.saving_kg : "", lines: q.lines };
    $("issue").disabled = true; toast("Issuing…");
    try {
      const saved = await API.saveQuote(rec);
      issued = saved.quote_no;
      setNumber(issued, false);
      showPdfLink(saved.pdf_url);
      toast(saved.pdf_url
        ? `Quotation ${issued} issued and saved. The PDF is ready.`
        : `Quotation ${issued} issued and saved.`);
    }
    catch (err) { toast(err.message, true); }
    finally { $("issue").disabled = false; }
  }

  /* Shown only when the server actually produced a file. */
  function showPdfLink(url) {
    const box = $("pdf-link");
    if (!box) return;
    box.hidden = !url;
    if (url) {
      const a = box.querySelector("a");
      a.href = url;
      a.textContent = `Open the PDF of ${issued}`;
    }
  }

  function copy() {
    const q = last; if (!q) return;
    const head = [`${issued || "Draft"} · SDG Lines`, `${$("name").value} – ${$("company").value}`,
      q.type === "freight" ? `${q.from} → ${q.to}${q.via ? " (via " + q.via + ")" : ""} · ${q.equipment} ×${q.units}` : `Arrival charges ${q.port} · ${q.equipment} ×${q.units}`];
    const txt = head.concat(q.lines.map(l => `${l.label}: ${eur(l.amount)}`), [`TOTAL: ${eur(q.total)}`]).join("\n");
    try { navigator.clipboard.writeText(txt).then(() => toast("Summary copied."), () => toast("Could not copy automatically.", true)); }
    catch (_) { toast("Could not copy automatically.", true); }
  }
  function toast(msg, err) { const t = $("toast"); t.textContent = msg; t.classList.toggle("err", !!err); }

  function setMode(m) {
    mode = m;
    $("mode-freight").setAttribute("aria-pressed", m === "freight"); $("mode-arrival").setAttribute("aria-pressed", m === "arrival");
    ["origin-l", "swap", "etd-l", "opts-row", "weight-l", "sail-box"].forEach(id => $(id).hidden = m === "arrival");
    $("route-h").textContent = m === "freight" ? "Route" : "Port"; $("dest-t").textContent = m === "freight" ? "Port of discharge" : "Port of arrival";
    refreshSailings(); render();
  }

  /* ---------- start ---------- */
  API.loadData().then(({ db, source }) => {
    ix = E.index(db); sched = SCH.build(db.Sailings || []);
    const st = $("data-status"); st.textContent = source === "live" ? "Live data · Google Sheet" : "Offline snapshot"; st.classList.toggle("live", source === "live");
    fillSelects(); defaults(); TR.render({ gloss: $("gloss"), srcs: $("srcs"), qs: $("qs") });
    $("form").addEventListener("input", e => { if (e.target.id === "unit") setWeight(); if (["origin", "dest", "etd"].includes(e.target.id)) refreshSailings(); render(); });
    $("form").addEventListener("submit", issue);
    $("copy").addEventListener("click", copy);
    $("swap").addEventListener("click", () => { const a = $("origin").value; $("origin").value = $("dest").value; $("dest").value = a; refreshSailings(); render(); });
    $("mode-freight").addEventListener("click", () => setMode("freight")); $("mode-arrival").addEventListener("click", () => setMode("arrival"));
    $("teach").addEventListener("change", () => document.body.classList.toggle("teach", $("teach").checked));
    document.addEventListener("click", e => {
      const g = e.target.closest("[data-g]");
      if (g) { const el = $("g-" + g.dataset.g); if (el) { el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1600); } }
      const s = e.target.closest("[data-src]");
      if (s) { e.preventDefault(); const el = $("src-" + s.dataset.src); if (el) el.scrollIntoView({ block: "center" }); }
    });
    setMode("freight");
  }).catch(err => { $("data-status").textContent = "Data could not be loaded"; toast("Could not load data: " + err.message, true); });
})();
