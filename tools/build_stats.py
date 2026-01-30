import csv
import json
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parents[1]
MODELS_CSV = ROOT / "models_export.csv"
PASSENGER_CSV = ROOT / "data" / "passenger_aircraft_full.csv"

OUT_DIR = ROOT / "docs" / "data"
OUT_DIR.mkdir(parents=True, exist_ok=True)

OUT_MISSING = OUT_DIR / "missing_types.json"
OUT_MATRIX = OUT_DIR / "matrix.json"


def read_csv(path: Path, delimiter=";"):
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f, delimiter=delimiter))


def norm(s) -> str:
    return (s or "").strip()


def main():
    models = read_csv(MODELS_CSV, delimiter=";")
    pax = read_csv(PASSENGER_CSV, delimiter=";")

    # =========================
    # Missing types (stable by aircraft_id; display Typ_anzeige)
    # =========================
    present_ids = set()
    for r in models:
        aid = norm(r.get("aircraft_id"))
        if aid:
            present_ids.add(aid)

    id_to_label = {}
    master_ids = set()
    for r in pax:
        aid = norm(r.get("aircraft_id"))
        label = norm(r.get("Typ_anzeige")) or aid
        if aid:
            master_ids.add(aid)
            id_to_label[aid] = label

    warning = ""
    if not master_ids:
        warning = f"Keine aircraft_id aus {PASSENGER_CSV.name} gefunden."
        missing_ids = []
        present_in_master = set()
    else:
        present_in_master = present_ids & master_ids
        missing_ids = sorted(master_ids - present_ids)

    missing_types = [
        {"aircraft_id": aid, "Typ_anzeige": id_to_label.get(aid, aid)}
        for aid in missing_ids
    ]

    payload_missing = {
        "schema": "aircraft-labels.missing-types.v2",
        "warning": warning,
        "counts": {
            "master_types": len(master_ids),
            "present_types": len(present_in_master),
            "missing_types": len(missing_ids),
            "models": len(models),
        },
        "missing_types": missing_types,
    }
    OUT_MISSING.write_text(json.dumps(payload_missing, ensure_ascii=False, indent=2), encoding="utf-8")

    # =========================
    # Matrix (Airlines from sheets; Types from aircraft_type; cells = count)
    # =========================
    counts_by_airline_type = defaultdict(lambda: defaultdict(int))
    present_types_for_matrix = set()

    for r in models:
        airline = norm(r.get("airline")) or norm(r.get("airline_code"))  # sheet grouping
        t = norm(r.get("aircraft_type"))
        if airline and t:
            counts_by_airline_type[airline][t] += 1
            present_types_for_matrix.add(t)

    airlines = sorted(counts_by_airline_type.keys())
    types = sorted(present_types_for_matrix)

    matrix = []
    for a in airlines:
        row = []
        for t in types:
            row.append(counts_by_airline_type[a].get(t, 0))
        matrix.append(row)

    payload_matrix = {
        "schema": "aircraft-labels.matrix.v1",
        "counts": {
            "airlines": len(airlines),
            "types": len(types),
            "models": len(models),
        },
        "airlines": airlines,
        "types": types,
        "matrix": matrix,
    }
    OUT_MATRIX.write_text(json.dumps(payload_matrix, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
