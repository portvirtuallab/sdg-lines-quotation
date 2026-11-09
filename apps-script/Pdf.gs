/**
 * SDG Lines Quotation Desk — PDF generation
 * A second file in the same Apps Script project as Code.gs. Paste it alongside.
 *
 * saveQuote_() calls buildQuotationPdf_() after it has assigned the number, so the
 * PDF always carries a real quotation number and never a draft one.
 *
 * Why HTML and not a Google Docs template
 * ---------------------------------------
 * The brief asked for a Docs template, the way SDG Airlines does it. Two things
 * argue against it here and they are worth recording rather than discovering again:
 *
 *   1. A quotation has a variable number of charge lines - a reefer carries a
 *      plug-in, a dangerous shipment carries IMO, an arrival quotation has a
 *      different set entirely. Filling that into a Docs template means inserting
 *      table rows through the Docs API and keeping placeholder names in step with
 *      the engine. Building the rows from the same `lines` array the web app
 *      already renders is both shorter and impossible to get out of step.
 *   2. The template would live in Drive, outside the repository, so a change to it
 *      would not show up in any diff and could not be reviewed.
 *
 * What is lost: a trainer cannot restyle the document without editing code. If that
 * matters more than the two points above, the layout is one function, renderHtml_(),
 * and swapping it for DocumentApp is a contained change.
 *
 * Settings keys this reads, all optional:
 *   pdf_enabled     TRUE to generate PDFs. Anything else turns it off.
 *   pdf_folder_id   Drive folder for the files. Defaults to PDF_FOLDER_ID below.
 */

/* Project Drive folder from the handover. A pdf_folder_id in Settings wins. */
const PDF_FOLDER_ID = '16e0PozIjZ_RgIb4WWV5_9u0QVPqxectO';

/**
 * The SDG Lines logotype, as the public site serves it.
 *
 * A remote image is a dependency the rest of this file does not have, so it is
 * worth saying why. The alternative is a base64 data URI, which the Apps Script
 * HTML-to-PDF converter does not reliably accept; the one after that is drawing
 * the wordmark in type, which is close but is not the logo. If the CDN is ever
 * unreachable the converter leaves the alt text and the document still reads.
 *
 * Override it with a logo_url row in Settings.
 */
const LOGO_URL =
  'https://irp.cdn-website.com/aca2e1ef/dms3rep/multi/opt/logo_sdglines_apaisado-232w.png';

/**
 * Brand colours, sampled from the logotype itself rather than chosen to match
 * it. The cyan and the navy are the two the mark is built from; the green is
 * its third segment, which is why the emissions panel uses it.
 */
const BRAND = {
  primary: '#03B8D9',  // the cyan of "SDG Lines"
  deep: '#242E59',     // the navy of the mark and of "Shipping Digital Game"
  mid: '#373F66',      // the lighter navy inside the mark
  pale: '#CFE2F3',
  wash: '#F2FAFD',     // a tint of the cyan, for panel backgrounds
  eco: '#40A636',      // the green segment of the mark
  ecoWash: '#F1F9F0',
  ink: '#1F2A3C',
  muted: '#6B7489',
  line: '#DCE4EC',
};

/**
 * Build the PDF for an issued quotation and file it in Drive.
 *
 * Never throws. A quotation that is saved but has no PDF is a smaller problem
 * than a quotation that fails to save because Drive was unavailable, so the
 * caller gets a reason back instead of an exception.
 *
 * @param {Object} quote The record as saved, including quote_no.
 * @param {Object} settings Settings tab as {key: value}.
 * @return {{url: string|null, error: string|null}}
 */
