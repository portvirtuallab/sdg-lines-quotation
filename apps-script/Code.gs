/**
 * SDG Lines Quotation Desk — Apps Script API (v3 · light)
 * Bound to the "SDG_Lines_DB" Google Sheet.
 *
 * GET  ?action=data              → the 6 tariff tabs as JSON (cached 10 min)
 *                                  Schedule, distances and routes live in GitHub (data/network.json).
 * GET  ?action=quotes&limit=50   → latest quotations (needs ?key=TRAINER_KEY)
 * POST {action:"save", quote:{…}} → assigns the next SDG/AC number, appends a row to Quotations
 *                                  and, when Settings.pdf_enabled is TRUE, files a PDF in Drive
 *                                  and returns its link (see Pdf.gs)
 *
 * Deploy: Extensions › Apps Script › paste this file › Deploy › New deployment › Web app
 *         Execute as: Me · Who has access: Anyone
 * Then run setupLog once (or use the "SDG Lines" menu) to create the "Log (last 2 months)" tab.
 */

const TABS = ['Settings', 'Ports', 'Equipment', 'THC', 'Surcharges', 'FreightCurve'];
const CACHE_KEY = 'sdg_tariffs_v3';

function doGet(e) {
  const action = (e && e.parameter.action) || 'data';
  try {
    if (action === 'data') return json_(readAll_());
    if (action === 'quotes') {
      if (!isTrainer_(e.parameter.key)) return json_({ error: 'Not authorised' });
      return json_(latestQuotes_(Number(e.parameter.limit) || 50));
    }
    return json_({ error: 'Unknown action' });
  } catch (err) {
    return json_({ error: String(err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    if (body.action === 'save') return json_(saveQuote_(body.quote || {}));
    return json_({ error: 'Unknown action' });
  } catch (err) {
    return json_({ error: String(err) });
  }
}

/* ---------- read ---------- */
function readAll_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get(CACHE_KEY);
  if (hit) return JSON.parse(hit);
  const ss = SpreadsheetApp.getActive();
  const out = { generated_at: new Date().toISOString() };
  TABS.forEach(name => { out[name] = readTab_(ss.getSheetByName(name)); });
  const s = JSON.stringify(out);
  if (s.length < 95000) cache.put(CACHE_KEY, s, 600); // CacheService limit is 100 KB per key
  return out;
}

function readTab_(sh) {
  if (!sh) return [];
  const values = sh.getDataRange().getValues();
  const head = values.shift();
  const tz = Session.getScriptTimeZone();
  return values.filter(r => r.some(c => c !== '')).map(r => {
    const o = {};
    head.forEach((h, i) => {
      let v = r[i];
      if (v instanceof Date) v = Utilities.formatDate(v, tz, 'dd/MM/yyyy HH:mm');
      if (v === 'TRUE') v = true; if (v === 'FALSE') v = false;
      o[h] = v;
    });
    return o;
  });
}

/* Call this after editing tariffs if you want the web app to see the change immediately. */
function clearCache() { CacheService.getScriptCache().remove(CACHE_KEY); }

/* ---------- write ---------- */
function saveQuote_(q) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = SpreadsheetApp.getActive();
    const settings = ss.getSheetByName('Settings');
    const rows = settings.getDataRange().getValues();
    const isArrival = q.type === 'arrival';
    const keyNext = isArrival ? 'next_number_arrival' : 'next_number_freight';
    const keyPrefix = isArrival ? 'quote_prefix_arrival' : 'quote_prefix_freight';
    let prefix = isArrival ? 'AC' : 'SDG', next = 1, row = -1;
    rows.forEach((r, i) => {
      if (r[0] === keyPrefix) prefix = r[1];
      if (r[0] === keyNext) { next = Number(r[1]) || 1; row = i + 1; }
    });
    const year = new Date().getFullYear();
    const number = prefix + year + String(next).padStart(4, '0');
    if (row > 0) settings.getRange(row, 2).setValue(next + 1);

    const sh = ss.getSheetByName('Quotations');
    const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    const rec = Object.assign({}, q, { quote_no: number, created_at: new Date(), status: 'issued' }); // real date so the log can filter by period
    rec.lines_json = JSON.stringify(q.lines || []);

    // The PDF is built after the number is assigned, so it can never show a draft
    // one, and it never throws: a quotation saved without its PDF is a smaller
    // problem than one that fails to save because Drive was unavailable.
    const cfg = {};
    rows.forEach(r => { if (r[0]) cfg[String(r[0]).trim()] = r[1]; });
    const pdf = buildQuotationPdf_(rec, cfg);
    if (pdf.url) rec.pdf_url = pdf.url;
    if (pdf.error) console.warn('PDF not created for ' + number + ': ' + pdf.error);

    // Email is the record of the activity, so it is attempted after the PDF and,
    // like the PDF, can never take the quotation down with it.
    const mail = emailQuotation_(rec, cfg, pdf.blob);
    if (mail.sent) rec.emailed_to = mail.to;
    if (mail.error) console.warn('Email not sent for ' + number + ': ' + mail.error);

    sh.appendRow(head.map(h => rec[h] !== undefined ? rec[h] : ''));
    return {
      ok: true, quote_no: number,
      pdf_url: pdf.url || null, pdf_error: pdf.error || null,
      emailed_to: mail.sent ? mail.to : null, email_error: mail.error || null,
    };
  } finally {
    lock.releaseLock();
  }
}

