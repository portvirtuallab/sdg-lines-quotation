/**
 * Course access codes.
 *
 * Escola Europea has issued PVL course codes since 2023 through a Google Form,
 * and the responses land in "Control Access PVL (Responses)". That sheet has a
 * tab called Base holding nothing but the code and whether it is active, which
 * is exactly and only what the Desk needs.
 *
 * This file reads that tab and nothing else. The form responses alongside it
 * carry course names, institutions and coordinator email addresses, and none of
 * that belongs in the quotation system: a code and a yes or no is enough to
 * decide whether somebody may issue a quotation.
 *
 * What this is and is not
 * -----------------------
 * It is a classroom control. It decides who gets a numbered quotation, a PDF
 * and a row in Quotations, and it gives everybody else a sample with no total.
 *
 * It is not secrecy. The pricing engine is JavaScript running in the learner's
 * own browser, and the repository that serves it is public, so the tariffs can
 * be read by anyone who goes looking. That is deliberate - an engine a learner
 * can open is the point of the exercise - and it means this gate should never
 * be described to anyone as protecting the prices.
 */

/* The access sheet, opened by id and never written to. */
const ACCESS_SHEET_ID = '19LcU3eDyjhCC_snzx89gxPj4-1zLeSWFIGQOSvfKnbk';
const ACCESS_TAB = 'Base';
const ACCESS_CACHE_KEY = 'sdg_access_codes_v1';
const ACCESS_CACHE_SECONDS = 600;

/**
 * The set of codes that may quote today.
 * Returns a plain object used as a set, so a lookup is one property read.
 */
function activeCodes_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get(ACCESS_CACHE_KEY);
  if (hit) return JSON.parse(hit);

  const out = {};
  try {
    const sheet = SpreadsheetApp.openById(ACCESS_SHEET_ID).getSheetByName(ACCESS_TAB);
    if (!sheet) throw new Error('the ' + ACCESS_TAB + ' tab is not there');
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      const code = normaliseCode_(values[i][0]);
      const status = String(values[i][1] || '').trim().toLowerCase();
      if (code && status === 'active') out[code] = true;
    }
  } catch (err) {
    /* A sheet that cannot be read must not become a sheet that lets everybody
       in. The empty set means nobody quotes until it is reachable again, which
       is the failure a trainer notices rather than the one nobody notices. */
    console.warn('Access codes unavailable: ' + err.message);
    return {};
  }

  cache.put(ACCESS_CACHE_KEY, JSON.stringify(out), ACCESS_CACHE_SECONDS);
  return out;
}

/* Codes are four digit numbers in the sheet, which arrive from a form field as
   anything a person can type. Compare them as trimmed strings so that " 7914 "
   and 7914 are the same code, without turning "07914" into something else. */
function normaliseCode_(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/**
 * Whether a code may issue quotations.
 * Returns { granted, code, reason } and never throws.
 */
function checkAccess_(code) {
  const wanted = normaliseCode_(code);
  if (!wanted) return { granted: false, code: '', reason: 'no code given' };
  const codes = activeCodes_();
  if (Object.keys(codes).length === 0) {
    return { granted: false, code: wanted, reason: 'the access list could not be read' };
  }
  if (!codes[wanted]) return { granted: false, code: wanted, reason: 'not an active course code' };
  return { granted: true, code: wanted, reason: '' };
}

/* Drop the cached list, for when a code has just been activated and the class
   is waiting. Wired into the SDG Lines menu beside the tariff cache. */
function clearAccessCache() {
  CacheService.getScriptCache().remove(ACCESS_CACHE_KEY);
}

/**
 * What the Desk is given without a valid code.
 *
 * Ports and the freight curve, which are enough to show a route, its distance
 * and what the ocean freight on it would start at. Not the surcharges, not the
 * terminal handling, not the equipment factors and not the emissions settings,
 * so a total cannot be assembled from what is sent. The sample is incomplete
 * at the server, not hidden at the browser.
 */
function sampleOf_(full) {
  const SHOWN_SETTINGS = {
    freight_validity_days: true,
    arrival_validity_days: true,
    hub_port: true,
    freight_mode: true,
  };
  return {
    generated_at: full.generated_at,
    sample: true,
    Ports: full.Ports,
    FreightCurve: full.FreightCurve,
    Settings: (full.Settings || []).filter(function (row) {
      return SHOWN_SETTINGS[row.key];
    }),
    Equipment: [],
    THC: [],
    Surcharges: [],
  };
}

/** A quick check from the editor, printing counts rather than codes. */
function checkAccessList() {
  clearAccessCache();
  const codes = activeCodes_();
  const total = Object.keys(codes).length;
  console.log(
    total === 0
      ? 'No active codes were read. Check that this account can open the access sheet.'
      : total + ' active course code(s) read from ' + ACCESS_TAB + '.',
  );
}
