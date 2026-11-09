/* Renders the quotation document to an HTML file so the layout can be worked on
   in a browser, without deploying Apps Script every time.

   Usage: node tools/preview-pdf.js [out.html]        default: tools/preview.html

   It loads the real renderHtml_ out of apps-script/Pdf.gs and runs it against
   sample quotations, so what you see here is what the deployed script builds.

   The browser is more forgiving than the converter, and the difference has
   already cost one round trip: the converter drops every background, so a
   coloured band with white text on it came out as white text on white paper.

   So this page renders the samples the way the converter does - backgrounds
   stripped - and offers a toggle to see them. What you see by default is what
   the PDF will look like. Stay with tables, inline styles and borders. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'apps-script', 'Pdf.gs'), 'utf8');

/* Apps Script globals the layout touches. Only these two. */
const sandbox = {
  Session: { getScriptTimeZone: () => 'Europe/Madrid' },
  Utilities: {
    formatDate(date, _tz, pattern) {
      const months = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
      const full = months[date.getMonth()];
      if (pattern === 'd MMMM yyyy') return `${date.getDate()} ${full} ${date.getFullYear()}`;
      if (pattern === 'd MMM yyyy') {
        return `${date.getDate()} ${full.slice(0, 3)} ${date.getFullYear()}`;
      }
      return date.toISOString();
    },
  },
  console,
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox);

const settings = {};
for (const row of require(path.join(root, 'data', 'tariffs.json')).Settings || []) {
  settings[row.key] = row.value;
}

/* The sample documents are priced by the real engine, not written by hand.
   An invented `lines` array would be missing the `group`, `unit_price` and
   `qty` fields the layout reads, and the preview would quietly show something
   the deployed script never produces. */
const E = require(path.join(root, 'js', 'engine.js'));
const db = Object.assign(
  {},
  require(path.join(root, 'data', 'network.json')),
  require(path.join(root, 'data', 'tariffs.json')),
);
const ix = E.index(db);

function freight(caption, args, extra) {
  const q = E.quoteFreight(ix, args);
  return {
    caption,
    quote: Object.assign(
      {
        quote_no: 'SDG20260588', type: 'freight', mode: 'corrected',
        customer_name: 'Ada Pujol', company: 'Escola Europea – Intermodal Transport',
        email: 'ada.pujol@example.org',
        from: args.from, to: args.to, equipment: args.equipment, units: args.units,
        dangerous: !!args.dangerous, vgm: !!args.vgm,
        nm: q.nm, total: q.total, lines: q.lines,
        co2_sea_kg: q.co2 && q.co2.sea_kg, co2_saving_kg: q.co2 && q.co2.saving_kg,
      },
      extra || {},
    ),
  };
}

function arrival(caption, args) {
  const q = E.quoteArrival(ix, args);
  return {
    caption,
    quote: {
      quote_no: 'AC20260277', type: 'arrival', mode: 'corrected',
      customer_name: 'Joan Mariné', company: 'Port Virtual Lab', email: 'joan@example.org',
      port: args.port, to: args.port, equipment: args.equipment, units: args.units,
      dangerous: !!args.dangerous, total: q.total, lines: q.lines,
    },
  };
}

const samples = [
  freight(
    'Freight, reefer, three units, dangerous goods — the longest document',
    { from: 'BARCELONA', to: 'DAMIETTA', equipment: '20 feet Reefer', units: 3, vgm: true, dangerous: true, ams: true },
    { service: 'Optimed', vessel: 'Aglahonike Of Thessaly', tripcode: 'SDGCH7021',
      etd: '12/11/2026 08:00', eta: '21/11/2026 14:00', weight_kg: 48000, imo_class: '3' },
  ),
  freight(
    'Freight, one dry container — the common case',
    { from: 'AQABA', to: 'MARSEILLE', equipment: '40 feet Container (Dry Cargo)', units: 1, vgm: false, dangerous: false },
    { service: 'Optimed', vessel: 'Theano Of Crotone', etd: '03/12/2026 06:00', eta: '12/12/2026 18:00' },
  ),
  arrival(
    'Arrival charges, one unit — the shortest document there is',
    { port: 'BARCELONA', equipment: '20 feet Container (Dry Cargo)', units: 1, dangerous: false },
  ),
];