function latestQuotes_(limit) {
  const all = readTab_(SpreadsheetApp.getActive().getSheetByName('Quotations'));
  return all.slice(-limit).reverse();
}

/* Trainer key: Project Settings › Script properties › TRAINER_KEY */
function isTrainer_(key) {
  const k = PropertiesService.getScriptProperties().getProperty('TRAINER_KEY');
  return !!k && key === k;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- log tab inside this spreadsheet ---------- */
/* Adds an "SDG Lines" menu when the sheet is opened. */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('SDG Lines')
    .addItem('Create / refresh "Log (last 2 months)" tab', 'setupLog')
    .addItem('Clear API cache (after editing tariffs)', 'clearCache')
    .addItem('Preview the quotation PDF', 'previewQuotationPdf')
    .addItem('Send myself a sample email', 'previewQuotationEmail')
    .addToUi();
}

/* Creates the log tab. It reads only the Quotations tab of this file and
   always shows the last 2 months (the window moves forward by itself every day). */
function setupLog() {
  const ss = SpreadsheetApp.getActive();
  const name = 'Log (last 2 months)';
  let sh = ss.getSheetByName(name);
  if (sh) sh.clear(); else sh = ss.insertSheet(name, 1);
  const Q = 'Quotations', CUT = 'TEXT($B$3,"yyyy-mm-dd hh:mm:ss")';
  const f = (type, cols, labels, msg) =>
    '=IFERROR(QUERY(' + Q + '!A1:AD,"select ' + cols + " where B = '" + type + "' and C >= datetime '\"&" + CUT +
    "&\"' order by C desc label " + labels + '",1),"' + msg + '")';

  sh.getRange('A1').setValue('SDG Lines – Quotation log (last 2 months)').setFontSize(16).setFontWeight('bold').setFontColor('#0687A1');
  sh.getRange('A3:B3').setValues([['Showing quotations since', '']]);
  sh.getRange('B3').setFormula('=EDATE(TODAY(),-2)').setNumberFormat('dd/mm/yyyy').setFontWeight('bold').setFontColor('#0000FF');
  sh.getRange('C3').setValue('Rolling window: always the last 2 months. For fixed periods (Jan–Feb, Mar–Apr…) use =DATE(YEAR(TODAY()),2*INT((MONTH(TODAY())-1)/2)+1,1)')
    .setFontStyle('italic').setFontColor('#4A6472');

  const kpi = [
    ['Freight quotations', '=COUNTIFS(' + Q + '!B2:B,"freight",' + Q + '!C2:C,">="&$B$3)', '0'],
    ['Arrival charges quotations', '=COUNTIFS(' + Q + '!B2:B,"arrival",' + Q + '!C2:C,">="&$B$3)', '0'],
    ['Total freight quoted', '=SUMIFS(' + Q + '!Z2:Z,' + Q + '!B2:B,"freight",' + Q + '!C2:C,">="&$B$3)', '€#,##0.00'],
    ['Total arrival charges quoted', '=SUMIFS(' + Q + '!Z2:Z,' + Q + '!B2:B,"arrival",' + Q + '!C2:C,">="&$B$3)', '€#,##0.00'],
    ['CO2 saved vs road (kg)', '=SUMIFS(' + Q + '!AB2:AB,' + Q + '!B2:B,"freight",' + Q + '!C2:C,">="&$B$3)', '#,##0']
  ];
  kpi.forEach((k, i) => {
    sh.getRange(5 + i, 1).setValue(k[0]);
    sh.getRange(5 + i, 2).setFormula(k[1]).setNumberFormat(k[2]).setFontWeight('bold');
  });

  sh.getRange('A11').setValue('Freight quotations').setFontWeight('bold').setFontSize(12);
  sh.getRange('A12').setFormula(f('freight',
    'C, A, E, F, G, H, I, K, L, P, Q, Z',
    "C 'Date', A 'Quotation no', E 'Name', F 'Company', G 'Email', H 'From', I 'To', K 'Service', L 'Vessel', P 'Equipment', Q 'Units', Z 'Total €'",
    'No freight quotations in this period yet'));

  sh.getRange('N11').setValue('Arrival charges quotations').setFontWeight('bold').setFontSize(12);
  sh.getRange('N12').setFormula(f('arrival',
    'C, A, E, F, I, P, Q, Z',
    "C 'Date', A 'Quotation no', E 'Name', F 'Company', I 'Port', P 'Equipment', Q 'Units', Z 'Total €'",
    'No arrival charges quotations in this period yet'));

  sh.getRange('A12:U12').setFontWeight('bold').setBackground('#CFE2F3');
  sh.setFrozenRows(12);
  sh.setColumnWidth(1, 200); sh.setColumnWidth(14, 140);
  ss.setActiveSheet(sh);
}
