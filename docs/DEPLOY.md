# Deploying this version

Everything below happens in two browser tabs: the **SDG_Lines_DB** spreadsheet
and the Apps Script editor you open from it. Nothing is installed on your
computer.

Allow fifteen minutes. Steps 1 to 6 change nothing a learner can see; the
switch is thrown at step 7.

---

## 1. Open the editor

In **SDG_Lines_DB**, go to **Extensions › Apps Script**. The project opens with
`Code.gs` in it. Leave this tab open for the whole of the deployment.

## 2. Keep a copy of what is there now

In the editor, open `Code.gs`, select everything (Ctrl+A), copy, and paste it
into a scratch file on your computer. Name it `Code.gs.backup`.

This is the undo button. If anything below goes wrong, pasting this back
restores exactly what was running this morning.

## 3. Add `Pdf.gs`

Next to **Files**, click **+ › Script**. Name it `Pdf` — the editor adds the
`.gs` itself.

Delete the three lines of sample code it creates, then paste the whole of
`apps-script/Pdf.gs`.

## 4. Add `Mail.gs`

The same again: **+ › Script**, name it `Mail`, clear the sample, paste the
whole of `apps-script/Mail.gs`.

## 5. Replace `Code.gs`

Open `Code.gs`, select everything, and paste `apps-script/Code.gs` over it.

Press **Ctrl+S**. If the editor reports a syntax error, stop and send me what
it says — do not continue to step 6.

## 6. Two rows in the sheet

Back in the spreadsheet, in the **Settings** tab, add these to the bottom of
the key/value list:

| key | value |
| --- | --- |
| `pdf_enabled` | `TRUE` |
| `email_enabled` | `FALSE` |

`email_enabled` as `FALSE` keeps sending off for now. **A missing row counts as
TRUE**, so leaving it out would send email from the first quotation onwards.
Turn it on deliberately, once you have seen a sample.

While you are in the sheet, two optional columns on the **Quotations** tab:
`pdf_url` and `emailed_to`. Add the headers and those values get logged; leave
them out and everything still works, it simply is not recorded.

## 7. Test before deploying

In the editor, pick **`previewQuotationPdf`** from the function dropdown at the
top and press **Run**.

Google will ask for permission to use Drive, which the old version never
needed. Approve it. You will likely see **"Google hasn't verified this app"** —
click **Advanced**, then **Go to (project name)**. This is your own script
asking for access to your own Drive.

The execution log prints a link. Open it. That is the new document.

**Nothing has changed for learners yet.** The published web app is still the old
version. If the PDF looks wrong, say so now, and nobody has seen it.

## 8. Publish

**Deploy › Manage deployments › the pencil icon › Version: New version ›
Deploy.**

Use the pencil on the existing deployment, not **New deployment**. The pencil
keeps the same `/exec` URL, so `js/config.js` needs no change. A new deployment
would give a different URL and the site would carry on talking to the old one.

## 9. Check it end to end

Open the Desk, price anything, and press **Issue quotation**. You should get a
number, and under it a link to the PDF.

This writes a real row to **Quotations** and consumes a quotation number. That
is the point of the test, but it is the first step in this list that cannot be
undone with Ctrl+Z.

## 10. The trainer view, when you want it

Set **Project Settings › Script properties › `TRAINER_KEY`** to any string, and
publish `trainer.html`, `js/trainer.js` and `css/trainer.css` with the site.
Open `trainer.html` and enter the key. See `TRAINER.md`.

## 11. Email, when you want it

Change `email_enabled` to `TRUE`. Add `email_evidence_to` with the address that
should receive a copy of every quotation.

Before you do, run **SDG Lines › Send myself a sample email** from the sheet
menu and read what arrives. And read `EMAIL.md`: the message goes to whatever
address a learner typed into the form, and there is no allow-list.

---

## If something breaks

Paste `Code.gs.backup` over `Code.gs`, delete `Pdf.gs` and `Mail.gs`, and
deploy a new version. That is the state you started from.

A quotation can still be issued even when the PDF or the email fails: both are
attempted after the number is assigned and neither can throw. If learners can
issue quotations, the deployment is not broken, whatever else is wrong.
