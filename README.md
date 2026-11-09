# SDG Lines Quotation Desk

Quotation tool for **SDG Lines**, the simulated shipping line of Escola Europea – Intermodal Transport used in Port Virtual Lab training.

- Container, RORO, flat rack, roll trailer, vehicle and project cargo freight quotations
- Arrival charges at the port of discharge
- Real sailings from the SDG Lines schedule, including transshipment via Barcelona
- Training mode: every charge explained, the calculation shown step by step, sources cited
- One light Google Sheet (tariffs + quotations) instead of three separate sheets; the heavy network data lives in this repository

This is a **new, independent project**. The current Google Forms + Document Studio system is not modified and can keep running in parallel.

---

## How it works

```
GitHub Pages (this repository)
   ├─ data/network.json   schedule, distances, routes, services, vessels (always from here)
   │
   │  fetch tariffs / save quotation      ▲ if the API is unreachable,
   ▼                                      │ the site uses data/tariffs.json
Apps Script web app (apps-script/Code.gs)
   │
   ▼
Google Sheet "SDG_Lines_DB" (light): README · Settings · Ports · Equipment · THC ·
                                     Surcharges · FreightCurve · Quotations · Log (last 2 months)
```

| Folder / file | Content |
|---|---|
| `index.html` | The quotation desk |
| `css/styles.css` | SDG Lines branding (Nunito, #03B8D9, #CFE2F3) |
| `js/engine.js` | Calculation engine (freight, surcharges, ETS, CO₂). No DOM, testable in Node |
| `js/schedule.js` | Finds sailings in the published schedule |
| `js/api.js` | Loads network.json + tariffs (live from the Sheet, or tariffs.json); saves quotations |
| `js/training.js` | Glossary, sources, review questions, step-by-step calculation |
| `js/config.js` | **The only file you edit**: the Apps Script URL |
| `data/SDG_Lines_DB.xlsx` | Light database to import into Google Sheets (tariffs + empty Quotations) |
| `data/network.json` | Schedule, distances, routes, services, vessels, terminals |
| `data/tariffs.json` | Offline copy of the tariffs (fallback when the API is down) |
| `apps-script/Code.gs` | API to paste into the Google Sheet |
| `tools/validate.js` | Replays 919 historic quotations against the engine |
| `tools/export_snapshot.py` | Regenerates `data/tariffs.json` from a download of the Sheet |
| `tools/build_light_db.py` | Rebuilds `data/SDG_Lines_DB.xlsx` from `data/tariffs.json` |
| `docs/VALIDATION.md` | What was checked and what differs from the old system |

---

## Setup, step by step

### Step 1 — Create the repository and publish the site
1. In GitHub, create a new repository, for example `sdg-lines-quotation`.
2. Upload every file and folder of this project (drag and drop on github.com works, or `git push`).
3. Go to **Settings › Pages** → *Source*: **Deploy from a branch** → Branch **main**, folder **/ (root)** → **Save**.
4. After a minute the site is live at `https://<your-account>.github.io/sdg-lines-quotation/`.

At this point the site already works with the data snapshot. The status badge at the top says **Offline snapshot**. Quotations can be calculated but not issued with a number.

### Step 2 — Create the master Google Sheet
1. In Google Drive: **New › File upload** → `data/SDG_Lines_DB.xlsx`.
2. Open it and choose **File › Save as Google Sheets**. Name it **SDG_Lines_DB**.
   (Already done in the Drive folder *SDG Lines – Quotation Desk*.)
3. Keep the tab names exactly as they are. Blue values are the ones you are expected to edit (tariffs, settings, port categories).

### Step 3 — Publish the API
1. In the Google Sheet: **Extensions › Apps Script**.
2. Delete the sample code and paste the full content of `apps-script/Code.gs`. Save.
3. **Deploy › New deployment** → type **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Authorise the script when asked, then copy the **Web app URL** (ends in `/exec`).
5. In GitHub, edit `js/config.js` and paste the URL:
   ```js
   API_URL: "https://script.google.com/macros/s/XXXXXXXX/exec",
   ```
6. Back in the Sheet, reload it: an **SDG Lines** menu appears. Run **Create / refresh "Log (last 2 months)" tab** once.
7. Commit. Reload the site: the badge now says **Live data · Google Sheet** and **Issue quotation** writes to the **Quotations** tab with the next SDG/AC number.

Optional: to read the quotation history through the API (`?action=quotes&key=…`), add a script property `TRAINER_KEY` in **Project Settings › Script properties**.

### Step 4 — Test
1. Open the site, keep the default Aqaba → Marseille, 40' dry, and fill in a name and company.
2. Click **Issue quotation**. A new row appears in **Quotations** and the document shows its number.
3. Switch to **Arrival charges**, choose Barcelona and a 20' dry container: the total must be **€503.80**.

---

## Everyday use

| You want to… | Do this |
|---|---|
| Change a tariff or surcharge | Edit the blue cells in **THC**, **Surcharges**, **Equipment** or **FreightCurve** |
| Change the EUA price, validity days, numbering | Edit **Settings** |
| See the change immediately | Menu **SDG Lines › Clear API cache**, then reload the site |
| Add a new schedule period | Update `data/network.json` (Sailings) in GitHub and commit |
| Update the offline copy of the tariffs | Download the Sheet as .xlsx, run `python tools/export_snapshot.py file.xlsx`, commit `data/tariffs.json` |
| See the last 2 months of quotations | Open the **Log (last 2 months)** tab (it updates by itself) |
| Check nothing broke after editing the engine | `node tools/validate.js` |

### Freight mode
`Settings › freight_mode`:
- **corrected** (default): ocean freight = base FEU × equipment factor × units; BAF, port additionals and plug-in also multiply by units.
- **legacy**: reproduces the old sheet exactly, including its known errors (see `docs/VALIDATION.md`).

---

## Data sources
Built on 4 November 2026 from three Google Sheets that were **read but not modified**:
- `SDGLINESV2 GENERAL DATA` — ports, services, vessels, schedule, distances, freight rates
- `SDG Lines – Bookings_V3_FORM (Responses)` — tariffs and 643 issued freight quotations
- `MEDtrade SDG Lines – Arrival ChargesV3 (Responses)` — 276 issued arrival charges quotations

Customer data from the old form responses (names, emails, phones) is **not** copied into this project.

SDG Lines is a simulated company for training. It offers no real services.
