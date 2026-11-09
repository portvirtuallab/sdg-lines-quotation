# Validation against the old system

Run: `node tools/validate.js`

The engine was replayed, in **legacy** mode, over every quotation the old Google Forms system
issued: 643 freight quotations and 276 arrival charges.

| Quotation type | Cases | Identical to the cent |
|---|---|---|
| Freight (SDG…) | 643 | **643** |
| Arrival charges (AC…) | 276 | **262** |

### What these numbers do and do not prove

They prove that the **rules** were reconstructed correctly: every surcharge, the BAF ladder, the
THC lookup, the port additionals, the ETS and the per-unit behaviour all reproduce the old sheet.

They do **not** prove that the engine returns the euro figure a learner would find on an archived
PDF, and it does not. The freight curve has been re-rated since those quotations were issued, so
`exp.total` in `tools/test-cases.json` holds each case recomputed at the **current** tariff, not
the amount the old system printed at the time. The case numbers (`SDG20260001`…) identify the
shipment, not the historical price.

The re-rating is uniform. Measured against a September 2026 snapshot of the old workbook across the
36 distances it covers, the current curve is **98.383 % of it, with a spread of 0.001 percentage
points** — a flat −1.617 %, consistent with the EUR/USD rate behind the Drewry indices moving from
0.87335 to about 0.85923. It is a tariff update, not drift.

**Practical consequence for trainers:** a quotation printed by the old system before the re-rating
will not match this tool to the cent. The difference is about 1.6 % of the ocean freight line and
nothing else. If a learner brings an old PDF, that is why.

A regression suite that compares an engine with figures it produced itself cannot notice a change
in the tariff, by construction. That is what `tools/anchors.test.js` is for.

The 14 arrival charges that differ all come from one error in the old sheet: the IMO (dangerous goods) surcharge is taken from the **neighbouring row**. A dangerous shipment is quoted without IMO and the next, non-dangerous shipment gets it instead (for example AC20260020 / AC20260021). The new engine applies IMO to the right quotation.

## How the old system calculates (now documented in the database)

| Item | Rule | Where it lives now |
|---|---|---|
| Distance | Sea distance from the *Distance NM* matrix. The old sheet labels it "Distance KM", but the values are nautical miles | `Distances` |
| Base freight | Price per FEU by distance, from a curve (47 points, interpolated) | `FreightCurve` |
| BAF | Base BAF of the equipment × 1.07 per category step of the **origin** port | `Equipment.baf_base_A`, `Settings.baf_category_step` |
| THC | By equipment and port category (A–D); origin for freight, destination for arrival | `THC` |
| Port additionals | 20 % of THC | `Settings.port_additional_pct` |
| Other surcharges | Fixed by port category; per unit or per booking | `Surcharges` |
| ETS | Distance × emission factor → kg CO₂; × EUA €73.59/t × units; + €20 fee when below €20 | `Equipment.emission_factor`, `Settings` |
| CO₂ saving | Road CO₂ = sea CO₂ × 1.37 | `Settings.truck_co2_ratio` |
| Plug-in | Reefers: 2 days × daily rate (€25 for 20', €29 for 40') | `Equipment.plugin_per_day` |
| AMS | Shown on the document but **not** added to the total | `Surcharges.in_total` |

## Errors found in the old system (fixed in "corrected" mode)

1. **The equipment factor is not applied to the total.** The sheet computes the freight with the factor (20' = 0.8, 20' reefer = 1.25, semi-trailer = 1.5…), but the PDF and the total use the base 40' price. A 20' container pays the same freight as a 40'.
2. **Freight is not multiplied by the number of units.** A booking of 64 reefers pays the ocean freight and BAF of one.
3. **Port additionals grow with the square of the units** in freight quotations (20 % × THC × units × units). In arrival charges they are charged once regardless of units.
4. **CO₂ emissions ignore the number of units**, while the ETS surcharge does use them.
5. **IMO surcharge row offset** in arrival charges (see above).
6. **Schedule:** 59 legs of *Halide Edib Adıvar* (Westmed, trip codes SDGCH6753–SDGCH6762) have no arrival time in *SDGLINESV2 › General*, so their dates show as 1899. They are left out of `data/network.json`, so they never appear in the sailing search.

## Note on SDG20260587
The PDF issued on 1 Nov 2026 shows ocean freight €933.46 for Aqaba–Marseille (2,282 NM). The current sheet returns €938.18 for the same distance, so the freight curve was updated after that PDF. The new database uses the current values.
