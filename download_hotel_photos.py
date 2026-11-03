#!/usr/bin/env python3
"""Phase 2: download one authentic photo per hotel from its official website.

For each hotel in src/data/hotels.json that has a `photo` target path, fetch the
hotel's official website, extract a best-candidate image (og:image, twitter:image,
or first <img> in header/hero), download it into public/images/hotels/<slug>.jpg,
and save a report of successes/failures.
"""
import json
import os
import re
import sys
import time
import hashlib
import urllib.parse
import requests

ROOT = os.path.dirname(os.path.abspath(__file__))
HOTELS = os.path.join(ROOT, "src", "data", "hotels.json")
OUTDIR = os.path.join(ROOT, "public", "images", "hotels")

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
HEADERS = {"User-Agent": UA, "Accept": "text/html,application/xhtml+xml",
           "Accept-Language": "en-US,en;q=0.9"}

IMG_RE = re.compile(r'<img[^>]+src=["\']([^"\']+)["\']', re.I)
OG_RE = re.compile(r'property=["\']og:image["\'][^>]*content=["\']([^"\']+)', re.I)
TW_RE = re.compile(r'name=["\']twitter:image["\'][^>]*content=["\']([^"\']+)', re.I)
HREF_RE = re.compile(r'<link[^>]+rel=["\'](?:apple-touch-icon|icon)["\'][^>]*href=["\']([^"\']+)', re.I)

VALID_EXT = (".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif")


def norm_url(base, src):
    if not src or not src.strip():
        return None
    src = src.strip()
    if src.startswith("data:"):
        return None
    return urllib.parse.urljoin(base, src)


def get_page(url, timeout=15):
    try:
        r = requests.get(url, headers=HEADERS, timeout=timeout, stream=True)
        if r.status_code != 200:
            return None
        # read up to 3MB of html
        body = r.raw.read(3_000_000, decode_content=True)
        if isinstance(body, bytes):
            body = body.decode("utf-8", "ignore")
        return body
    except Exception:
        return None


def candidates(html, base):
    found = []
    for m in OG_RE.finditer(html):
        found.append(norm_url(base, m.group(1)))
    for m in TW_RE.finditer(html):
        found.append(norm_url(base, m.group(1)))
    for m in HREF_RE.finditer(html):
        found.append(norm_url(base, m.group(1)))
    # hero-ish imgs: first few <img> that don't look like icons/logos
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
        found.append(u)
    return found


def download(url, timeout=20):
    try:
        r = requests.get(url, headers={"User-Agent": UA}, timeout=timeout, stream=True)
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
            # sniff ext from content-type
            ctype = ctype.split(";")[0].strip().lower()
            ext = {".image/jpeg": ".jpg", "image/png": ".png",
                   "image/webp": ".webp", "image/gif": ".gif"}.get(ctype, ".jpg")
        return data, (ext or ".jpg")
    except Exception:
        return None, None


def main(limit=None, only_zones=None, skip_existing=True):
    hotels = json.load(open(HOTELS))["hotels"]
    report = {"ok": [], "failed": [], "skipped": []}
    done = 0
    for h in hotels:
        slug = h.get("slug", "")
        photo = (h.get("photo") or "").strip()
        target = os.path.join(OUTDIR, os.path.basename(photo)) if photo else os.path.join(OUTDIR, slug + ".jpg")
        if skip_existing and os.path.exists(target) and os.path.getsize(target) > 2000:
            report["skipped"].append({"name": h.get("name"), "slug": slug, "photo": os.path.basename(target)})
            continue
        if only_zones and h.get("zone") not in only_zones:
            report["skipped"].append({"name": h.get("name"), "slug": slug, "photo": os.path.basename(target), "reason": "zone not in scope"})
            continue
        url = h.get("website") or ""
        if not url or url == "N/A":
            report["failed"].append({"name": h.get("name"), "slug": slug, "reason": "no website"})
            continue
        html = get_page(url)
        if html is None:
            report["failed"].append({"name": h.get("name"), "slug": slug, "reason": "page fetch failed"})
            done += 1
            if limit and done >= limit:
                break
            continue
        chosen = None
        for cand in candidates(html, url):
            data, ext = download(cand)
            if data:
                # pick the largest/heaviest of candidates
                if chosen is None or len(data) > len(chosen[0]):
                    chosen = (data, ext, cand)
        if chosen is None:
            report["failed"].append({"name": h.get("name"), "slug": slug, "reason": "no usable image found"})
        else:
            data, ext, cand = chosen
            path = target if target.endswith(ext) else os.path.splitext(target)[0] + ext
            with open(path, "wb") as f:
                f.write(data)
            report["ok"].append({"name": h.get("name"), "slug": slug,
                                 "photo": os.path.basename(path), "src": cand, "bytes": len(data)})
            h["photo"] = os.path.relpath(path, os.path.join(ROOT, "public", "images"))
        done += 1
        if limit and done >= limit:
            break
        time.sleep(0.4)  # be polite to hotel servers

    out = os.path.join(ROOT, "reports", "download-report.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w") as f:
        json.dump(report, f, indent=2)
    print(f"ok={len(report['ok'])} failed={len(report['failed'])} "
          f"skipped={len(report['skipped'])}")
    print("report:", out)
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
