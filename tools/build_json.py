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
AIRLINE_LOGOS_CSV = os.path.join(REPO_ROOT, "data", "airline_logos.csv")

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
    v = v.replace("€", "").replace(" ", "")
    v = v.replace(",", ".")
    try:
        return float(v)
    except ValueError:
        return None


def excel_serial_to_iso(v: str) -> Optional[str]:
    """
    Excel-Seriendatum (z.B. 45799) -> YYYY-MM-DD
    """
    v = (v or "").strip()
    if not v:
        return None
    if re.match(r"^\d{4}-\d{2}-\d{2}$", v):
        return v
    if re.match(r"^\d{1,2}\.\d{1,2}\.\d{4}$", v):
        try:
            d = datetime.strptime(v, "%d.%m.%Y").date()
            return d.isoformat()
        except ValueError:
            pass
    try:
        n = int(float(v))
        base = datetime(1899, 12, 30).date()
        d = base + timedelta(days=n)
        return d.isoformat()
    except ValueError:
        return None


def safe_filename(model_id: str) -> str:
    model_id = model_id.strip()
    model_id = re.sub(r"[^A-Za-z0-9_-]", "_", model_id)
    return model_id


def index_by_key(rows: List[Dict[str, str]], key_field: str) -> Dict[str, Dict[str, str]]:
    idx: Dict[str, Dict[str, str]] = {}
    if not key_field:
        return idx
    for r in rows:
        k = (r.get(key_field, "") or "").strip()
        if k and k not in idx:
            idx[k] = r
    return idx


def normalize_livery_code(v: str) -> str:
    return (v or "").strip()


def parse_scale_from_text(text: str) -> Optional[str]:
    """
    Finds scale patterns like 1:400, 1 : 200, 1:87 in free text.
    Also supports Excel-text marker prefix: '1:350
    Returns normalized '1:XXX' or None.
    """
    t = (text or "").strip()
    if not t:
        return None

    # Excel export: leading apostrophe to force text (e.g. '1:350)
    if t.startswith("'"):
        t = t[1:].strip()

    m = re.search(r"\b1\s*:\s*(\d{2,4})\b", t)
    if not m:
        return None
    return f"1:{m.group(1)}"


