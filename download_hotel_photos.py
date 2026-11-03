#!/usr/bin/env python3
"""Phase 2: download one authentic photo per hotel from its official website.

For each hotel in src/data/hotels.json that has a `photo` target path, fetch the
hotel's official website, extract a best-candidate image (og:image, twitter:image,
or first <img> in header/hero), download it into public/images/hotels/<slug>.jpg,
and save a report of successes/failures.

Concurrent (thread pool) so 205 hotels complete in minutes, not hours.
"""
import json
import os
import re
import sys
import time
import hashlib
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

ROOT = os.path.dirname(os.path.abspath(__file__))
HOTELS = os.path.join(ROOT, "src", "data", "hotels.json")
OUTDIR = os.path.join(ROOT, "public", "images", "hotels")
REPORT = os.path.join(ROOT, "reports", "download-report.json")
WORKERS = int(os.environ.get("PHOTO_WORKERS", "6"))

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
HEADERS = {"User-Agent": UA,
           "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
           "Accept-Language": "en-US,en;q=0.9",
           "Accept-Encoding": "gzip, deflate, br",
           "Upgrade-Insecure-Requests": "1",
           "Sec-Fetch-Dest": "document",
           "Sec-Fetch-Mode": "navigate",
           "Sec-Fetch-Site": "none",
           "Sec-Fetch-User": "?1",
           "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
           "Sec-Ch-Ua-Mobile": "?0",
           "Sec-Ch-Ua-Platform": '"Windows"',
           "Referer": "https://www.google.com/"}
# Some hotel sites serve self-signed / misconfigured TLS; those are still fetchable,
# so tolerate cert errors rather than dropping the hotel entirely.
REQUESTS_OPTS = {"verify": False}

IMG_RE = re.compile(r'<img[^>]+src=["\']([^"\']+)["\']', re.I)
OG_RE = re.compile(r'property=["\']og:image["\'][^>]*content=["\']([^"\']+)', re.I)
TW_RE = re.compile(r'name=["\']twitter:image["\'][^>]*content=["\']([^"\']+)', re.I)
HREF_RE = re.compile(r'<link[^>]+rel=["\'](?:apple-touch-icon|icon)["\'][^>]*href=["\']([^"\']+)', re.I)

VALID_EXT = (".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif")

# keywords that indicate a promo/banner/logo rather than a real property photo
BAD_KW = ("cyber", "-monday", "sale", "booknow", "book-now", "promo", "banner",
          "newsletter", "subscribe", "campaign", "offer", "deal", "voucher",
          "logo", "favicon", "sprite", "sponsor", "advert", "1080x", "banner-",
          "header-bg", "bg-", "background", "cta-", "call-to-action",
          "hero-bg", "quote", "testimonial", "map-", "icon-", "icon_")


def norm_url(base, src):
    if not src or not src.strip():
        return None
    src = src.strip()
    if src.startswith("data:"):
        return None
    return urllib.parse.urljoin(base, src)


def get_page(url, timeout=8):
    err = None
    try:
        r = requests.get(url, headers=HEADERS, timeout=timeout, stream=True, **REQUESTS_OPTS)
        code = r.status_code
        if code != 200:
            return None, f"http_{code}"
        body = r.raw.read(3_000_000, decode_content=True)
        if isinstance(body, bytes):
            body = body.decode("utf-8", "ignore")
        return body, "ok"
    except requests.exceptions.SSLError as e:
        err = "ssl_error"
    except requests.exceptions.ConnectTimeout:
        err = "connect_timeout"
    except requests.exceptions.ReadTimeout:
        err = "read_timeout"
    except requests.exceptions.ConnectionError as e:
        estr = str(e).lower()
        if "name or service not known" in estr or "getaddrinfo" in estr:
            err = "dns_failed"
        else:
            err = "conn_error"
    except Exception:
        err = "unknown"
    return None, err


def candidates(html, base):
    found = []
    for m in OG_RE.finditer(html):
        found.append(norm_url(base, m.group(1)))
    for m in TW_RE.finditer(html):
        found.append(norm_url(base, m.group(1)))
    for m in HREF_RE.finditer(html):
        found.append(norm_url(base, m.group(1)))
    for i, m in enumerate(IMG_RE.finditer(html)):
        if i >= 30:
            break
        u = norm_url(base, m.group(1))
        if not u:
            continue
        url = urllib.parse.urlparse(u)
        path = url.path.lower()
        if any(x in path for x in ("logo", "icon", "favicon", ".svg", "sprite", "avatar")):
            continue
        if any(kw in path for kw in BAD_KW):
            continue
        found.append(u)
    return found


