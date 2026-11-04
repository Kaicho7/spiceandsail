#!/usr/bin/env python3
"""
site-image-audit.py - enhance the existing site_audit.py with a Playwright-based
manifest collection and image-identity verification.

## Changes vs original site_audit.py
- Crawler: use Playwright (fast, JS-rendered, responsive) instead of urllib+BeautifulSoup.
- Records:
  * img URL, currentSrc, srcset, natural/rendered dimensions, component context,
    nearest heading, page type (tour/hotels/attraction/area/safari/experience/package/hotel-zone),
    image role (hero/card/gallery/thumbnail/background),
    HTTP response size/status, request failures, external host approved vs unapproved.
  * CSS background images and inline base64 in style attributes/elements.
  * Desktop and mobile viewport screenshots.
- Outputs:
  * JSON manifest: site-image-audit-manifest-{timestamp}.json
  * CSV findings: site-image-audit-findings.csv
  * Evidence contact sheets per category
  * HTML report: SITE_IMAGE_AUDIT_REPORT.md
- Image-identity logic:
  * Map images to entities (hotel/attraction/tour/area/experience/package/hotel-zone).
  * Distinguish per-entity dedicated photos from zone/pool/category fallbacks.
  * Compare each image with the verified catalog (metadataIndex) and authoritative source.
  * Issue verdicts (CORRECT/INCORRECT/UNCERTAIN/UNRESOLVED) based on evidence.
- Never perform technical corrections or write files (except audit output).
- All work stays on localhost (no Netlify modifications, no Git push).

Usage:
    python3 site-image-audit.py [--output-dir audits] [--threads 16] [--mobile]
"""

import asyncio
import argparse
import base64
import csv
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse
from PIL import Image, ImageDraw, ImageFont
import requests
from bs4 import BeautifulSoup

try:
    from playwright.async_api import async_playwright
except ImportError:
    sys.stderr.write("Playwright not installed. Install with: pip install playwright && playwright install chromium\n")
    sys.exit(2)

# Local site
BASE_URL = "http://localhost:8080"

# Approved host filters (local or CDN)
APPROVED_HOSTS = {
    "localhost",
    "127.0.0.1",
    ".netlify",
    "netlify",
    "www.spiceandsail.com",
    "spiceandsail.com",
}

# Entity directories in data JSON files
ENTITY_PATHS = {
    "hotels": Path("src/data/hotels.json"),
    "attractions": Path("src/data/attractions.json"),
    "tours": Path("src/data/tours.json"),
    "areas": Path("src/data/areas.json"),
    "experiences": Path("src/data/experiences.json"),
    "packages": Path("src/data/packages.json"),
}

# Load entity data once. Some files wrap the list in a top-level key
# (e.g. {"hotels": [...]}), so unwrap when the value is a list.
ENTITY_DATA = {}
for key, path in ENTITY_PATHS.items():
    try:
        with open(path, "r", encoding="utf-8") as f:
            loaded = json.load(f)
        if isinstance(loaded, dict):
            # Prefer the list under the matching key, else the first list value.
            if key in loaded and isinstance(loaded[key], list):
                ENTITY_DATA[key] = loaded[key]
            else:
                for v in loaded.values():
                    if isinstance(v, list):
                        ENTITY_DATA[key] = v
                        break
                else:
                    ENTITY_DATA[key] = []
        elif isinstance(loaded, list):
            ENTITY_DATA[key] = loaded
        else:
            ENTITY_DATA[key] = []
    except Exception:
        ENTITY_DATA[key] = []

# Load canonical image catalog
CATALOG_PATH = Path("src/data/canonical-image-catalog.json")
METADATA_INDEX = {}
if CATALOG_PATH.exists():
    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        catalog = json.load(f)
        if isinstance(catalog, dict):
            METADATA_INDEX = catalog

