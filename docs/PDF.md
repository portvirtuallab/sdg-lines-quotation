# The quotation PDF

Backlog item 1. An issued quotation is rendered as a PDF, filed in the project
Drive folder, and its link returned to the web app.

## Switching it on

Two rows in the **Settings** tab of `SDG_Lines_DB`:

| key | value | meaning |
| --- | --- | --- |
| `pdf_enabled` | `TRUE` | Anything else and no PDF is produced. Quotations still issue. |
| `pdf_folder_id` | *(optional)* | Drive folder id. Defaults to the project folder already in `Pdf.gs`. |

Then, in the Apps Script project:

1. Paste `apps-script/Pdf.gs` as a **new file** beside `Code.gs`.
2. Paste the updated `Code.gs` over the existing one.
3. Run **`previewQuotationPdf`** once from the editor. Apps Script will ask for
   Drive permission, which the old version never needed; approve it. The log
   prints a link to a sample document.
4. **Deploy › Manage deployments › Edit (pencil) › Version: New version › Deploy.**
   This keeps the same `/exec` URL, so `js/config.js` does not change.

The **SDG Lines** menu in the sheet gains *Preview the quotation PDF*, which does
the same thing without issuing a number or writing to `Quotations`.

To record the link in the sheet, add a `pdf_url` column to the **Quotations**
tab. The writer fills any column whose header it recognises, so adding the header
is the whole of the change. Without it the link is still returned to the browser;
it is simply not kept.

## It cannot break a quotation

`buildQuotationPdf_` never throws. If Drive is unavailable, if the folder id is
wrong, if the permission was not granted, the quotation is still numbered and
still saved; the response carries `pdf_url: null` and a `pdf_error`, the web app
shows the number without a link, and the reason goes to the Apps Script log.

A quotation saved without its PDF is a far smaller problem than a quotation that
fails to save because Drive was slow.

## Why HTML and not a Google Docs template

The handover asked for a Docs template, as SDG Airlines does it. This generates
the PDF from HTML instead. The reasoning, so it is not rediscovered later:

1. **The charge list has no fixed length.** A reefer carries a plug-in line, a
   dangerous shipment carries IMO, an arrival quotation has a different set
   entirely. Filling that into a Docs template means inserting table rows through
   the Docs API and keeping placeholder names in step with the engine. Building
   the rows from the same `lines` array the web app already renders cannot drift.
2. **A template lives in Drive, outside the repository.** A change to it appears
   in no diff and can be reviewed by nobody.

What this costs: a trainer cannot restyle the document without editing code. If
that matters more, the layout is one function — `renderHtml_` — and replacing it
with `DocumentApp` is a contained change that touches nothing else.

## Editing the layout

`renderHtml_` in `Pdf.gs`, and the `BRAND` object above it for the colours, which
mirror `css/styles.css`.

Apps Script converts HTML to PDF with a limited renderer. Keep to tables and
inline styles; flexbox and grid do not survive. Web fonts are not loaded, so
Nunito and IBM Plex Mono are named first and the rest of the stack does the work
when the converter does not have them.

## What is on the document

Quotation number and type, the simulation notice, the customer, the shipment and
its routing, every charge line with the total, the emissions estimate with the
saving against road, and the validity window from
`freight_validity_days` / `arrival_validity_days`.

A quotation priced in `legacy` mode says so in the footer, because the figure it
carries reproduces known errors of the previous system on purpose.

## Not done

**Emailing the PDF** is backlog item 2 and is deliberately absent. It needs to be
off by default and switched on by a trainer, and sending anything to a learner's
address is a decision for the product owner rather than a default.

## Charges that are printed but not counted

The **Surcharges** tab has an `in_total` column. One code sets it to `FALSE`:
`AMS`. That charge is shown on the document, greyed, under the note *shown for
information, not included in the total*, and the group subtotal and the total
both leave it out.

The engine was adding it. `js/engine.js` had no mention of `in_total` at all, so
AMS reached the total and a quotation that asked for it was €40 too high.
`tools/validate.js` could not see this: its 643 expectations were produced by the
engine itself, and none of the 643 asks for AMS. `tools/anchors.test.js` now
checks it directly, and that every total equals the sum of the lines that count.

