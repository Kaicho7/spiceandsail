#!/usr/bin/env python3
"""fix_progress.py

Check progress on the 8 previously-failed hotels and note which ones now have photos
s via the 4 corrected domains (Isaraya, Konokono, Marijani, Essque) and the
 enhanced scripts.

Also list the remaining anti-bot-blocked hotels that still need browser/
automation strategies.
"""

import json
import os
from pathlib import Path

def main():
    ROOT = Path(__file__).parent.parent
    HOTELS_JSON = ROOT / "src" / "data" / "hotels.json"
    HOTEL_PHOTOS_DIR = ROOT / "public" / "images" / "hotels"

    with open(HOTELS_JSON, "r") as f:
        data = json.load(f)

    hotels = data["hotels"] if isinstance(data, dict) and "hotels" in data else data

    # Hotels that were previously failed and were fixed
    fixed_ids = {"ZNZ-0008", "ZNZ-0012", "ZNZ-0017", "ZNZ-0021"}

    # Hotels that are behind anti-bot protection (Cloudflare 403, ParkLogic, 429, etc.)
    anti_bot_ids = {"ZNZ-0002", "ZNZ-0029", "ZNZ-0034", "ZNZ-0009"}

    print("=== COMPLETED FIXES (updated domains) ===\n")

    for h in hotels:
        if h["id"] not in fixed_ids:
            continue
        slug = h["slug"]
        photo = h.get("photo") or ""
        target = HOTEL_PHOTOS_DIR / (os.path.basename(photo) if photo else f"{slug}.jpg")
        exists = target.exists() and target.stat().st_size > 2000
        print(f"{h['id']} — {h['name']}")
        print(f"  Domain: {h['website']}")
        print(f"  Photo: {photo if photo else '(file expected)'} — {'✓ EXISTS' if exists else '✗ MISSING'}")
        print()

    print("=== ANTI-BOT HOTELS (still need automation) ===\n")

    for h in hotels:
        if h["id"] not in anti_bot_ids:
            continue
        slug = h["slug"]
        photo = h.get("photo") or ""
        target = HOTEL_PHOTOS_DIR / (os.path.basename(photo) if photo else f"{slug}.jpg")
        exists = target.exists() and target.stat().st_size > 2000
        print(f"{h['id']} — {h['name']}")
        print(f"  Domain: {h['website']}")
        print(f"  Photo: {photo if photo else '(file expected)'} — {'✓ EXISTS' if exists else '✗ MISSING'}")
        print(f"  Status: Behind Cloudflare/ParkLogic/429 protection — needs browser automation")
        print()

    print("=== ADDITIONAL MISSING HOTELS (unrelated to previous failure list) ===\n")
    print(f"Total hotels: {len(hotels)}")
    print(f"Hotels with photos: {sum(1 for h in hotels if (h.get('photo') or '').strip())}")
    print(f"Hotels missing photos: {sum(1 for h in hotels if not (h.get('photo') or '').strip())}")
    print()
    print("To fix the remaining missing photos for the anti-bot hotels, consider:")
    print("  • Run the enhanced photo download script with browser automation")
    print("  • Add Selenium/Playwright integration for JavaScript-heavy sites")
    print("  • Use Firecrawl for sites requiring anti-bot bypass")
    print("  • Implement Cloudflare bypass techniques")

if __name__ == "__main__":
    main()