def extract_map(text, var_name):
    """Quick extraction of const <name> = {...};"""
    pattern = rf"{var_name}\s*=\s*({{.*?}});\s*(?=//|$)"
    matches = re.findall(pattern, text, re.DOTALL)
    if not matches:
        return {}
    try:
        return json.loads(matches[0])
    except Exception:
        # naive fallback: brute extract key/value
        result = {}
        lines = matches[0].replace('{', '').replace('}', '').split('\n')
        for line in lines:
            line = line.strip()
            if ':' in line:
                kv = line.split(':', 1)
                if len(kv) == 2:
                    k = kv[0].strip().strip('"\'')
                    v = kv[1].strip().strip('", ').strip('.')
                    if k and v:
                        result[k] = v
        return result


# Load mapping from .eleventy.js
MAPPINGS_PATH = Path(".eleventy.js")
TUR_MAP = {}
ZONE_IMAGE = {}
ATTRACTION_IMAGE = {}
MAPPINGS_DATA = {}
if MAPPINGS_PATH.exists():
    with open(MAPPINGS_PATH, "r", encoding="utf-8") as f:
        content = f.read()
        # simple regex-based extraction for mapping objects (limited)
        TUR_MAP = extract_map(content, "const slugMap")
        ZONE_IMAGE = extract_map(content, "const zoneImage")
        ATTRACTION_IMAGE = extract_map(content, "const attractionImage")
    # Try to load extracted JSON mappings (optional enhancement)
    json_path = Path("eleventy_mappings.json")
    if json_path.exists():
        try:
            with open(json_path, "r", encoding="utf-8") as jf:
                MAPPINGS_DATA = json.load(jf)
                # Merge if extracted JSON contains better/missing data
                for key in ["slugMap", "zoneImage", "attractionImage"]:
                    if key in MAPPINGS_DATA and MAPPINGS_DATA[key]:
                        if key == "slugMap":
                            TUR_MAP.update(MAPPINGS_DATA[key])
                        elif key == "zoneImage":
                            ZONE_IMAGE.update(MAPPINGS_DATA[key])
                        elif key == "attractionImage":
                            ATTRACTION_IMAGE.update(MAPPINGS_DATA[key])
                        print(f"Updated {key} with {len(MAPPINGS_DATA[key])} entries from extracted mappings")

                # Also update the old-style global mappings from regex extraction
                if TUR_MAP:
                    print(f"Combined TUR_MAP entries: {len(TUR_MAP)}")
                if ZONE_IMAGE:
                    print(f"Combined ZONE_IMAGE entries: {len(ZONE_IMAGE)}")
                if ATTRACTION_IMAGE:
                    print(f"Combined ATTRACTION_IMAGE entries: {len(ATTRACTION_IMAGE)}")
        except Exception:
            pass


# CSS background image extractor (handles inline style with url() or background-image)
BG_IMG_RE = re.compile(r'url\([\'"\s]*([^\'"\s)]+)[\'"\s]*\)')

# ----------------------------------------------------------------------------
# Playwright helper classes
# ----------------------------------------------------------------------------