Customs clearance joined it in November 2026. It is a third-party cost, not a
service the carrier sells, so it is shown for the record and left out of the
total. **Control** was withdrawn from the tariff in the same decision and is no
longer quoted at all.

Legacy mode ignores every one of these rules on purpose. The old system billed
customs clearance and Control, and legacy exists to reproduce the old system,
errors included. If it honoured the column, the replay would stop matching the
405 quotations it is checked against. `tools/anchors.test.js` asserts both
halves of that: the rules apply in corrected mode and do not apply in legacy.

## The brand on the document

The colours are not chosen to go with the logo; they are taken out of it. The
landscape logotype on sdglines.com was read pixel by pixel and three colours do
the work:

| | | where it is used |
| --- | --- | --- |
| `#03B8D9` | cyan | "SDG Lines" in the logotype — rules, section headings, the quotation type |
| `#242E59` | navy | the mark and "Shipping Digital Game" — the total band, the number, headings |
| `#40A636` | green | the green segment of the mark — the emissions panel |

The site sets **Lato**, so the stack names it first. The converter loads no web
fonts, so in practice the fallbacks draw the page; naming it costs nothing and
is right wherever the font happens to be installed.

### The logotype is a remote image

`LOGO_URL` points at the PNG the public site serves, and a `logo_url` row in
Settings overrides it.

This is the one external dependency in the whole file, so it is worth saying
why it is there. A base64 data URI is the obvious alternative and the Apps
Script converter does not reliably accept one. Drawing the wordmark in type
gets close but is not the logo. If the CDN is ever unreachable the converter
falls back to the alt text and the document still reads — it simply loses the
mark.

The letterhead is white rather than the coloured band it used to be. The
logotype is cyan and navy on transparency, so on a dark ground its navy half
disappeared. The colour moved to the two rules underneath, in the order they
appear in the mark: cyan over navy.

## One page

The document is laid out to land on a single A4 page, and that constraint
drives the rest of the design. A reefer quotation with dangerous goods and
plug-in runs to twenty charge lines, so the vertical budget is spent
deliberately:

- The shipment facts are one band of three dense columns, not stacked panels.
  Nobody reads a quotation header in sentences; they look for the one field they
  came for. This saved about 110 points on its own.
- Charge rows carry alternating tints rather than a rule under each one. At this
  density a rule per row turns the block into a grid and the eye has nothing to
  follow across.
- The training notice sits in the footer. Still on every document, no longer
  costing an eighth of the page.
- The emissions estimate is a strip beside its heading rather than a panel
  under it.

`node tools/preview-pdf.js` draws the A4 content box (718 × 1039 px at 96 dpi,
after the `@page` margins) as a dashed rule across each sample and prints the
measured height under it in green or red. The three samples currently measure
**898, 798 and 543** points, the first being the longest document the engine can
produce.

Keep roughly 100 points in hand. The browser and the Apps Script converter do
not have the same fonts, and a document that fits exactly in the preview can
spill in the PDF. If a new charge pushes it over, the row padding in `pad` is
the first dial to turn, then the base `font-size` on `body`.

## What the converter actually supports

Established by rendering a real PDF, not by reading documentation:

| | |
| --- | --- |
| table layout, inline styles, text colour | yes |
| borders, including thick ones used as rules and bars | yes |
| remote images | yes |
| **`background` / `background-color` on anything** | **no** |
| flexbox, grid, CSS variables, web fonts, `border-radius` | no |

The missing backgrounds are the trap, and they cost one round trip to find. The
first version of this layout had a navy band with the total reversed out in
white. The converter dropped the fill and kept the white text, so the most
important figure on the page arrived as white on white.

**Nothing in this document is reversed out.** Every piece of type is dark on
white. Colour arrives through borders: the quotation number sits against a cyan
left rule, the total between two heavy navy rules, the emissions bars are a
`border-bottom` on a cell of the right width. The background tints that remain
are decoration the document does not depend on — strip them and it still reads.

`node tools/preview-pdf.js` now renders the samples the way the converter does,
with backgrounds stripped, and a toggle at the top shows them. **What you see by
default is what the PDF will look like.** A design that needs a fill in order to
be readable now fails in the browser too, which is where it is cheap to notice.
