/* Trainer view.
 *
 * Reads the Quotations tab through the web app's `quotes` action, which is
 * refused without the trainer key. Nothing here writes: a trainer watching a
 * class should not be able to change a learner's quotation by accident.
 *
 * The key lives in localStorage on the trainer's own device. That is weak
 * storage for a shared secret, and it is the right trade for what it protects:
 * a list of simulated quotations carrying invented customer names. If the key
 * ever guards anything real, it needs a real sign-in instead.
 */
(function () {
  "use strict";

  const C = window.SDG_CONFIG || {};
  const KEY_STORE = "sdg_trainer_key";
  const $ = (id) => document.getElementById(id);

  let key = "";
  let rows = [];
  let timer = null;

  /* ---------- small helpers ---------- */

  const eur = (n) =>
    "€" + Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const esc = (v) =>
    String(v === undefined || v === null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  /* The sheet hands back whatever the cell held: a Date, an ISO string, or a
     blank. Anything unparseable is shown as a dash rather than "Invalid Date". */
  function when(v) {
    if (!v) return "—";
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    const today = new Date();
    const sameDay =
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();
    const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    return sameDay ? time : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) + " " + time;
  }

  function shipment(r) {
    const where = r.type === "arrival"
      ? "Arrival · " + (r.to || r.port || "")
      : (r.from || "") + " → " + (r.to || "");
    const kit = [r.equipment, r.units ? "× " + r.units : ""].filter(Boolean).join(" ");
    return { where, kit };
  }

  /* Two quotations are the same question when the route, the box and the count
     match. Everything else - the learner's name, the sailing they picked - is
     allowed to differ without making the comparison unfair. */
  const question = (r) =>
    [r.type, r.from || "", r.to || r.port || "", r.equipment || "", r.units || ""].join("|");

  /* ---------- loading ---------- */

  /* Returns true when the data arrived. The caller decides what a failure
     means: at the gate it is a rejected key and the board must stay shut; once
     the board is open it is a blip, and the rows already on screen are better
     than an empty page. */
  async function load(candidate) {
    const k = candidate === undefined ? key : candidate;
    if (!C.API_URL) return fail("No API URL is configured. Set API_URL in js/config.js.");
    $("status").textContent = "Loading…";
    try {
      const url = C.API_URL + "?action=quotes&key=" + encodeURIComponent(k) + "&limit=200";
      const res = await fetch(url);
      if (!res.ok) return fail("The web app answered " + res.status + ".");
      const data = await res.json();

      if (data && data.error) return fail(data.error);
      if (!Array.isArray(data)) return fail("The web app returned something unexpected.");

      rows = data;
      $("status").textContent = "Live · " + when(new Date());
      $("status").classList.add("ok");
      if (!$("board").hidden) render();
      return true;
    } catch (err) {
      return fail(String(err && err.message ? err.message : err));
    }
  }

  function fail(message) {
    const refused = /not authoris|not authoriz/i.test(message);
    $("status").classList.remove("ok");
    $("status").textContent = refused ? "Not connected" : message;
    if ($("board").hidden) {
      $("gate-err").textContent = refused ? "That key was not accepted." : message;
      $("gate-err").hidden = false;
    }
    return false;
  }

  /* ---------- drawing ---------- */

  function render() {
    const needle = $("q").value.trim().toLowerCase();
    const shown = needle
      ? rows.filter((r) =>
          [r.customer_name, r.company, r.from, r.to, r.port, r.quote_no, r.equipment]
            .join(" ").toLowerCase().includes(needle))
      : rows.slice();

    /* Newest first. The sheet appends, so the tail is the newest, but a sheet
       edited by hand can arrive in any order - sort rather than assume. */
    shown.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    $("count").textContent =
      shown.length + (shown.length === 1 ? " quotation" : " quotations") +
      (needle && shown.length !== rows.length ? " of " + rows.length : "");

    $("list").tBodies[0].innerHTML = shown.map((r) => {
      const s = shipment(r);
      const doc = r.pdf_url
        ? '<a href="' + esc(r.pdf_url) + '" target="_blank" rel="noopener">PDF</a>'
        : '<span class="muted">—</span>';
      const sent = r.emailed_to ? '<div class="sub">sent to ' + esc(r.emailed_to) + "</div>" : "";
      return (
        "<tr>" +
        "<td>" + esc(when(r.created_at)) + "</td>" +
        '<td class="mono">' + esc(r.quote_no) + "</td>" +
        "<td>" + esc(r.customer_name || "—") +
        (r.company ? '<div class="sub">' + esc(r.company) + "</div>" : "") + "</td>" +
        "<td>" + esc(s.where) + (s.kit ? '<div class="sub">' + esc(s.kit) + "</div>" : "") + "</td>" +
        '<td class="num mono">' + eur(r.total) + "</td>" +
        "<td>" + doc + sent + "</td>" +
        "</tr>"
      );
    }).join("");

    $("empty").hidden = shown.length > 0;
    renderSpread(shown);
  }

  function renderSpread(shown) {
    const groups = new Map();
    for (const r of shown) {
      const k = question(r);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(r);
    }

    /* Only a group where the answers actually differ teaches anything. Two
       learners agreeing is the expected case and would just be noise here. */
    const interesting = [...groups.values()]
      .filter((g) => g.length > 1)
      .map((g) => {
        const totals = g.map((r) => Number(r.total) || 0);
        return { g, min: Math.min(...totals), max: Math.max(...totals) };
      })
      .filter((x) => x.max - x.min > 0.005)
      .sort((a, b) => (b.max - b.min) - (a.max - a.min));

    $("spread-card").hidden = interesting.length === 0;
    if (!interesting.length) return;

    $("spread").innerHTML = interesting.map(({ g, min, max }) => {
      const s = shipment(g[0]);
      const gap = max - min;
      const pct = min > 0 ? (gap / min) * 100 : 0;
      const people = g
        .slice()
        .sort((a, b) => Number(a.total) - Number(b.total))
        .map((r) => {
          const t = Number(r.total) || 0;
          const width = max > 0 ? Math.max(3, (t / max) * 100) : 3;
          const extreme = t === min ? " low" : t === max ? " high" : "";
          return (
            '<div class="who">' +
            '<span class="nm">' + esc(r.customer_name || r.quote_no) + "</span>" +
            '<span class="bar"><i class="' + extreme.trim() + '" style="width:' + width.toFixed(1) + '%"></i></span>' +
            '<span class="amt mono">' + eur(t) + "</span>" +
            "</div>"
          );
        }).join("");

      return (
        '<div class="spread-row">' +
        '<div class="spread-head">' +
        "<strong>" + esc(s.where) + "</strong>" +
        (s.kit ? ' <span class="muted">' + esc(s.kit) + "</span>" : "") +
        '<span class="gap">' + eur(gap) + " apart · " + pct.toFixed(0) + "%</span>" +
        "</div>" + people +
        "</div>"
      );
    }).join("");
  }

  /* ---------- wiring ---------- */

  /* The key is only accepted once the web app has accepted it. Opening the
     board first and sorting it out afterwards is what let a wrong key through
     to a blank table with the refusal hidden in a status pill. */
  async function open(k, remember) {
    $("gate-err").hidden = true;
    const ok = await load(k);
    if (!ok) return false;
    key = k;
    if (remember) {
      try { localStorage.setItem(KEY_STORE, k); } catch (err) { /* private window */ }
    }
    $("gate").hidden = true;
    $("board").hidden = false;
    render();
    schedule();
    return true;
  }

  function schedule() {
    if (timer) clearInterval(timer);
    if ($("auto").checked) timer = setInterval(load, 30000);
  }

  $("gate-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const k = $("key").value.trim();
    if (!k) return;
    const button = $("gate-form").querySelector("button");
    button.disabled = true;
    try { await open(k, true); } finally { button.disabled = false; }
  });

  $("refresh").addEventListener("click", () => load());
  $("q").addEventListener("input", render);
  $("auto").addEventListener("change", schedule);
  $("forget").addEventListener("click", () => {
    try { localStorage.removeItem(KEY_STORE); } catch (err) { /* nothing to do */ }
    location.reload();
  });

  /* A key kept from last time is tried silently. If it has since been changed
     in the script properties, the gate simply appears with the reason. */
  let saved = "";
  try { saved = localStorage.getItem(KEY_STORE) || ""; } catch (err) { saved = ""; }
  if (saved) open(saved, false);
})();
