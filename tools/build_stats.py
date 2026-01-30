import csv
import json
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parents[1]
MODELS_CSV = ROOT / "models_export.csv"

# Passe den Pfad an, falls deine Datei anders liegt:
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


def norm(s: str) -> str:
    return (s or "").strip()


def main():
    models = read_csv(MODELS_CSV, delimiter=";")
    pax = read_csv(PASSENGER_CSV, delimiter=";")

    # --- Collection: types present ---
    present_types = set()
    present_by_airline = defaultdict(set)
    counts_by_airline_type = defaultdict(lambda: defaultdict(int))

    for r in models:
        airline = norm(r.get("airline_row")) or norm(r.get("airline")) or norm(r.get("airline_code"))
        t = norm(r.get("aircraft_type"))
        if t:
            present_types.add(t)
            if airline:
                present_by_airline[airline].add(t)
                counts_by_airline_type[airline][t] += 1

    # --- Master type list from passenger_aircraft_full.csv ---
    # Verwendet: aircraft_id + Typ_anzeige
    master_types = set()
    for r in pax:
        t = norm(r.get("Typ_anzeige")) or norm(r.get("aircraft_id"))
        if t:
            master_types.add(t)


    # Fallback: wenn passenger_aircraft_full.csv fehlt/leer ist:
    # dann kann man "fehlend" nicht sinnvoll bestimmen -> leere Liste + Hinweis
    warning = ""
    if not master_types:
        warning = f"Keine Typen aus {PASSENGER_CSV.name} gefunden (Datei fehlt oder Spaltennamen passen nicht)."
        missing_types = []
    else:
        missing_types = sorted(master_types - present_types)

    payload_missing = {
        "schema": "aircraft-labels.missing-types.v1",
        "warning": warning,
        "counts": {
            "master_types": len(master_types),
            "present_types": len(present_types),
            "missing_types": len(missing_types),
            "models": len(models),
        },
        "missing_types": missing_types,
        "present_types": sorted(present_types),
    }
    OUT_MISSING.write_text(json.dumps(payload_missing, ensure_ascii=False, indent=2), encoding="utf-8")

    # --- Matrix payload (Airlines x Types) ---
    airlines = sorted(counts_by_airline_type.keys())
    types = sorted(present_types)  # nur Typen, die du wirklich hast (übersichtlich)
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
