#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import os
import sys
from typing import Any

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(REPO_ROOT, "docs", "data")

KEEP_FILES = {
    "flights.json",
    "flight_routes.json",
    "flights_routes.json",
    "flights_points.json",
    "airports.json",
    "airports_missing.json",
    "matrix.json",
    "missing_types.json",
    "types_overview.json",
    "postcards_enriched.json",
    "stats.json",
}

DRY_RUN = "--apply" not in sys.argv  # default = dry run


def load_json(path: str) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def is_old_model_json(path: str) -> bool:
    try:
        obj = load_json(path)
    except Exception:
        return False
    return isinstance(obj, dict) and bool(str(obj.get("model_id") or "").strip())


def main() -> int:
    if not os.path.isdir(DATA_DIR):
        print(f"[cleanup] missing dir: {DATA_DIR}")
        return 0

    would_delete = []
    kept = []
    skipped = []

    for fn in sorted(os.listdir(DATA_DIR)):
        path = os.path.join(DATA_DIR, fn)

        if not os.path.isfile(path):
            continue

        if not fn.lower().endswith(".json"):
            continue

        if fn in KEEP_FILES:
            kept.append(fn)
            continue

        if is_old_model_json(path):
            would_delete.append(fn)
        else:
            skipped.append(fn)

    print("----- CLEANUP REPORT -----")
    print(f"Mode: {'DRY RUN' if DRY_RUN else 'APPLY'}")
    print()

    print(f"Old model JSONs detected: {len(would_delete)}")
    for fn in would_delete[:20]:
        print(f"  - docs/data/{fn}")
    if len(would_delete) > 20:
        print(f"  ... ({len(would_delete) - 20} more)")

    print()
    print(f"Kept (protected): {len(kept)}")
    print(f"Skipped (non-model json): {len(skipped)}")
    print()

    if not DRY_RUN:
        for fn in would_delete:
            os.remove(os.path.join(DATA_DIR, fn))
        print(f"Deleted {len(would_delete)} files.")

    print("--------------------------")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
