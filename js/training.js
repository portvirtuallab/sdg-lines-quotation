/* Training layer: glossary, sources, review questions and the step-by-step calculation. */
(function (root) {
  "use strict";
  const SRC = {
    sur: ["Mohawk Global — Glossary of transportation surcharges", "https://mohawkglobal.com/global-news/no-longer-baffled-by-baf-caf-and-faf-a-glossary-of-transportation-surcharges/"],
    baf: ["Xeneta — Bunker Adjustment Factor (BAF)", "https://xeneta.com/shipping-terms/bunker-adjustment-factor-surcharge-baf"],
    inco: ["ICC — Incoterms® rules FAQ", "https://www.iccwbo.org/incoterms_faq/"],
    vgm: ["IMO — Verification of the gross mass of a packed container (SOLAS VI/2)", "https://imo.org/en/OurWork/Safety/Pages/Verification-of-the-gross-mass.aspx"],
    isps: ["IMO — SOLAS XI-2 and the ISPS Code", "https://www.imo.org/en/OurWork/Security/Pages/SOLAS-XI-2%20ISPS%20Code.aspx"],
    ets: ["EMSA — Extension of the EU ETS to maritime transport", "https://www.emsa.europa.eu/reducing-emissions/extension-ets.html"],
    imdg: ["International Maritime Dangerous Goods Code (overview)", "https://en.wikipedia.org/wiki/International_Maritime_Dangerous_Goods_Code"],
    ams: ["Skuld — USA Automated Manifest System regulations", "https://www.skuld.com/topics/cargo/automated-manifest-system-ams/usa-new-automated-manifest-system-regulations/"],
    kvk: ["KVK (Netherlands Chamber of Commerce) — Import terminology explained", "https://kvk.nl/en/international/difficult-import-terminology-explained"],
    glec: ["GHG Protocol — GLEC Framework for logistics emissions accounting", "https://ghgprotocol.org/blog/glec-framework-universal-method-logistics-emissions-accounting"],
    drewry: ["Drewry — World Container Index (freight benchmark used for the SDG tariff)", "https://www.drewry.co.uk/supply-chain-advisors/supply-chain-expertise/world-container-index-assessed-by-drewry"],
    sdg: ["SDG Lines — simulated shipping line by Escola Europea", "https://www.sdglines.com/"]
  };
  const KEYS = Object.keys(SRC);
  const cite = k => `<a href="#src-${k}" data-src="${k}">[${KEYS.indexOf(k) + 1}]</a>`;

  const G = {
    OCEAN_FREIGHT: { t: "Ocean freight", full: "Basic sea freight", what: "The price to carry the cargo by sea from the port of loading to the port of discharge. Everything else is added on top.", sim: "Base price per FEU for the distance (FreightCurve tab) × equipment factor × units.", src: ["sur", "drewry"] },
    BAF: { t: "BAF", full: "Bunker Adjustment Factor", what: "A fuel surcharge that lets the carrier pass on changes in bunker (ship fuel) prices without renegotiating the base freight.", sim: "Base BAF of the equipment × 1.07 for each port category step above A (origin port).", src: ["baf", "sur"] },
    THC: { t: "THC", full: "Terminal Handling Charge", what: "What the terminal charges to lift the container on or off the vessel and move it in the yard. Origin THC is paid at loading, destination THC at discharge; who pays depends on the Incoterm.", sim: "Per unit, from the THC tab by equipment and port category (A cheapest, D most expensive).", src: ["sur", "inco"] },
    PORT_ADDITIONAL: { t: "Port additionals", full: "Additional port services", what: "Extra port services such as moves inside the terminal, positioning or inspection support.", sim: "20% of the THC, per unit.", src: ["sur"] },
    PORT_TAXES: { t: "Port taxes", full: "Port dues on the cargo", what: "Charges set by the port authority for the use of port infrastructure, passed on by the carrier.", sim: "Per unit, by port category: A €20 · B €35 · C €40 · D €45.", src: ["kvk"] },
    VGM: { t: "VGM", full: "Verified Gross Mass", what: "Since 1 July 2016 SOLAS requires the shipper to declare the verified weight of every packed container before loading. Without it the container cannot be loaded. This line applies when the carrier does the weighing.", sim: "Per unit, by port category: €25 to €40.", src: ["vgm"] },
    DOCUMENTATION: { t: "Documentation", full: "Bill of lading and documents", what: "Issuing the bill of lading and related shipping documents.", sim: "Per booking, by port category: €54 to €78.", src: ["kvk"] },
    ISPS: { t: "ISPS", full: "International Ship and Port Facility Security", what: "A security surcharge for the measures ports and ships apply under the ISPS Code (SOLAS chapter XI-2).", sim: "Per unit, by port category: €15 to €30.", src: ["isps"] },
    LOGISTIC_MANAGEMENT: { t: "Logistic management", full: "Booking management", what: "Administrative handling of the booking: equipment release, coordination and follow-up.", sim: "Per booking, by port category: €8 to €14.", src: ["sdg"] },
    SEAL: { t: "Seal", full: "Container seal", what: "The numbered high-security seal fitted to the doors. Its number goes on the bill of lading and proves the box has not been opened.", sim: "Per unit, by port category: €10 to €15.", src: ["kvk"] },
    AMS: { t: "AMS", full: "Automated Manifest System", what: "Advance electronic filing of the cargo manifest for US-bound cargo, at least 24 hours before loading at the foreign port.", sim: "Per booking, only when ticked.", src: ["ams"] },
    IMO: { t: "IMO surcharge", full: "Dangerous goods", what: "Extra charge for cargo classified under the IMDG Code (classes 1 to 9). It covers special stowage, segregation and declarations.", sim: "Per unit, by port category: €55 to €70.", src: ["imdg"] },
    PLUGIN: { t: "Plug-in", full: "Reefer power supply", what: "Electricity to keep a reefer at the set temperature while at the terminal.", sim: "Daily rate of the equipment × 2 days included × units.", src: ["sur"] },
    ETS: { t: "ETS", full: "EU Emissions Trading System", what: "Shipping companies must buy allowances (EUAs) for the CO₂ their ships emit on voyages to, from and within the EU. Carriers pass this cost on as a surcharge.", sim: "CO₂ of the voyage (t) × EUA price × units, plus a fixed fee when the result is below the threshold (Settings tab).", src: ["ets"] },
    CUSTOM_CLEARANCE: { t: "Customs clearance", full: "Export or import clearance", what: "Filing the customs declaration. Shown for information so the forwarder can build a complete commercial offer.", sim: "Per booking, by port category: €35 to €50 (informative *).", src: ["kvk", "inco"] },
    CONTROL: { t: "Control", full: "Inspection control", what: "Cost of a physical or documentary inspection if the authorities select the shipment. SDG Lines withdrew it from the tariff in November 2026: the carrier does not perform the inspection and does not bill it. It still exists in the trade, and a forwarder building a full offer has to allow for it.", sim: "No longer quoted. Historic quotations priced it per unit by port category, €20 to €35.", src: ["kvk"] },
    CATEGORY: { t: "Port category", full: "A, B, C, D", what: "SDG Lines groups ports by size and cost level. Category A ports (Rotterdam, Antwerp, Busan, Yantian) are the most efficient and the cheapest per container; category D ports are the most expensive.", sim: "Category is in the Ports tab and drives THC, BAF and every surcharge.", src: ["sdg"] },
    CO2: { t: "CO₂ saving", full: "Sea vs road", what: "Short-sea shipping emits less CO₂ than trucks for the same cargo. The figure compares the voyage with the same cargo moved by road.", sim: "Distance (NM) × equipment emission factor; road = sea × 1.37.", src: ["glec"] }
  };

  const QS = [
    ["Under FOB Barcelona, who normally pays the origin THC?", "The seller. Under FOB the seller bears all costs until the goods are on board at the port of loading, including origin terminal handling. The buyer pays the ocean freight and destination charges."],
    ["Why is the same 20' container cheaper to load in Rotterdam than in Bari?", "Rotterdam is a category A port and Bari is category D. THC, BAF and the other surcharges increase with each category step."],
    ["The shipper did not send the VGM. What happens to the container?", "Under SOLAS it cannot be loaded. The carrier may weigh it and charge for the service, which is why the VGM line exists."],
    ["Why do some routes show 'via Barcelona'?", "No single SDG Lines service calls at both ports, so the cargo is transshipped at the Barcelona hub from one service to another."],
    ["Why is customs clearance shown but not added to the total?", "Because SDG Lines does not perform it. It is a third-party cost that belongs to the operation, so the quotation shows it to be complete, and leaves it out of what the carrier is charging you. Inspection control used to be quoted the same way and was withdrawn altogether in November 2026."]
  ];

  function render(el) {
    el.gloss.innerHTML = Object.entries(G).map(([k, g]) => `<div class="term" id="g-${k}"><h3>${g.t} <small>${g.full}</small></h3><p>${g.what}</p><div class="sim">In this tool: ${g.sim}</div><div class="src">Source ${g.src.map(cite).join(" ")}</div></div>`).join("");
    el.srcs.innerHTML = KEYS.map(k => `<li id="src-${k}"><a href="${SRC[k][1]}" target="_blank" rel="noopener">${SRC[k][0]}</a></li>`).join("");
    el.qs.innerHTML = QS.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join("");
  }

  const eur = n => "€" + Number(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt = n => Number(n).toLocaleString("en-GB");

  function steps(q, ix) {
    const S = ix.settings, L = c => q.lines.find(l => l.code === c);
    if (q.type === "arrival") {
      return [
        `<b>Port category.</b> ${q.port} is category <code>${q.category}</code> ${cite("sdg")}. It sets every amount below.`,
        `<b>THC (destination)</b> ${cite("sur")}: <code>${eur(L("THC").unit_price)} × ${q.units} = ${eur(L("THC").amount)}</code>`,
        `<b>Port additionals:</b> <code>20% × THC × ${L("PORT_ADDITIONAL").qty} = ${eur(L("PORT_ADDITIONAL").amount)}</code>`,
        `<b>Per-booking charges:</b> documentation, logistic management and customs clearance are charged once, whatever the number of units.`,
        `<b>Total:</b> <code>${eur(q.total)}</code>. Who pays these costs depends on the Incoterm ${cite("inco")}.`];
    }
    const f = L("OCEAN_FREIGHT"), b = L("BAF"), e = L("ETS");
    const out = [
      `<b>Distance.</b> ${q.from} → ${q.to}${q.via ? " via " + q.via : ""}: <code>${fmt(q.nm)} NM (${fmt(q.km)} km)</code>. Port of loading category <code>${q.category}</code> ${cite("sdg")}.`,
      `<b>Base freight</b> ${cite("drewry")}: the FreightCurve gives <code>${eur(q.base_feu)} per FEU</code> for ${fmt(q.nm)} NM.`,
      q.mode === "legacy" ? `<b>Ocean freight (legacy mode):</b> <code>${eur(f.amount)}</code>, the base FEU price without equipment factor or units, as the old sheet did.`
        : `<b>Ocean freight:</b> <code>${eur(q.base_feu)} × factor ${ix.equipment[q.equipment].freight_factor} × ${q.units} unit${q.units > 1 ? "s" : ""} = ${eur(f.amount)}</code>`,
      `<b>BAF</b> ${cite("baf")}: <code>${eur(ix.equipment[q.equipment].baf_base_A)} × 1.07<sup>${"ABCD".indexOf(q.category)}</sup> = ${eur(b.unit_price)} × ${b.qty} = ${eur(b.amount)}</code>`,
      `<b>Terminal</b> ${cite("sur")}: <code>THC ${eur(L("THC").unit_price)} × ${L("THC").qty} = ${eur(L("THC").amount)}</code> plus port additionals at 20% of THC.`,
      `<b>ETS</b> ${cite("ets")}: <code>${fmt(q.co2.sea_kg)} kg CO₂ ÷ 1,000 × €${S.eua_price_eur_t}/t = ${eur(q.co2.ets_cost)}</code>${q.co2.ets_fee ? ` + <code>€${q.co2.ets_fee}</code> fee because it is below €${S.ets_fee_threshold_eur}` : ""} → <code>${eur(e.amount)}</code>`,
      `<b>Total:</b> <code>freight ${eur(q.total_freight)} + surcharges ${eur(q.total_surcharges)} = ${eur(q.total)}</code>`,
      `<b>CO₂ saving</b> ${cite("glec")}: road ${fmt(q.co2.truck_kg)} kg − sea ${fmt(q.co2.sea_kg)} kg = <code>${fmt(q.co2.saving_kg)} kg</code>`];
    return out;
  }

  root.SDGTraining = { G, render, steps, cite };
})(window);
