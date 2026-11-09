# Developer brief — SDG Lines Quotation Desk

You are taking over **SDG Lines Quotation Desk**, a static web app for SDG Lines, the simulated shipping line used by Escola Europea – Intermodal Transport in Port Virtual Lab training. It quotes sea freight (container, RORO, flat rack, project cargo) and arrival charges. It also has a training layer that explains every charge, with sources.

## Hard rules
- **Do not touch the old system.** Do not read from or write to these Google Sheets: Bookings_V3, Arrival ChargesV3, SDGLINESV2, Google Forms or Document Studio. Old quotations stay there as an archive.
- **All UI text, code comments and documents must be in English.**
- **Never copy personal data** (names, emails, phones) from the old form responses.
- SDG Lines is a simulated company. Keep the training disclaimer on every quotation.
- No build step. The app is plain HTML/CSS/JS that runs on GitHub Pages.

## Architecture
```
GitHub Pages ── data/network.json   (schedule, distances, routes, services, vessels, terminals; read from the repo)
     │
     ├── GET  ?action=data   → tariffs (6 tabs) from the Google Sheet; falls back to data/tariffs.json
     └── POST {action:"save"} (Content-Type text/plain, so no CORS preflight) → next SDG/AC number + row in Quotations
Apps Script web app (apps-script/Code.gs v3, bound to the sheet)
Google Sheet "SDG_Lines_DB" (light): README, Settings, Ports, Equipment, THC, Surcharges, FreightCurve, Quotations, Log (last 2 months)
```
- `js/engine.js` is pure and has no DOM access, so it runs in Node too. It holds the pricing rules:
  - Base freight per FEU comes from FreightCurve, interpolated by nautical miles, then × equipment factor × units.
  - BAF = baf_base_A × 1.07^(category step of the origin port).
  - THC depends on equipment and port category (A–D). Port additionals are 20% of THC.
  - ETS = NM × emission factor → t CO₂ × EUA price × units, plus a €20 minimum fee.
  - Plug-in for reefers.
  - `Settings.freight_mode` is `corrected` (default) or `legacy`. Legacy reproduces the old sheet's errors on purpose (see docs/VALIDATION.md).
- `js/schedule.js` finds direct sailings first. It uses transshipment via BARCELONA only when no direct sailing exists.
- `js/api.js` merges network.json with the tariffs. `js/config.js` is the only file that needs editing (API_URL).
- `js/training.js` holds the glossary, sources, the step-by-step calculation and the review questions.

## Links and IDs (everything you need)
| What | Where |
|---|---|
| Google Sheet database `SDG_Lines_DB` | https://docs.google.com/spreadsheets/d/1Q5n3modYtibAX2hkAYgojZMQkQxCZZcWKj71wz_iBWw/edit |
| Apps Script web app (API, already deployed) | https://script.google.com/macros/s/AKfycbxhFndks12hv-AuakhE0zM-YL8Rhh9OTh4GplrNv4W_Mm47CT9ydwTKXHVbA1qLxr7t/exec |
| API test (should return JSON with Settings, Ports…) | `<API URL>?action=data` |
| Apps Script editor | Open the Sheet › Extensions › Apps Script (owner: coursemanager@playpcs.com) |
| Drive folder of the project | https://drive.google.com/drive/folders/1gzJs2XwVpMZjfbW_U3k4ZVoBxOeP7jvD |
| GitHub repository | `sdg-lines-quotation` (GitHub Pages: main / root) |
| Public brand reference | https://www.sdglines.com/ |
| Brand | Nunito + IBM Plex Mono · #03B8D9 (primary) · #0687A1 (deep) · #CFE2F3 (pale) · #38761D (eco) |

**Access you need from the owner (Orlando):** editor access to the Google Sheet (gives access to its Apps Script) and write access to the GitHub repository. `js/config.js` already contains the API URL.

**Redeploying Apps Script:** after changing Code.gs use *Deploy › Manage deployments › Edit (pencil) › Version: New version › Deploy*. This keeps the same /exec URL. A *New deployment* creates a new URL and config.js must be updated.

