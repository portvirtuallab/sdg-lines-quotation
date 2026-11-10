# The American ports, as rows for SDG_Lines_DB

One file, because one tab is all the sheet has for this.

`Ports.tsv` holds the five American ports written the way the `Ports` tab
stores them, with that tab's own header line on top for checking. The header is
not meant to be pasted.

## Why only this one

The workbook is not the whole database. `apps-script/Code.gs` reads exactly six
tabs:

    const TABS = ['Settings', 'Ports', 'Equipment', 'THC', 'Surcharges', 'FreightCurve'];

Services, service legs, vessels, port terminals, distances and routes are not
among them and have no tab at all. They live in `data/network.json` in this
repository, and the Desk fetches them from here. Adding a service means a commit,
not a paste; adding a port means both, because a port is priced from the sheet
and sailed from the repository.

An earlier version of this file told you to paste seven files into seven tabs.
Six of those tabs do not exist. The rows were right and the destination was
wrong, which is the kind of instruction that wastes an afternoon before anyone
notices nothing changed.

## Pasting it

Open `Ports`, click the first empty cell in column A, paste without the header,
then run **SDG Lines › Clear API cache** from the sheet's menu. The web app keeps
the tariffs in `CacheService`, so without that step the ports are in the sheet
and still invisible to the Desk.

## Format the utc_winter cells as plain text first

The five American offsets are negative - `-05:00`, `-04:00`, `-08:00` - and
Sheets reads a negative time as a duration rather than a label. It converts
`-05:00` to `-0.2083…`, five twenty-fourths of a day. The number means the right
thing and is stored the wrong way: the thirty-seven Mediterranean ports all hold
that column as text.

Nothing prices from `utc_winter` today, so this breaks nothing now. It would
break the first thing that reads the column expecting what the other rows hold.

Select the five cells, **Format › Number › Plain text**, then retype the values.

## What is deliberately absent

No American port connects to a Mediterranean one. There is no transatlantic
service, so Barcelona to New York has no route and the Desk says so rather than
inventing a distance. That is a decision still to be taken, not a gap in this
file.
