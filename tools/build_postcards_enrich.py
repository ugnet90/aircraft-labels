#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import os
import re
import time
from typing import Any, Dict, List, Tuple, Optional
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS_DATA_DIR = os.path.join(ROOT, "docs", "data")
MODELS_DIR = DOCS_DATA_DIR  # model json files live in docs/data/<MODEL_ID>.json
OUT_PATH = os.path.join(DOCS_DATA_DIR, "postcards_enriched.json")

# Rate limit to be polite
SLEEP_SECONDS = 1.0
TIMEOUT = 25

# Only scrape this domain
ALLOWED_HOSTS = {"jjpostcards.com", "www.jjpostcards.com"}

# Map JJ labels -> our fields (German labels as seen on site)
LABEL_MAP = {
    "Airline": "airline",
    "Flugzeughersteller": "aircraft_manufacturer",
    "Flugzeugtyp": "aircraft_type",
    "Flugzeugtyp genau": "aircraft_type_exact",
    "Registration": "registration",
    "Postkartenherausgeber": "publisher",
    "Erscheinungsjahr": "year",
    "Grösse": "size",
    "Kartenzustand": "condition",
}

# some pages show "Kartenherausgeber, Nummer" etc. – we ignore unless you want it later.


def load_json(path: str) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: str, obj: Any) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)


def is_jjpostcards_url(url: str) -> bool:
    try:
        host = urlparse(url).netloc.lower()
        return host in ALLOWED_HOSTS
    except Exception:
        return False


def norm_space(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())


def parse_year(val: str) -> Optional[int]:
    m = re.search(r"\b(19\d{2}|20\d{2})\b", val or "")
    if not m:
        return None
    try:
        return int(m.group(1))
    except Exception:
        return None


def parse_size(val: str) -> Optional[str]:
    # examples: "150x105 mm", "148x104 mm"
    v = norm_space(val)
    m = re.search(r"(\d{2,3})\s*[x×]\s*(\d{2,3})\s*mm", v, flags=re.IGNORECASE)
    if not m:
        return None
    return f"{m.group(1)}x{m.group(2)} mm"


def extract_artikeldetails_pairs(html: str) -> Dict[str, str]:
    """
    Robust strategy:
    - Find the 'Artikeldetails' heading block
    - Then parse label/value as alternating elements.
    On jjpostcards pages, in the rendered text it appears as:
      Artikeldetails
      Airline
          Alitalia
      ...
    We'll parse the DOM by reading the product description area and walking text blocks.
    """
    soup = BeautifulSoup(html, "html.parser")

    # Attempt 1: look for a container that contains the text "Artikeldetails"
    text_nodes = soup.find_all(string=re.compile(r"^\s*Artikeldetails\s*$", re.IGNORECASE))
    container = None
    for tn in text_nodes:
        container = tn.parent
        if container:
            # climb a bit to get a larger section
            for _ in range(6):
                if container.parent:
                    container = container.parent
            break

    # Fallback to whole page if not found
    root = container if container else soup

    # Grab text lines in reading order
    lines: List[str] = []
    for el in root.find_all(["h1", "h2", "h3", "p", "li", "span", "div"]):
        t = norm_space(el.get_text(" ", strip=True))
        if not t:
            continue
        # keep lines reasonably short; avoid huge duplicates
        if len(t) > 250:
            continue
        lines.append(t)

    # Now find the first occurrence of "Artikeldetails" in lines and parse pairs after it
    pairs: Dict[str, str] = {}
    try:
        start_idx = next(i for i, t in enumerate(lines) if t.lower() == "artikeldetails")
    except StopIteration:
        return pairs

    # after "Artikeldetails", labels and values often appear as separate lines.
    # We'll scan and accept known labels, grabbing the next non-label line as value.
    i = start_idx + 1
    while i < len(lines) - 1:
        label = lines[i]
        if label in LABEL_MAP:
            # value may be on next line; sometimes next line repeats label, so skip empties/duplicates
            j = i + 1
            while j < len(lines):
                val = lines[j]
                if not val or val.lower() == "artikeldetails":
                    j += 1
                    continue
                # stop if we hit another label
                if val in LABEL_MAP:
                    break
                pairs[label] = val
                break
            i = j
        i += 1

    return pairs


def scrape_one(url: str) -> Dict[str, Any]:
    res = requests.get(
        url,
        timeout=TIMEOUT,
        headers={
            "User-Agent": "aircraft-labels postcard enrichment (personal collection; polite; contact via repo)"
        },
    )
    res.raise_for_status()
    pairs = extract_artikeldetails_pairs(res.text)

    out: Dict[str, Any] = {
        "source_url": url,
    }

    for jj_label, field in LABEL_MAP.items():
        if jj_label not in pairs:
            continue
        val = pairs[jj_label]

        if field == "year":
            out[field] = parse_year(val)
        elif field == "size":
            out[field] = parse_size(val) or norm_space(val)
        else:
            out[field] = norm_space(val)

    return out


def collect_postcards_from_models() -> List[Tuple[str, str, str]]:
    """
    Returns list of (postcard_id, model_id, url)
    """
    items: List[Tuple[str, str, str]] = []

    if not os.path.isdir(MODELS_DIR):
        return items

    for fn in os.listdir(MODELS_DIR):
        if not fn.lower().endswith(".json"):
            continue
        if fn in ("index.json", "stats.json", "flights.json", "flight_routes.json", "airports_missing.json", "postcards_enriched.json"):
            continue

        path = os.path.join(MODELS_DIR, fn)
        try:
            d = load_json(path)
        except Exception:
            continue

        model_id = str(d.get("model_id") or "").strip()
        pcs = d.get("postcards")
        if not model_id or not isinstance(pcs, list):
            continue

        for pc in pcs:
            if not isinstance(pc, dict):
                continue
            pc_id = str(pc.get("id") or "").strip()
            url = str(pc.get("url") or "").strip()
            if not pc_id or not url:
                continue
            if not is_jjpostcards_url(url):
                continue
            items.append((pc_id, model_id, url))

    return items


def main() -> int:
    existing: Dict[str, Any] = {}
    if os.path.exists(OUT_PATH):
        try:
            existing = load_json(OUT_PATH)
            if not isinstance(existing, dict):
                existing = {}
        except Exception:
            existing = {}

    postcards = collect_postcards_from_models()

    # Deduplicate by postcard_id, keep first URL
    by_id: Dict[str, Tuple[str, str]] = {}
    for pc_id, model_id, url in postcards:
        if pc_id not in by_id:
            by_id[pc_id] = (model_id, url)

    to_fetch = [(pc_id, by_id[pc_id][0], by_id[pc_id][1]) for pc_id in by_id.keys() if pc_id not in existing]

    print(f"[postcards_enrich] found postcards: {len(by_id)} ; existing: {len(existing)} ; to fetch: {len(to_fetch)}")

    for n, (pc_id, model_id, url) in enumerate(to_fetch, start=1):
        print(f"[postcards_enrich] ({n}/{len(to_fetch)}) {pc_id} {model_id} -> {url}")
        try:
            data = scrape_one(url)
            data["postcard_id"] = pc_id
            data["model_id"] = model_id
            data["scraped_at_utc"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            existing[pc_id] = data
        except Exception as e:
            existing[pc_id] = {
                "postcard_id": pc_id,
                "model_id": model_id,
                "source_url": url,
                "error": str(e),
                "scraped_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }

        time.sleep(SLEEP_SECONDS)

    save_json(OUT_PATH, existing)
    print(f"[postcards_enrich] wrote: {OUT_PATH} entries={len(existing)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