function buildQuotationPdf_(quote, settings) {
  try {
    if (String(settings.pdf_enabled).toUpperCase() !== 'TRUE') {
      return { url: null, blob: null, error: null };
    }

    const folderId = settings.pdf_folder_id || PDF_FOLDER_ID;
    /* Name the folder in the message. "Access denied: DriveApp" on its own
       sends you looking at permissions and scopes, when the answer is almost
       always that this id belongs to somebody else's Drive. */
    let folder;
    try {
      folder = DriveApp.getFolderById(folderId);
    } catch (err) {
      return {
        url: null, blob: null,
        error:
          'Drive folder ' + folderId + ' could not be opened by ' +
          (Session.getActiveUser().getEmail() || 'this account') +
          '. Put the id of a folder you own in the pdf_folder_id row of the ' +
          'Settings tab. (' + err + ')',
      };
    }

    const name = quote.quote_no + ' SDG Lines quotation.pdf';
    const blob = Utilities.newBlob(renderHtml_(quote, settings), 'text/html', name)
      .getAs('application/pdf')
      .setName(name);

    const file = folder.createFile(blob);

    /* Link sharing is a convenience, not the point. A learner should be able to
       open their own quotation without asking anyone for access, so the file is
       made readable by link - not listed publicly, and not editable.

       A managed Workspace domain can forbid sharing outside the organisation,
       and then this line throws "Access denied: DriveApp" on a file that was
       written perfectly well. Losing the quotation over that would be absurd:
       the document exists, it is filed, and whoever can reach the folder can
       read it. The restriction is reported and the link returned regardless. */
    let note = null;
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (err) {
      note =
        'The PDF was created but could not be shared by link, which this Google ' +
        'Workspace domain appears to forbid. Anyone outside the domain will be ' +
        'asked for access when they open it. Share the containing folder with ' +
        'the class instead, and the files inherit that access. (' + err + ')';
    }

    return { url: file.getUrl(), blob: blob, error: note };
  } catch (err) {
    return { url: null, blob: null, error: String(err) };
  }
}

/* ---------- layout ---------- */

