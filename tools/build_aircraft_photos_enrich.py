#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import os
import time
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

MODELS_DIR = os.path.join(REPO_ROOT, "docs", "data", "models")
OUT_PATH = os.path.join(REPO_ROOT, "docs", "data", "aircraft_photos_enriched.json")

SLEEP_SECONDS = 1.0
TIMEOUT = 25

FORCE_REBUILD = os.environ.get("FORCE_REBUILD", "").strip() == "1"

# We allow these common sources; you can extend later
ALLOWED_HOSTS = {
    "www.jetphotos.com",
    "jetphotos.com",
    "www.planespotters.net",
    "planespotters.net",
    "airport-data.com",
    "www.airport-data.com",
}

UA = "aircraft-labels photo enrichment (personal collection; polite; contact via repo)"


def load_json(path: str) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: str, obj: Any) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)


def norm(s: Any) -> str:
    return str(s or "").strip()


def extract_og_image(soup: BeautifulSoup, base_url: str) -> Optional[str]:
    og = soup.find("meta", attrs={"property": "og:image"})
    if og and og.get("content"):
        return urljoin(base_url, og["content"].strip())
    # some sites use name="twitter:image"
    tw = soup.find("meta", attrs={"name": "twitter:image"})
    if tw and tw.get("content"):
        return urljoin(base_url, tw["content"].strip())
    return None


def host_allowed(url: str) -> bool:
    try:
        from urllib.parse import urlparse
        h = urlparse(url).netloc.lower()
        return (h in ALLOWED_HOSTS) or h.endswith(".planespotters.net") or h.endswith(".jetphotos.com")
    except Exception:
        return False


def scrape_thumb(url: str) -> Dict[str, Any]:
    res = requests.get(url, timeout=TIMEOUT, headers={"User-Agent": UA})
    res.raise_for_status()
    soup = BeautifulSoup(res.text, "html.parser")
    thumb = extract_og_image(soup, url)
    return {
        "source_url": url,
        "thumb_url": thumb,
    }


def collect_models() -> List[Dict[str, str]]:
    """
    Returns list of dict: {model_id, photo_url}
    """
    out: List[Dict[str, str]] = []
    if not os.path.isdir(MODELS_DIR):
        return out

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
        photo_url = norm(d.get("photo"))  # field name in your model json
        if not model_id or not photo_url:
            continue

        # allow direct image URLs too (no scraping needed)
        reg = norm(d.get("registration"))
        out.append({"model_id": model_id, "photo_url": photo_url, "registration": reg})
    return out

def fetch_planespotters_api_by_reg(reg: str) -> Optional[Dict[str, Any]]:
    reg = reg.strip()
    if not reg:
        return None
    api_url = f"https://api.planespotters.net/pub/photos/reg/{reg}"
    res = requests.get(api_url, timeout=TIMEOUT, headers={"User-Agent": UA})
    res.raise_for_status()
    j = res.json()
    if not isinstance(j, dict):
        return None
    photos = j.get("photos")
    if not isinstance(photos, list) or not photos:
        return None
    p0 = photos[0] if isinstance(photos[0], dict) else None
    if not p0:
        return None
    tl = p0.get("thumbnail_large") or {}
    thumb = tl.get("src") if isinstance(tl, dict) else None
    link = p0.get("link")  # public page URL
    return {"source_url": link or api_url, "thumb_url": thumb, "api_url": api_url}

def is_direct_image(url: str) -> bool:
    u = url.lower()
    return any(u.endswith(ext) or (ext + "?") in u for ext in [".jpg", ".jpeg", ".png", ".webp"])


def main() -> int:
    existing: Dict[str, Any] = {}
    if os.path.exists(OUT_PATH) and not FORCE_REBUILD:
        try:
            existing = load_json(OUT_PATH)
            if not isinstance(existing, dict):
                existing = {}
        except Exception:
            existing = {}

    models = collect_models()
    print(f"[photos_enrich] models with photo field: {len(models)}")
    print(f"[photos_enrich] existing entries: {len(existing)} (FORCE_REBUILD={FORCE_REBUILD})")

    to_fetch = []
    for m in models:
        mid = m["model_id"]
        if FORCE_REBUILD or mid not in existing:
            to_fetch.append(m)

    print(f"[photos_enrich] to fetch: {len(to_fetch)}")

    for i, m in enumerate(to_fetch, start=1):
        model_id = m["model_id"]
        url = m["photo_url"]
    
        print(f"[photos_enrich] ({i}/{len(to_fetch)}) {model_id} -> {url}")
    
        try:
            # 1) Direct image URLs bleiben wie bisher
            if is_direct_image(url):
                existing[model_id] = {
                    "model_id": model_id,
                    "source_url": url,
                    "thumb_url": url,
                    "scraped_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "direct_image": True,
                }
    
            else:
                # 2) Planespotters API via registration
                reg = norm(m.get("registration"))
                hit = None
    
                try:
                    hit = fetch_planespotters_api_by_reg(reg) if reg else None
                except Exception as e:
                    hit = {"thumb_url": None, "error": f"api reg failed: {e}"}
    
                if hit and hit.get("thumb_url"):
                    existing[model_id] = {
                        "model_id": model_id,
                        **hit,
                        "scraped_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        "direct_image": False,
                        "method": "planespotters_api_reg",
                    }
                else:
                    existing[model_id] = {
                        "model_id": model_id,
                        "source_url": url,
                        "thumb_url": None,
                        "scraped_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        "direct_image": False,
                        "method": "none",
                        "error": (hit.get("error") if isinstance(hit, dict) else None) or "no thumbnail",
                    }
    
        except Exception as e:
            existing[model_id] = {
                "model_id": model_id,
                "source_url": url,
                "thumb_url": None,
                "scraped_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "error": str(e),
            }
    
        time.sleep(SLEEP_SECONDS)
    
    save_json(OUT_PATH, existing)
    print(f"[photos_enrich] wrote: {OUT_PATH} entries={len(existing)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
