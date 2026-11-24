(function (root) {
  const C = root.SDG_CONFIG || {};

  function withTimeout(p, ms) {
    return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
  }

  /* The course code the learner entered, kept for the session only. It is a
     classroom credential, so it is not written to localStorage where it would
     outlive the class and sit on a shared machine. */
  let code = "";
  function setCode(value) { code = String(value || "").trim(); }
  function getCode() { return code; }

  /* A tariff set without surcharges is the sample, whoever sent it: the server
     says so with a flag, and the offline snapshot says so the same way. Asking
     the data rather than trusting a flag means a sample cannot be turned into
     a full quotation by editing one boolean in the console. */
  function isSample(db) {
    return !db || !Array.isArray(db.Surcharges) || db.Surcharges.length === 0;
  }

  async function loadData() {
    const netP = fetch(C.NETWORK_URL || "data/network.json").then(r => r.json());
    let tariffs = null, source = "snapshot", access = null;
    if (C.API_URL) {
      try {
        const url = C.API_URL + "?action=data" + (code ? "&code=" + encodeURIComponent(code) : "");
        const r = await withTimeout(fetch(url), 12000);
        const d = await r.json();
        if (d && d.Ports && d.Ports.length) { tariffs = d; source = "live"; access = d.access || null; }
      } catch (e) { console.warn("Live tariffs unavailable, using the sample:", e.message); }
    }
    /* The offline fallback is the sample set, not the full one. A class whose
       connection drops keeps a working demonstration; it does not quietly get
       the whole tariff back. */
    if (!tariffs) tariffs = await (await fetch(C.TARIFFS_URL || "data/tariffs-sample.json")).json();
    const db = Object.assign({}, await netP, tariffs);
    return { db, source, sample: isSample(db), access };
  }

  /* text/plain avoids a CORS preflight, which Apps Script cannot answer */
  async function saveQuote(quote) {
    if (!C.API_URL) throw new Error("No API configured. The quotation was not saved.");
    const r = await withTimeout(fetch(C.API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "save", code, quote }) }), 20000);
    const d = await r.json();
    if (!d.ok) throw new Error(d.error || "The server did not save the quotation.");
    /* pdf_url is null when PDFs are switched off in Settings, or when Drive was
       unavailable. The quotation is saved either way, so the caller shows the
       number regardless and only offers the link when there is one. */
    return { quote_no: d.quote_no, pdf_url: d.pdf_url || null };
  }

  root.SDGApi = { loadData, saveQuote, setCode, getCode, isSample, hasApi: () => !!C.API_URL };
})(window);
