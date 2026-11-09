/* Data access: live Google Sheet through Apps Script, with the JSON snapshot as fallback. */
(function (root) {
  "use strict";
  const C = root.SDG_CONFIG || {};
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

  /* Network data always comes from the repository; tariffs come live from the Google Sheet,
     or from data/tariffs.json when the API is not configured or unreachable. */
  async function loadData() {
    const netP = fetch(C.NETWORK_URL || "data/network.json").then(r => r.json());
    let tariffs = null, source = "snapshot";
    if (C.API_URL) {
      try {
        const r = await withTimeout(fetch(C.API_URL + "?action=data"), 12000);
        const d = await r.json();
        if (d && d.Ports && d.Ports.length) { tariffs = d; source = "live"; }
      } catch (e) { console.warn("Live tariffs unavailable, using data/tariffs.json:", e.message); }
    }
    if (!tariffs) tariffs = await (await fetch(C.TARIFFS_URL || "data/tariffs.json")).json();
    return { db: Object.assign({}, await netP, tariffs), source };
  }

  /* text/plain avoids a CORS preflight, which Apps Script cannot answer */
  async function saveQuote(quote) {
    if (!C.API_URL) throw new Error("No API configured. The quotation was not saved.");
    const r = await withTimeout(fetch(C.API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "save", quote }) }), 20000);
    const d = await r.json();
    if (!d.ok) throw new Error(d.error || "The server did not save the quotation.");
    /* pdf_url is null when PDFs are switched off in Settings, or when Drive was
       unavailable. The quotation is saved either way, so the caller shows the
       number regardless and only offers the link when there is one. */
    return { quote_no: d.quote_no, pdf_url: d.pdf_url || null };
  }

  root.SDGApi = { loadData, saveQuote, hasApi: () => !!C.API_URL };
})(window);
