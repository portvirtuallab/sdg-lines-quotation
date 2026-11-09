# The trainer view

Backlog item 3. `trainer.html` shows the quotations a class is issuing, live,
without anyone opening the spreadsheet.

## Switching it on

Nothing to deploy on the Apps Script side: the `quotes` action and the key check
already existed. Publish `trainer.html`, `js/trainer.js` and `css/trainer.css`
with the rest of the site.

Set the key once, in the Apps Script project:
**Project Settings › Script properties › `TRAINER_KEY`**. Any string. Without
that property the view refuses every key, including the right one.

There is deliberately **no link to it from the learner's page**. A trainer opens
`trainer.html` directly. A link would tell thirty learners the page exists and
invite them to guess at the key.

## What it shows

**Quotations issued** — one row per quotation, newest first: when, the number,
who issued it, the shipment, the total, and a link to the PDF when there is one.
The filter box matches name, company, port, number or equipment.

**Same shipment, different answers** — the part worth having. Quotations are
grouped by route, equipment and count; a group appears only when more than one
learner quoted it *and their totals differ*. Each learner gets a bar, the
cheapest in green, the dearest in amber, and the group is labelled with the gap
in euro and as a percentage.

Two learners agreeing is the expected case, so it is not shown. A gap is the
thing to ask about out loud: the inputs were identical, so something in the
reasoning was not. In practice the gaps come from the equipment category, the
number of units, or dangerous goods being ticked by one and not the other.

The list refreshes every 30 seconds; the tick box turns that off.

## About the key

The key is kept in the trainer's browser (`localStorage`) so it is typed once
per device. **Forget the key** clears it.

That is weak storage for a shared secret, and it is the right trade for what it
protects: a list of simulated quotations carrying invented customer names. Two
consequences worth being honest about:

- Anyone who learns the key can read the class list from anywhere. Change the
  script property and every stored copy stops working.
- The key travels in the query string of the request, so it will appear in
  Apps Script's execution logs.

If this view is ever pointed at anything real, it needs a proper sign-in, not a
shared string.

## It reads, and only reads

The view has no write path at all. A trainer cannot edit or delete a learner's
quotation from here, by accident or otherwise. Corrections are made in the
spreadsheet, on purpose.
