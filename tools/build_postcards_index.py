#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple


REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

MODELS_DIR = os.path.join(REPO_ROOT, "docs", "data", "models")
OUT_PATH = os.path.join(REPO_ROOT, "docs", "data", "postcards_index.json")


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_json(path: str) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: str, obj: Any) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)


def norm(s: Any) -> str:
    return str(s or "").strip()


def collect_from_models() -> Tuple[List[Dict[str, Any]], Dict[str, Dict[str, Any]]]:
    items: List[Dict[str, Any]] = []
    by_id: Dict[str, Dict[str, Any]] = {}

    if not os.path.isdir(MODELS_DIR):
        return items, by_id

    for fn in sorted(os.listdir(MODELS_DIR)):
        if not fn.lower().endswith(".json"):
            continue

        path = os.path.join(MODELS_DIR, fn)
        try:
            d = load_json(path)
        except Exception:
            continue
        if not isinstance(d, dict):
            continue

        model_id = norm(d.get("model_id"))
        pcs = d.get("postcards")
        if not model_id or not isinstance(pcs, list) or not pcs:
            continue

        for pc in pcs:
            if not isinstance(pc, dict):
                continue
            pc_id = norm(pc.get("id"))
            url = norm(pc.get("url"))
            label = norm(pc.get("label"))
            price = pc.get("price", None)

            if not pc_id or not url:
                continue

            entry = {
                "id": pc_id,
                "model_id": model_id,
                "url": url,
            }
            if label:
                entry["label"] = label
            if price not in (None, "", 0, 0.0):
                entry["price"] = price

            items.append(entry)
            # Deduplicate by id (keep first occurrence)
            if pc_id not in by_id:
                by_id[pc_id] = entry

    return items, by_id


def main() -> int:
    items, by_id = collect_from_models()

    out = {
        "generated_at": utc_now_iso(),
        "count_total": len(items),
        "count_unique": len(by_id),
        "items": items,
        "by_id": by_id,
    }

    save_json(OUT_PATH, out)
    print(f"[postcards_index] wrote: {OUT_PATH} total={len(items)} unique={len(by_id)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
