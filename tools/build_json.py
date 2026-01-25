import csv
import json
import os
import re
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, List

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

MODELS_CSV = os.path.join(REPO_ROOT, "models_export.csv")
PAX_CSV = os.path.join(REPO_ROOT, "data", "passenger_aircraft_full.csv")
LIV_CSV = os.path.join(REPO_ROOT, "data", "liveries.csv")

OUT_DIR = os.path.join(REPO_ROOT, "docs", "data")
INDEX_JSON = os.path.join(REPO_ROOT, "docs", "index.json")


def read_csv(path: str) -> List[Dict[str, str]]:
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        # deutschsprachige Excel-CSV: Semikolon
        reader = csv.DictReader(f, delimiter=";")
        rows = []
        for row in reader:
            # Normalize None -> ""
            rows.append({k: (v if v is not None else "") for k, v in row.items()})
        return rows


def to_bool_x(v: str) -> Optional[bool]:
    v = (v or "").strip().lower()
    if v in ("x", "1", "true", "wahr", "yes", "ja"):
        return True
    if v in ("0", "false", "falsch", "no", "nein"):
        return False
    return None


def to_float(v: str) -> Optional[float]:
    v = (v or "").strip()
    if not v:
        return None
    # Entferne Währungszeichen, Leerzeichen
    v = v.replace("€", "").replace(" ", "")
    # deutsches Dezimal-Komma
    v = v.replace(",", ".")
    try:
        return float(v)
    except ValueError:
        return None


def excel_serial_to_iso(v: str) -> Optional[str]:
    """
    Excel-Seriendatum (z.B. 45799) -> YYYY-MM-DD
    Excel day 1 = 1899-12-31 (mit 1900-Leap-Year-Bug); für reine Tageswerte reicht Standardformel.
    """
    v = (v or "").strip()
    if not v:
        return None
    # falls schon ISO-ähnlich
    if re.match(r"^\d{4}-\d{2}-\d{2}$", v):
        return v
    # falls deutsches Datum
    if re.match(r"^\d{1,2}\.\d{1,2}\.\d{4}$", v):
        try:
            d = datetime.strptime(v, "%d.%m.%Y").date()
            return d.isoformat()
        except ValueError:
            pass
    # excel serial
    try:
        n = int(float(v))
        # Excel epoch: 1899-12-30 ist gängige Umrechnung inkl. 1900-Bug
        base = datetime(1899, 12, 30).date()
        d = base + timedelta(days=n)
        return d.isoformat()
    except ValueError:
        return None


def safe_filename(model_id: str) -> str:
    # model_id wie OS016, BOA001 etc. erlauben; sonst säubern
    model_id = model_id.strip()
    model_id = re.sub(r"[^A-Za-z0-9_-]", "_", model_id)
    return model_id


def index_by_key(rows: List[Dict[str, str]], key_field: str) -> Dict[str, Dict[str, str]]:
    idx: Dict[str, Dict[str, str]] = {}
    for r in rows:
        k = (r.get(key_field, "") or "").strip()
        if k:
            # first wins; bei Duplikaten könnte man loggen
            if k not in idx:
                idx[k] = r
    return idx


def normalize_livery_code(v: str) -> str:
    return (v or "").strip()


