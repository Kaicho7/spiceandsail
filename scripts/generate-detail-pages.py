#!/usr/bin/env python3
"""
Generate hotel and attraction detail pages
Workaround for Eleventy/Nunjucks pagination bug on large templates
Run AFTER eleventy build: python3 scripts/generate-detail-pages.py
"""
import json
import re
import pathlib
import urllib.parse
import html

SRC = pathlib.Path(__file__).parent.parent / "src"
DIST = pathlib.Path(__file__).parent.parent / "dist"

hotels_raw = json.loads((SRC / "data" / "hotels.json").read_text())
hotels_all = hotels_raw if isinstance(hotels_raw, list) else hotels_raw.get("hotels", [])
attractions_raw = json.loads((SRC / "data" / "attractions.json").read_text())
attractions_all = attractions_raw if isinstance(attractions_raw, list) else attractions_raw.get("attractions", [])
site = json.loads((SRC / "data" / "site.json").read_text())
hotel_public_rates = json.loads((SRC / "data" / "hotelPublicRates.json").read_text())

PARTNER = {"le-paradis-boutique-hotel-zanzibar", "mkeka-spice-lodge", "stone-town-view-hotel",
           "stonetown-view-hotel", "the-island-stonetown", "the-one-resort-zanzibar"}
ALIAS = {"stonetown-view-hotel": "stone-town-view-hotel"}
BOILER = re.compile(r"^Located in .+\. A popular .+ for visitors to Zanzibar\.$")
wc = lambda s: len(re.findall(r"\S+", s or ""))
MIN = 50

hotels_build = [h for h in hotels_all if h.get("slug") and h.get("name") and not h.get("partnerStay") and h.get("slug") not in PARTNER]
hotels_build = [h for h in hotels_build if wc(h.get("description", "")) >= MIN]
hotels_build = [{**h, "slug": ALIAS.get(h["slug"], h["slug"])} for h in hotels_build]

attractions_build = [a for a in attractions_all if a.get("slug") and a.get("name") and a.get("island") != "Pemba"]
attractions_build = [a for a in attractions_build if wc(a.get("description", "")) >= MIN]

def esc(s): return html.escape(str(s or ""))
def urlenc(s): return urllib.parse.quote(str(s or ""))
def strip_html(s): return re.sub(r"<[^>]*>", "", s or "").strip()
def truncate(s, n=150):
    t = strip_html(s)
    return t if len(t) <= n else t[:n].rstrip() + "..."

def compute_hotel_photo(h):
    photo = h.get("photo")
    if photo and isinstance(photo, str):
        cleaned = photo.lstrip("/")
        norm = cleaned.replace("hotels/", "").replace("images/hotels/", "")
        if (pathlib.Path("/home/efatha/spiceandsail/public/images/hotels") / norm).exists():
            return "/images/hotels/" + norm
    return "/images/image-not-available.svg"

ATTR_IMG = {
    "Baraka Aquarium": "sea-turtles-swimming-zanzibar-water.jpg",
    "Cheetah's Rock": "cheetahs-rock-header.jpg",
    "Forodhani Market (Official)": "zanzibar-night-food-stall-skewers-bread.jpg",
    "Fukuchani Ruins": "zanzibar-ancient-ruins-stone-columns.jpg",
    "House of Wonders": "stone-town-colonial-building-clock-tower.jpg",
    "Jozani Chwaka Bay Nat. Park": "woman-smiling-next-to-monkey-jozani-forest.jpg",
    "Kuza Cave": "people-swimming-turquoise-water-steps.jpg",
    "Salaam Cave Turtle Aquarium": "salaam-cave-turtle-aquarium-kizimkazi.jpg",
    "Mangapwani Slave Chambers": "mangapwani-slave-chamber-coral-cavern.jpg",
    "Menai Bay Conservation": "dhow-boat-turquoise-water-zanzibar.jpg",
    "Mnarani Marine Turtle Pond": "sea-turtles-with-child-zanzibar.jpg",
    "Mrembo Spa & Traditional Services": "mrembo-traditional-spa-swahili-flowers.jpg",
    "Nakupenda Sandbank": "nakupenda-sandbank-tour-pristine-beach-zanzibar.jpg",
    "Old Fort": "stone-town-cannons-sea-boat-tour.jpg",
    "Palace Museum": "palace-museum-beit-al-sahel-stone-town.jpg",
    "Princess Salme Spice Garden": "zanzibar-spice-farm-tour-fresh-nutmeg-cloves.jpg",
    "Prison Island": "giant-tortoises-rocky-terrain.jpg",
    "Seaweed Center Paje": "people-collecting-sea-items-zanzibar-beach.jpg",
    "Spice Farm Tour (Kidichi)": "people-leaf-crowns-tree-outdoor.jpg",
    "Stone Town Food Market": "zanzibar-stone-town-market-fruit-stall.jpg",
    "Zanzibar Butterfly (Park)": "zanzibar-butterfly-centre-tropical.jpg",
    "Zanzibar Horse Riding (Nungwi)": "women-horse-riding-ocean-water-zanzibar.jpg",
    "ZIFF Festival Center": "historical-photos-wall-zanzibar-exhibit.jpg",
    "The Rock Restaurant": "zanzibar-rock-house-with-tourists.jpg",
}
CAT_POOLS = {
    "Dive Center": ["scuba-diver-fish-coral-reef-underwater.jpg", "underwater-coral-reef-fish-zanzibar.jpg"],
    "Water Sports": ["kitesurfing-turquoise-ocean-zanzibar.jpg", "kite-centre-zanzibar-aerial-kitesurfing.jpg"],
    "Attraction": ["stone-town-cannons-sea-boat-tour.jpg", "people-swimming-turquoise-water-steps.jpg"],
    "Restaurant": ["zanzibar-rock-house-with-tourists.jpg", "zanzibar-night-food-stall-skewers-bread.jpg"]
}
def hash_pick(s, arr):
    h = 0
    for ch in s: h = (h * 31 + ord(ch)) & 0xffffffff
    return arr[h % len(arr)]
