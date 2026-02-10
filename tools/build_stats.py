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
OUT_TYPES = OUT_DIR / "types_overview.json"


def read_csv(path: Path, delimiter=";"):
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f, delimiter=delimiter))


def norm(s) -> str:
    return (s or "").strip()


def is_present(row) -> bool:
    v = (row.get("vorhanden", "") or "").strip().lower()
    return v in ("wahr", "true", "1", "x", "ja", "yes")


def is_ordered(row) -> bool:
    """
    Bestellt = bestellt_am gesetzt UND noch nicht angekommen UND NICHT vorhanden
    """
    bestellt = norm(row.get("bestellt_am"))
    angekommen = norm(row.get("angekommen"))
    present = is_present(row)
    return (not present) and bool(bestellt) and (not angekommen)


def main():
    models = read_csv(MODELS_CSV, delimiter=";")
    pax = read_csv(PASSENGER_CSV, delimiter=";")

    # =========================
    # Missing types (stable by aircraft_id; display Typ_anzeige)
    # =========================
    present_ids = set()
    ordered_ids = set()

    for r in models:
        aid = norm(r.get("aircraft_id"))
        if not aid:
            continue
        if is_present(r):
            present_ids.add(aid)
        if is_ordered(r):
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
        ordered_missing_ids = []
    else:
        present_in_master = present_ids & master_ids

        # Fehlend = nicht vorhanden UND nicht bestellt
        missing_ids = sorted(master_ids - present_ids - ordered_ids)

        # Bestellt aber (noch) nicht vorhanden
        ordered_missing_ids = sorted((master_ids - present_ids) & ordered_ids)

    missing_types = (
        [
            {
                "aircraft_id": aid,
                "Typ_anzeige": id_to_label.get(aid, aid),
                "manufacturer": id_to_manu.get(aid, ""),
                "status": "missing",
            }
            for aid in missing_ids
        ]
        + [
            {
                "aircraft_id": aid,
                "Typ_anzeige": id_to_label.get(aid, aid),
                "manufacturer": id_to_manu.get(aid, ""),
                "status": "ordered",
            }
            for aid in ordered_missing_ids
        ]
    )

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
    OUT_MISSING.write_text(
        json.dumps(payload_missing, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # =========================
    # Matrix: Gruppen (airline = Sheet/Gruppe) x Typen (aircraft_type)
    # - present_matrix: nur vorhandene Modelle
    # - ordered_matrix: bestellte Modelle (vorhanden=FALSCH & bestellt_am gesetzt)
    # =========================
    present_counts = defaultdict(lambda: defaultdict(int))
    ordered_counts = defaultdict(lambda: defaultdict(int))
    seen_types = set()

    for r in models:
        group = norm(r.get("airline")) or norm(r.get("airline_code"))
        t = norm(r.get("aircraft_id"))
        if not group or not t:
            continue

        seen_types.add(t)

        if is_present(r):
            present_counts[group][t] += 1
        elif is_ordered(r):
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
    OUT_MATRIX.write_text(
        json.dumps(payload_matrix, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # =========================
    # Types overview (master from passenger_aircraft_full)
    # - 1 row per aircraft_id
    # - counts: owned / ordered / total
    # - drilldown: group + airlines
    # - wingtip: has_wingtip = Wingtip != NONE
    # =========================
    pax_by_id = {}
    manufacturers_set = set()
    wingtip_values = set()

    for r in pax:
        aid = norm(r.get("aircraft_id"))
        if not aid:
            continue
        typ = norm(r.get("Typ_anzeige")) or aid
        manu = norm(r.get("Hersteller"))
        wingtip = norm(r.get("Wingtip")).upper()
        pax_by_id[aid] = {
            "aircraft_id": aid,
            "typ_anzeige": typ,
            "manufacturer": manu,
            "wingtip": wingtip,
            "has_wingtip": (wingtip != "" and wingtip != "NONE"),
        }
        if manu:
            manufacturers_set.add(manu)
        if wingtip:
            wingtip_values.add(wingtip)

    # counts per aircraft_id -> group -> airline_row
    owned_by_type = defaultdict(int)
    ordered_by_type = defaultdict(int)

    group_airline_counts = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: {"owned": 0, "ordered": 0})))

    for r in models:
        aid = norm(r.get("aircraft_id"))
        if not aid:
            continue

        group = norm(r.get("airline")) or norm(r.get("airline_code"))
        airline_row = norm(r.get("airline_row")) or group

        if is_present(r):
            owned_by_type[aid] += 1
            group_airline_counts[aid][group][airline_row]["owned"] += 1
        elif is_ordered(r):
            ordered_by_type[aid] += 1
            group_airline_counts[aid][group][airline_row]["ordered"] += 1

    def type_status(owned: int, ordered: int) -> str:
        total = owned + ordered
        if total == 0:
            return "missing"
        if owned > 0 and ordered > 0:
            return "mixed"
        if owned > 0:
            return "owned"
        return "ordered"

    items = []
    master_ids_sorted = sorted(
        pax_by_id.keys(),
        key=lambda x: (pax_by_id[x].get("typ_anzeige", "").lower(), x),
    )

    for aid in master_ids_sorted:
        base = pax_by_id[aid]
        owned = owned_by_type.get(aid, 0)
        ordered = ordered_by_type.get(aid, 0)
        total = owned + ordered

        # build drilldown list
        group_list = []
        for g in sorted(group_airline_counts[aid].keys(), key=lambda s: s.lower()):
            airlines_map = group_airline_counts[aid][g]
            airlines_list = []
            g_owned = 0
            g_ordered = 0

            for al in sorted(airlines_map.keys(), key=lambda s: s.lower()):
                o = airlines_map[al]["owned"]
                od = airlines_map[al]["ordered"]
                airlines_list.append(
                    {
                        "airline": al,
                        "owned": o,
                        "ordered": od,
                        "total": o + od,
                    }
                )
                g_owned += o
                g_ordered += od

            group_list.append(
                {
                    "group": g,
                    "owned": g_owned,
                    "ordered": g_ordered,
                    "total": g_owned + g_ordered,
                    "airlines": airlines_list,
                }
            )

        items.append(
            {
                "aircraft_id": aid,
                "typ_anzeige": base.get("typ_anzeige", aid),
                "type_key": (base.get("typ_anzeige", aid) or aid).lower(),
                "manufacturer": base.get("manufacturer", ""),
                "wingtip": base.get("wingtip", ""),
                "has_wingtip": bool(base.get("has_wingtip", False)),
                "status": type_status(owned, ordered),
                "owned_count": owned,
                "ordered_count": ordered,
                "total_count": total,
                "airline_group_counts": group_list,
            }
        )

    payload_types = {
        "schema": "aircraft-labels.types-overview.v1",
        "generated_at": "",  # optional; UI zeigt es nicht zwingend
        "master_count": len(pax_by_id),
        "with_any_models": sum(1 for x in items if (x.get("total_count", 0) or 0) > 0),
        "missing": sum(1 for x in items if (x.get("total_count", 0) or 0) == 0),
        "filters": {
            "manufacturers": sorted(manufacturers_set, key=lambda s: s.lower()),
            "statuses": ["all", "missing", "owned", "ordered", "mixed"],
            "has_wingtip": ["all", "true", "false"],
        },
        "default_sort": "type_az",
        "sort_modes": ["type_az", "owned_desc", "ordered_desc", "manufacturer_az"],
        "items": items,
    }

    OUT_TYPES.write_text(
        json.dumps(payload_types, ensure_ascii=False, indent=2), encoding="utf-8"
    )


if __name__ == "__main__":
    main()