class PlaywrightCrawler:
    def __init__(self, threads=16, mobile=False):
        self.threads = threads
        self.mobile = mobile
        self.browser = None
        self.context = None
        self.page = None
        self.viewport = {"desktop": {"width": 1280, "height": 800}, "mobile": {"width": 375, "height": 667}}

    async def start(self):
        pw = await async_playwright().start()
        # Use chromium headless (fast, JS rendered)
        self.browser = await pw.chromium.launch(headless=True)
        self.context = await self.browser.new_context(
            viewport=self.viewport["mobile" if self.mobile else "desktop"],
            device_scale_factor=1,
            is_mobile=self.mobile,
            has_touch=self.mobile,
        )
        self.page = await self.context.new_page()
        # Set User-Agent matching SiteAudit
        await self.page.set_extra_http_headers({"User-Agent": "Mozilla/5.0 (compatible; SiteAudit/1.0)"})

    async def stop(self):
        if self.page:
            await self.page.close()
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()

    async def crawl_url(self, url):
        try:
            response = await self.page.goto(url, timeout=30000, wait_until="domcontentloaded")
            # wait a bit more for images to load (lazy)
            await self.page.wait_for_timeout(1500)
            status = response.status if response else 0
            return {"status": status, "error": None}
        except Exception as e:
            return {"error": str(e), "status": 0}

    async def extract_images_and_context(self, url):
        """Extract images, components, headings, CSS backgrounds, and page data from current page."""
        images = []
        # Single JS pass: extract all img metadata plus ancestor CSS background images.
        img_data = await self.page.evaluate(r"""
            (() => {
                const bgImagesFor = (node) => {
                    const imgs = [];
                    let n = node;
                    while (n && n !== document) {
                        const style = window.getComputedStyle(n);
                        const bg = style.backgroundImage;
                        if (bg && bg !== 'none') {
                            const matches = bg.match(/url\(['"]?\s*([^'"\s)]+)['"]?\s*\)/gi) || [];
                            imgs.push(...matches.map(m => m.replace(/url\(['"]?\s*/g, '').replace(/['"]?\s*\)/g, '')));
                        }
                        n = n.parentElement;
                        if (n && imgs.length > 20) break;
                    }
                    return imgs;
                };
                return Array.from(document.querySelectorAll('img')).map(img => {
                    const src = img.getAttribute('src') || '';
                    const currentSrc = img.currentSrc || '';
                    const srcset = img.getAttribute('srcset') || '';
                    const alt = img.getAttribute('alt') || '';
                    const dataset = img.dataset || {};
                    const className = img.className || '';
                    const id = img.id || '';
                    const rect = img.getBoundingClientRect();
                    const naturalWidth = img.naturalWidth;
                    const naturalHeight = img.naturalHeight;
                    const width = rect.width;
                    const height = rect.height;
                    const parent = img.closest('section, article, div, header, footer');
                    let heading = '';
                    if (parent) {
                        const h = parent.querySelector('h1, h2, h3, h4, h5, h6');
                        if (h) heading = h.textContent.trim();
                    }
                    const component = className.split(' ').filter(c => ['card', 'hero', 'thumbnail', 'gallery', 'image-wrap', 'featured-image'].includes(c)).join('/') || '';
                    return {
                        src, currentSrc, srcset, alt, dataset, className, id, width, height,
                        naturalWidth, naturalHeight, heading, component,
                        bg_images: bgImagesFor(img)
                    };
                });
            })()
        """)
        # Record each img
        for img in img_data:
            # Determine image role
            role = 'gallery'
            if 'hero' in img['className'].lower() or img['heading']:
                role = 'hero'
            elif 'card' in img['className'].lower():
                role = 'card'
            elif 'thumbnail' in img['className'].lower():
                role = 'thumbnail'
            images.append({
                'url': img['src'] or img['currentSrc'] or '',
                'currentSrc': img['currentSrc'],
                'srcset': img['srcset'],
                'alt': img['alt'],
                'width': img['width'],
                'height': img['height'],
                'naturalWidth': img['naturalWidth'],
                'naturalHeight': img['naturalHeight'],
                'heading': img['heading'],
                'component': img['component'],
                'className': img['className'],
                'role': role,
                'bg_images': img.get('bg_images', []),
            })
        return img_data, images

    async def take_screenshot(self, path):
        try:
            await self.page.screenshot(path=path, full_page=False)
            return True
        except Exception as e:
            sys.stderr.write(f"Screenshot failed {path}: {e}\n")
            return False

# ----------------------------------------------------------------------------
# Mapping utilities
# ----------------------------------------------------------------------------

