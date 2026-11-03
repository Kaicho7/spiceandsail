#!/usr/bin/env python3
"""download_social_photos.py — Fetch hotel photos from Instagram/Facebook profiles.

For hotels whose official website is destined (parked page, SSL error) or blocked
by anti-bot (Cloudflare/ParkLogic), fall back to the hotel's public social
profiles. Instagram and Facebook profile pages embed JSON-LD / og:image meta
that points to real photos on CDN hosts (scontent.cdninstagram.com, etc.).

Usage:
  python3 scripts/download_social_photos.py --ids ZNZ-0002 ZNZ-0009 ZNZ-0012 ZNZ-0021
  python3 scripts/download_social_photos.py --all-remaining
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
REPORT = ROOT / "reports" / "download-report-social.json"

sys.path.insert(0, str(ROOT))
import download_hotel_photos_enhanced as E  # reuse download_with_retry / analyze_image_quality

UA_LIST = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
]

SOCIAL_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
}


def get_social_page(url, timeout=20, max_retries=3):
    """Fetch a social profile page with UA rotation + backoff."""
    for attempt in range(max_retries):
        try:
            headers = SOCIAL_HEADERS.copy()
            headers["User-Agent"] = UA_LIST[attempt % len(UA_LIST)]
            r = requests.get(url, headers=headers, timeout=timeout, stream=True, verify=False)
            if r.status_code == 429:
                time.sleep(2 ** attempt * random_uniform(1, 2))
                continue
            if r.status_code != 200:
                return None, f"http_{r.status_code}"
            body = r.raw.read(8_000_000, decode_content=True)
            if isinstance(body, bytes):
                body = body.decode("utf-8", "ignore")
            return body, None
        except requests.exceptions.SSLError:
            return None, "ssl_error"
        except requests.exceptions.RequestException as e:
            if attempt == max_retries - 1:
                return None, f"req:{type(e).__name__}"
    return None, "retries_exhausted"


def random_uniform(a, b):
    """Small helper so we don't need to import random at top (used in retry)."""
    import random
    return random.uniform(a, b)


def parse_og_images(html):
    """Extract og:image / twitter:image meta tags from social page HTML."""
    images = []
    for m in re.finditer(
        r'<meta[^>]+(?:property|name)=["\'](?:og:image|twitter:image)[^>]+content=["\']([^"\']+)["\']',
        html, re.I,
    ):
        url = m.group(1).strip()
        if url.startswith("http"):
            images.append(url)
    # Some pages put og:image content before the property attr
    for m in re.finditer(
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\'](?:og:image|twitter:image)',
        html, re.I,
    ):
        url = m.group(1).strip()
        if url.startswith("http"):
            images.append(url)
    return list(dict.fromkeys(images))


def parse_jsonld_images(html):
    """Extract image URLs from embedded JSON-LD (og:image frequently present)."""
    urls = []
    # Look for "image" fields inside JSON-LD <script type="application/ld+json">
    for script in re.finditer(
        r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html, re.I | re.S,
    ):
        block = script.group(1)
        # Find http(s) urls inside image arrays
        for m in re.finditer(r'"image"\s*:\s*("(?:https?://[^"]+)"|\[[^\]]*\])', block, re.I):
            raw = m.group(1)
            if raw.startswith('"'):
                urls.append(raw.strip('"'))
            else:
                for u in re.finditer(r'"(https?://[^"]+)"', raw):
                    urls.append(u.group(1))
    return list(dict.fromkeys(urls))


def extract_cdn_images(html):
    """Fallback: pull any scontent.cdninstagram.com / CDN image URLs."""
    urls = re.findall(
        r'https?://(?:scontent\.cdninstagram\.com|scontent-[a-z0-9-]+\.cdninstagram\.com|lookaside\.fbsbx\.com|i\.ibb\.co|static\.(?:fb|instagram)cdn\.com)[^\s"\'<>\\]+',
        html,
    )
    # Keep only likely-photo extensions; strip tracking query noise
    clean = []
    for u in urls:
        path = urllib_parse(u).path.lower()
        if any(path.endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".webp", ".avif")):
            clean.append(u)
    return list(dict.fromkeys(clean))


