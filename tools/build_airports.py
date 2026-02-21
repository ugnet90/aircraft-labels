# tools/build_airports.py
from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AIRPORTS_CSV = ROOT / "data" / "airports.csv"
OUT_JSON = ROOT / "docs" / "data" / "airports.json"


def _to_float(v: str | None) -> float | None:
    if v is None:
        return None
    v = str(v).strip()
    if not v:
        return None
    try:
        return float(v)
    except ValueError:
        return None


def main() -> None:
    if not AIRPORTS_CSV.exists():
        raise FileNotFoundError(f"Missing input: {AIRPORTS_CSV}")

    airports: dict[str, dict] = {}

    with AIRPORTS_CSV.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        # OurAirports typical columns: ident, type, name, latitude_deg, longitude_deg,
        # elevation_ft, continent, iso_country, iso_region, municipality, scheduled_service,
        # gps_code, iata_code, local_code, home_link, wikipedia_link, keywords
        for row in reader:
            iata = (row.get("iata_code") or "").strip().upper()
            if not iata or len(iata) != 3:
                continue

            lat = _to_float(row.get("latitude_deg"))
            lon = _to_float(row.get("longitude_deg"))
            if lat is None or lon is None:
                # For heatmap we need coordinates; skip if missing.
                continue

            airports[iata] = {
                "iata": iata,
                "icao": (row.get("ident") or "").strip().upper() or None,
                "name": (row.get("name") or "").strip() or None,
                "city": (row.get("municipality") or "").strip() or None,
                "country": (row.get("iso_country") or "").strip().upper() or None,
                "lat": lat,
                "lon": lon,
            }

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    # Stable ordering for diffs
    ordered = {k: airports[k] for k in sorted(airports.keys())}

    OUT_JSON.write_text(json.dumps(ordered, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"[build_airports] wrote {OUT_JSON} ({len(ordered)} airports)")


if __name__ == "__main__":
    main()