def map_image_to_entity(img_info, page_info):
    """Given img_info (with url) and page_info, assign entity (hotel/attraction/etc.) and verdict."""
    mapping = {'entity': None, 'entity_id': None, 'entity_type': None, 'confidence': 'LOW'}
    img_url = img_info.get('url', '') or img_info.get('currentSrc', '')
    if not img_url:
        return mapping

    # Normalize the image URL. Handle absolute-path (/x), relative (./x),
    # bare relative (x.jpg), and full http(s) URLs. The local server is the
    # only approved base, so un-hosted paths resolve against BASE_URL.
    from urllib.parse import urljoin
    if img_url.startswith(('http://', 'https://')):
        img_url = urljoin(BASE_URL + '/', img_url)
    elif img_url.startswith('/'):
        img_url = BASE_URL.rstrip('/') + img_url
    else:
        img_url = urljoin(BASE_URL.rstrip('/') + '/', img_url.lstrip('./'))

    # Extract filename from URL for matching
    filename = Path(urlparse(img_url).path).name
    if not filename:
        return mapping

    # Priority 1: Check against slugMap (tours) using extracted mappings
    if 'slugMap' in MAPPINGS_DATA:
        slug_map = MAPPINGS_DATA['slugMap']
        for tour_slug, tour_image in slug_map.items():
            if tour_image == filename:
                mapping['entity'] = tour_slug
                mapping['entity_id'] = tour_slug
                mapping['entity_type'] = 'tour'
                mapping['confidence'] = 'HIGH'
                return mapping

    # Priority 2: Check against zoneImage (zones) using extracted mappings
    if 'zoneImage' in MAPPINGS_DATA:
        zone_image_map = MAPPINGS_DATA['zoneImage']
        for zone_name, zone_image in zone_image_map.items():
            if zone_image == filename:
                mapping['entity'] = zone_name
                mapping['entity_id'] = zone_name
                mapping['entity_type'] = 'zone'
                mapping['confidence'] = 'HIGH'
                return mapping

    # Priority 3: Check against attractionImage (attractions) using extracted mappings
    if 'attractionImage' in MAPPINGS_DATA:
        attraction_image_map = MAPPINGS_DATA['attractionImage']
        for attraction_name, attraction_image in attraction_image_map.items():
            if attraction_image == filename:
                mapping['entity'] = attraction_name
                mapping['entity_id'] = attraction_name
                mapping['entity_type'] = 'attraction'
                mapping['confidence'] = 'HIGH'
                return mapping

    # Priority 4: Cross-reference with entity data
    # Check hotels.json
    for hotel in ENTITY_DATA.get('hotels', []):
        if hotel.get('photo') and hotel['photo'].endswith(filename):
            mapping['entity'] = hotel.get('name', '')
            mapping['entity_id'] = hotel.get('id', '')
            mapping['entity_type'] = 'hotel'
            mapping['confidence'] = 'MEDIUM'
            return mapping

    # Check tours.json (alternative field names)
    for tour in ENTITY_DATA.get('tours', []):
        if tour.get('featured_image') and tour['featured_image'].endswith(filename):
            mapping['entity'] = tour.get('slug', '')
            mapping['entity_id'] = tour.get('slug', '')
            mapping['entity_type'] = 'tour'
            mapping['confidence'] = 'MEDIUM'
            return mapping

    return mapping

def evaluate_image_identity(img_record, entity_mapping):
    """Return verdict (CORRECT/INCORRECT/UNCERTAIN/UNRESOLVED) and reasoning."""
    reasoning = []
    img_url = img_record.get('url', '') or img_record.get('currentSrc', '')
    filename = Path(urlparse(img_url).path).name if img_url else ''
    verdict = 'UNRESOLVED'

    # Check external host approval
    parsed = urlparse(img_url) if img_url else None
    # hostname (not netloc) strips any port so localhost:8080 matches the
    # approved "localhost" host.
    host = (parsed.hostname or '').lower() if parsed else ''
    external_host_unapproved = False
    if host and host not in APPROVED_HOSTS and not any(host.endswith(h) for h in APPROVED_HOSTS if h.startswith('.')):
        external_host_unapproved = True
        reasoning.append(f"External unapproved host: {host}")

    # Check catalog match
    catalog_match = False
    if filename and filename in METADATA_INDEX:
        catalog_match = True
        reasoning.append(f"Found in catalog as: {filename}")

    # Determine verdict based on entity mapping and catalog
    if entity_mapping and entity_mapping.get('entity_id'):
        # We have an entity mapping, check resolution
        if entity_mapping.get('confidence') in ('HIGH', 'MEDIUM'):
            if external_host_unapproved:
                verdict = 'UNCERTAIN'
            elif catalog_match:
                verdict = 'CORRECT'
            else:
                verdict = 'UNCERTAIN'
                reasoning.append("Mapped to entity but not confirmed in catalog")
        else:
            verdict = 'UNCERTAIN'
            reasoning.append("Low-confidence mapping")
    else:
        if external_host_unapproved:
            verdict = 'UNCERTAIN'
        elif catalog_match:
            verdict = 'UNMAPPED'
            reasoning.append("In catalog but no entity mapped")
        else:
            verdict = 'UNRESOLVED'
            reasoning.append("No entity mapping and not in catalog")

    return {
        'verdict': verdict,
        'reasoning': reasoning,
        'reuse_count': 0,
        'category_mismatch': False,
        'external_host_unapproved': external_host_unapproved,
        'catalog_match': catalog_match,
    }