def main() -> int:
    os.makedirs(OUT_DIR, exist_ok=True)

    models = read_csv(MODELS_CSV)
    pax_rows = read_csv(PAX_CSV)
    liv_rows = read_csv(LIV_CSV)
    logos_rows = read_csv(AIRLINE_LOGOS_CSV)

    # Index nach logo_id (Primärschlüssel)
    logos_idx = index_by_key(logos_rows, "logo_id")

    pax_idx = index_by_key(pax_rows, "aircraft_id")


    # In liveries kann der Schlüssel unterschiedlich heißen; wir versuchen mehrere typische
    liv_key = None
    if liv_rows:
        header_keys = list(liv_rows[0].keys())
    
        # case-insensitive lookup
        def find_key_ci(candidates):
            lower_map = {k.lower(): k for k in header_keys}
            for c in candidates:
                k = lower_map.get(c.lower())
                if k:
                    return k
            return None
    
        liv_key = find_key_ci([
            "Livery_ID", "livery_id",
            "LiveryId", "liveryid",
            "Livery_Code", "livery_code",
            "Code", "code"
        ])
    
    liv_idx = index_by_key(liv_rows, liv_key) if liv_key else {}

    index_list = []
    counts: Dict[str, int] = {}

    for r in models:
        model_id = (r.get("model_id", "") or "").strip()
        if not model_id:
            continue

        airline_code = (r.get("airline_code", "") or "").strip()
        airline = (r.get("airline", "") or "").strip()
        airline_row = (r.get("airline_row", "") or "").strip()
        manufacturer = (r.get("manufacturer", "") or "").strip()
        
        aircraft_name = (r.get("aircraft_name", "") or "").strip()
        livery_note = (r.get("livery_note", "") or "").strip()
        extra_info = (r.get("extra_info", "") or "").strip()
        
        shop_url = (r.get("Shop_url", "") or "").strip()

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

        logo_id = (r.get("logo_id", "") or "").strip()
        logo_row = logos_idx.get(logo_id) if logo_id else None
        
        logo_link = (logo_row.get("Logo_Link", "") or "").strip() if logo_row else ""
        logo_name = (logo_row.get("full_name", "") or "").strip() if logo_row else ""
        logo_airline = (logo_row.get("Airline", "") or "").strip() if logo_row else ""
        
        angekommen_raw = (r.get("angekommen", "") or "").strip()
        angekommen_iso = excel_serial_to_iso(angekommen_raw)

        bestellt_raw = (r.get("bestellt_am", "") or "").strip()
        bestellt_iso = excel_serial_to_iso(bestellt_raw)
        
        vorhanden_raw = (r.get("vorhanden", "") or "").strip().lower()
        present = (vorhanden_raw in ("wahr", "true", "1", "x", "ja", "yes"))
        
        ordered = bool(bestellt_iso) and not bool(angekommen_iso) and not present


        source_sheet = (r.get("source_sheet", "") or "").strip()
        source_row = (r.get("source_row", "") or "").strip()

        # Scale precedence:
        # 1) explicit CSV column "scale" (falls du sie später exportierst)
        # 2) parse from special_note (Sondermodell; z.B. '1:350)
        # 3) default 1:400
        scale_csv = (r.get("scale", "") or "").strip()
        if scale_csv.startswith("'"):
            scale_csv = scale_csv[1:].strip()
        scale_text = parse_scale_from_text(special_note)
        scale_final = scale_csv or scale_text or "1:400"

        # Enrichment: passenger_aircraft_full by aircraft_id
        aircraft_full = pax_idx.get(aircraft_id) if aircraft_id else None

        # Enrichment: liveries by livery code (if possible)
        livery_full = liv_idx.get(livery) if livery and livery in liv_idx else None

        out: Dict[str, Any] = {
            "model_id": model_id,
            "airline_code": airline_code,
            "airline": airline,
            "airline_row": airline_row,
            "manufacturer": manufacturer,
            "aircraft_name": aircraft_name,
            "livery_note": livery_note,
            "extra_info": extra_info,
            "shop_url": shop_url,
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
            "ordered_at": bestellt_iso,
            "ordered": ordered,
            "source": {"sheet": source_sheet, "row": source_row},
            "aircraft": {
                "aircraft_id": aircraft_id,
                "type": aircraft_type,
                "registration": registration,
            },
            "livery": {
                "code": livery,
                "parent": parent_livery,
                "notes_raw": zusatzinfo,
                "note": livery_note,
            },
            "model": {
                "scale": scale_final,
                "manufacturer": manufacturer,
                "model_number": (r.get("model_number", "") or "").strip(),
                "shop": shop,
                "price": price,
                "shipping_allocated": shipping,
                "arrived": angekommen_iso,
                "ordered_at": bestellt_iso,
                "ordered": ordered,
                "flown": eigenfluege,
                "special_note": special_note,
            },
            "links": {
                "postcard": postcard,
                "photo": photo,
                "shop": shop,
                "shop_url": shop_url,
            },
        }

        # Logo-Infos (airline_logos.csv)
        if logo_id or logo_link:
            out["logo"] = {
                "id": logo_id,
                "link": logo_link,
                "name": logo_name,
                "airline": logo_airline,
            }
            
        if aircraft_full:
            out["aircraft_full_v8"] = aircraft_full

        if livery_full:
            out["livery_full"] = livery_full

        fn = safe_filename(model_id) + ".json"
        with open(os.path.join(OUT_DIR, fn), "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=2)

        livery_pretty = ""
        if livery_full:
            livery_pretty = (livery_full.get("Livery_Name", "") or "").strip()
        
        index_list.append({
            "model_id": model_id,
            "airline_code": airline_code,
            "airline": airline,
            "airline_row": (r.get("airline_row", "") or "").strip(),
        
            "aircraft_id": aircraft_id,
            "aircraft_type": aircraft_type,
            "registration": registration,
        
            "manufacturer": (r.get("manufacturer", "") or "").strip(),
            "aircraft_name": (r.get("aircraft_name", "") or "").strip(),
            "livery_note": (r.get("livery_note", "") or "").strip(),
            "extra_info": (r.get("extra_info", "") or "").strip(),
        
            "livery_name": livery,                      # Code behalten (für Debug/Referenz)
            "livery_display": livery_pretty or livery,   # Anzeige
            "arrived": angekommen_iso,
            "scale": scale_final,
            "flown": eigenfluege,
            "logo_id": logo_id,
        
            "shop_url": (r.get("Shop_url", "") or "").strip(),
            "ordered_at": bestellt_iso,
            "ordered": ordered,
        })
        counts[airline_code] = counts.get(airline_code, 0) + 1

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
