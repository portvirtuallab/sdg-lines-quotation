# Emailing the quotation

Backlog item 2. When a quotation is issued, the PDF is emailed to the address on
it, with a copy to the trainer. The message is the evidence that the activity
happened, which is why it goes out with the quotation rather than on request.

## Switching it on

Deploy `apps-script/Mail.gs` alongside `Pdf.gs`. It needs the PDF, so
`pdf_enabled` must be `TRUE` as well; without a PDF there is nothing to attach.

Rows in the **Settings** tab of `SDG_Lines_DB`:

| key | value | meaning |
| --- | --- | --- |
| `email_enabled` | `TRUE` / `FALSE` | **A missing row counts as TRUE.** Add the row set to `FALSE` to hold sending. |
| `email_evidence_to` | an address | Receives a copy of every quotation. Empty and no copy is sent. |
| `email_from_name` | text | Display name. Defaults to `SDG Lines`. |

Run **`previewQuotationEmail`** from the editor, or *Send myself a sample email*
in the **SDG Lines** menu, to receive a sample at your own address without
issuing a quotation or writing to the sheet.

## Read this before deploying it

**It sends to whatever address was typed into the form.** There is no
allow-list. The field is free text filled in by a learner. If a real customer
address is ever typed there, that person receives mail from the simulation,
and nothing in the system will stop it.

The training notice is in the subject line and in the body, so a message that
reaches the wrong person says what it is before it is opened. That is a
mitigation, not a control. If you would rather the option existed without being
on, add `email_enabled` = `FALSE` now and turn it on per session.

**Sending limits.** Apps Script allows 100 recipients a day on a consumer
account and 1500 on Workspace. Each quotation uses one, or two with the evidence
copy. A class of thirty will not reach it; a bulk replay would.

## It cannot break a quotation

`emailQuotation_` never throws. If the address is malformed, if the daily quota
is spent, if `MailApp` is unavailable, the quotation is still numbered, still
saved and still has its PDF. The response carries `email_error` and the reason
goes to the Apps Script log.

The order is deliberate: number, then PDF, then email. Each step can fail
without costing the ones before it.

## What is recorded

If the `Quotations` tab has an `emailed_to` column, the address is written
there. As with `pdf_url`, adding the header is the whole of the change; without
it the send still happens and simply is not logged.
