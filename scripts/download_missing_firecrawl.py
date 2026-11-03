#!/usr/bin/env python3
"""download_missing_firecrawl.py

Use Firecrawl (JS-rendered / anti-bot scraping) to fetch photos for hotels the
plain-requests downloader could not get (Cloudflare 403, ParkLogic, 429, dead DNS,
parked pages, etc.).

Reuses the image-quality scoring/analysis logic from download_hotel_photos_enhanced.py.

Strategy per hotel:
  1. Extract from the hotel website via Firecrawl scrape (rawHtml).
  2. Score candidate image URLs with the enhanced module's score_image_candidate.
  3. Download the best-scored candidate; verify quality via analyze_image_quality.
  4. Save as public/images/hotels/<slug>.jpg (or matching ext).

Usage:
  python3 scripts/download_missing_firecrawl.py                    # all missing hotels
  python3 scripts/download_missing_firecrawl.py --ids ZNZ-0002 ZNZ-0008
  python3 scripts/download_missing_firecrawl.py --limit 5
"""

import argparse
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).parent.parent))
import download_hotel_photos_enhanced as E  # reused scoring/analysis

V = Path(__file__).parent.parent
HOTELS_JSON = V / "src" / "data" / "hotels.json"
OUTDIR = V / "public" / "images" / "hotels"
REPORT = V / "reports" / "download-report-firecrawl.json"

def load_env():
    env = {}
    p = V / ".env"
    if p.exists():
        for line in p.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip()
    return env

ENV = load_env()
FIRECRAWL_KEY = ENV.get("FIRECRAWL_API_KEY") or os.environ.get("FIRECRAWL_API_KEY")
FC = "https://api.firecrawl.dev/v1/scrape"

IMG_URL_RE = re.compile(r'https?://[^\s"\')\\<>]+\.(?:jpg|jpeg|png|webp|avif|gif)', re.I)

def firecrawl_html(url, timeout=90):
    """Scrape page HTML via Firecrawl. Returns (html, error|None)."""
    payload = {"url": url, "formats": ["rawHtml", "markdown"], "onlyMainContent": False}
    for attempt in range(2):
        try:
            body = dict(payload)
            if attempt > 0:
                body["skipTlsVerification"] = True
            r = requests.post(
                FC,
                headers={"Authorization": f"Bearer {FIRECRAWL_KEY}", "Content-Type": "application/json"},
                json=body,
                timeout=timeout,
            )
            if r.status_code != 200:
                # don't retry on 200; but a 500 may be transient TLS — retry once
                if attempt == 0:
                    continue
                return None, f"http_{r.status_code}"
            data = r.json()
            if not data.get("success"):
                # HTTPS errors are the TLS/skip-tls case; retry with skipTlsVerification
                if attempt == 0:
                    continue
                return None, data.get("status") or data.get("error") or "fc_not_success"
            d = data.get("data", {})
            html = d.get("rawHtml") or d.get("html") or ""
            md = d.get("markdown") or ""
            return html + "\n" + md, None
        except requests.exceptions.RequestException as e:
            return None, f"fc_err:{type(e).__name__}"
    return None, "fc_retries_exhausted"

def find_image_urls(html, base):
    urls = []
    for m in IMG_URL_RE.finditer(html):
        urls.append(m.group(0))
    # dedupe preserving order
    return list(dict.fromkeys(urls))

def score_and_download(h, html, base):
    """Score candidates, download best that passes quality checks.
    Returns (path_rel, src, bytes) on success else (None, None, None)."""
    candidates = find_image_urls(html, base)
    if not candidates:
        return None, None, None
    scored = [(u, E.score_image_candidate(u, html)) for u in candidates]
    scored.sort(key=lambda x: x[1], reverse=True)
    slug = h["slug"]
    for u, score in scored:
        if score < 7:
            continue
        data, ext = E.download_with_retry(u)
        if not data:
            continue
        ok, reason = E.analyze_image_quality(data, u)
        if not ok:
            continue
        target = OUTDIR / f"{slug}{ext if ext and ext.startswith('.') else ('.jpg')}"
        target.write_bytes(data)
        rel = os.path.relpath(target, V / "public" / "images")
        return rel, u, len(data)
    return None, None, None

def process_hotel(h):
    slug = h["slug"]
    photo = (h.get("photo") or "").strip()
    target = OUTDIR / (os.path.basename(photo) if photo else f"{slug}.jpg")
    if target.exists() and target.stat().st_size > 2000:
        return h, {"status": "skipped", "slug": slug, "name": h.get("name"), "strategy": "already_exists"}

    url = h.get("website") or ""
    if not url or url == "N/A":
        return h, {"status": "failed", "slug": slug, "name": h.get("name"), "reason": "no_website"}

    html, err = firecrawl_html(url)
    if err or not html:
        return h, {"status": "failed", "slug": slug, "name": h.get("name"), "reason": err or "empty_html", "strategy": "firecrawl"}

    rel, src, nbytes = score_and_download(h, html, url)
    if not rel:
        return h, {"status": "failed", "slug": slug, "name": h.get("name"), "reason": "no_usable_image", "strategy": "firecrawl"}

    h["photo"] = rel
    return h, {"status": "ok", "slug": slug, "name": h.get("name"),
               "photo": os.path.basename(rel), "src": src, "bytes": nbytes,
               "strategy": "firecrawl"}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ids", nargs="*", default=None)
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--workers", type=int, default=3)
    args = ap.parse_args()

    if not FIRECRAWL_KEY:
        print("FIRECRAWL_API_KEY not found in .env or env", file=sys.stderr)
        sys.exit(1)

    data = json.load(open(HOTELS_JSON))
    hotels = data["hotels"] if isinstance(data, dict) else data

    todo = []
    for h in hotels:
        if args.ids and h["id"] not in args.ids:
            continue
        slug = h["slug"]
        photo = (h.get("photo") or "").strip()
        target = OUTDIR / (os.path.basename(photo) if photo else f"{slug}.jpg")
        if target.exists() and target.stat().st_size > 2000:
            continue
        todo.append(h)
        if args.limit and len(todo) >= args.limit:
            break

    print(f"Firecrawl processing {len(todo)} missing hotels (workers={args.workers})")
    report = {"ok": [], "failed": [], "skipped": []}
    processed = 0

    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(process_hotel, h): h for h in todo}
        for fut in as_completed(futs):
            h, status = fut.result()
            processed += 1
            report[status["status"]].append(status)
            if processed % 5 == 0 or processed == len(todo):
                print(f"  progress {processed}/{len(todo)} ok={len(report['ok'])} "
                      f"failed={len(report['failed'])}", flush=True)

    with open(HOTELS_JSON, "w") as f:
        json.dump({"hotels": hotels}, f, indent=2)

    OUTDIR.mkdir(exist_ok=True)
    REPORT.parent.mkdir(exist_ok=True)
    with open(REPORT, "w") as f:
        json.dump(report, f, indent=2)

    print(f"\nFirecrawl complete: ok={len(report['ok'])} failed={len(report['failed'])} "
          f"skipped={len(report['skipped'])}")
    print("report:", REPORT)

if __name__ == "__main__":
    main()
