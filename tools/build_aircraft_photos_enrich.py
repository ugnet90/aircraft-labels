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
        airline_row = norm(d.get("airline_row") or d.get("airline"))
        aircraft_type = norm(d.get("aircraft_type") or d.get("typ_anzeige"))
        aircraft_id = norm(d.get("aircraft_id"))
        
        out.append({
            "model_id": model_id,
            "photo_url": photo_url,
            "registration": reg,
            "airline_row": airline_row,
            "aircraft_type": aircraft_type,
            "aircraft_id": aircraft_id,
        })
    return out

def _norm_match(s: str) -> str:
    s = (s or "").strip().lower()
    # cheap normalization
    s = " ".join(s.split())
    return s

def _dig(d: dict, *path, default=None):
    cur = d
    for p in path:
        if not isinstance(cur, dict) or p not in cur:
            return default
        cur = cur[p]
    return cur

def _pick_thumb(photo: dict) -> Optional[str]:
    # tolerate different keys
    for k in ("thumbnail_large", "thumbnail", "thumbnail_medium", "thumbnail_small"):
        v = photo.get(k)
        if isinstance(v, dict):
            src = v.get("src")
            if src:
                return str(src).strip()
    return None

from urllib.parse import urlparse

def _slug_tokens_from_link(photo: dict) -> List[str]:
    link = photo.get("link") or ""
    try:
        path = urlparse(str(link)).path or ""
    except Exception:
        path = str(link)

    slug = path.strip("/").split("/")[-1]  # last part
    slug = _norm_match(slug)
    # tokens split on hyphen and other separators
    tokens = [t for t in slug.replace("_", "-").split("-") if t]
    return tokens

def _slug_text_from_link(photo: dict) -> str:
    tokens = _slug_tokens_from_link(photo)
    return " ".join(tokens)
    
def _photo_airline_name(photo: dict) -> str:
    v = _norm_match(
        _dig(photo, "airline", "name", default="")
        or _dig(photo, "operator", "name", default="")
        or photo.get("airline", "")
        or photo.get("operator", "")
        or ""
    )
    if v:
        return v

    # Fallback: parse from link slug (e.g. ".../d-abdq-eurowings-airbus-a320-214")
    slug = _slug_text_from_link(photo)
    # airline is typically a token group before manufacturer tokens; we just return slug text as "airline-ish"
    # and let scoring check substring matches.
    return slug

def _photo_type_text(photo: dict) -> str:
    v = _norm_match(
        _dig(photo, "aircraft", "type", default="")
        or _dig(photo, "aircraft", "model", default="")
        or _dig(photo, "aircraft", "name", default="")
        or photo.get("type", "")
        or ""
    )
    if v:
        return v

    # Fallback: parse from link slug
    return _slug_text_from_link(photo)

def _score_photo(photo: dict, want_airline: str, want_type: str) -> int:
    s = 0
    got_airline = _photo_airline_name(photo)
    got_type = _photo_type_text(photo)

    wa = _norm_match(want_airline)
    wa_slug = wa.replace(" ", "-")
    wt = _norm_match(want_type)
    wt_slug = wt.replace(" ", "-")

    # airline match
    if wa and got_airline:
        if wa == got_airline:
            s += 6
        elif wa in got_airline or got_airline in wa:
            s += 4
        elif wa_slug and wa_slug in got_airline:
            s += 4

    # type match (very tolerant)
    if wt and got_type:
        if wt == got_type:
            s += 6
        elif wt_slug and wt_slug in got_type:
            s += 4            
        else:
            # handle "Airbus A320-200" vs "Airbus A320"
            # give points if key tokens overlap
            tokens_w = [t for t in wt.replace("-", " ").split() if len(t) >= 3]
            tokens_g = [t for t in got_type.replace("-", " ").split() if len(t) >= 3]
            overlap = sum(1 for t in tokens_w if t in tokens_g)
            if overlap >= 2:
                s += 4
            elif overlap == 1:
                s += 2

    # prefer entries that actually have a thumbnail
    if _pick_thumb(photo):
        s += 2

    return s

def fetch_planespotters_api_by_reg(reg: str, want_airline: str = "", want_type: str = "") -> Optional[Dict[str, Any]]:
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

    best = None
    best_score = -1
    for p in photos:
        if not isinstance(p, dict):
            continue
        sc = _score_photo(p, want_airline, want_type)
        if sc > best_score:
            best_score = sc
            best = p

    if not isinstance(best, dict):
        return None

    thumb_url = _pick_thumb(best)
    link = best.get("link")  # public page URL
    return {
        "source_url": str(link or api_url),
        "thumb_url": thumb_url,
        "api_url": api_url,
        "picked_score": best_score,
        # optional debug: keep what we matched against (small + helpful)
        "picked_airline": _photo_airline_name(best),
        "picked_type": _photo_type_text(best),
    }

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
                    want_airline = norm(m.get("airline_row"))
                    want_type = norm(m.get("aircraft_type"))
                    
                    hit = fetch_planespotters_api_by_reg(reg, want_airline=want_airline, want_type=want_type) if reg else None
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