def download(url, timeout=20):
    try:
        r = requests.get(url, headers={"User-Agent": UA}, timeout=timeout, stream=True, **REQUESTS_OPTS)
        if r.status_code != 200:
            return None, None
        ctype = r.headers.get("Content-Type", "")
        if "image" not in ctype.lower():
            return None, None
        size = 0
        chunks = []
        cap = 6_000_000
        for ch in r.iter_content(65536):
            chunks.append(ch)
            size += len(ch)
            if size > cap:
                return None, None
        data = b"".join(chunks)
        if size < 2000:  # too small to be a real photo
            return None, None
        ext = os.path.splitext(urllib.parse.urlparse(url).path)[1].lower()
        if ext not in VALID_EXT:
            ctype = ctype.split(";")[0].strip().lower()
            ext = {"image/jpeg": ".jpg", "image/png": ".png",
                   "image/webp": ".webp", "image/gif": ".gif"}.get(ctype, ".jpg")
        return data, (ext or ".jpg")
    except Exception:
        return None, None


def process_hotel(h):
    """Download a single hotel's photo. Returns (hotel, status_dict)."""
    slug = h.get("slug", "")
    photo = (h.get("photo") or "").strip()
    target = os.path.join(OUTDIR, os.path.basename(photo)) if photo else os.path.join(OUTDIR, slug + ".jpg")

    if os.path.exists(target) and os.path.getsize(target) > 2000:
        return h, {"status": "skipped", "slug": slug, "name": h.get("name"),
                   "photo": os.path.basename(target)}

    url = h.get("website") or ""
    if not url or url == "N/A":
        return h, {"status": "failed", "slug": slug, "name": h.get("name"), "reason": "no website"}

    html, code = get_page(url)
    if html is None:
        return h, {"status": "failed", "slug": slug, "name": h.get("name"), "reason": code}

    chosen = None
    for cand in candidates(html, url):
        data, ext = download(cand)
        if not data:
            continue
        parsed = urllib.parse.urlparse(cand)
        name = os.path.basename(parsed.path).lower()
        if any(bad in name for bad in BAD_KW):
            continue
        if ext not in (".jpg", ".jpeg", ".png", ".webp"):
            continue
        if chosen is None or len(data) > len(chosen[0]):
            chosen = (data, ext, cand)

    if chosen is None:
        return h, {"status": "failed", "slug": slug, "name": h.get("name"), "reason": "no usable image found"}

    data, ext, cand = chosen
    path = target if target.endswith(ext) else os.path.splitext(target)[0] + ext
    with open(path, "wb") as f:
        f.write(data)
    h["photo"] = os.path.relpath(path, os.path.join(ROOT, "public", "images"))
    return h, {"status": "ok", "slug": slug, "name": h.get("name"),
               "photo": os.path.basename(path), "src": cand, "bytes": len(data)}


def main(limit=None, only_zones=None, skip_existing=True):
    data = json.load(open(HOTELS))
    hotels = data["hotels"] if isinstance(data, dict) and "hotels" in data else data

    todo = []
    for h in hotels:
        slug = h.get("slug", "")
        photo = (h.get("photo") or "").strip()
        target = os.path.join(OUTDIR, os.path.basename(photo)) if photo else os.path.join(OUTDIR, slug + ".jpg")
        if skip_existing and os.path.exists(target) and os.path.getsize(target) > 2000:
            continue
        if only_zones and h.get("zone") not in only_zones:
            continue
        todo.append(h)
        if limit and len(todo) >= limit:
            break

    report = {"ok": [], "failed": [], "skipped": []}
    processed = 0

    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futs = {ex.submit(process_hotel, h): h for h in todo}
        for fut in as_completed(futs):
            h, status = fut.result()
            processed += 1
            report[status["status"]].append(status)
            if processed % 10 == 0 or processed == len(todo):
                print(f"  progress {processed}/{len(todo)}  "
                      f"ok={len(report['ok'])} failed={len(report['failed'])} "
                      f"skipped={len(report['skipped'])}", flush=True)
                with open(REPORT, "w") as f:
                    json.dump(report, f, indent=2)

    # persist hotel photo fields back to disk
    with open(HOTELS, "w") as f:
        json.dump({"hotels": hotels}, f, indent=2)

    os.makedirs(os.path.dirname(REPORT), exist_ok=True)
    with open(REPORT, "w") as f:
        json.dump(report, f, indent=2)

    print(f"ok={len(report['ok'])} failed={len(report['failed'])} "
          f"skipped={len(report['skipped'])}")
    print("report:", REPORT)
    return report


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--zones", nargs="*", default=None)
    ap.add_argument("--redownload", action="store_true")
    args = ap.parse_args()
    only = set(args.zones) if args.zones else None
    main(limit=args.limit, only_zones=only, skip_existing=not args.redownload)
