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
  /* True while the Desk is working from the sample tariff set, which is what
     it gets until a course access code is accepted. */
  let sample = false;

  /* ---------- setup ---------- */
  function fillSelects() {
    const ports = ix.db.Ports.slice().sort((a, b) => a.name.localeCompare(b.name));
    /* The port category (A–D) used to be appended to every option. It is an
       internal pricing band: it drives THC, BAF and the surcharges, and a bare
       letter next to forty-two port names told a learner nothing while reading
       like part of the port's identity. It is still taught, in the place where
       it does some work: the charge breakdown explains it, and the glossary has
       a "Port category" entry behind the "What is this?" button. */
    const opts = ports.map(p => `<option value="${p.port}">${esc(p.name)} (${esc(p.country)})</option>`).join("");
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

  /* ---------- sample mode ---------- */
  /* Without a course code the server sends ports and the freight curve and no
     surcharges at all, so there is nothing to total. Rather than let the
     engine fail on the missing tables, the Desk shows what it does have: the
     route, the distance, the service and what ocean freight starts at. */
  function baseFeu(nm) {
    /* ix.curve is the published curve the engine itself interpolates on,
       already sorted, so the sample quotes the same base rate a full
       quotation would rather than a second opinion of it. */
    const curve = ix.curve || [];
    if (!curve.length) return null;
    if (nm <= curve[0][0]) return curve[0][1];
    for (let i = 1; i < curve.length; i++) {
      if (nm <= curve[i][0]) {
        const [x0, y0] = curve[i - 1], [x1, y1] = curve[i];
        return y0 + ((y1 - y0) * (nm - x0)) / (x1 - x0);
      }
    }
    return curve[curve.length - 1][1];
  }

  function renderSample() {
    const from = $("origin").value, to = $("dest").value;
    const po = ix.ports[from], pd = ix.ports[to];
    if (!po || !pd) { $("flag").hidden = false; $("flag").textContent = "Choose a port of loading and a port of discharge."; return; }
    if (from === to) { $("flag").hidden = false; $("flag").textContent = "The two ports are the same."; return; }

    const rt = (ix.routes[from] && ix.routes[from][to]) || null;
    const d = (ix.dist[from] && ix.dist[from][to]) || null;
    if (!d) { $("flag").hidden = false; $("flag").textContent = "No distance for " + from + "–" + to + "."; return; }

    const nm = Number(d.nm), s = chosenSailing(), feu = baseFeu(nm);
    setNumber("sample", true);
    $("d-service").textContent = (s ? s.service : (rt && rt.first_service) || "—").toUpperCase();
    $("d-from").innerHTML = `<div class="k">From</div><div class="port">${esc(po.name)} (${esc(po.country)}) Port</div><div class="v">ETD ${s ? dfmt(s.etd) : "—"}</div><div class="v">${esc(po.locode)} · Cat. ${po.category}</div>`;
    $("d-to").innerHTML = `<div class="k">To</div><div class="port">${esc(pd.name)} (${esc(pd.country)}) Port</div><div class="v">ETA ${s ? dfmt(s.eta) : "—"}</div><div class="v">${esc(pd.locode)} · Cat. ${pd.category}</div>`;
    $("d-tt").innerHTML = `<div class="k">Estimated transportation days</div><div class="v">${s ? s.days : "—"}</div>`;
    [$("d-to"), $("d-tt"), $("b-freight")].forEach(x => x.hidden = false);
    $("d-co2").hidden = true;
    $("d-dear").innerHTML = `This is a <b>sample</b>. It shows the route and what ocean freight on it starts at. A full quotation needs a course access code.`;
    $("d-summary").innerHTML = cell("Route", [from, rt && rt.via, to].filter(Boolean).join("-"))
      + cell("Service", s ? s.service : (rt && rt.first_service) || "—")
      + cell("Vessel", s ? s.vessel : "To be confirmed")
      + cell("Distance", `${nm.toLocaleString("en-GB")} NM`)
      + cell("Agent at origin", po.agent);
    $("t-freight").innerHTML = `<tr><th>Concept</th><th>Units</th><th>Amount</th></tr>`
      + `<tr><td>Ocean freight, base rate for one 40ft unit</td><td class="num">1</td><td class="num">${feu === null ? "—" : eur(Math.round(feu * 100) / 100)}</td></tr>`;
    $("h-sur").textContent = "Surcharges";
    $("t-sur").innerHTML = `<tr class="info"><td colspan="3">Surcharges, terminal handling, port additionals and the emissions allowance are not part of a sample. They are what turns a base rate into a price, and they need a course access code.</td></tr>`;
    $("d-total-l").textContent = "Total amount quotation";
    $("d-total").innerHTML = `<span class="sample-total">Not shown in a sample</span>`;
    $("calc").innerHTML = "<li>A sample shows the distance and the base rate the freight curve gives for it. The working behind a full quotation appears once a course code is entered.</li>";
    last = null; issued = null;
  }

  function render() {
    $("flag").hidden = true;
    if (sample) return renderSample();
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
    /* The server refuses this without a code too. Catching it here only saves
       the learner a round trip and a confusing error; it is not the check that
       matters. */
    if (sample || !last) {
      toast("A course access code is needed to issue a quotation.", true);
      $("access-code").focus();
      return;
    }
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
  /* ---------- course access ---------- */
  function applyAccess(state) {
    sample = state.sample;
    const box = $("access");
    box.hidden = !sample;
    box.classList.toggle("ok", !sample);
    const st = $("data-status");
    st.textContent = sample
      ? (state.source === "live" ? "Sample · no course code" : "Sample · offline")
      : (state.source === "live" ? "Live data · Google Sheet" : "Offline snapshot");
    st.classList.toggle("live", state.source === "live" && !sample);
  }

  async function unlock(e) {
    e.preventDefault();
    const entered = $("access-code").value.trim();
    const box = $("access"), note = $("access-note"), title = $("access-title");
    if (!entered) { $("access-code").focus(); return; }
    $("access-go").disabled = true;
    title.textContent = "Checking…";
    try {
      API.setCode(entered);
      const state = await API.loadData();
      if (state.sample) {
        /* The code was refused, so the Desk stays in sample mode and says so.
           Keeping the entered code would send it again on the next reload, so
           it is dropped. */
        API.setCode("");
        box.classList.add("bad");
        title.textContent = "That code was not accepted";
        note.textContent =
          "Check it with your trainer. The Desk is still showing a sample: route, distance and the base ocean freight, with no total.";
        $("access-code").select();
        return;
      }
      ix = E.index(state.db); sched = SCH.build(state.db.Sailings || []);
      box.classList.remove("bad");
      applyAccess(state);
      fillSelects(); defaults(); refreshSailings(); render();
      toast("Course code accepted. Full quotations are available.");
    } catch (err) {
      API.setCode("");
      box.classList.add("bad");
      title.textContent = "The code could not be checked";
      note.textContent = err.message;
    } finally {
      $("access-go").disabled = false;
    }
  }

  API.loadData().then((state) => {
    const { db } = state;
    ix = E.index(db); sched = SCH.build(db.Sailings || []);
    applyAccess(state);
    $("access-form").addEventListener("submit", unlock);
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
