# The American network, as rows for SDG_Lines_DB

These seven files are the American ports, services, legs, vessels, terminals and
distances written exactly as the Google Sheet stores them: one file per tab,
tab-separated, with the tab's own header line on top.

They exist because the sheet is the live source. `data/tariffs.json` and
`data/network.json` in this repository are a snapshot of it, so changing them
makes the American routes quotable here and nowhere else. Until these rows are
in the sheet, the Desk in front of a class still has thirty-seven ports.

## How to use them

For each file, open the tab of the same name in `SDG_Lines_DB`, click the first
empty cell in column A below the last row, and paste the file's contents
**without its header line**. The header is included so the column order can be
checked against the tab before pasting; it is not meant to be pasted.

The column order is not a guess. `tools/export_snapshot.py` builds the snapshot
with `dict(zip(head, row))`, so the order of the fields in the JSON is the order
of the header row in the sheet, and these files are written from that order. A
row pasted in a different order would look right and price wrong.

Then run **SDG Lines › Clear API cache** from the sheet's menu. The web app
holds the tariffs in `CacheService`, so without that step the new ports are in
the sheet and still invisible to the Desk.

## What is deliberately empty

`road_km` in `Distances.tsv` is blank for every American pair. The column holds
the road distance for an intermodal comparison, and there is no road between
Cartagena and New York. A zero there would read as a measurement; blank reads as
what it is.

`via` in `Routes.tsv` is blank for the twenty American pairs because each is
reachable on a single service. The Mediterranean rows use it to name the port
where a shipment changes vessel.

## What these rows do not add

No American port connects to a Mediterranean one. There is no transatlantic
service in the network, so Barcelona to New York has no route and the Desk will
say so rather than invent a distance. That is a decision waiting to be taken,
not an omission in these files.