def urllib_parse(url):
    from urllib.parse import urlparse
    return urlparse(url)


def candidates_from_profile(html):
    """Merge all candidate extraction strategies into ordered path list."""
    cands = []
    cands.extend(parse_og_images(html))
    cands.extend(parse_jsonld_images(html))
    cands.extend(extract_cdn_images(html))
    return list(dict.fromkeys(cands))


def process_social(h):
    """Try Instagram, then Facebook for a single hotel."""
    slug = h.get("slug", "")
    photo = (h.get("photo") or "").strip()
    target = OUTDIR / (os.path.basename(photo) if photo else f"{slug}.jpg")
    if target.exists() and target.stat().st_size > 2000:
        return h, {"status": "skipped", "slug": slug, "name": h.get("name"),
                   "strategy": "already_exists"}

    handles = {"instagram": h.get("instagram"), "facebook": h.get("facebook")}
    if not any(handles.values()):
        return h, {"status": "failed", "slug": slug, "name": h.get("name"),
                   "reason": "no_social_handles", "strategy": "social"}

    for network, url in handles.items():
        if not url or url == "N/A":
            continue
        print(f"    [{network}] {h.get('name')} — {url}")
        html, err = get_social_page(url)
        if err or not html:
            print(f"      page error: {err}")
            continue

        candidates = candidates_from_profile(html)
        # Dedupe + score; keep candidates with hotel-name keyword in URL
        name_kw = [w for w in re.findall(r"[a-z0-9]+", h.get("name", "").lower()) if len(w) > 2]

        # Try each candidate, preferring og:image first
        for cand_url in candidates:
            # quick sanity: must be a real image CDN, not a meta tpl
            if "template" in cand_url.lower() or "static" in cand_url.lower() and "cdn" not in cand_url.lower():
                continue
            data, ext = E.download_with_retry(cand_url)
            if not data:
                continue
            ok, reason = E.analyze_image_quality(data, cand_url)
            if not ok:
                print(f"      rejected {cand_url[:70]} ({reason})")
                continue

            path = OUTDIR / f"{slug}{ext if ext and ext.startswith('.') else '.jpg'}"
            path.write_bytes(data)
            rel = os.path.relpath(path, ROOT / "public" / "images")
            h["photo"] = rel
            print(f"      ✓ saved {rel} ({len(data):,} bytes) via {network}")
            return h, {"status": "ok", "slug": slug, "name": h.get("name"),
                       "photo": path.name, "src": cand_url, "bytes": len(data),
                       "strategy": f"social_{network}"}
        print(f"      no usable image from {network}")
        # Small delay between networks to avoid rate-limit
        time.sleep(1.5)

    return h, {"status": "failed", "slug": slug, "name": h.get("name"),
               "reason": "no_usable_social_image", "strategy": "social"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ids", nargs="*", default=None)
    ap.add_argument("--limit", type=int, default=None)
    args = ap.parse_args()

    data = json.load(open(HOTELS_JSON))
    hotels = data["hotels"] if isinstance(data, dict) else data

    todo = []
    for h in hotels:
        if args.ids and h["id"] not in args.ids:
            continue
        slug = h.get("slug", "")
        photo = (h.get("photo") or "").strip()
        target = OUTDIR / (os.path.basename(photo) if photo else f"{slug}.jpg")
        if target.exists() and target.stat().st_size > 2000:
            continue
        todo.append(h)
        if args.limit and len(todo) >= args.limit:
            break

    print(f"Processing {len(todo)} hotels via social profiles")
    report = {"ok": [], "failed": [], "skipped": []}
    for h in todo:
        h, status = process_social(h)
        report[status["status"]].append(status)
        print(f"  -> [{status['status']}] {h.get('name')}")

    with open(HOTELS_JSON, "w") as f:
        json.dump({"hotels": hotels}, f, indent=2)
    OUTDIR.mkdir(exist_ok=True)
    REPORT.parent.mkdir(exist_ok=True)
    with open(REPORT, "w") as f:
        json.dump(report, f, indent=2)

    print(f"\nSocial download complete: ok={len(report['ok'])} "
          f"failed={len(report['failed'])} skipped={len(report['skipped'])}")
    print("report:", REPORT)


if __name__ == "__main__":
    main()