function esc_(v) {
  return String(v === undefined || v === null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function eur_(n) {
  const v = Number(n);
  if (!isFinite(v)) return '';
  return '€' + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** One row of the shipment table, skipped entirely when there is nothing to say. */
function row_(label, value) {
  if (value === '' || value === null || value === undefined) return '';
  return (
    '<tr><td style="padding:3px 14px 3px 0;color:' + BRAND.muted + ';white-space:nowrap">' +
    esc_(label) +
    '</td><td style="padding:3px 0;font-weight:600">' + esc_(value) + '</td></tr>'
  );
}

/**
 * The whole document, as one HTML string, designed to land on a single A4 page.
 *
 * One page is the hard constraint and it drives every other decision here. A
 * quotation with a reefer, dangerous goods and plug-in runs to twenty charge
 * lines, so the vertical budget is spent deliberately: dense rows, a single
 * band of shipment facts instead of stacked panels, and the training notice in
 * the footer where it is still unmissable but no longer costs a block of the
 * page. If a future charge list overflows, the row padding is the first dial.
 *
 * Deliberately built from tables and inline styles. Apps Script converts HTML
 * to PDF with an old renderer. What survives it, established by running the
 * real thing rather than by reading documentation:
 *
 *   table layout, inline styles, borders, text colour, images   yes
 *   background and background-color on any element              NO
 *   flexbox, grid, CSS variables, web fonts, border-radius      no
 *
 * The missing backgrounds are the trap. A band of colour with white text on it
 * renders as white text on white paper, and the most important figure on the
 * page becomes the one nobody can read. So nothing here is reversed out: every
 * piece of type is dark on white, colour arrives through borders, and the tints
 * that are still declared are decoration the document does not depend on.
 *
 * Use `node tools/preview-pdf.js` to see changes in a browser without
 * deploying. The browser is more forgiving than the converter, so keep to what
 * is already here.
 */
function renderHtml_(q, settings) {
  const isArrival = q.type === 'arrival';
  /* Lato first: it is what sdglines.com sets. The converter has no web fonts,
     so the rest of the stack is what actually draws the page most of the time. */
  const font = "'Lato','Nunito','Trebuchet MS','Helvetica Neue',Helvetica,Arial,sans-serif";
  const mono = "'IBM Plex Mono','Consolas','Courier New',monospace";

  const validity =
    Number(isArrival ? settings.arrival_validity_days : settings.freight_validity_days) || 30;
  const issued = new Date();
  const until = new Date(issued.getTime() + validity * 86400000);
  const tz = Session.getScriptTimeZone();
  const day = (d) => Utilities.formatDate(d, tz, 'd MMM yyyy');

  const units = Math.max(1, Number(q.units) || 1);

  /* ---- charges ----------------------------------------------------------- */

  const GROUPS = [
    { key: 'freight', title: 'Ocean freight' },
    { key: 'surcharge', title: 'Surcharges and local charges' },
    { key: 'cost', title: 'Charges on arrival' },
  ];

  const all = q.lines || [];
  /* A line with in_total === false is printed but does not count. Subtotals
     that included it would not add up to the total, and the reader would be
     left to work out which line was the odd one. */
  const counts = (l) => l.in_total !== false;
  const sum = (rows) => rows.filter(counts).reduce((t, l) => t + Number(l.amount || 0), 0);

  const pad = 'padding:5px 0;';
  const num = pad + 'text-align:right;font-family:' + mono + ';white-space:nowrap;';

  let charges = '';
  let striped = 0;
  for (const group of GROUPS) {
    const rows = all.filter((l) => (l.group || 'cost') === group.key);
    if (!rows.length) continue;

    charges +=
      '<tr><td colspan="4" style="padding:13px 0 4px;font-size:9.5px;letter-spacing:1.3px;' +
      'text-transform:uppercase;color:' + BRAND.primary + ';font-weight:700;' +
      'border-bottom:2px solid ' + BRAND.primary + '">' + esc_(group.title) + '</td></tr>' +
      rows
        .map((l) => {
          /* Alternate tints rather than rules between rows: at this density a
             line under every row turns the block into a grid and the eye has
             nothing to follow across. */
          const tint = striped++ % 2 ? 'background:#F7FAFC;' : '';
          const excluded = !counts(l);

          /* Unit price and quantity earn their columns only when there is more
             than one unit; a charge billed once per booking has nothing to say. */
          const detail =
            Number(l.qty) > 1 && Number(l.unit_price)
              ? '<td style="' + num + tint + 'color:' + BRAND.muted + ';font-size:10.5px">' +
                eur_(l.unit_price) + '</td>' +
                '<td style="' + pad + tint + 'text-align:right;color:' + BRAND.muted +
                ';font-size:10.5px;white-space:nowrap;padding-left:8px">&times;' + esc_(l.qty) + '</td>'
              : '<td style="' + pad + tint + '"></td><td style="' + pad + tint + '"></td>';

          const note = excluded
            ? 'Not included in the total' + (l.note ? ' · ' + l.note : '')
            : l.note;

          return (
            '<tr><td style="' + pad + tint + 'padding-left:4px;' +
            (excluded ? 'color:' + BRAND.muted : '') + '">' + esc_(l.label) +
            (note
              ? '<span style="font-size:10px;color:' + BRAND.muted + ';font-weight:400"> &mdash; ' +
                esc_(note) + '</span>'
              : '') +
            '</td>' + detail +
            '<td style="' + num + tint + 'padding-right:4px;' +
            (excluded ? 'color:' + BRAND.muted : 'font-weight:700;color:' + BRAND.ink) + '">' +
            eur_(l.amount) + '</td></tr>'
          );
        })
        .join('') +
      /* A subtotal only says something when more than one line sits under it. */
      (rows.length > 1
        ? '<tr><td style="padding:7px 0 4px 4px;color:' + BRAND.muted + ';font-size:10.5px">' +
          'Subtotal</td><td></td><td></td>' +
          '<td style="padding:7px 4px 4px 0;text-align:right;font-family:' + mono +
          ';font-weight:700;font-size:11.5px">' + eur_(sum(rows)) + '</td></tr>'
        : '');
  }

  /* ---- the facts, as one band of small label/value pairs ------------------ */

  /* Stacked panels read well and cost 200 points of height. The same facts set
     in three dense columns cost 90 and lose nothing: nobody reads a quotation
     header in sentences, they look for the one field they came for. */
  const fact = (label, value) => {
    if (value === '' || value === null || value === undefined) return '';
    /* Two cells rather than a label of fixed width: "Escola Europea -
       Intermodal Transport" wraps, and with an inline-block label its second
       line starts back at the margin, underneath the label it belongs to. */
    return (
      '<tr>' +
      '<td style="vertical-align:top;padding:3px 10px 3px 0;color:' + BRAND.muted +
      ';font-size:9.5px;text-transform:uppercase;letter-spacing:.6px;white-space:nowrap">' +
      esc_(label) + '</td>' +
      '<td style="vertical-align:top;padding:3px 0;font-weight:700;font-size:11.5px">' +
      esc_(value) + '</td></tr>'
    );
  };
  const factTable = (rows) =>
    rows ? '<table style="border-collapse:collapse;width:100%">' + rows + '</table>' : '';

  const colFor =
    fact('Name', q.customer_name) +
    fact('Company', q.company) +
    fact('Email', q.email) +
    fact('Equipment', q.equipment) +
    fact('Units', units);

  const colRoute = isArrival
    ? fact('Port', q.to || q.port) +
      fact('Weight', q.weight_kg ? Number(q.weight_kg).toLocaleString('en-GB') + ' kg' : '') +
      fact('Dangerous', q.dangerous ? 'Yes' + (q.imo_class ? ' · IMO ' + q.imo_class : '') : 'No')
    : fact('Loading', q.from) +
      fact('Discharge', q.to) +
      fact('Via', q.via) +
      fact('Distance', q.nm ? q.nm + ' NM' : '') +
      fact('Weight', q.weight_kg ? Number(q.weight_kg).toLocaleString('en-GB') + ' kg' : '');

  const colSailing = isArrival
    ? ''
    : fact('Service', q.service) +
      fact('Vessel', q.vessel) +
      fact('Trip', q.tripcode) +
      fact('ETD', q.etd) +
      fact('ETA', q.eta);

  const colExtra = isArrival
    ? ''
    : fact('Dangerous', q.dangerous ? 'Yes' + (q.imo_class ? ' · IMO ' + q.imo_class : '') : 'No') +
      fact('VGM SOLAS', q.vgm ? 'Included' : 'Not included');

  const columns = [colFor, colRoute, colSailing + colExtra].filter(function (c) { return c; });
  const width = Math.floor(100 / columns.length);
  const facts =
    '<table style="width:100%;border-collapse:collapse;background:' + BRAND.wash + ';' +
    'border-left:3px solid ' + BRAND.primary + '"><tr>' +
    columns
      .map(function (c) {
        return '<td style="vertical-align:top;width:' + width + '%;padding:13px 16px">' +
          factTable(c) + '</td>';
      })
      .join('') +
    '</tr></table>';

  /* ---- emissions, as a strip rather than a panel -------------------------- */

  let co2 = '';
  if (!isArrival && q.co2_sea_kg) {
    const sea = Math.round(Number(q.co2_sea_kg));
    const road = Math.round(sea + Number(q.co2_saving_kg || 0));
    const seaPct = road > 0 ? Math.max(4, Math.round((sea / road) * 100)) : 100;
    const bar = (label, value, pct, colour) =>
      '<tr><td style="padding:1.5px 8px 1.5px 0;font-size:9px;color:' + BRAND.muted +
      ';white-space:nowrap">' + label + '</td>' +
      '<td style="padding:1.5px 0;width:100%">' +
      '<table style="width:100%;border-collapse:collapse"><tr>' +
      '<td style="border-bottom:10px solid ' + colour + ';width:' + pct +
      '%;font-size:0;line-height:0">&nbsp;</td>' +
      '<td style="border-bottom:10px solid #E4EBF1;font-size:0;line-height:0">&nbsp;</td>' +
      '</tr></table></td>' +
      '<td style="padding:1.5px 0 1.5px 8px;font-family:' + mono + ';font-size:9px;' +
      'white-space:nowrap;font-weight:700">' + value.toLocaleString('en-GB') + ' kg</td></tr>';

    co2 =
      '<table style="width:100%;border-collapse:collapse;margin-top:10px;background:' +
      BRAND.ecoWash + ';border-left:3px solid ' + BRAND.eco + '">' +
      '<tr><td style="padding:11px 16px;width:34%;vertical-align:middle">' +
      '<div style="font-size:8.5px;letter-spacing:1.2px;text-transform:uppercase;font-weight:700;' +
      'color:' + BRAND.eco + '">Estimated emissions</div>' +
      (q.co2_saving_kg
        ? '<div style="font-size:9.5px;color:' + BRAND.ink + ';padding-top:2px">Going by sea ' +
          'avoids about <strong>' + Math.round(q.co2_saving_kg).toLocaleString('en-GB') +
          ' kg CO2e</strong></div>'
        : '') +
      '</td><td style="padding:11px 16px 11px 0;vertical-align:middle">' +
      '<table style="width:100%;border-collapse:collapse">' +
      bar('By sea with SDG Lines', sea, seaPct, BRAND.eco) +
      bar('The same cargo by road', road, 100, '#C06A4C') +
      '</table></td></tr></table>';
  }

  /* ---- the page ----------------------------------------------------------- */

  const perUnit = units > 1 ? Number(q.total || 0) / units : null;

  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    /* Honoured by some converters and ignored by others; it costs nothing and
       when it lands it is the difference between one page and two. */
    '<style>@page{size:A4;margin:11mm 10mm}body{margin:0}</style>' +
    '</head>' +
    '<body style="margin:0;font-family:' + font + ';font-size:11.5px;line-height:1.4;color:' +
    BRAND.ink + '">' +

    /* Letterhead. The logotype is cyan and navy on transparency, so it needs a
       white ground: on a coloured band its navy half disappears. The colour
       goes to the rules underneath, in the order they appear in the mark. */
    '<table style="width:100%;border-collapse:collapse"><tr>' +
    '<td style="vertical-align:middle;padding:0 0 10px">' +
    '<img src="' + esc_(settings.logo_url || LOGO_URL) + '" alt="SDG Lines" ' +
    'width="190" style="display:block;border:0">' +
    '</td>' +
    '<td style="vertical-align:middle;text-align:right;padding:0 0 10px">' +
    '<table style="border-collapse:collapse;float:right"><tr>' +
    '<td style="padding:4px 0 4px 16px;text-align:right;border-left:3px solid ' +
    BRAND.primary + '">' +
    '<div style="font-size:8px;letter-spacing:1.6px;text-transform:uppercase;color:' +
    BRAND.primary + ';font-weight:700">' +
    (isArrival ? 'Arrival charges' : 'Freight quotation') + '</div>' +
    '<div style="font-family:' + mono + ';font-size:20px;font-weight:700;color:' + BRAND.deep +
    ';line-height:1.2">' + esc_(q.quote_no) + '</div>' +
    '</td></tr></table>' +
    '</td></tr></table>' +

    '<div style="height:2px;background:' + BRAND.primary + '"></div>' +
    '<div style="height:5px;background:' + BRAND.deep + '"></div>' +

    '<div style="padding:12px 0 0;font-family:' + font + '">' +

    facts +

    /* Charges */
    '<table style="width:100%;border-collapse:collapse;font-size:10.5px;margin-top:10px;' +
    'font-family:' + font + '">' + charges + '</table>' +

    /* Total */
    '<table style="width:100%;border-collapse:collapse;margin-top:12px;border-top:3px solid ' +
    BRAND.deep + ';border-bottom:3px solid ' + BRAND.deep + '"><tr>' +
    '<td style="padding:11px 2px;color:' + BRAND.deep + ';font-weight:700;font-size:13px;' +
    'letter-spacing:.3px">Total' +
    (units > 1 ? ' for ' + esc_(units) + ' units' : '') +
    (perUnit
      ? '<span style="font-weight:400;color:' + BRAND.muted + ';font-size:10px"> &nbsp;' +
        eur_(perUnit) + ' each</span>'
      : '') +
    '</td>' +
    '<td style="padding:11px 2px;text-align:right;color:' + BRAND.deep +
    ';font-weight:800;font-size:23px;font-family:' + mono + '">' + eur_(q.total) + '</td>' +
    '</tr></table>' +

    co2 +

    /* Footer. The training notice lives here rather than in a block of its own:
       still on every page, no longer costing one eighth of it. */
    '<table style="width:100%;border-collapse:collapse;margin-top:10px;border-top:1px solid ' +
    BRAND.line + '"><tr><td style="padding-top:9px;font-size:9.5px;line-height:1.5;color:' +
    BRAND.muted + '">' +
    '<strong style="color:' + BRAND.deep + '">Training simulation.</strong> SDG Lines is a ' +
    'simulated shipping company used by Escola Europea &ndash; Intermodal Transport for ' +
    'education. This document is not a commercial offer and carries no contractual value.<br>' +
    'Issued ' + day(issued) + ' &middot; valid until ' + day(until) + ' (' + validity + ' days)' +
    (q.mode === 'legacy'
      ? ' &middot; priced in <strong>legacy</strong> mode, which reproduces known errors of the ' +
        'previous system on purpose'
      : '') +
    ' &middot; all amounts in euro &middot; Port Virtual Lab' +
    '</td></tr></table>' +

    '</div></body></html>'
  );
}

/* ---------- manual check ---------- */

/**
 * Renders a sample PDF without issuing a number or touching the Quotations tab.
 * Run it from the editor, or from the SDG Lines menu, and open the logged link.
 */
function previewQuotationPdf() {
  const settings = settingsMap_();
  settings.pdf_enabled = 'TRUE'; // so a preview works before the feature is switched on
  const sample = {
    quote_no: 'SDG2026PREVIEW',
    type: 'freight',
    mode: 'corrected',
    customer_name: 'Ada Pujol',
    company: 'Escola Europea',
    email: 'ada@example.org',
    from: 'AQABA',
    to: 'MARSEILLE',
    service: 'Optimed',
    vessel: 'Aglahonike Of Thessaly',
    etd: '12/11/2026 08:00',
    eta: '21/11/2026 14:00',
    nm: 2282,
    equipment: "40 feet Container (Dry Cargo)",
    units: 2,
    weight_kg: 21000,
    dangerous: false,
    vgm: true,
    total: 3283.42,
    co2_sea_kg: 388,
    co2_saving_kg: 144,
    /* Each line carries its group, unit price and quantity, as the engine
       produces them. Without the group every line fell into the default and the
       sample printed "Charges on arrival" over a freight quotation - a sample
       that misrepresents the real document is worse than no sample. */
    lines: [
      { code: 'OCEAN_FREIGHT', label: 'Ocean freight', unit_price: 938.18, qty: 2,
        amount: 1876.36, group: 'freight', note: 'Base FEU €938.18 × factor 1' },
      { code: 'BAF', label: 'BAF', unit_price: 92.25, qty: 2, amount: 184.5, group: 'freight' },
      { code: 'THC', label: 'THC (origin)', unit_price: 279, qty: 2, amount: 558,
        group: 'surcharge' },
      { code: 'PORT_ADDITIONAL', label: 'Port additionals', unit_price: 55.8, qty: 2,
        amount: 111.6, group: 'surcharge' },
      { code: 'DOCUMENTATION', label: 'Documentation', unit_price: 72, qty: 1, amount: 72,
        group: 'surcharge' },
      { code: 'ETS', label: 'ETS', unit_price: 48.56, qty: 1, amount: 48.56, group: 'surcharge' },
      { code: 'CUSTOM_CLEARANCE', label: 'Customs clearance', unit_price: 45, qty: 1,
        amount: 45, group: 'surcharge', in_total: false,
        note: 'not a carrier service; shown so the operation is complete' },
    ],
  };
  const out = buildQuotationPdf_(sample, settings);
  Logger.log(out.url || ('Could not create the preview: ' + out.error));
  /* Deliberately returns nothing. The editor tries to display whatever a
     function returns, and `out` carries the PDF blob for the mail attachment.
     Asking the editor to render a blob fails with "An unknown error has
     occurred, please try again later", which reads like the PDF broke when in
     fact it was written correctly. The link is in the log above. */
}

/** Settings tab as a plain {key: value} object. */
function settingsMap_() {
  const sh = SpreadsheetApp.getActive().getSheetByName('Settings');
  const map = {};
  if (!sh) return map;
  sh.getDataRange().getValues().forEach((r) => {
    if (r[0]) map[String(r[0]).trim()] = r[1];
  });
  return map;
}
