from __future__ import annotations

import html
import json
from pathlib import Path
from typing import Any

import qrcode


ROOT = Path(__file__).resolve().parents[1]
MODELS_DIR = ROOT / "docs" / "data" / "models"

OUT_DIR = ROOT / "docs" / "labels"
OUT_HTML = OUT_DIR / "labels.html"
OUT_CSS = OUT_DIR / "labels.css"

QR_DIR = ROOT / "docs" / "labels" / "qr"

PUBLIC_BASE_URL = "https://ugnet90.github.io/aircraft-labels/model_public.html?id="

PAGE_MARGIN_MM = 8
LABEL_W_MM = 48
LABEL_H_MM = 22
COL_GAP_MM = 4
ROW_GAP_MM = 4


def esc(v: Any) -> str:
    return html.escape(str(v or ""))


def first(*vals: Any) -> str:
    for v in vals:
        s = str(v or "").strip()
        if s:
            return s
    return ""


def load_models() -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []

    for path in sorted(MODELS_DIR.glob("*.json")):
        d = json.loads(path.read_text(encoding="utf-8"))

        model_id = first(d.get("model_id"), path.stem)

        # bestellte / alte Relikte nicht als Label erzeugen
        if model_id.upper().startswith("ORD-"):
            continue

        airline = first(d.get("airline_row"), d.get("airline"))
        typ = first(d.get("aircraft_type"), d.get("aircraft", {}).get("type"))
        reg = first(d.get("registration"), d.get("aircraft", {}).get("registration"))
        manufacturer = first(d.get("model", {}).get("manufacturer"), d.get("manufacturer"))
        scale = first(d.get("model", {}).get("scale"), d.get("scale"))

        url = f"{PUBLIC_BASE_URL}{model_id}"

        items.append({
            "model_id": model_id,
            "airline": airline,
            "type": typ,
            "reg": reg,
            "manufacturer": manufacturer,
            "scale": scale,
            "url": url,
            "qr": f"qr/{model_id}.png",
        })

    items.sort(key=lambda x: (
        str(x["airline"] or "").lower(),
        str(x["model_id"] or "").lower()
    ))
    print("Modelle für Labels:", len(items))
    print("Erste 10 IDs:", [x["model_id"] for x in items[:10]])    
    return items
    
def build_qr(url: str, out: Path) -> None:
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


def write_css() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_CSS.write_text(f"""\
@page {{
  size: A4;
  margin: {PAGE_MARGIN_MM}mm;
}}

:root {{
  --label-w: {LABEL_W_MM}mm;
  --label-h: {LABEL_H_MM}mm;
  --col-gap: {COL_GAP_MM}mm;
  --row-gap: {ROW_GAP_MM}mm;
}}

* {{
  box-sizing: border-box;
}}

html, body {{
  margin: 0;
  padding: 0;
  font-family: Arial, Helvetica, sans-serif;
  color: #111;
  background: #fff;
}}

body {{
  padding: {PAGE_MARGIN_MM}mm;
}}

.sheet {{
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--label-w), var(--label-w)));
  gap: var(--row-gap) var(--col-gap);
  align-content: start;
}}

/* Airline Trenner */
.airline-break{{
  grid-column: 1 / -1;
  margin: 2mm 0 1mm;
  padding: 1.5mm 2mm;
  border-top: 0.4mm solid #000;
  border-bottom: 0.2mm solid #999;
  background: #f3f3f3;
}}

.airline-break-title{{
  font-size: 11pt;
  font-weight: 700;
  line-height: 1.1;
}}

/* Label Layout */
.label{{
  width: var(--label-w);
  height: var(--label-h);
  border: 0.25mm solid #000;
  border-radius: 1.2mm;
  padding: 1.4mm;

  display: grid;
  grid-template-columns: 1fr 10mm;
  gap: 1.2mm;

  align-content: start;
}}

.label-left{{
  display:flex;
  flex-direction:column;
  gap:0.6mm;
}}

.airline{{
  font-size:7pt;
  font-weight:700;
  line-height:1.1;
}}

.type{{
  font-size:7pt;
  line-height:1.1;
}}

.bottom-row{{
  font-size:7pt;
  line-height:1.1;
  margin-top:0.6mm;
}}

.reg{{
  white-space:nowrap;
}}

.label-right{{
  display:flex;
  flex-direction:column;
  align-items:center;
  gap:0.5mm;
}}

.qr-box img{{
  width:9mm;
  height:auto;
  display:block;
}}

.model-id-small{{
  font-size:6pt;
  line-height:1;
  text-align:center;
}}

.no-print-header {{
  margin-bottom: 8mm;
  font-size: 11pt;
}}

.print-btn {{
  margin-top: 8px;
  padding: 6px 12px;
  border: 1px solid rgba(0,0,0,.2);
  background: #fff;
  cursor: pointer;
}}

@media print {{
  .no-print-header {{
    display: none;
  }}
}}
""", encoding="utf-8")

def label_html(it: dict[str, Any]) -> str:
    return f"""\
<article class="label">
  <div class="label-left">
    <div class="airline">{esc(it["airline"])}</div>
    <div class="type">{esc(it["type"])}</div>

    <div class="bottom-row">
      <div class="reg">Reg: {esc(it["reg"])}</div>
    </div>
  </div>

  <div class="label-right">
    <div class="qr-box">
      <img src="{esc(it["qr"])}" alt="QR {esc(it["model_id"])}">
    </div>
    <div class="model-id-small">{esc(it["model_id"])}</div>
  </div>
</article>
"""

def airline_header_html(name: str) -> str:
    return f"""
<div class="airline-break">
  <div class="airline-break-title">{esc(name)}</div>
</div>
"""

def write_html(items: list[dict[str, Any]]) -> None:
    parts: list[str] = []
    last_airline = None

    for it in items:
        airline = it["airline"] or "Ohne Airline"

        if airline != last_airline:
            parts.append(airline_header_html(airline))
            last_airline = airline

        parts.append(label_html(it))

    OUT_HTML.write_text(
        f"""\
<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Aircraft Labels</title>
  <link rel="stylesheet" href="labels.css">
</head>
<body>
  <div class="no-print-header">
    <strong>Aircraft Labels</strong> – {len(items)} Labels<br>
    Drucken mit 100 % Skalierung und ohne Kopf-/Fußzeilen.
    <div>
      <button class="print-btn" onclick="window.print()">Drucken</button>
    </div>
  </div>

  <main class="sheet">
    {"".join(parts)}
  </main>
</body>
</html>
""",
        encoding="utf-8",
    )

def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    QR_DIR.mkdir(parents=True, exist_ok=True)

    # alte QR-Dateien entfernen, damit keine Relikte bleiben
    for old in QR_DIR.glob("*.png"):
      old.unlink()

    items = load_models()

    for it in items:
        build_qr(it["url"], QR_DIR / f"{it['model_id']}.png")

    write_css()
    write_html(items)

    print("Labels erstellt:", len(items))
    print("HTML:", OUT_HTML)
    print("CSS :", OUT_CSS)
    print("QRs :", QR_DIR)


if __name__ == "__main__":
    main()
