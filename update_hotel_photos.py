#!/usr/bin/env python3
"""Update hotels.json photo fields with downloaded photos (preserving image file references).
Reads the existing hotels.json, updates the `photo` value to be relative to public/images (like hotels/<slug>.jpg) when available in public/images/hotels/."""
import json
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
HOTELS_JSON = os.path.join(ROOT, "src", "data", "hotels.json")
HOTELS_DIR = os.path.join(ROOT, "public", "images", "hotels")

with open(HOTELS_JSON, "r", encoding="utf-8") as f:
    data = json.load(f)

hotels = data["hotels"]
updated = 0
skipped = 0
for h in hotels:
    slug = h.get("slug")
    old = h.get("photo") or ""
    target_name = f"{slug}.jpg"
    target_path = os.path.join(HOTELS_DIR, target_name)
    if os.path.exists(target_path):
        h["photo"] = os.path.join("hotels", target_name)
        updated += 1
    else:
        if old:
            # keep old path if exists elsewhere? Not in our workflow.
            pass
        skipped += 1

with open(HOTELS_JSON, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f"updated {updated}, skipped {skipped}")
