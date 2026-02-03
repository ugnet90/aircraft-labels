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
            
    # ordered = bestellt_am gesetzt UND noch nicht angekommen
    ordered_ids = set()
    for r in models:
        aid = norm(r.get("aircraft_id"))
        bestellt = norm(r.get("bestellt_am"))
        angekommen = norm(r.get("angekommen"))
        if aid and bestellt and not angekommen:
            ordered_ids.add(aid)

    id_to_label = {}
    id_to_manu = {}
    master_ids = set()
    
    for r in pax:
        aid = norm(r.get("aircraft_id"))
        label = norm(r.get("Typ_anzeige")) or aid
        manu = norm(r.get("Hersteller"))
    
        if aid:
            master_ids.add(aid)
            id_to_label[aid] = label
            id_to_manu[aid] = manu


    warning = ""
    if not master_ids:
        warning = f"Keine aircraft_id aus {PASSENGER_CSV.name} gefunden."
        missing_ids = []
        present_in_master = set()
    else:
        present_in_master = present_ids & master_ids

        # Fehlend = nicht vorhanden UND nicht bestellt
        missing_ids = sorted(master_ids - present_ids - ordered_ids)

        # Bestellt aber (noch) nicht vorhanden
        ordered_missing_ids = sorted((master_ids - present_ids) & ordered_ids)


    missing_types = [
        {
            "aircraft_id": aid,
            "Typ_anzeige": id_to_label.get(aid, aid),
            "manufacturer": id_to_manu.get(aid, ""),
            "status": "missing"
        }
        for aid in missing_ids
    ] + [
        {
            "aircraft_id": aid,
            "Typ_anzeige": id_to_label.get(aid, aid),
            "manufacturer": id_to_manu.get(aid, ""),
            "status": "ordered"
        }
        for aid in ordered_missing_ids
    ]


    payload_missing = {
        "schema": "aircraft-labels.missing-types.v3",
        "warning": warning,
        "counts": {
            "master_types": len(master_ids),
            "present_types": len(present_in_master),
            "missing_types": len(missing_ids),
            "ordered_types": len(ordered_missing_ids),
            "models": len(models),
        },
        "missing_types": missing_types,
    }
    OUT_MISSING.write_text(json.dumps(payload_missing, ensure_ascii=False, indent=2), encoding="utf-8")

    # =========================
    # Matrix: Gruppen (airline = Sheet/Gruppe) x Typen (aircraft_type)
    # - present_matrix: nur vorhandene Modelle
    # - ordered_matrix: bestellte Modelle (vorhanden=FALSCH & bestellt_am gesetzt)
    # =========================
    present_counts = defaultdict(lambda: defaultdict(int))
    ordered_counts = defaultdict(lambda: defaultdict(int))
    seen_types = set()

    def is_present(row):
        v = (row.get("vorhanden", "") or "").strip().lower()
        return v in ("wahr", "true", "1", "x", "ja", "yes")

    for r in models:
        group = norm(r.get("airline")) or norm(r.get("airline_code"))
        t = norm(r.get("aircraft_type"))
        if not group or not t:
            continue

        seen_types.add(t)

        bestellt = norm(r.get("bestellt_am"))
        arrived = norm(r.get("angekommen"))
        present = is_present(r)
        ordered = (not present) and bool(bestellt) and (not arrived)

        if present:
            present_counts[group][t] += 1
        elif ordered:
            ordered_counts[group][t] += 1

    groups = sorted(set(list(present_counts.keys()) + list(ordered_counts.keys())))
    types = sorted(seen_types)

    present_matrix = []
    ordered_matrix = []
    for g in groups:
        prow = []
        orow = []
        for t in types:
            prow.append(present_counts[g].get(t, 0))
            orow.append(ordered_counts[g].get(t, 0))
        present_matrix.append(prow)
        ordered_matrix.append(orow)

    payload_matrix = {
        "schema": "aircraft-labels.matrix.v2",
        "counts": {
            "groups": len(groups),
            "types": len(types),
            "models": len(models),
        },
        "groups": groups,
        "types": types,
        "present_matrix": present_matrix,
        "ordered_matrix": ordered_matrix,
    }
    OUT_MATRIX.write_text(json.dumps(payload_matrix, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
