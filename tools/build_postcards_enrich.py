#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import os
import re
import time
from typing import Any, Dict, List, Tuple, Optional
from urllib.parse import urlparse, urljoin

import requests
from bs4 import BeautifulSoup

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS_DATA_DIR = os.path.join(ROOT, "docs", "data")
MODELS_DIR = os.path.join(DOCS_DATA_DIR, "models")  # model json files live in docs/data/models/<MODEL_ID>.json
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

# Labels that exist in jjpostcards "Artikeldetails" but we don't store them.
# They must still act as boundaries, otherwise they get appended to the previous value.
IGNORE_LABELS = {
    "Bemalung, Sticker, spezielle Titel",
    "Land",
    "Aufnahmeort, Datum",
    "Kartenherausgeber, Nummer",
    # optional (harmless boundaries, even if you don't use them)
    "Flughafen",
    "Land Flughafen",
}

ALL_DETAIL_LABELS = set(LABEL_MAP.keys()) | set(IGNORE_LABELS)

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


def parse_size_mm(val: str) -> Optional[Dict[str, int]]:
    v = norm_space(val)
    m = re.search(r"(\d{2,3})\s*[x×]\s*(\d{2,3})\s*mm", v, flags=re.IGNORECASE)
    if not m:
        return None
    return {"w": int(m.group(1)), "h": int(m.group(2))}

def extract_artikeldetails_pairs(html: str) -> Dict[str, str]:
    """
    Parse 'Artikeldetails' as line-based label/value pairs.
    This is robust against DOM nesting, because it uses soup.get_text("\n").
    """
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text("\n")
    lines = [norm_space(l) for l in text.split("\n")]
    lines = [l for l in lines if l]

    # find 'Artikeldetails'
    start = None
    for i, l in enumerate(lines):
        if l.lower() == "artikeldetails":
            start = i + 1
            break
    if start is None:
        return {}

    # stop when the "other items" section starts (seen on jjpostcards pages)
    stop_markers = {
        "16 andere artikel in der gleichen kategorie:",
        "andere artikel in der gleichen kategorie:",
        "unternehmen",
        "ihr konto",
    }

    pairs: Dict[str, str] = {}
    i = start
    while i < len(lines):
        label = lines[i]

        low = label.lower()
        if low in stop_markers:
            break

        if label in ALL_DETAIL_LABELS:
            # collect value lines until next known label or stop marker
            j = i + 1
            vals: List[str] = []
            while j < len(lines):
                nxt = lines[j]
                low2 = nxt.lower()
                if low2 in stop_markers:
                    break
                if nxt in ALL_DETAIL_LABELS:
                    break
                vals.append(nxt)
                j += 1

            if vals and label in LABEL_MAP:
                # take only the first line to avoid "bleed" and keep fields clean
                pairs[label] = vals[0]

            i = j
            continue

        i += 1

    return pairs
    
def extract_og_image(soup: BeautifulSoup, base_url: str) -> Optional[str]:
    og = soup.find("meta", attrs={"property": "og:image"})
    if og and og.get("content"):
        return urljoin(base_url, og["content"].strip())
    return None

def scrape_one(url: str) -> Dict[str, Any]:
    res = requests.get(
        url,
        timeout=TIMEOUT,
        headers={
            "User-Agent": "aircraft-labels postcard enrichment (personal collection; polite; contact via repo)"
        },
    )
    res.raise_for_status()

    soup = BeautifulSoup(res.text, "html.parser")
    pairs = extract_artikeldetails_pairs(res.text)

    thumb_url = extract_og_image(soup, url)

    out: Dict[str, Any] = {
        "source_url": url,
        "thumb_url": thumb_url,
    }

    for jj_label, field in LABEL_MAP.items():
        if jj_label not in pairs:
            continue
        val = pairs[jj_label]

        if field == "year":
            out[field] = parse_year(val)
        elif field == "size":
            out[field] = norm_space(val)
            mm = parse_size_mm(val)
            if mm:
                out["size_mm"] = mm
        else:
            out[field] = norm_space(val)
    
    if out.get("publisher"):
        out["publisher_norm"] = norm_space(out["publisher"])
        
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
        
        if not isinstance(d, dict):
            print(f"[postcards_enrich] skip non-dict json: {fn}")
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
