from __future__ import annotations

import html
import json
from pathlib import Path
from typing import Any

import qrcode


ROOT = Path(__file__).resolve().parents[1]
MODELS_DIR = ROOT / "docs" / "data" / "models"
OUT_HTML = ROOT / "docs" / "labels.html"
OUT_CSS = ROOT / "docs" / "css" / "labels.css"
QR_DIR = ROOT / "docs" / "assets" / "qr"

# ⚠️ ANPASSEN
PUBLIC_BASE_URL = "https://ugnet90.github.io/aircraft-labels/model_public.html?id="

PAGE_MARGIN_MM = 8
LABEL_W_MM = 48
LABEL_H_MM = 22
COL_GAP_MM = 4
ROW_GAP_MM = 4


def esc(v: Any) -> str:
    return html.escape(str(v or ""))


def first(*vals):
    for v in vals:
        s = str(v or "").strip()
        if s:
            return s
    return ""


def load_models():
    items = []

    for path in sorted(MODELS_DIR.glob("*.json")):
        d = json.loads(path.read_text(encoding="utf-8"))

        model_id = first(d.get("model_id"), path.stem)
        
        # bestellte / alte Relikte nicht als Label erzeugen
        if model_id.upper().startswith("ORD-"):
            continue
        
        airline = first(d.get("airline_row"), d.get("airline"))
        typ = first(d.get("aircraft_type"), d.get("aircraft", {}).get("type"))
        reg = first(d.get("registration"), d.get("aircraft", {}).get("registration"))
        manufacturer = first(d.get("model", {}).get("manufacturer"))
        scale = first(d.get("model", {}).get("scale"))

        url = f"{PUBLIC_BASE_URL}{model_id}"

        items.append({
            "model_id": model_id,
            "airline": airline,
            "type": typ,
            "reg": reg,
            "manufacturer": manufacturer,
            "scale": scale,
            "url": url,
            "qr": f"assets/qr/{model_id}.png"
        })

    return items


def build_qr(url, out):
    qr = qrcode.QRCode(
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out)


def write_css():
    OUT_CSS.parent.mkdir(parents=True, exist_ok=True)
    OUT_CSS.write_text(f"""
@page {{ size:A4; margin:{PAGE_MARGIN_MM}mm; }}

body {{
  margin:0;
  font-family:Arial, sans-serif;
}}

.sheet {{
  display:grid;
  grid-template-columns:repeat(auto-fill,{LABEL_W_MM}mm);
  gap:{ROW_GAP_MM}mm {COL_GAP_MM}mm;
  padding:{PAGE_MARGIN_MM}mm;
}}

.label {{
  width:{LABEL_W_MM}mm;
  height:{LABEL_H_MM}mm;
  border:0.3mm solid #000;
  padding:1.5mm;
  display:grid;
  grid-template-columns:1fr 15mm;
}}

.model-id {{ font-size:10pt; font-weight:700; }}
.airline {{ font-size:7pt; font-weight:700; }}
.type {{ font-size:7pt; }}
.reg {{ font-size:7pt; }}
.meta {{ font-size:6pt; color:#444; }}

.qr img {{
  width:100%;
}}
""", encoding="utf-8")


def label_html(it):
    return f"""
<div class="label">
  <div>
    <div class="model-id">{esc(it["model_id"])}</div>
    <div class="airline">{esc(it["airline"])}</div>
    <div class="type">{esc(it["type"])}</div>
    <div class="reg">{esc(it["reg"])}</div>
    <div class="meta">{esc(it["manufacturer"])} · {esc(it["scale"])}</div>
  </div>
  <div class="qr">
    <img src="{esc(it["qr"])}">
  </div>
</div>
"""


def write_html(items):
    OUT_HTML.write_text(f"""
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="css/labels.css">
</head>
<body>
<div class="sheet">
{''.join(label_html(x) for x in items)}
</div>
</body>
</html>
""", encoding="utf-8")


def main():
    QR_DIR.mkdir(parents=True, exist_ok=True)

    for old in QR_DIR.glob("*.png"):
        old.unlink()

    items = load_models()

    for it in items:
        build_qr(it["url"], QR_DIR / f"{it['model_id']}.png")

    write_css()
    write_html(items)

    print("Labels erstellt:", len(items))


if __name__ == "__main__":
    main()