def main() -> int:
    os.makedirs(OUT_DIR, exist_ok=True)

    models = read_csv(MODELS_CSV)
    pax_rows = read_csv(PAX_CSV)
    liv_rows = read_csv(LIV_CSV)

    pax_idx = index_by_key(pax_rows, "aircraft_id")
    # In liveries kann der Schlüssel unterschiedlich heißen; wir versuchen mehrere typische
    liv_key = None
    if liv_rows:
        for candidate in ("livery_id", "Livery", "livery", "code", "livery_code"):
            if candidate in liv_rows[0]:
                liv_key = candidate
                break
    liv_idx = index_by_key(liv_rows, liv_key) if liv_key else {}

    index_list = []
    counts: Dict[str, int] = {}

    for r in models:
        model_id = (r.get("model_id", "") or "").strip()
        if not model_id:
            continue

        airline_code = (r.get("airline_code", "") or "").strip()
        airline = (r.get("airline", "") or "").strip()
        aircraft_id = (r.get("aircraft_id", "") or "").strip()

        aircraft_type = (r.get("aircraft_type", "") or "").strip()
        registration = (r.get("registration", "") or "").strip()

        livery = normalize_livery_code(r.get("livery", ""))
        parent_livery = normalize_livery_code(r.get("parent_livery", ""))

        zusatzinfo = (r.get("Zusatzinfo", "") or "").strip()
        special_note = (r.get("special_note", "") or "").strip()

        shop = (r.get("Shop", "") or "").strip()
        price = to_float(r.get("Preis", ""))
        shipping = to_float(r.get("Versandkosten", ""))
        eigenfluege = to_bool_x(r.get("Eigenfluege", ""))

        postcard = (r.get("Postkarte", "") or "").strip()
        postcard_price = to_float(r.get("Preis_Postkarte", ""))
        photo = (r.get("Foto", "") or "").strip()

        angekommen_raw = (r.get("angekommen", "") or "").strip()
        angekommen_iso = excel_serial_to_iso(angekommen_raw)

        source_sheet = (r.get("source_sheet", "") or "").strip()
        source_row = (r.get("source_row", "") or "").strip()

        # Enrichment: passenger_aircraft_full by aircraft_id
        aircraft_full = pax_idx.get(aircraft_id) if aircraft_id else None

        # Enrichment: liveries by livery code (if possible)
        livery_full = liv_idx.get(livery) if livery and livery in liv_idx else None

        # Backward-compatible flat fields for current model.html
        out: Dict[str, Any] = {
            "model_id": model_id,
            "airline_code": airline_code,
            "airline": airline,
            "aircraft_id": aircraft_id,
            "aircraft_type": aircraft_type,
            "registration": registration,
            "livery_name": livery,
            "parent_livery": parent_livery,
            "zusatzinfo": zusatzinfo,
            "special_note": special_note,
            "shop": shop,
            "price": price,
            "shipping_allocated": shipping,
            "flown": eigenfluege,
            "postcard": postcard,
            "postcard_price": postcard_price,
            "photo": photo,
            "arrived_excel": angekommen_raw,
            "arrived": angekommen_iso,
            "source": {"sheet": source_sheet, "row": source_row},
            # structured blocks for future UI
            "aircraft": {
                "aircraft_id": aircraft_id,
                "type": aircraft_type,
                "registration": registration,
            },
            "livery": {
                "code": livery,
                "parent": parent_livery,
                "notes": zusatzinfo,
            },
            "model": {
                "scale": "1:400",  # default; falls du später exportierst, kann hier überschrieben werden
                "manufacturer": (r.get("manufacturer", "") or "").strip(),
                "model_number": (r.get("model_number", "") or "").strip(),
                "shop": shop,
                "price": price,
                "shipping_allocated": shipping,
                "arrived": angekommen_iso,
                "flown": eigenfluege,
                "special_note": special_note,
            },
            "links": {
                "postcard": postcard,
                "photo": photo,
            },
        }

        if aircraft_full:
            out["aircraft_full_v8"] = aircraft_full

        if livery_full:
            out["livery_full"] = livery_full

        fn = safe_filename(model_id) + ".json"
        with open(os.path.join(OUT_DIR, fn), "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=2)

        # index
        index_list.append({
            "model_id": model_id,
            "airline_code": airline_code,
            "airline": airline,
            "aircraft_id": aircraft_id,
            "aircraft_type": aircraft_type,
            "registration": registration,
            "livery_name": livery,
            "arrived": angekommen_iso,
        })

        counts[airline_code] = counts.get(airline_code, 0) + 1

    # write index.json
    index_payload = {
        "generated_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "count": len(index_list),
        "counts_by_airline_code": counts,
        "items": sorted(index_list, key=lambda x: (x.get("airline_code") or "", x.get("model_id") or "")),
    }
    with open(INDEX_JSON, "w", encoding="utf-8") as f:
        json.dump(index_payload, f, ensure_ascii=False, indent=2)

    print(f"Generated {len(index_list)} JSON files into {OUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