**Do not use / do not modify** (old system, archive only): `SDG_Lines_DB OLD` (1c5a59SVUBz3p2qWN7ecMVoHt6TYcVDa6Z6waceymLwg), Bookings_V3 (1rKHY0y6qlHdHwcc2rLWwhsJ211ImJq7LulRPcyxXJfI), Arrival ChargesV3 (1R-7M2raKETvFHZp9i4A08P14h0F6U915JlvSSEKzLEc), SDGLINESV2 (1BL5ef3HGqaPiJ2VZJhtj-zxGnfYEOAQeD4bhO_eCTug).

## Repository map
| Path | Content |
|---|---|
| `index.html`, `css/styles.css` | Quotation desk UI (light/dark) |
| `js/config.js` | API URL + data paths |
| `js/engine.js` | Pricing engine (pure, Node-testable) |
| `js/schedule.js` | Sailing search (direct, then via Barcelona hub) |
| `js/api.js` | Loads network.json + tariffs, saves quotations |
| `js/training.js` | Glossary, sources, step-by-step calculation, review questions |
| `js/app.js` | UI logic |
| `data/network.json` | Schedule, distances, routes, services, vessels, terminals |
| `data/tariffs.json` | Offline copy of the 6 tariff tabs |
| `data/SDG_Lines_DB.xlsx` | Light database template (already imported as the Google Sheet) |
| `apps-script/Code.gs` | API code (v3), same as deployed |
| `tools/validate.js`, `tools/test-cases.json` | Regression test against 919 historic quotations |
| `tools/export_snapshot.py`, `tools/build_light_db.py` | Sheet → tariffs.json, tariffs.json → xlsx |
| `docs/VALIDATION.md` | Validation results and old-system errors |

## Run locally
```
python3 -m http.server 8000      # then open http://localhost:8000
node tools/validate.js           # needs Node 18+
```

## Setup (already done — only for a fresh install)
1. Push the repository and enable GitHub Pages (main, root).
2. Google Sheet `SDG_Lines_DB` → Extensions › Apps Script → paste `apps-script/Code.gs` → Deploy as a web app (Execute as: Me; Who has access: Anyone).
3. Put the `/exec` URL in `js/config.js` → `API_URL`.
4. In the sheet, open the **SDG Lines** menu and choose **Create / refresh "Log (last 2 months)" tab**.

## Acceptance tests (all must pass before any merge)
1. `node tools/validate.js` prints **Freight 643/643** and **Arrival 262/276**. The 14 differences are a known bug in the old sheet.
2. Default quote Aqaba → Marseille, 40' dry, 1 unit = **€1,641.71**.
3. Arrival charges, Barcelona, 20' dry, 1 unit = **€503.80**.
4. With API_URL set, the badge says "Live data · Google Sheet". **Issue quotation** returns an SDG2026xxxx number and adds one row to Quotations. That row appears in the Log tab.
5. With API_URL empty or unreachable, the app still calculates (badge "Offline snapshot") and does not issue numbers.
6. No horizontal scroll at 390 px width. Light and dark themes are both readable.

## Backlog (in priority order)
1. **PDF quotation**: generate it with Apps Script from a Google Docs template in SDG Lines branding. Store it in a Drive folder and return its link to the web app (same approach as SDG Airlines).
2. **Optional email of the PDF to the customer.** It must be off by default, and the trainer turns it on in Settings.
3. **Trainer view**: a password-protected page that lists the latest quotations (`?action=quotes&key=TRAINER_KEY`) with filters by date and type.
4. **Booking step**: turn an issued quotation into a booking request (new tab `Bookings` in the same sheet).
5. **Schedule update tool**: `tools/` script that rebuilds `data/network.json` from a new schedule export.
6. Keep the training layer in sync with any new charge, with a glossary entry and a source for each.

## Conventions
- Keep engine.js free of DOM code, and add a test case in tools/test-cases.json for every rule change.
- Tariff values live only in the sheet and tariffs.json, never hard-coded in JS.
- After editing tariffs in the sheet, run **SDG Lines › Clear API cache**. Then refresh `data/tariffs.json` with `tools/export_snapshot.py`.