/* A4 at 96dpi is 794 x 1123 px. The @page rule in the document asks for
   11mm x 10mm margins, which leaves this much room for content. Drawing that
   box is the only way to answer "does it fit on one page" without printing. */
const A4_W = 794 - Math.round((10 / 25.4) * 96) * 2;
const A4_H = 1123 - Math.round((11 / 25.4) * 96) * 2;

const out = process.argv[2] || path.join(__dirname, 'preview.html');
const page = samples
  .map(
    (s, i) =>
      '<p style="font:600 13px/1.4 system-ui,sans-serif;color:#5A7380;margin:30px 0 8px">' +
      s.caption + '</p>' +
      '<div class="sheet" data-i="' + i + '" style="position:relative;width:' + A4_W + 'px;' +
      'box-shadow:0 2px 14px rgba(0,0,0,.14);background:#fff;padding:0">' +
      sandbox.renderHtml_(s.quote, settings) +
      '<div style="position:absolute;left:0;right:0;top:' + A4_H + 'px;height:0;' +
      'border-top:2px dashed #D23;pointer-events:none"></div>' +
      '<div style="position:absolute;right:4px;top:' + (A4_H + 4) + 'px;font:700 10px system-ui;' +
      'color:#D23">end of page 1</div>' +
      '</div>',
  )
  .join('');

fs.writeFileSync(
  out,
  '<!doctype html><meta charset="utf-8"><title>Quotation document preview</title>' +
    '<style>' +
    '/* The converter ignores every background. Simulating that here is the' +
    '   whole point of this page: a design that needs a fill to be readable' +
    '   must fail in the browser too, or it fails in the PDF instead. */' +
    'body.as-pdf .sheet *{background:transparent!important}' +
    '.bar{position:fixed;top:0;left:0;right:0;padding:8px 26px;background:#132738;' +
    'color:#fff;font:600 12px system-ui,sans-serif;z-index:9}' +
    '.bar label{cursor:pointer}' +
    '</style>' +
    '<body class="as-pdf" style="margin:0;padding:52px 26px 26px;background:#EEF3F5">' +
    '<div class="bar"><label><input type="checkbox" id="fills"> ' +
    'show backgrounds (the browser can, the PDF cannot)</label></div>' +
    '<script>document.addEventListener("change",function(e){' +
    'if(e.target.id==="fills")document.body.classList.toggle("as-pdf",!e.target.checked);' +
    '});</script>' + page +
    '<script>window.addEventListener("load",function(){' +
    'document.querySelectorAll(".sheet").forEach(function(el){' +
    'var kids=[].slice.call(el.children).filter(function(c){return getComputedStyle(c).position!=="absolute"});' +
    'var h=Math.max.apply(null,kids.map(function(c){return c.offsetTop+c.offsetHeight}));' +
    'var fits=h<=' + A4_H + ';' +
    'var tag=document.createElement("div");' +
    'tag.style.cssText="font:700 12px system-ui;margin:6px 0 0;color:"+(fits?"#17863C":"#D23");' +
    'tag.textContent=(fits?"fits: ":"OVERFLOWS: ")+h+" of ' + A4_H + ' px";' +
    'el.parentNode.insertBefore(tag,el.nextSibling);});});</script>' +
    '</body>',
);

console.log('Wrote ' + path.relative(root, out) + ' with ' + samples.length + ' sample documents.');
console.log('A4 content box: ' + A4_W + ' x ' + A4_H + ' px. The dashed rule is where page 1 ends.');