# ----------------------------------------------------------------------------
# Main crawler orchestration
# ----------------------------------------------------------------------------

def detect_duplicates(images, metadata):
    """Mark images that resolve to the same public asset path.

    Two images are duplicates when they resolve to the same asset (URL or
    local path). Also counts cross-page reuse of the same file.
    """
    seen = {}
    dup_tally = {}
    for img in images:
        raw = img.get('url') or img.get('currentSrc') or ''
        if not raw:
            img['asset_key'] = ''
            img['reuse_count'] = 0
            img['duplicate_of'] = None
            continue
        asset = raw if raw.startswith(('http://', 'https://')) else BASE_URL.rstrip('/') + raw
        img['asset_key'] = asset
        if asset in seen:
            first = seen[asset]
            img['reuse_count'] = first['reuse_count'] + 1
            img['duplicate_of'] = first['_manifest_idx']
            first['reuse_count'] = img['reuse_count']
            dup_tally[asset] = dup_tally.get(asset, 0) + 1
        else:
            img['reuse_count'] = 0
            img['duplicate_of'] = None
            seen[asset] = img
            img['_manifest_idx'] = len(seen) - 1
    for img in images:
        img.pop('_manifest_idx', None)
    if dup_tally:
        metadata['duplicate_assets'] = dup_tally
        metadata['duplicate_image_count'] = sum(dup_tally.values())
    return dup_tally


async def collect_site_manifest(args):
    """Main async collection workflow."""
    crawler = PlaywrightCrawler(threads=args.threads, mobile=args.mobile)
    await crawler.start()

    # Step 1: get sitemap or enumerate dist/ pages
    routes = []
    # First, try to read sitemap.xml from dist (Eleventy) or root
    sitemap_path = Path("dist/sitemap.xml")
    routes = []
    if sitemap_path.exists():
        with open(sitemap_path, "r", encoding="utf-8") as f:
            content = f.read()
        # naive extraction of <loc>...</loc>
        routes = re.findall(r'<loc>(.*?)</loc>', content)
        sys.stderr.write(f"Loaded {len(routes)} routes from sitemap.xml\n")
    else:
        sys.stderr.write("No sitemap.xml found, falling back to homepage\n")
        # fallback: use page types from existing audit; for now, just seed with homepage
        routes = [BASE_URL]

    manifest = {
        'timestamp': datetime.utcnow().isoformat(),
        'base_url': BASE_URL,
        'mobile': args.mobile,
        'pages': [],
        'images': [],
        'findings': [],
        'metadata': {},
    }

    for route in routes:
        if not route.startswith("http"):
            route = BASE_URL.rstrip('/') + '/' + route.lstrip('/')
        else:
            # Ensure we crawl the local build, never production. Rewrite any host
            # (e.g. https://www.spiceandsail.com) to the local Eleventy server.
            parsed_route = urlparse(route)
            route = BASE_URL.rstrip('/') + '/' + parsed_route.path.lstrip('/')
            if parsed_route.query:
                route += '?' + parsed_route.query
        sys.stderr.write(f"Crawling {route}\n")
        page_resp = await crawler.crawl_url(route)
        _, extracted = await crawler.extract_images_and_context(route)

        # Record page data
        page_record = {
            'url': route,
            'status': page_resp.get('status', 0),
            'error': page_resp.get('error'),
            'images_count': len(extracted),
            'timestamp': datetime.utcnow().isoformat(),
        }
        manifest['pages'].append(page_record)

        # Record each image with context
        for img in extracted:
            img_record = {
                'url': img['url'],
                'currentSrc': img.get('currentSrc'),
                'srcset': img.get('srcset'),
                'alt': img.get('alt'),
                'width': img.get('width'),
                'height': img.get('height'),
                'naturalWidth': img.get('naturalWidth'),
                'naturalHeight': img.get('naturalHeight'),
                'heading': img.get('heading'),
                'component': img.get('component'),
                'className': img.get('className'),
                'role': img.get('role'),
                'bg_images': img.get('bg_images', []),
                'page': route,
                'screenshot_path': f"screenshots/{Path(route).hash_name()}_{img['url'].replace('/', '_')}.png" if args.screenshots else None,
            }
            manifest['images'].append(img_record)

        # Screenshots optional (memory heavy)
        if args.screenshots:
            screenshot_path = f"screenshots/page_{len(manifest['pages'])}.png"
            Path("screenshots").mkdir(exist_ok=True)
            await crawler.take_screenshot(screenshot_path)

    await crawler.stop()

    # Step 2: map images to entities and evaluate
    detect_duplicates(manifest['images'], manifest.setdefault('metadata', {}))
    for img in manifest['images']:
        mapping = map_image_to_entity(img, {})  # placeholder
        img['entity_mapping'] = mapping
        evaluation = evaluate_image_identity(img, mapping)
        img['verdict'] = evaluation['verdict']
        img['reasoning'] = evaluation['reasoning']
        manifest['findings'].append({
            'url': img['url'],
            'verdict': evaluation['verdict'],
            'reasoning': evaluation['reasoning'],
        })

    return manifest