def attr_photo(name, cat):
    f = ATTR_IMG.get(name)
    if f: return "/images/" + f
    pool = CAT_POOLS.get(cat, CAT_POOLS["Attraction"])
    return "/images/" + hash_pick(name, pool)

hotel_tpl = (pathlib.Path("/home/efatha/spiceandsail/scripts/templates/hotel-detail.html")).read_text()
attr_tpl = (pathlib.Path("/home/efatha/spiceandsail/scripts/templates/attraction-detail.html")).read_text()

def render(tpl, d):
    out = tpl
    for k, v in d.items():
        if v is not None:
            out = out.replace("{{" + k + "}}", v)
        else:
            out = out.replace("{{" + k + "}}", "")
    out = re.sub(r"\{\{#if (\w+)\}\}(.*?)\{\{/if\}\}", lambda m: m.group(2) if d.get(m.group(1)) else "", out, flags=re.DOTALL)
    return out

print(f"Generating {len(hotels_build)} hotel pages...")
for h in hotels_build:
    slug = ALIAS.get(h["slug"], h["slug"])
    photo = compute_hotel_photo(h)
    desc = h.get("description", "")
    data = {
        "title": f"{h['name']} - {h['zone']}, Zanzibar | Spice & Sail",
        "description": truncate(desc),
        "canonicalUrl": f"/hotels/{slug}/",
        "hotelName": h["name"],
        "zone": h["zone"],
        "starRating": h.get("star_rating", ""),
        "category": h.get("category", ""),
        "board": h.get("board", "Bed & Breakfast"),
        "island": h.get("island", ""),
        "website": h.get("website", ""),
        "websiteDomain": h.get("website_domain", ""),
        "email": h.get("email", ""),
        "phone": h.get("phone", ""),
        "tax": str(h.get("taxPerPersonPerNight", "")),
        "description": desc,
        "whatsapp": site.get("contact", {}).get("whatsapp", ""),
        "waMsg": urllib.parse.quote(f"Hi Spice & Sail! I would like to book {h['name']} for 2 guests."),
        "cdnPhotoUrl": photo,
    }
    html = render(hotel_tpl, data)
    out = pathlib.Path("/home/efatha/spiceandsail/dist/hotels") / slug / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html)

print(f"Generating {len(attractions_build)} attraction pages...")
for a in attractions_build:
    slug = a["slug"]
    photo = attr_photo(a["name"], a.get("category", "Attraction"))
    data = {
        "title": f"{a['name']} - {a['zone']}, Zanzibar | Spice & Sail",
        "description": truncate(a.get("description", "")),
        "canonicalUrl": f"/attractions/{slug}/",
        "attractionName": a["name"],
        "zone": a["zone"],
        "island": a.get("island", ""),
        "category": a.get("category", ""),
        "website": a.get("website", ""),
        "description": a.get("description", ""),
        "whatsapp": site.get("contact", {}).get("whatsapp", ""),
        "waMsg": urllib.parse.quote(f"Hi Spice & Sail! I would like to visit {a['name']} in {a['zone']}."),
        "cdnPhotoUrl": photo,
    }
    html = render(attr_tpl, data)
    out = pathlib.Path("/home/efatha/spiceandsail/dist/attractions") / slug / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html)

print(f"Generated {len(hotels_build)} hotel pages and {len(attractions_build)} attraction pages.")