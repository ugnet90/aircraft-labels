from __future__ import annotations

import html
import json
from pathlib import Path
from typing import Any

import qrcode


ROOT = Path(__file__).resolve().parents[1]
MODELS_DIR = ROOT / "docs" / "data" / "models"
CONFIG_PATH = ROOT / "tools" / "labels_config.json"
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

def load_config() -> dict[str, Any]:
    if not CONFIG_PATH.exists():
        raise FileNotFoundError(f"Config-Datei fehlt: {CONFIG_PATH}")
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))


def parse_selected_ids(values: list[Any]) -> set[str]:
    return {
        str(x).strip().upper()
        for x in (values or [])
        if str(x).strip()
    }
    
def parse_ids(raw: str) -> set[str]:
    if not raw:
        return set()
    return {
        x.strip().upper()
        for x in raw.split(",")
        if x.strip()
    }
    
def esc(v: Any) -> str:
    return html.escape(str(v or ""))


def first(*vals: Any) -> str:
    for v in vals:
        s = str(v or "").strip()
        if s:
            return s
    return ""


def load_models(mode: str, selected_ids: set[str]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []

    for path in sorted(MODELS_DIR.glob("*.json")):
        d = json.loads(path.read_text(encoding="utf-8"))

        model_id = first(d.get("model_id"), path.stem)

        # bestellte / alte Relikte nicht als Label erzeugen
        if model_id.upper().startswith("ORD-"):
            continue

        # nur bestimmte IDs
        if mode == "selection" and selected_ids:
            if model_id.upper() not in selected_ids:
                continue

        airline = first(d.get("airline_row"), d.get("airline"))
        typ = first(d.get("aircraft_type"), d.get("aircraft", {}).get("type"))
        reg = first(d.get("registration"), d.get("aircraft", {}).get("registration"))

        url = f"{PUBLIC_BASE_URL}{model_id}"

        items.append({
            "model_id": model_id,
            "airline": airline,
            "type": typ,
            "reg": reg,
            "url": url,
            "qr": f"qr/{model_id}.png",
        })

    items.sort(key=lambda x: (
        str(x["airline"] or "").lower(),
        str(x["model_id"] or "").lower()
    ))
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


def write_css(
    page_margin_mm: float,
    label_w_mm: float,
    label_h_mm: float,
    col_gap_mm: float,
    row_gap_mm: float,
    qr_size_mm: float,
    show_border: bool,
    cut_marks: bool,
    cut_mark_length_mm: float,
    cut_mark_offset_mm: float,
) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    border_css = "0.25mm solid #000" if show_border else "none"
    cut_display = "block" if cut_marks else "none"

    OUT_CSS.write_text(f"""\
@page {{
  size: A4;
  margin: {page_margin_mm}mm;
}}

:root {{
  --label-w: {label_w_mm}mm;
  --label-h: {label_h_mm}mm;
  --col-gap: {col_gap_mm}mm;
  --row-gap: {row_gap_mm}mm;
  --qr-size: {qr_size_mm}mm;
  --cut-len: {cut_mark_length_mm}mm;
  --cut-off: {cut_mark_offset_mm}mm;
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
  padding: {page_margin_mm}mm;
}}

.sheet {{
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--label-w), var(--label-w)));
  gap: var(--row-gap) var(--col-gap);
  align-content: start;
}}

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

.label{{
  position: relative;
  width: var(--label-w);
  height: var(--label-h);
  border: {border_css};
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
  width:var(--qr-size);
  height:auto;
  display:block;
}}

.model-id-small{{
  font-size:6pt;
  line-height:1;
  text-align:center;
}}

.cut {{
  display: {cut_display};
  position: absolute;
  width: var(--cut-len);
  height: var(--cut-len);
  pointer-events: none;
}}

.cut-tl {{
  top: calc(-1 * var(--cut-off));
  left: calc(-1 * var(--cut-off));
  border-top: 0.2mm solid #000;
  border-left: 0.2mm solid #000;
}}

.cut-tr {{
  top: calc(-1 * var(--cut-off));
  right: calc(-1 * var(--cut-off));
  border-top: 0.2mm solid #000;
  border-right: 0.2mm solid #000;
}}

.cut-bl {{
  bottom: calc(-1 * var(--cut-off));
  left: calc(-1 * var(--cut-off));
  border-bottom: 0.2mm solid #000;
  border-left: 0.2mm solid #000;
}}

.cut-br {{
  bottom: calc(-1 * var(--cut-off));
  right: calc(-1 * var(--cut-off));
  border-bottom: 0.2mm solid #000;
  border-right: 0.2mm solid #000;
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

def label_html(it: dict[str, Any], show_cut_marks: bool) -> str:
    cut_html = """
    <span class="cut cut-tl"></span>
    <span class="cut cut-tr"></span>
    <span class="cut cut-bl"></span>
    <span class="cut cut-br"></span>
    """ if show_cut_marks else ""

    return f"""\
<article class="label">
  {cut_html}
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

def write_html(items: list[dict[str, Any]], group_by_airline: bool, show_cut_marks: bool) -> None:
    parts: list[str] = []

    if group_by_airline:
        last_airline = None
        for it in items:
            airline = it["airline"] or "Ohne Airline"
            if airline != last_airline:
                parts.append(airline_header_html(airline))
                last_airline = airline
            parts.append(label_html(it, show_cut_marks=show_cut_marks))
    else:
        parts = [label_html(it, show_cut_marks=show_cut_marks) for it in items]

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

    config = load_config()

    template_name = config.get("template", "standard")
    templates = config.get("templates", {})
    if template_name not in templates:
        raise ValueError(f"Unbekannte Vorlage: {template_name}")

    template = templates[template_name]

    label_w_mm = float(template["label_width_mm"])
    label_h_mm = float(template["label_height_mm"])
    page_margin_mm = float(template["page_margin_mm"])
    col_gap_mm = float(template["col_gap_mm"])
    row_gap_mm = float(template["row_gap_mm"])
    qr_size_mm = float(template["qr_size_mm"])
    show_border = bool(template["show_border"])
    cut_marks = bool(template.get("cut_marks", False))
    cut_mark_length_mm = float(template.get("cut_mark_length_mm", 2))
    cut_mark_offset_mm = float(template.get("cut_mark_offset_mm", 1))

    mode = str(config.get("mode", "default")).strip().lower()
    group_by_airline = bool(config.get("group_by_airline", False))
    selected_ids = parse_selected_ids(config.get("selected_ids", []))

    # alte QR-Dateien entfernen
    for old in QR_DIR.glob("*.png"):
        old.unlink()

    items = load_models(mode, selected_ids)

    for it in items:
        build_qr(it["url"], QR_DIR / f"{it['model_id']}.png")

    write_css(
        page_margin_mm=page_margin_mm,
        label_w_mm=label_w_mm,
        label_h_mm=label_h_mm,
        col_gap_mm=col_gap_mm,
        row_gap_mm=row_gap_mm,
        qr_size_mm=qr_size_mm,
        show_border=show_border,
        cut_marks=cut_marks,
        cut_mark_length_mm=cut_mark_length_mm,
        cut_mark_offset_mm=cut_mark_offset_mm,
    )

    write_html(
        items,
        group_by_airline=group_by_airline,
        show_cut_marks=cut_marks,
    )

    print("Labels erstellt:", len(items))
    print("Template:", template_name)
    print("Mode:", mode)
    print("Grouped by airline:", group_by_airline)


if __name__ == "__main__":
    main()