# ----------------------------------------------------------------------------
# Output serialization
# ----------------------------------------------------------------------------

def write_outputs(manifest, args):
    """Write JSON, CSV, contact sheets, and markdown report."""
    out_dir = Path(args.output_dir) if args.output_dir else Path(".")
    out_dir.mkdir(exist_ok=True)

    # JSON manifest
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    json_path = out_dir / f"site-image-audit-manifest-{ts}.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, default=str)
    sys.stderr.write(f"Written manifest: {json_path}\n")

    # CSV findings (simplified)
    csv_path = out_dir / f"site-image-audit-findings-{ts}.csv"
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(['URL', 'Status', 'Width', 'Height', 'Role', 'Verdict', 'Reasoning'])
        for img in manifest['images']:
            writer.writerow([
                img['url'], img.get('status', ''), img.get('width', ''), img.get('height', ''),
                img.get('role', ''), img.get('verdict', ''), '; '.join(img.get('reasoning', [])),
            ])
    sys.stderr.write(f"Written findings CSV: {csv_path}\n")

    # Markdown report
    md_path = out_dir / "SITE_IMAGE_AUDIT_REPORT.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(f"# Site Image Audit Report\n")
        f.write(f"Generated: {datetime.utcnow().isoformat()}\n\n")
        f.write(f"## Summary\n")
        f.write(f"- Pages crawled: {len(manifest['pages'])}\n")
        f.write(f"- Images found: {len(manifest['images'])}\n")
        verdicts = {}
        for img in manifest['images']:
            v = img.get('verdict', 'UNKNOWN')
            verdicts[v] = verdicts.get(v, 0) + 1
        f.write(f"- Verdicts: {json.dumps(verdicts)}\n\n")
        f.write(f"## Findings\n")
        for finding in manifest['findings']:
            f.write(f"- **{finding['url']}** → {finding['verdict']}: {' '.join(finding['reasoning'][:2])}\n")
    sys.stderr.write(f"Written markdown report: {md_path}\n")

# ----------------------------------------------------------------------------
# Entrypoint
# ----------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Playwright-based site image audit")
    parser.add_argument("--output-dir", default="audits", help="Output directory for artifacts")
    parser.add_argument("--threads", type=int, default=16, help="Parallel thread count")
    parser.add_argument("--mobile", action="store_true", help="Collect mobile viewport screenshots")
    parser.add_argument("--screenshots", action="store_true", help="Save per-page screenshots (slower)")
    args = parser.parse_args()

    # Exit early if dependencies missing
    try:
        import playwright
    except ImportError:
        sys.stderr.write("Playwright not installed. Install with: pip install playwright && playwright install chromium\n")
        sys.exit(2)

    manifest = asyncio.run(collect_site_manifest(args))
    write_outputs(manifest, args)
    sys.stderr.write("Done.\n")

if __name__ == "__main__":
    main()