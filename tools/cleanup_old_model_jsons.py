#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import os
from typing import Any

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(REPO_ROOT, "docs", "data")

# Safety: never delete these filenames even if they look weird
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

def load_json(path: str) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def is_old_model_json(path: str) -> bool:
    """
    Old model JSONs are single-model dicts containing "model_id".
    We only consider JSON files in docs/data (not in subfolders).
    """
    try:
        obj = load_json(path)
    except Exception:
        return False
    return isinstance(obj, dict) and bool(str(obj.get("model_id") or "").strip())

def main() -> int:
    if not os.path.isdir(DATA_DIR):
        print(f"[cleanup] missing dir: {DATA_DIR}")
        return 0

    deleted = 0
    kept = 0
    skipped = 0

    for fn in sorted(os.listdir(DATA_DIR)):
        path = os.path.join(DATA_DIR, fn)

        # only files directly in docs/data
        if not os.path.isfile(path):
            continue

        if not fn.lower().endswith(".json"):
            continue

        if fn in KEEP_FILES:
            kept += 1
            continue

        if is_old_model_json(path):
            os.remove(path)
            deleted += 1
            print(f"[cleanup] deleted old model json: docs/data/{fn}")
        else:
            skipped += 1

    print(f"[cleanup] done. deleted={deleted} kept={kept} skipped={skipped}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
