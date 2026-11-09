"""Regenerate data/tariffs.json (offline copy of the tariffs) from a .xlsx downloaded from the SDG_Lines_DB Google Sheet.
Usage:  python tools/export_snapshot.py [path/to/SDG_Lines_DB.xlsx]
"""
import json, sys
from pathlib import Path
from openpyxl import load_workbook

TABS = ["Settings", "Ports", "Equipment", "THC", "Surcharges", "FreightCurve"]
root = Path(__file__).resolve().parent.parent
src = Path(sys.argv[1]) if len(sys.argv) > 1 else root / "data" / "SDG_Lines_DB.xlsx"
wb = load_workbook(src, data_only=True)

def clean(v):
    if v in ("TRUE", "FALSE"): return v == "TRUE"
    if hasattr(v, "strftime"): return v.strftime("%d/%m/%Y %H:%M")
    return "" if v is None else v

out = {}
for t in TABS:
    rows = list(wb[t].iter_rows(values_only=True))
    head = rows[0]
    out[t] = [dict(zip(head, map(clean, r))) for r in rows[1:] if any(c not in (None, "") for c in r)]
(root / "data" / "tariffs.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
print("data/tariffs.json written:", {t: len(v) for t, v in out.items()})
