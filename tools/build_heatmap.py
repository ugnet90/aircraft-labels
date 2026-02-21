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
OUT_ROUTES = ROOT / "docs" / "data" / "flights_routes.json"


def _iata(v) -> str | None:
    if v is None:
        return None
    s = str(v).strip().upper()
    return s if len(s) == 3 else None


def _extract_flights(payload) -> list[dict]:
    if isinstance(payload, list):
        return [x for x in payload if isinstance(x, dict)]

    if isinstance(payload, dict):
        for key in ("flights", "items", "data", "rows", "records"):
            val = payload.get(key)
            if isinstance(val, list):
                return [x for x in val if isinstance(x, dict)]

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
    airports: dict = json.loads(AIRPORTS_JSON.read_text(encoding="utf-8"))
    flights = _extract_flights(flights_payload)

    counts_airport: Counter[str] = Counter()
    missing: Counter[str] = Counter()

    # Route aggregation: directed and undirected
    route_dir: Counter[tuple[str, str]] = Counter()
    route_und: Counter[tuple[str, str]] = Counter()

    for fl in flights:
        fr = _iata(fl.get("from"))
        to = _iata(fl.get("to"))

        # A) Airport hits: departure + arrival
        for code in (fr, to):
            if not code:
                continue
            if code in airports:
                counts_airport[code] += 1
            else:
                missing[code] += 1

        # Routes: only if both endpoints are mappable
        if fr and to and fr in airports and to in airports and fr != to:
            route_dir[(fr, to)] += 1
            a, b = sorted([fr, to])
            route_und[(a, b)] += 1

    # Points for heatmap
    points = []
    for iata, w in counts_airport.most_common():
        ap = airports.get(iata)
        if not ap:
            continue
        lat = ap.get("lat")
        lon = ap.get("lon")
        if lat is None or lon is None:
            continue
        points.append({"iata": iata, "lat": lat, "lon": lon, "w": int(w)})

    # Routes output (use undirected counts for thickness)
    routes = []
    for (a, b), w in route_und.most_common():
        ap1 = airports[a]
        ap2 = airports[b]
        routes.append(
            {
                "a": a,
                "b": b,
                "w": int(w),
                "a_lat": ap1["lat"],
                "a_lon": ap1["lon"],
                "b_lat": ap2["lat"],
                "b_lon": ap2["lon"],
            }
        )

    OUT_POINTS.parent.mkdir(parents=True, exist_ok=True)
    OUT_POINTS.write_text(json.dumps(points, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    OUT_ROUTES.write_text(json.dumps(routes, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    missing_list = [{"iata": k, "count": int(v)} for k, v in missing.most_common()]
    OUT_MISSING.write_text(
        json.dumps(missing_list, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    print(f"[build_heatmap] flights: {len(flights)}")
    print(f"[build_heatmap] points: {len(points)} -> {OUT_POINTS}")
    print(f"[build_heatmap] routes: {len(routes)} -> {OUT_ROUTES}")
    print(f"[build_heatmap] missing airports: {len(missing_list)} -> {OUT_MISSING}")


if __name__ == "__main__":
    main()
