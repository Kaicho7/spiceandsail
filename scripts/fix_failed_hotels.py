#!/usr/bin/env python3
"""fix_failed_hotels.py

Apply the 4 domain fixes that were previously applied manually to hotels.json.

This script is for reproducibility - it applies the same corrections that were
made to fix the failed hotel photo downloads for:
  • Isaraya Luxury Overwater Villas (ZNZ-0012) - was Konokono's website
  • Konokono Beach Resort (ZNZ-0017) - unchanged except for website
  • Marijani Beach Resort & Spa (ZNZ-0021) - corrected domain and socials
  • Essque Zalu Zanzibar (ZNZ-0008) - corrected domain, email, and socials

These fixes allow the enhanced photo download scripts to correctly target
the updated domains.
"""

import json
from pathlib import Path

FIXES = {
    # ZNZ-0008 - Essque Zalu Zanzibar (was: https://www.essque-zalu.com)
    "ZNZ-0008": {
        "website": "https://www.essquehotels.com",
        "website_domain": "essquehotels.com",
        "email": "reservations@essquehotels.com",
        "facebook": "https://facebook.com/essquezalu",
        "instagram": "https://instagram.com/essquezalu",
    },
    # ZNZ-0012 - Isaraya Luxury Overwater Villas (was: https://www.konokonoresort.com)
    "ZNZ-0012": {
        "website": "https://www.isaraya.com",
        "website_domain": "isaraya.com",
        "email": "reservations@isaraya.com",
        "phone": "+255715100500",
        "facebook": "https://facebook.com/isarayaz",
        "instagram": "https://instagram.com/isarayaz",
    },
    # ZNZ-0017 - Konokono Beach Resort (was: https://www.konokonoresort.com)
    "ZNZ-0017": {
        "website": "https://www.konokonozanzibar.com",
        "website_domain": "konokonozanzibar.com",
        "email": "reservations@konokonozanzibar.com",
    },
    # ZNZ-0021 - Marijani Beach Resort & Spa (was: https://marijanizanzibar.com)
    "ZNZ-0021": {
        "website": "https://marijani.com",
        "website_domain": "marijani.com",
        "email": "info@marijani.com",
        "facebook": "https://facebook.com/marijanizanzibar",
        "instagram": "https://instagram.com/marijanizanzibar",
    },
}

def apply_fixes():
    ROOT = Path(__file__).parent.parent
    HOTELS_JSON = ROOT / "src" / "data" / "hotels.json"

    with open(HOTELS_JSON, "r") as f:
        data = json.load(f)

    hotels = data["hotels"] if isinstance(data, dict) and "hotels" in data else data

    changes_made = False
    for hotel in hotels:
        hotel_id = hotel["id"]
        if hotel_id in FIXES:
            for key, value in FIXES[hotel_id].items():
                if hotel.get(key) != value:
                    old = hotel.get(key)
                    hotel[key] = value
                    print(f"  {hotel_id}: {key} {old!r} → {value!r}")
                    changes_made = True

    if changes_made:
        with open(HOTELS_JSON, "w") as f:
            json.dump({"hotels": hotels}, f, indent=2)
        print(f"✓ Applied fixes for {len([h for h in hotels if h['id'] in FIXES])} hotels")
    else:
        print("✓ All fixes already applied")

    return changes_made

if __name__ == "__main__":
    apply_fixes()