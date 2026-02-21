# tools/build_heatmap.py
from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FLIGHTS_JSON = ROOT / "docs" / "data" / "flights.json"
AIRPORTS_JSON = ROOT / "docs" / "data" / "airports.json"

OUT_POINTS = ROOT / "docs" / "data" / "flights_points.json"
OUT_MISSING = ROOT / "docs" / "data" / "airports_missing.json"


def _iata(v) -> str | None:
    if v is None:
        return None
    s = str(v).strip().upper()
    return s if len(s) == 3 else None


def _extract_flights(payload) -> list[dict]:
    """
    Accepts either:
    - list[flight]
    - dict with common keys holding the list, e.g. {"flights":[...]} or {"items":[...]} etc.
    """
    if isinstance(payload, list):
        return [x for x in payload if isinstance(x, dict)]

    if isinstance(payload, dict):
        # common wrappers
        for key in ("flights", "items", "data", "rows", "records"):
            val = payload.get(key)
            if isinstance(val, list):
                return [x for x in val if isinstance(x, dict)]

        # fallback: if there is exactly one list value, use it
        list_values = [v for v in payload.values() if isinstance(v, list)]
        if len(list_values) == 1:
            return [x for x in list_values[0] if isinstance(x, dict)]

    raise ValueError(
        "docs/data/flights.json has an unexpected structure. "
        "Expected a list OR a dict wrapping a list (keys: flights/items/data/rows/records)."
    )


def main() -> None:
    if not FLIGHTS_JSON.exists():
        raise FileNotFoundError(f"Missing input: {FLIGHTS_JSON}")
    if not AIRPORTS_JSON.exists():
        raise FileNotFoundError(
            f"Missing input: {AIRPORTS_JSON} (run tools/build_airports.py first)"
        )

    flights_payload = json.loads(FLIGHTS_JSON.read_text(encoding="utf-8"))
    airports = json.loads(AIRPORTS_JSON.read_text(encoding="utf-8"))

    flights = _extract_flights(flights_payload)

    counts: Counter[str] = Counter()
    missing: Counter[str] = Counter()

    for fl in flights:
        fr = _iata(fl.get("from"))
        to = _iata(fl.get("to"))

        # A) Departure + Arrival counts
        for code in (fr, to):
            if not code:
                continue
            if code in airports:
                counts[code] += 1
            else:
                missing[code] += 1

    points = []
    for iata, w in counts.most_common():
        ap = airports.get(iata)
        if not ap:
            continue
        # safety: require coords
        lat = ap.get("lat")
        lon = ap.get("lon")
        if lat is None or lon is None:
            continue
        points.append({"iata": iata, "lat": lat, "lon": lon, "w": int(w)})

    OUT_POINTS.parent.mkdir(parents=True, exist_ok=True)
    OUT_POINTS.write_text(json.dumps(points, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    missing_list = [{"iata": k, "count": int(v)} for k, v in missing.most_common()]
    OUT_MISSING.write_text(
        json.dumps(missing_list, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    print(f"[build_heatmap] flights: {len(flights)}")
    print(f"[build_heatmap] points: {len(points)} -> {OUT_POINTS}")
    print(f"[build_heatmap] missing airports: {len(missing_list)} -> {OUT_MISSING}")


if __name__ == "__main__":
    main()
