/**
 * Sends the issued quotation to the address on it, with the PDF attached, and
 * keeps a copy for the trainer. The email is the evidence that the activity
 * happened, so it goes out with the quotation rather than on request.
 *
 * Settings rows that control it, all in the Settings tab of SDG_Lines_DB:
 *
 *   email_enabled      TRUE / FALSE. Missing counts as TRUE.
 *   email_evidence_to  Address that receives a copy of every quotation.
 *                      Leave it empty and no copy is sent.
 *   email_from_name    Display name on the message. Defaults to SDG Lines.
 *
 * Two things worth knowing before this is deployed:
 *
 *  - It sends to whatever address a learner typed into the form. There is no
 *    allow-list. If quotations are ever issued with real customer addresses in
 *    that field, those people receive mail from the simulation.
 *  - Apps Script allows a limited number of recipients a day per account
 *    (100 on a consumer account, 1500 on Workspace). A class of thirty issuing
 *    several quotations each will not reach it; a bulk replay might.
 */

/* A send must never cost a quotation its number. Everything here is caught. */
function emailQuotation_(quote, settings, pdfBlob) {
  try {
    if (String(settings.email_enabled || 'TRUE').toUpperCase() !== 'TRUE') {
      return { sent: false, error: null };
    }

    const to = String(quote.email || '').trim();
    if (!to) return { sent: false, error: null };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
      return { sent: false, error: 'Not a usable address: ' + to };
    }

    const evidence = String(settings.email_evidence_to || '').trim();
    const isArrival = quote.type === 'arrival';
    const subject =
      'SDG Lines ' + (isArrival ? 'arrival charges' : 'quotation') + ' ' + quote.quote_no +
      ' (training simulation)';

    const options = {
      name: settings.email_from_name || 'SDG Lines',
      htmlBody: mailBody_(quote, isArrival),
      attachments: pdfBlob ? [pdfBlob] : [],
    };
    /* A copy rather than a blind one: the learner should be able to see that
       their trainer has the same document. */
    if (evidence) options.cc = evidence;

    MailApp.sendEmail(to, subject, mailPlain_(quote, isArrival), options);
    return { sent: true, to: to, error: null };
  } catch (err) {
    return { sent: false, error: String(err) };
  }
}

function mailBody_(q, isArrival) {
  const where = isArrival
    ? esc_(q.port || q.to || '')
    : esc_(q.from || '') + ' to ' + esc_(q.to || '');
  const total = typeof eur_ === 'function' ? eur_(q.total) : '€' + q.total;

  return (
    '<div style="font-family:Trebuchet MS,Helvetica,Arial,sans-serif;font-size:14px;' +
    'line-height:1.55;color:#1A2B33;max-width:560px">' +
    '<p>Hello ' + esc_(q.customer_name || '') + ',</p>' +
    '<p>Your ' + (isArrival ? 'arrival charges' : 'quotation') + ' <strong>' +
    esc_(q.quote_no) + '</strong> for ' + where + ' is attached as a PDF.</p>' +
    '<p style="font-size:20px;font-weight:700;margin:18px 0">' + total + '</p>' +
    (q.pdf_url
      ? '<p><a href="' + esc_(q.pdf_url) + '">Open the quotation</a></p>'
      : '') +
    '<p style="background:#CFE2F3;padding:10px 14px;font-size:12.5px">' +
    '<strong>Training simulation.</strong> SDG Lines is a simulated shipping ' +
    'company used by Escola Europea &ndash; Intermodal Transport for education. ' +
    'This message is not a commercial offer and carries no contractual value.</p>' +
    '</div>'
  );
}

function mailPlain_(q, isArrival) {
  return (
    'Your ' + (isArrival ? 'arrival charges' : 'quotation') + ' ' + q.quote_no +
    ' is attached as a PDF.\n\n' +
    'Training simulation. SDG Lines is a simulated shipping company used by ' +
    'Escola Europea - Intermodal Transport for education. This message is not a ' +
    'commercial offer and carries no contractual value.'
  );
}

/**
 * Sends a sample to whoever runs it, so the wording and the attachment can be
 * checked without issuing a quotation or writing to the sheet.
 */
function previewQuotationEmail() {
  const settings = settingsMap_();
  const sample = {
    quote_no: 'SDG20260000', type: 'freight', from: 'BARCELONA', to: 'DAMIETTA',
    customer_name: 'Sample learner', email: Session.getActiveUser().getEmail(),
    total: 5458.48,
  };
  const pdf = buildQuotationPdf_(sample, settings);
  const r = emailQuotation_(sample, settings, pdf.blob);
  console.log(r.sent ? 'Sent to ' + r.to : 'Not sent: ' + (r.error || 'email_enabled is FALSE'));
}
