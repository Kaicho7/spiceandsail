#!/usr/bin/env python3
"""serper_aggressive_fallback.py — Aggressive Serper fallback for stubborn hotels.

The main download_serper_images.py breaks after the first query that returns results
and only tries a handful of the top candidates. For hotels where that failed, this
script:
  * issues several diverse Serper queries,
  * dedupes every image candidate URL,
  * tries downloading each in turn, accepting the first that passes the shared
    quality analyzer,
  * writes it to public/images/hotels/<slug>.jpg and updates hotels.json.

Usage:
  python3 scripts/serper_aggressive_fallback.py --ids ZNZ-0044 ZNZ-0055 ...
"""

import argparse
import json
import sys
import time
from pathlib import Path

import requests
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

ROOT = Path(__file__).parent.parent
HOTELS_JSON = ROOT / "src" / "data" / "hotels.json"
OUTDIR = ROOT / "public" / "images" / "hotels"
REPORT = ROOT / "reports" / "download-fallback-aggressive.json"

sys.path.insert(0, str(ROOT))
import download_hotel_photos_enhanced as E

SERPER_IMAGES = "https://google.serper.dev/images"


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
SERPER_KEY = ENV.get("SERPER_API_KEY") or os.environ.get("SERPER_API_KEY")


def serper_images(query, n=10):
    try:
        r = requests.post(
            SERPER_IMAGES,
            headers={"X-API-KEY": SERPER_KEY, "Content-Type": "application/json"},
            json={"q": query, "num": n},
            timeout=30,
        )
        if r.status_code != 200:
            return [], f"http_{r.status_code}"
        data = r.json()
        imgs = data.get("images") or []
        urls = [i.get("imageUrl") for i in imgs if i.get("imageUrl")]
        # Prefer hotel-aggregator / property CDN hostnames
        hotel_hosts = [
            "tripadvisor.com", "bstatic.com", "booking.com", "expedia.com",
            "priceline.com", "tablethotels.com", "hotels.com", "agoda.com",
            "pix.com", "cloudinary.com",
        ]
        good = [u for u in urls if any(h in u.lower() for h in hotel_hosts)]
        fallback = [u for u in urls if u not in good]
        return good + fallback, None
    except Exception as e:  # noqa: BLE001
        return [], f"exc:{e}"


def process_hotel(h):
    name = h.get("name")
    slug = h["slug"]
    target = OUTDIR / f"{slug}.jpg"

    queries = [
        f"{name} Zanzibar",
        f"{name} Zanzibar hotel",
        f"{name} resort photo",
        f"{name} bedroom pool",
        f"{name} lodge",
    ]

    candidates = {}  # url -> query
    for q in queries:
        urls, err = serper_images(q)
        if err:
            print(f"  [{slug}] serper {err} for {q!r}")
            continue
        # daily quota / rate-limit guard
        time.sleep(0.8)
        for u in urls:
            if u and u not in candidates:
                candidates[u] = q
        if not urls:
            continue
        print(f"  [{slug}] {q!r} -> {len(urls)} candidates (total {len(candidates)})")

    if not candidates:
        return h, {"status": "failed", "slug": slug, "reason": "no_candidates", "strategy": "serper_aggressive"}

    # order: prefer higher-scoring first
    ordered = sorted(candidates.keys(), key=lambda u: E.score_image_candidate(u), reverse=True)

    attempt = 0
    for u in ordered:
        attempt += 1
        data, ext = E.download_with_retry(u)
        if not data:
            continue
        ok, reason = E.analyze_image_quality(data, u)
        if ok:
            target.write_bytes(data)
            rel = f"/images/hotels/{target.name}"
            h["photo"] = rel
            return h, {"status": "ok", "slug": slug, "photo": target.name,
                       "src": u, "bytes": len(data), "attempts": attempt,
                       "strategy": "serper_aggressive"}
        if attempt <= 6:
            print(f"  [{slug}] candidate #{attempt} failed quality ({reason}): {u[:80]}")

    return h, {"status": "failed", "slug": slug, "reason": "all_candidates_failed",
               "attempts": attempt, "candidates": len(ordered), "strategy": "serper_aggressive"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ids", nargs="*", default=None)
    ap.add_argument("--sleep", type=float, default=1.0)
    args = ap.parse_args()

    if not SERPER_KEY:
        print("SERPER_API_KEY not found", file=sys.stderr)
        sys.exit(1)

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

    results = []
    for h in todo:
        print(f"== {h['id']} {h.get('name')}")
        h2, rec = process_hotel(h)
        results.append(rec)
        print(f"   -> {rec['status']} ({rec.get('reason') or rec.get('photo')})")
        time.sleep(args.sleep)

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(results, indent=2))
    print(f"\nreport: {REPORT}")
    ok = sum(1 for r in results if r["status"] == "ok")
    print(f"ok={ok} failed={len(results)-ok}")

    if any(r["status"] == "ok" for r in results):
        json.dump(data, open(HOTELS_JSON, "w"), indent=2, ensure_ascii=False)
        print("hotels.json updated")


if __name__ == "__main__":
    main()
