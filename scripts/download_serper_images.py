#!/usr/bin/env python3
"""download_serper_images.py — Fetch hotel photos via Serper Google-image search.

For hotels where the official website is dead/SSL-broken and social profiles expose
no extractable photos, fall back to Serper's Google image search: query the hotel's
name + "Zanzibar", collect image candidates, score them, download the best-scoring
one, and verify it with the shared quality analyzer.

Usage:
  python3 scripts/download_serper_images.py --ids ZNZ-0012 ZNZ-0021 ZNZ-0002 ZNZ-0009
  python3 scripts/download_serper_images.py --all-remaining
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

import requests
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

ROOT = Path(__file__).parent.parent
HOTELS_JSON = ROOT / "src" / "data" / "hotels.json"
OUTDIR = ROOT / "public" / "images" / "hotels"
REPORT = ROOT / "reports" / "download-report-serper.json"

sys.path.insert(0, str(ROOT))
import download_hotel_photos_enhanced as E  # reuse scoring/download/analysis

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
    """Call Serper images endpoint. Returns list of candidate image URLs."""
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
    return urls, None


def process_hotel(h):
    name = h.get("name")
    slug = h["slug"]
    target = OUTDIR / f"{slug}.jpg"

    queries = [
        f"{name} Zanzibar",
        f"{name} hotel photo Hanzibar",
        f"{name} beach resort photo",
    ]

    candidates = []
    for q in queries:
        urls, err = serper_images(q)
        if err:
            print(f"  [{slug}] serper {err} for {q!r}")
            continue
        for u in urls:
            candidates.append((E.score_image_candidate(u), u, q))
        print(f"  [{slug}] serper {q!r} -> {len(urls)} image candidates")
        if not urls:
            time.sleep(1.5)
            continue
        # a response with results is enough; don't burn quota on more queries
        break

    candidates.sort(key=lambda t: t[0], reverse=True)
    if not candidates:
        return h, {"status": "failed", "slug": slug, "name": name, "reason": "no_candidates", "strategy": "serper"}

    best_url = candidates[0][1]
    data = E.download_with_retry(best_url)
    if data is None:
        return h, {"status": "failed", "slug": slug, "name": name, "reason": "download_failed", "src": best_url, "strategy": "serper"}

    ok, reason = E.analyze_image_quality(data, best_url)
    if not ok:
        # try next candidates
        for score, u, q in candidates[1:]:
            data = E.download_with_retry(u)
            if data is None:
                continue
            ok, reason = E.analyze_image_quality(data, u)
            if ok:
                best_url = u
                break
    if not ok:
        return h, {"status": "failed", "slug": slug, "name": name, "reason": reason, "src": best_url, "strategy": "serper"}

    target.write_bytes(data)
    rel = f"/images/hotels/{target.name}"
    h["photo"] = rel
    return h, {"status": "ok", "slug": slug, "name": name,
               "photo": target.name, "src": best_url, "bytes": len(data),
               "strategy": "serper"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ids", nargs="*", default=None)
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--sleep", type=float, default=2.0)
    args = ap.parse_args()

    if not SERPER_KEY:
        print("SERPER_API_KEY not found in .env or env", file=sys.stderr)
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
        if args.limit and len(todo) >= args.limit:
            break

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
    print(f"ok={sum(1 for r in results if r['status']=='ok')} failed={sum(1 for r in results if r['status']!='ok')}")

    if any(r["status"] == "ok" for r in results):
        json.dump(data, open(HOTELS_JSON, "w"), indent=2, ensure_ascii=False)
        print("hotels.json updated (photo paths for successful downloads)")


if __name__ == "__main__":
    main()
