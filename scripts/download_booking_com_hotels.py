#!/usr/bin/env python3
"""download_booking_com_hotels.py — Fallback for hotels hosted on booking.com CDN.

For hotels where the official website fails but booking.com (or similar aggregators)
hold the hotel photos, fall back to scraping booking.com's gallery pages. This covers
hotels like Baraza where the photo URL from Serper points to booking.com.

Usage:
  python3 scripts/download_booking_com_hotels.py --ids ZNZ-0002
  python3 scripts/download_booking_com_hotels.py --all-remaining
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
REPORT = ROOT / "reports" / "download-report-bookingcom.json"

sys.path.insert(0, str(ROOT))
import download_hotel_photos_enhanced as E  # reuse scoring/analysis

BOOKING_CDN = "https://cf.bstatic.com"


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


def get_booking_hotel_id(hotel_name):
    """Try to find a Booking.com hotel ID via search (simple lookup)."""
    url = f"https://www.booking.com/searchresults.html?ss={requests.utils.quote(hotel_name)}"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"}
    r = requests.get(url, headers=headers, timeout=10, verify=False)
    if r.status_code != 200:
        return None
    # Look for hotel ID in hrefs like /hotel/england/xxx.html
    pattern = r'/hotel/[^/]*/(\d+)\.html'
    matches = re.findall(pattern, r.text)
    if matches:
        return matches[0]
    return None


def get_booking_gallery(hotel_id):
    """Fetch the hotel gallery page and extract image URLs."""
    url = f"https://www.booking.com/hotel/{hotel_id}.html"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"}
    r = requests.get(url, headers=headers, timeout=10, verify=False)
    if r.status_code != 200:
        return None, f"status_{r.status_code}"

    html = r.text
    # Try to extract from json-ld
    jsonld_pattern = r'<script type="application/ld\+json">([\s\S]*?)</script>'
    for match in re.finditer(jsonld_pattern, html):
        try:
            data = json.loads(match.group(1))
            if "image" in data:
                img = data["image"]
                if isinstance(img, list):
                    return [i for i in img if i.startswith("http")], None
                elif isinstance(img, str) and img.startswith("http"):
                    return [img], None
        except Exception:
            continue

    # Fallback: regex for common image patterns
    patterns = [
        r'src="([^"]+\.jpg)"',
        r'background-image:\s*url\(["\']?([^")\']+\.jpg)["\']?\)',
        r'lazyload\(\"([^\"]+\.jpg)\"\)',
    ]
    urls = []
    for pat in patterns:
        urls.extend(re.findall(pat, html, re.IGNORECASE))

    # Filter for booking.com images and deduplicate
    booking_urls = []
    seen = set()
    for url in urls:
        if url.startswith("//"):
            url = "https:" + url
        if url.startswith("/"):
            url = BOOKING_CDN + url
        if url.startswith("http") and "bstatic.com" in url and url not in seen:
            seen.add(url)
            booking_urls.append(url)

    return booking_urls, None


def process_hotel(h):
    name = h.get("name")
    slug = h["slug"]
    target = OUTDIR / f"{slug}.jpg"
    if target.exists() and target.stat().st_size > 2000:
        return h, {"status": "skipped", "slug": slug, "name": name,
                   "reason": "already_exists", "strategy": "booking.com"}

    # Try to get booking.com hotel ID
    hotel_id = get_booking_hotel_id(name)
    if not hotel_id:
        return h, {"status": "failed", "slug": slug, "name": name,
                   "reason": "booking_id_not_found", "strategy": "booking.com"}

    print(f"    [{slug}] booking.com hotel ID: {hotel_id}")
    gallery_urls, err = get_booking_gallery(hotel_id)
    if err:
        return h, {"status": "failed", "slug": slug, "name": name,
                   "reason": f"gallery_failed: {err}", "strategy": "booking.com"}

    if not gallery_urls:
        return h, {"status": "failed", "slug": slug, "name": name,
                   "reason": "no_booking_images", "strategy": "booking.com"}

    # Try each image URL
    for photo_url in gallery_urls[:3]:
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
        print(f"      ✓ saved {rel} ({len(data):,} bytes) from booking.com")
        return h, {"status": "ok", "slug": slug, "name": name,
                   "photo": path.name, "src": photo_url, "bytes": len(data),
                   "strategy": "booking.com"}

    return h, {"status": "failed", "slug": slug, "name": name,
               "reason": "all_candidates_rejected", "strategy": "booking.com"}


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
