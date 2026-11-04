#!/usr/bin/env python3
"""
make_contact_sheets.py - Generate 7 labelled contact sheets from the audit manifest.

Reads the most recent site-image-audit-manifest-*.json and emits one HTML contact
sheet per category:
  1. hotels-resorts
  2. attractions-landmarks
  3. beaches-locations
  4. safaris-wildlife
  5. activities
  6. tours-excursions
  7. homepage-promotional

Every image card shows the thumbnail, entity name, verdict and image filename.
All assets are referenced by localhost URL so sheets render while the dev server
is running. No technical corrections are made; this is a reporting artifact only.
"""

import csv
import glob
import html
import json
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

AUDIT_DIR = Path("/home/efatha/spiceandsail/audits")
OUT_DIR = Path("/home/efatha/spiceandsail/audits/contact_sheets")
OUT_DIR.mkdir(parents=True, exist_ok=True)

# --- activity keywords for classifying attraction-type entities ---
ACTIVITY_RE = re.compile(
    r"(diving|dive|kite|surf|scuba|snorkel|horse riding|spa|swim|board|kayak|sail|dhow)",
    re.IGNORECASE,
)
# --- safari keywords for classifying tour-type entities ---
SAFARI_RE = re.compile(r"(safari|mikumi|serengeti|nyerere|wildlife|game drive)", re.IGNORECASE)


def entity_category(em):
    """Return one of the 7 category keys for an entity mapping."""
    et = (em or {}).get("entity_type")
    name = (em or {}).get("entity") or ""
    if et == "hotel":
        return "hotels-resorts"
    if et == "zone":
        return "beaches-locations"
    if et == "attraction":
        return "activities" if ACTIVITY_RE.search(name) else "attractions-landmarks"
    if et == "tour":
        return "safaris-wildlife" if SAFARI_RE.search(name) else "tours-excursions"
    return "homepage-promotional"


def page_is_home(page):
    path = re.sub(r"^https?://[^/]+", "", page).rstrip("/")
    return path == ""


def latest_manifest():
    files = sorted(glob.glob(str(AUDIT_DIR / "site-image-audit-manifest-*.json")))
    if not files:
        sys.exit("no manifest found")
    return files[-1]


def main():
    manifest_path = latest_manifest()
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    buckets = defaultdict(list)
    for img in manifest["images"]:
        em = img.get("entity_mapping") or {}
        if page_is_home(img.get("page", "")):
            cat = "homepage-promotional"
        else:
            cat = entity_category(em)
        buckets[cat].append(img)

    order = [
        "hotels-resorts",
        "attractions-landmarks",
        "beaches-locations",
        "safaris-wildlife",
        "activities",
        "tours-excursions",
        "homepage-promotional",
    ]
    titles = {
        "hotels-resorts": "Hotels & Resorts",
        "attractions-landmarks": "Attractions & Landmarks",
        "beaches-locations": "Beaches & Locations",
        "safaris-wildlife": "Safaris & Wildlife",
        "activities": "Activities",
        "tours-excursions": "Tours & Excursions",
        "homepage-promotional": "Homepage & Promotional",
    }

    # summary CSV
    csv_path = OUT_DIR / "contact_sheet_inventory.csv"
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["category", "entity", "entity_type", "image_file", "page", "verdict"])
        for cat in order:
            for img in buckets[cat]:
                em = img.get("entity_mapping") or {}
                w.writerow([
                    cat,
                    em.get("entity", ""),
                    em.get("entity_type", ""),
                    os.path.basename(img.get("currentSrc", img.get("url", ""))),
                    img.get("page", ""),
                    img.get("verdict", ""),
                ])

    for cat in order:
        imgs = buckets[cat]
        if not imgs:
            continue
        cards = []
        for img in imgs:
            src = img.get("currentSrc") or img.get("url", "")
            name = os.path.basename(src)
            em = img.get("entity_mapping") or {}
            entity = em.get("entity") or "—"
            # Sanitize entity for HTML output
            entity = entity.replace('"', '&quot;').replace("'", '&apos;')
            entity = entity.replace('>', '&gt;').replace('<', '&lt;')
            verdict = img.get("verdict", "")
            badge = {"CORRECT": "ok", "UNCERTAIN": "warn", "INCORRECT": "bad", "UNRESOLVED": "na"}.get(verdict, "")
            cards.append(f"""
            <div class="card {badge}">
              <a href="{html.escape(src)}"><img src="{html.escape(src)}" alt="" loading="lazy"></a>
              <div class="meta">
                <div class="entity">{html.escape(entity)}</div>
                <div class="verdict {badge}">{html.escape(verdict)}</div>
                <div class="file">{html.escape(name)}</div>
              </div>
            </div>""")

        counts = defaultdict(int)
        for img in imgs:
            counts[img.get("verdict", "")] += 1
        summary = " | ".join(f"{k}: {v}" for k, v in sorted(counts.items()))

        html_doc = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Contact Sheet — {titles[cat]} ({len(imgs)})</title>
<style>
  body {{ font-family: system-ui, sans-serif; margin: 24px; background: #fafafa; color: #1a1a1a; }}
  h1 {{ font-size: 20px; border-bottom: 2px solid #333; padding-bottom: 8px; }}
  .summary {{ font-size: 12px; color: #666; margin-bottom: 16px; }}
  .grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; }}
  .card {{ background: #fff; border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden; }}
  .card img {{ width: 100%; height: 140px; object-fit: cover; display: block; }}
  .meta {{ padding: 8px; font-size: 12px; }}
  .entity {{ font-weight: 600; margin-bottom: 2px; }}
  .verdict {{ font-weight: 600; padding: 1px 6px; border-radius: 3px; display: inline-block; margin-bottom: 2px; }}
  .verdict.ok {{ background: #e3f6e3; color: #1a7a1a; }}
  .verdict.warn {{ background: #fff4d6; color: #9a6a00; }}
  .verdict.bad {{ background: #fbe3e3; color: #b00000; }}
  .verdict.na {{ background: #eee; color: #555; }}
  .file {{ color: #888; word-break: break-all; }}
</style>
</head>
<body>
  <h1>Contact Sheet — {titles[cat]}</h1>
  <div class="summary">{len(imgs)} images &nbsp;·&nbsp; {summary}</div>
  <div class="grid">{"".join(cards)}</div>
</body>
</html>"""

        out = OUT_DIR / f"{cat}.html"
        out.write_text(html_doc, encoding="utf-8")
        print(f"wrote {out} ({len(imgs)} images)")


if __name__ == "__main__":
    main()
