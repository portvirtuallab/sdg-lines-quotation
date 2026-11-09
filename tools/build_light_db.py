"""Builds data/SDG_Lines_DB.xlsx (light version) from data/tariffs.json."""
import json
from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter
root = Path(__file__).resolve().parent.parent
db = json.loads((root / "data" / "tariffs.json").read_text(encoding="utf-8"))
QHEAD = ['quote_no','type','created_at','mode','customer_name','company','email','from','to','via','service','vessel','tripcode','etd','eta',
         'equipment','units','weight_kg','dangerous','imo_class','vgm','nm','base_feu','total_freight','total_surcharges','total','co2_sea_kg','co2_saving_kg','lines_json','status']
EDIT = {'Settings':['value'],'Ports':['category','agent','owner_rep','email','ets_status'],'Equipment':['freight_factor','default_weight_kg','emission_factor','baf_base_A','plugin_per_day'],
        'THC':['A','B','C','D'],'Surcharges':['A','B','C','D','in_total'],'FreightCurve':['base_feu_eur']}
F = 'Arial'; HDR = PatternFill('solid', fgColor='03B8D9')
wb = Workbook(); ws = wb.active; ws.title = 'README'
rows = [['SDG Lines – Database'], ['Tariffs and settings for the SDG Lines Quotation Desk, plus the quotations it issues.'], [],
        ['Blue values', 'Editable: change them here and the web app uses them within 10 minutes (menu SDG Lines › Clear API cache to apply at once).'],
        ['Quotations', 'Filled automatically by the web app. Do not edit by hand.'],
        ['Log (last 2 months)', 'Created by the script (menu SDG Lines). Summary of the last 2 months, updates by itself.'],
        ['Network data', 'Schedule, distances, routes, services and vessels live in the GitHub repository (data/network.json).'], [],
        ['Tab', 'Content'], ['Settings', 'EUA price, ETS fee, BAF step, validity, numbering, pricing mode'],
        ['Ports', '37 ports: category A–D (drives THC and surcharges), agent, owner representative'],
        ['Equipment', '16 equipment types: freight factor, default weight, emission factor, BAF base, plug-in'],
        ['THC', 'Terminal handling charge per equipment and port category'], ['Surcharges', 'Surcharges per port category'],
        ['FreightCurve', 'Base sea freight per FEU (€) by distance in NM'], ['Quotations', 'One row per quotation issued']]
for r in rows: ws.append(r)
for row in ws.iter_rows():
    for c in row: c.font = Font(name=F, size=10); c.alignment = Alignment(wrap_text=True, vertical='top')
ws['A1'].font = Font(name=F, bold=True, size=16, color='0687A1'); ws['A4'].font = Font(name=F, size=10, bold=True, color='0000FF')
ws['A9'].font = Font(name=F, bold=True); ws['B9'].font = Font(name=F, bold=True)
ws.column_dimensions['A'].width = 22; ws.column_dimensions['B'].width = 100
def sheet(name, data, cols):
    s = wb.create_sheet(name); s.append(cols)
    for d in data: s.append([('TRUE' if d.get(c) else 'FALSE') if isinstance(d.get(c), bool) else d.get(c, '') for c in cols])
    for i, c in enumerate(cols, 1):
        h = s.cell(1, i); h.font = Font(name=F, bold=True, color='FFFFFF'); h.fill = HDR
        w = max([len(str(c))] + [len(str(d.get(c, ''))) for d in data]) + 2
        s.column_dimensions[get_column_letter(i)].width = min(max(w, 8), 50)
        for r in range(2, len(data) + 2):
            s.cell(r, i).font = Font(name=F, size=10, color='0000FF' if c in EDIT.get(name, []) else '000000')
            if name in ('THC', 'Surcharges') and c in 'ABCD': s.cell(r, i).number_format = '€#,##0.00'
            if name == 'FreightCurve' and c == 'base_feu_eur': s.cell(r, i).number_format = '€#,##0.00'
    s.freeze_panes = 'A2'
for k in ['Settings', 'Ports', 'Equipment', 'THC', 'Surcharges', 'FreightCurve']: sheet(k, db[k], list(db[k][0].keys()))
sheet('Quotations', [], QHEAD)
out = root / "data" / "SDG_Lines_DB.xlsx"; wb.save(out); print("written", out, out.stat().st_size, "bytes")
