#!/usr/bin/env python3
"""download_achieveglobalsafaris.py — Fallback downloader for photos from achieveglobalsafaris.com.

For hotels where the official website is down or returns no usable photos, fall back
to scraping achieveglobalsafaris.com (a resort aggregator site that hosts hotel
photos for many Zanzibar hotels including Marijani and Isaraya).

Usage:
  python3 scripts/download_achieveglobalsafaris.py --ids ZNZ-0021 ZNZ-0012 ZNZ-0009
  python3 scripts/download_achieveglobalsafaris.py --all-remaining
"""

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

import requests
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

ROOT = Path(__file__).parent.parent
HOTELS_JSON = ROOT / "src" / "data" / "hotels.json"
OUTDIR = ROOT / "public" / "images" / "hotels"
REPORT = ROOT / "reports" / "download-report-achieveglobalsafaris.json"

sys.path.insert(0, str(ROOT))
import download_hotel_photos_enhanced as E  # reuse scoring/analysis

BASE_URL = "https://www.achieveglobalsafaris.com"


def load_env():
    env = {}
    p = ROOT / ".env"
    if p.exists():
        for line in p.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip()
    return env


ENV = load_env()


def get_page(url, headers=None):
    """Fetch page via requests, return (html, error|None)."""
    h = headers or {}
    h.setdefault("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
    r = requests.get(url, headers=h, timeout=15, verify=False)
    if r.status_code != 200:
        return None, f"status_{r.status_code}"
    return r.text, None


def extract_photo_urls(html):
    """Extract hotel photo URLs from AchieveGlobalSafaris page HTML."""
    urls = []
    # Look for image URLs in src attributes and data attributes
    patterns = [
        r'src="([^"]+\.(?:jpg|jpeg|png|webp))"',
        r'data-src="([^"]+\.(?:jpg|jpeg|png|webp))"',
        r'lazyload\(\"([^"]+\.(?:jpg|jpeg|png|webp))\"\)',
        r'background-image:\s*url\(["\']?([^")\']+\.(?:jpg|jpeg|png|webp))["\']?\)',
        r'srcset="([^"]+\.(?:jpg|jpeg|png|webp))',
    ]
    for pat in patterns:
        urls.extend(re.findall(pat, html, re.IGNORECASE))

    # Deduplicate while preserving order
    seen = set()
    unique = []
    for url in urls:
        if url.startswith("//"):
            url = "https:" + url
        if url.startswith("/"):
            url = BASE_URL + url
        if url not in seen:
            seen.add(url)
            unique.append(url)
    return unique


def process_hotel(h):
    name = h.get("name")
    slug = h["slug"]
    target = OUTDIR / f"{slug}.jpg"
    if target.exists() and target.stat().st_size > 2000:
        return h, {"status": "skipped", "slug": slug, "name": name,
                   "reason": "already_exists", "strategy": "achieveglobalsafaris"}

    # Search for the hotel on achieveglobalsafaris.com
    search_url = f"{BASE_URL}/search?q={name.replace(' ', '+')}"
    html, err = get_page(search_url)
    if err:
        return h, {"status": "failed", "slug": slug, "name": name,
                   "reason": f"search_failed: {err}", "strategy": "achieveglobalsafaris"}

    photo_urls = extract_photo_urls(html)
    if not photo_urls:
        # Maybe the hotel page is at a known URL pattern
        # Try typical pattern: /hotel/isaraya-luxury-overwater-villas
        alt_url = f"{BASE_URL}/hotel/{slug.replace(' ', '-')}"
        html2, err2 = get_page(alt_url)
        if html2:
            photo_urls = extract_photo_urls(html2)

    if not photo_urls:
        return h, {"status": "failed", "slug": slug, "name": name,
                   "reason": "no_photos_found", "strategy": "achieveglobalsafaris"}

    # Try each photo URL
    for photo_url in photo_urls[:3]:  # Limit to 3 tries
        print(f"    [{slug}] trying: {photo_url[:90]}")
        data, ext = E.download_with_retry(photo_url)
        if not data:
            continue
        ok, reason = E.analyze_image_quality(data, photo_url)
        if not ok:
            continue

        # Save the photo
        path = OUTDIR / f"{slug}.jpg"
        path.write_bytes(data)
        rel = f"/images/hotels/{path.name}"
        h["photo"] = rel
        print(f"      ✓ saved {rel} ({len(data):,} bytes) from achieveglobalsafaris")
        return h, {"status": "ok", "slug": slug, "name": name,
                   "photo": path.name, "src": photo_url, "bytes": len(data),
                   "strategy": "achieveglobalsafaris"}

    return h, {"status": "failed", "slug": slug, "name": name,
               "reason": "all_candidates_rejected", "strategy": "achieveglobalsafaris"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ids", nargs="*", default=None)
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--sleep", type=float, default=2.0)
    args = ap.parse_args()

    data = json.load(open(HOTELS_JSON))
    hotels = data["hotels"] if isinstance(data, dict) else data

    todo = []
    for h in hotels:
        if args.ids and h["id"] not in args.ids:
            continue
        slug = h["slug"]
        target = OUTDIR / f"{slug}.jpg"
        if target.exists() and target.stat().st_size > 2000:
            continue
        todo.append(h)
        if args.limit and len(todo) >= args.limit:
            break

    results = []
    for h in todo:
        print(f"== {h['id']} {h.get('name')}")
        h2, rec = process_hotel(h)
        results.append(rec)
        print(f"   -> {rec['status']} ({rec.get('reason') or rec.get('photo')})")
        time.sleep(args.sleep)

    # Save report
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(results, indent=2))
    print(f"\nreport: {REPORT}")
    ok = sum(1 for r in results if r["status"] == "ok")
    print(f"ok={ok} failed={len(results)-ok}")

    # Update hotels.json if successful
    if any(r["status"] == "ok" for r in results):
        json.dump(data, open(HOTELS_JSON, "w"), indent=2, ensure_ascii=False)
        print("hotels.json updated (photo paths for successful downloads)")


if __name__ == "__main__":
    main()
