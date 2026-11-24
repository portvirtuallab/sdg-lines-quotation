# Course access codes

The Desk shows a sample to anyone who arrives without a course code, and the
full quotation to anyone who has one.

## Where the codes live

They are already there. Escola Europea has issued PVL course codes through a
Google Form since 2023, and the responses land in **Control Access PVL
(Responses)**. That workbook has a tab called `Base` holding two columns, the
code and whether it is active.

`apps-script/Access.gs` reads that tab, by id, read only, cached for ten
minutes. Nothing changes in how codes are issued: a trainer fills in the form
as always, and the Desk picks the code up within ten minutes, or immediately
after **SDG Lines › Clear access-code cache**.

It reads `Base` and nothing else. The form responses beside it carry course
names, institutions and coordinator email addresses, and none of that belongs
in the quotation system. A code and a yes or no is the whole question.

## What a sample is

Without a valid code the server sends the ports and the freight curve, and
stops there. No surcharges, no terminal handling, no equipment factors, no
emissions settings. The Desk shows:

- the route, its distance and the service
- the sailing, with its ETD and ETA
- the base ocean freight for one 40ft unit

and, where the total would be, the words **Not shown in a sample**.

This is not a full quotation with the total painted out. The numbers that would
make a total never reach the browser, so there is nothing to uncover with the
developer console. `data/tariffs-sample.json` is the same reduction applied to
the offline fallback, built by `tools/build-sample-tariffs.js`, which refuses to
write a file that still contains a surcharge code or a price setting.

## What this gate is not

**It is not secrecy, and it should never be described as such.**

The pricing engine is JavaScript that runs in the learner's own browser, and
the repository that serves it is public. `data/tariffs.json` is still in this
repository - the test suites replay 643 recorded quotations against it - so the
full tariff can be read by anyone who goes looking through the source. The
git history holds it too, so removing the file would not remove the fact.

That is a deliberate trade. An engine a learner can open, read and argue with
is the point of the exercise; a black box would teach nothing. What the code
gives is a classroom control:

- a visitor who has not been given a code sees a sample rather than a working
  quotation tool
- a numbered quotation, a PDF and an email can only be produced with a code
- every row in `Quotations` carries the code that produced it, so activity can
  be traced to a course rather than to whatever name was typed into the form

If the prices themselves ever need to be confidential, the engine has to move
to the server and the repository has to become private, which on GitHub Pages
means a paid plan. That is a different piece of work and a different cost.

## Where the check happens

In `doGet` and in `doPost`, both in Apps Script.

The page also refuses to issue in sample mode, but only to save a learner a
round trip and a confusing error. That check is a convenience. The one in
`doPost` is the one that counts, because it is the only one the learner cannot
edit.

## If the access sheet cannot be read

`activeCodes_` returns an empty set, so no code is accepted and everybody sees
a sample. That is deliberate. A sheet that has become unreadable must not turn
into a sheet that lets everybody through, and a Desk that shows samples to a
whole classroom is a failure somebody reports within a minute - which is the
kind of failure to prefer.

Run **SDG Lines › Check the access-code list** to see how many codes were read.
It prints a count, never the codes.

## Deploying it

`Access.gs` is a new file. Paste it into the Apps Script project beside
`Code.gs`, `Pdf.gs` and `Mail.gs`, then redeploy through the pencil in Manage
deployments so the url does not change.

The first run asks for permission to open another spreadsheet, which is the
access sheet. That is expected, and it is read-only.
