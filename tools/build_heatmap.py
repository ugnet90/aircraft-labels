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
    if len(s) == 3:
        return s
    return None


def main() -> None:
    if not FLIGHTS_JSON.exists():
        raise FileNotFoundError(f"Missing input: {FLIGHTS_JSON}")
    if not AIRPORTS_JSON.exists():
        raise FileNotFoundError(
            f"Missing input: {AIRPORTS_JSON} (run tools/build_airports.py first)"
        )

    flights = json.loads(FLIGHTS_JSON.read_text(encoding="utf-8"))
    airports = json.loads(AIRPORTS_JSON.read_text(encoding="utf-8"))

    # flights.json can be list[flight] (expected)
    if not isinstance(flights, list):
        raise ValueError("docs/data/flights.json is not a list")

    counts: Counter[str] = Counter()
    missing: Counter[str] = Counter()

    for fl in flights:
        if not isinstance(fl, dict):
            continue
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
        points.append(
            {
                "iata": iata,
                "lat": ap["lat"],
                "lon": ap["lon"],
                "w": int(w),
            }
        )

    OUT_POINTS.parent.mkdir(parents=True, exist_ok=True)
    OUT_POINTS.write_text(json.dumps(points, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    missing_list = [{"iata": k, "count": int(v)} for k, v in missing.most_common()]
    OUT_MISSING.write_text(
        json.dumps(missing_list, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    total_segments = len(flights)  # assuming each entry is one segment
    print(f"[build_heatmap] segments: {total_segments}")
    print(f"[build_heatmap] points: {len(points)} -> {OUT_POINTS}")
    print(f"[build_heatmap] missing airports: {len(missing_list)} -> {OUT_MISSING}")


if __name__ == "__main__":
    main()
