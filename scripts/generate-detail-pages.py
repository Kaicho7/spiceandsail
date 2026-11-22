#!/usr/bin/env python3
"""
Generate hotel and attraction detail pages as Eleventy source files.

Run BEFORE the Eleventy build:
    python3 scripts/generate-detail-pages.py
"""
import html
import json
import pathlib
import re
import urllib.parse

ROOT = pathlib.Path(__file__).parent.parent
SRC = ROOT / "src"
PAGES_HOTELS = SRC / "pages" / "hotels"
PAGES_ATTR = SRC / "pages" / "attractions"

hotels_raw = json.loads((SRC / "data" / "hotels.json").read_text())
hotels_all = hotels_raw if isinstance(hotels_raw, list) else hotels_raw.get("hotels", [])
attractions_raw = json.loads((SRC / "data" / "attractions.json").read_text())
attractions_all = attractions_raw if isinstance(attractions_raw, list) else attractions_raw.get("attractions", [])
site = json.loads((SRC / "data" / "site.json").read_text())
public_rates = json.loads((SRC / "data" / "hotelPublicRates.json").read_text())
rates_data = json.loads((SRC / "data" / "hotelRates.json").read_text())
research_data = json.loads((SRC / "data" / "partnerPropertyResearch.json").read_text())
catalogue = json.loads((SRC / "data" / "concierge-catalogue.json").read_text())
tours_raw = json.loads((SRC / "data" / "tours.json").read_text())
tours_all = tours_raw if isinstance(tours_raw, list) else tours_raw.get("tours", [])

PARTNER = {"le-paradis-boutique-hotel-zanzibar", "mkeka-spice-lodge", "stone-town-view-hotel",
           "stonetown-view-hotel", "the-island-stonetown", "the-one-resort-zanzibar"}
ALIAS = {"stonetown-view-hotel": "stone-town-view-hotel"}
BOILER = re.compile(r"^Located in .+\. A popular .+ for visitors to Zanzibar\.$")
MIN = 50
SITE_URL = site.get("url", "https://spiceandsail.com").rstrip("/")
WHATSAPP = site.get("contact", {}).get("whatsapp", "")

public_by_slug = {h.get("slug"): h for h in public_rates.get("hotels", []) if h.get("slug")}
rates_by_slug = rates_data.get("bySlug", {})
research_by_slug = research_data.get("properties", {})
package_by_hotel = {
    s.get("hotelSlug"): s.get("slug")
    for s in catalogue.get("services", [])
    if s.get("type") == "package" and s.get("hotelSlug") and s.get("slug")
}
tour_pages = {p.stem for p in (SRC / "pages" / "tours").glob("*.njk")}


def wc(s):
    return len(re.findall(r"\S+", s or ""))


def strip_html(s):
    return re.sub(r"<[^>]*>", "", s or "").strip()


def clean_text(s):
    return re.sub(r"\s+", " ", strip_html(s)).strip()


def esc(s):
    return html.escape(str(s or ""), quote=True)


def truncate(s, n=155):
    t = clean_text(s)
    if len(t) <= n:
        return t
    cut = t[: n - 3].rsplit(" ", 1)[0].rstrip(".,;:")
    return cut + "..."


def yaml_str(s):
    return json.dumps(clean_text(s), ensure_ascii=False)


def make_title(name, zone):
    for candidate in (f"{name} — {zone} | Spice & Sail", f"{name} | Spice & Sail"):
        if len(candidate) <= 70:
            return candidate
    return name[:60].rstrip() + " | Spice & Sail"


def json_ld(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def parse_star(value):
    m = re.search(r"(\d)", str(value or ""))
    return int(m.group(1)) if m else None


def compute_hotel_photo(h):
    for photo in (h.get("photo"), (public_by_slug.get(h.get("_rate_slug"), {}) or {}).get("photo")):
        if photo and isinstance(photo, str):
            cleaned = photo.lstrip("/")
            norm = cleaned.replace("hotels/", "").replace("images/hotels/", "")
            if (ROOT / "public" / "images" / "hotels" / norm).exists():
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
    "Restaurant": ["zanzibar-rock-house-with-tourists.jpg", "zanzibar-night-food-stall-skewers-bread.jpg"],
}


def hash_pick(s, arr):
    h = 0
    for ch in s:
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    return arr[h % len(arr)]


def attr_photo(name, cat):
    f = ATTR_IMG.get(name)
    if f:
        return "/images/" + f
    pool = CAT_POOLS.get(cat, CAT_POOLS["Attraction"])
    return "/images/" + hash_pick(name, pool)


def render(tpl, d):
    out = tpl
    for k, v in d.items():
        out = out.replace("{{" + k + "}}", "" if v is None else str(v))
    out = re.sub(r"\{\{#if (\w+)\}\}(.*?)\{\{/if\}\}", lambda m: m.group(2) if d.get(m.group(1)) else "", out, flags=re.DOTALL)
    return out


def render_rate_section(rate_slug, public, rates):
    public = public or {}
    rates = rates or {}
    if not public and not rates:
        return "", None, None

    parts = ["<h2>Rates and seasons</h2>"]
    from_rate = None
    tax = public.get("taxPerPersonPerNight")
    board = public.get("board") or rates.get("basis") or ""
    status = public.get("ratesStatus")

    seasons = rates.get("seasons") or []
    if seasons and isinstance(seasons[0], dict) and "rooms" in seasons[0]:
        room_min = {}
        for season in seasons:
            for room in season.get("rooms", []):
                rt = room.get("roomType")
                if not rt:
                    continue
                hb = room.get("ourHalfBoard")
                ai = room.get("ourAllInclusive")
                slot = room_min.setdefault(rt, {})
                if hb is not None:
                    slot["hb"] = min(slot.get("hb", hb), hb)
                if ai is not None:
                    slot["ai"] = min(slot.get("ai", ai), ai)
        parts.append('<div class="table-wrapper"><table class="rate-table"><thead><tr><th>Room</th><th>Half board from</th><th>All inclusive from</th></tr></thead><tbody>')
        for rt, vals in room_min.items():
            hb, ai = vals.get("hb"), vals.get("ai")
            if hb is not None:
                from_rate = hb if from_rate is None else min(from_rate, hb)
            parts.append(f"<tr><td>{esc(rt)}</td><td>{'$' + str(hb) if hb is not None else 'On request'}</td><td>{'$' + str(ai) if ai is not None else 'On request'}</td></tr>")
        parts.append("</tbody></table></div>")
        parts.append('<h3>Season calendar</h3><div class="table-wrapper"><table class="rate-table"><thead><tr><th>Season</th><th>Dates</th><th>Half board from</th><th>All inclusive from</th></tr></thead><tbody>')
        for season in seasons:
            hbs = [r.get("ourHalfBoard") for r in season.get("rooms", []) if r.get("ourHalfBoard") is not None]
            ais = [r.get("ourAllInclusive") for r in season.get("rooms", []) if r.get("ourAllInclusive") is not None]
            parts.append(f"<tr><td>{esc(season.get('label', ''))}</td><td>{esc(season.get('dates', ''))}</td><td>{'$' + str(min(hbs)) if hbs else 'On request'}</td><td>{'$' + str(min(ais)) if ais else 'On request'}</td></tr>")
        parts.append("</tbody></table></div>")
    elif seasons:
        rooms = rates.get("rooms", [])
        discount = rates.get("discount", 0) or 0
        parts.append('<div class="table-wrapper"><table class="rate-table"><thead><tr><th>Room</th><th>Direct rate / night</th><th>OTA anchor</th></tr></thead><tbody>')
        for room in rooms:
            rt, our, ota = room.get("roomType"), room.get("ourRate"), room.get("otaAnchor")
            if our is not None:
                from_rate = our if from_rate is None else min(from_rate, our)
            parts.append(f"<tr><td>{esc(rt)}</td><td>{'$' + str(our) if our is not None else 'On request'}</td><td>{'$' + str(ota) if ota is not None else '—'}</td></tr>")
        parts.append("</tbody></table></div>")
        room_names = [r.get("roomType") for r in rooms if r.get("roomType")]
        if room_names:
            parts.append('<h3>Season calendar</h3><div class="table-wrapper"><table class="rate-table"><thead><tr><th>Season</th><th>Dates</th>')
            parts.extend(f"<th>{esc(rn)}</th>" for rn in room_names)
            parts.append("</tr></thead><tbody>")
            for season in seasons:
                parts.append(f"<tr><td>{esc(season.get('label', ''))}</td><td>{esc(season.get('dates', ''))}</td>")
                for rn in room_names:
                    v = season.get(rn)
                    if v is None:
                        parts.append("<td>—</td>")
                    else:
                        direct = round(v * (1 - discount)) if discount else v
                        if from_rate is None or direct < from_rate:
                            from_rate = direct
                        parts.append(f"<td>${direct}</td>")
                parts.append("</tr>")
            parts.append("</tbody></table></div>")
    elif rates.get("rooms"):
        parts.append('<div class="table-wrapper"><table class="rate-table"><thead><tr><th>Room</th><th>Rate / night</th><th>Sleeps</th></tr></thead><tbody>')
        pub_rooms = {r.get("type"): r for r in public.get("rooms", [])}
        for room in rates["rooms"]:
            rt, our = room.get("roomType"), room.get("ourRate")
            if our is not None:
                from_rate = our if from_rate is None else min(from_rate, our)
            parts.append(f"<tr><td>{esc(rt)}</td><td>{'$' + str(our) if our is not None else 'On request'}</td><td>{esc(pub_rooms.get(rt, {}).get('maxOccupancy', ''))}</td></tr>")
        parts.append("</tbody></table></div>")
    elif public.get("rooms"):
        parts.append('<div class="table-wrapper"><table class="rate-table"><thead><tr><th>Room</th><th>Rate / night</th><th>Sleeps</th></tr></thead><tbody>')
        for room in public["rooms"]:
            rt, rate = room.get("type"), room.get("guestRatePerRoomPerNight")
            if rate is not None:
                from_rate = rate if from_rate is None else min(from_rate, rate)
            parts.append(f"<tr><td>{esc(rt)}</td><td>{'$' + str(rate) if rate is not None else 'On request'}</td><td>{esc(room.get('maxOccupancy', ''))}</td></tr>")
        parts.append("</tbody></table></div>")
    else:
        return "", None, None

    notes = []
    if board:
        notes.append(f"Board basis: {esc(board)}.")
    if tax is not None:
        notes.append(f"Infrastructure tax: ${esc(tax)} per person per night, payable locally.")
    supplements = public.get("boardSupplements") or {}
    supp = []
    if supplements.get("halfBoardPerPersonPerNight") is not None:
        supp.append(f"half board +${supplements['halfBoardPerPersonPerNight']} pp/night")
    if supplements.get("fullBoardPerPersonPerNight") is not None:
        supp.append(f"full board +${supplements['fullBoardPerPersonPerNight']} pp/night")
    if supp:
        notes.append("Supplements: " + ", ".join(supp) + ".")
    notes.append("Rates are per room per night in USD. Direct rates include the contracted discount where shown. Transfers, marine park fees and extras are quoted separately unless listed. Availability and the final rate are confirmed by the team before payment.")
    parts.append(f'<p style="font-size:.9rem;color:#4e5d66;line-height:1.6;">{" ".join(notes)}</p>')
    return "".join(parts), from_rate, status


def why_list(research, h):
    items = []
    if research:
        items.extend(research.get("amenities", [])[:6])
        if research.get("airportDistance"):
            items.append(research["airportDistance"])
        if research.get("viewTypes"):
            items.append("Views: " + research["viewTypes"])
        items.append("Direct contracted rate — no OTA markup.")
    else:
        if h.get("star_rating"):
            items.append(f"{h['star_rating']} property in {h.get('zone', 'Zanzibar')}.")
        items.append("Direct WhatsApp booking with a local Zanzibar team.")
        items.append("Private airport transfer and licensed excursions can be added.")
        items.append("Clear, confirmed pricing before you pay.")
    if not items:
        return ""
    return '<ul class="checklist">' + "".join(f"<li>{esc(i)}</li>" for i in items) + "</ul>"


def room_types_section(research):
    room_types = (research or {}).get("roomTypes") or []
    if not room_types:
        return ""
    rows = []
    for room in room_types:
        rows.append(
            f"<tr><td>{esc(room.get('name', ''))}</td><td>{esc(room.get('type', ''))}</td>"
            f"<td>{esc(room.get('occupancy', ''))}</td><td>{esc(room.get('features', ''))}</td></tr>"
        )
    return (
        "<h2>Room types</h2><div class=\"table-wrapper\"><table class=\"rate-table\"><thead><tr>"
        "<th>Room</th><th>Type</th><th>Sleeps</th><th>Features</th></tr></thead><tbody>"
        + "".join(rows)
        + "</tbody></table></div>"
    )


def good_to_know(research, h):
    items = []
    if research:
        if research.get("address"):
            items.append(f"Address: {research['address']}")
        if research.get("airportDistance"):
            items.append(f"Airport: {research['airportDistance']}")
        if research.get("viewTypes"):
            items.append(f"Views: {research['viewTypes']}")
        if research.get("boards"):
            boards = research["boards"]
            if isinstance(boards, (list, tuple)):
                boards = ", ".join(str(b) for b in boards)
            items.append(f"Boards: {boards}")
        if research.get("officialSite"):
            items.append(f"Official site: <a href=\"{esc(research['officialSite'])}\" rel=\"nofollow noopener\">{esc(research['officialSite'])}</a>")
    else:
        if h.get("website"):
            items.append(f"Official site: <a href=\"{esc(h['website'])}\" rel=\"nofollow noopener\">{esc(h.get('website_domain') or h['website'])}</a>")
        if h.get("phone"):
            items.append(f"Phone: {esc(h['phone'])}")
        if h.get("email"):
            items.append(f"Email: {esc(h['email'])}")
    if not items:
        return ""
    return "<h2>Good to know</h2><ul>" + "".join(f"<li>{i}</li>" for i in items) + "</ul>"


def faq_block(items):
    return "".join(
        f"<details><summary>{esc(q)}</summary><p>{esc(a)}</p></details>" for q, a in items
    )


def hotel_faq(name, research, h, from_rate):
    airport = (research or {}).get("airportDistance") or f"{name} is in {h.get('zone', 'Zanzibar')}. Transfer time depends on the exact property; we confirm the route and timing before you book."
    board = (public_by_slug.get(h.get("_rate_slug"), {}) or {}).get("board") or h.get("board") or "the stated board basis"
    items = [
        (f"How far is {name} from Zanzibar Airport?", airport),
        (f"What is included in the rate at {name}?", f"The rate covers {board}. Zanzibar infrastructure tax is payable locally. Transfers, marine park fees and extras are quoted separately unless listed."),
        (f"Can I book an airport transfer and tours with my stay?", "Yes. We arrange private airport transfers and licensed excursions, and can combine them with your room booking in one confirmation."),
        (f"How do I check availability at {name}?", "Send your dates, room preference and guest count on WhatsApp. We confirm availability, the direct rate and the transfer in one reply."),
    ]
    return faq_block(items), items


def attraction_faq(name, zone):
    items = [
        (f"How do I get to {name}?", f"Most visitors reach {name} by private transfer or as part of a guided tour. Tell us where you are staying and we will confirm the route, travel time and timing."),
        (f"Is {name} suitable for families?", "Families are welcome at most Zanzibar attractions. We confirm the specific activity, tide and sea conditions before you book."),
        (f"Can I combine {name} with other tours?", "Yes. We can combine it with nearby tours, a Stone Town walk or a beach day. Send your dates and we will build the route."),
        (f"Do I need a guide for {name}?", "A licensed local guide adds context and handles entry logistics. We can arrange one for your visit."),
    ]
    return faq_block(items), items


def nearby_tours(zone, limit=4):
    matches = []
    for t in tours_all:
        slug = t.get("seo_slug") or t.get("slug")
        if slug not in tour_pages:
            continue
        location = (t.get("location") or "").lower()
        if zone.lower() in location or (location and location in zone.lower()):
            matches.append(t)
    if len(matches) < limit:
        for t in tours_all:
            slug = t.get("seo_slug") or t.get("slug")
            if slug in tour_pages and t not in matches:
                matches.append(t)
            if len(matches) >= limit:
                break
    if not matches:
        return '<p><a href="/tours/">Browse all Zanzibar tours</a></p>'
    items = []
    for t in matches[:limit]:
        slug = t.get("seo_slug") or t.get("slug")
        items.append(
            f'<li><a href="/tours/{esc(slug)}/">{esc(t.get("title") or t.get("name") or slug)}</a>'
            f' — {esc(truncate(t.get("short_description") or t.get("description") or "", 120))}</li>'
        )
    return "<ul>" + "".join(items) + "</ul>"


def hotel_schema(name, slug, photo, research, h, from_rate, faq_items):
    star = parse_star((research or {}).get("starRating") or h.get("star_rating"))
    amenities = (research or {}).get("amenities", [])[:8]
    same_as = []
    if (research or {}).get("officialSite"):
        same_as.append(research["officialSite"])
    elif h.get("website"):
        same_as.append(h["website"])
    address = (research or {}).get("address") or f"{h.get('zone', 'Zanzibar')}, Zanzibar, Tanzania"
    price_range = "$"
    if from_rate is not None:
        if from_rate >= 200:
            price_range = "$$$$"
        elif from_rate >= 100:
            price_range = "$$$"
        elif from_rate >= 50:
            price_range = "$$"
    hotel = {
        "@type": "Hotel",
        "@id": f"{SITE_URL}/hotels/{slug}/#hotel",
        "name": name,
        "description": clean_text((research or {}).get("description") or h.get("description") or ""),
        "image": SITE_URL + photo,
        "url": f"{SITE_URL}/hotels/{slug}/",
        "address": {
            "@type": "PostalAddress",
            "streetAddress": address,
            "addressLocality": "Zanzibar",
            "addressRegion": "Zanzibar",
            "addressCountry": "TZ",
        },
        "priceRange": price_range,
    }
    if star:
        hotel["starRating"] = {"@type": "Rating", "ratingValue": star}
    if amenities:
        hotel["amenityFeature"] = [
            {"@type": "LocationFeatureSpecification", "name": a} for a in amenities
        ]
    if same_as:
        hotel["sameAs"] = same_as
    if from_rate is not None:
        hotel["makesOffer"] = {
            "@type": "Offer",
            "priceCurrency": "USD",
            "price": from_rate,
            "url": f"{SITE_URL}/hotels/{slug}/",
        }
    faq = {
        "@type": "FAQPage",
        "@id": f"{SITE_URL}/hotels/{slug}/#faq",
        "mainEntity": [
            {
                "@type": "Question",
                "name": q,
                "acceptedAnswer": {"@type": "Answer", "text": a},
            }
            for q, a in faq_items
        ],
    }
    return json_ld({"@context": "https://schema.org", "@graph": [hotel, faq]})


def attraction_schema(name, slug, photo, a, faq_items):
    attraction = {
        "@type": "TouristAttraction",
        "@id": f"{SITE_URL}/attractions/{slug}/#attraction",
        "name": name,
        "description": clean_text(a.get("description") or ""),
        "image": SITE_URL + photo,
        "url": f"{SITE_URL}/attractions/{slug}/",
        "address": {
            "@type": "PostalAddress",
            "addressLocality": a.get("zone", "Zanzibar"),
            "addressRegion": "Zanzibar",
            "addressCountry": "TZ",
        },
        "touristType": "Leisure",
    }
    faq = {
        "@type": "FAQPage",
        "@id": f"{SITE_URL}/attractions/{slug}/#faq",
        "mainEntity": [
            {
                "@type": "Question",
                "name": q,
                "acceptedAnswer": {"@type": "Answer", "text": a_text},
            }
            for q, a_text in faq_items
        ],
    }
    return json_ld({"@context": "https://schema.org", "@graph": [attraction, faq]})


hotel_tpl = (ROOT / "scripts" / "templates" / "hotel-detail.html").read_text()
attr_tpl = (ROOT / "scripts" / "templates" / "attraction-detail.html").read_text()

hotels_build = []
for h in hotels_all:
    if not h.get("slug") or not h.get("name"):
        continue
    if wc(h.get("description", "")) < MIN:
        continue
    item = dict(h)
    item["_rate_slug"] = h["slug"]
    item["slug"] = ALIAS.get(h["slug"], h["slug"])
    hotels_build.append(item)

attractions_build = [
    a for a in attractions_all
    if a.get("slug") and a.get("name") and a.get("island") != "Pemba" and wc(a.get("description", "")) >= MIN
]

PAGES_HOTELS.mkdir(parents=True, exist_ok=True)
PAGES_ATTR.mkdir(parents=True, exist_ok=True)
for f in PAGES_HOTELS.glob("*.njk"):
    f.unlink()
for f in PAGES_ATTR.glob("*.njk"):
    f.unlink()

print(f"Generating {len(hotels_build)} hotel pages in src/pages/hotels/...")
for h in hotels_build:
    rate_slug = h["_rate_slug"]
    slug = h["slug"]
    public = public_by_slug.get(rate_slug, {})
    rates = rates_by_slug.get(rate_slug, {})
    research = research_by_slug.get(rate_slug)
    photo = compute_hotel_photo(h)
    name = h["name"]
    desc = h.get("description", "")
    lede_source = (research or {}).get("description") or desc
    rate_section, from_rate, rate_status = render_rate_section(rate_slug, public, rates)
    booking_slug = package_by_hotel.get(rate_slug, "")
    wa_msg = urllib.parse.quote(f"Hi Spice & Sail! I would like to book {name} for 2 guests.")
    if booking_slug:
        booking_button = (
            f'<button type="button" class="btn btn-primary" data-sns-booking-open '
            f'data-service-slug="{esc(booking_slug)}" data-hotel-slug="{esc(rate_slug)}" '
            f'data-hotel-name="{esc(name)}">Check availability</button>'
        )
    else:
        booking_button = (
            f'<a class="btn btn-primary" href="https://wa.me/{WHATSAPP}?text={wa_msg}" '
            f'rel="noopener" data-sns-wa>Request a quote</a>'
        )
    price_line = (
        f'<p style="margin:1rem 0 0;font-size:1rem;color:#ffd9a0;">From '
        f'<span class="price-amount">${from_rate}</span> per room per night</p>'
        if from_rate is not None
        else '<p style="margin:1rem 0 0;font-size:1rem;color:#ffd9a0;">Rates on request — send your dates for a direct quote.</p>'
    )
    status_text = {
        "confirmed": "Confirmed direct rate",
        "contracted": "Contracted partner rate",
    }.get(rate_status, "Direct quote")
    faq_html, faq_items = hotel_faq(name, research, h, from_rate)
    data = {
        "hotelNameHtml": esc(name),
        "zoneHtml": esc(h.get("zone") or public.get("area") or "Zanzibar"),
        "categoryHtml": esc(h.get("category") or "Hotel"),
        "boardHtml": esc(public.get("board") or h.get("board") or "Board basis confirmed on request"),
        "starHtml": esc((research or {}).get("starRating") or h.get("star_rating") or "Boutique"),
        "rateStatusHtml": esc(status_text),
        "ledeHtml": esc(truncate(lede_source, 240)),
        "descriptionHtml": esc(desc),
        "whyList": why_list(research, h),
        "roomTypesSection": room_types_section(research),
        "rateSection": rate_section,
        "goodToKnow": good_to_know(research, h),
        "faqHtml": faq_html,
        "bookingButton": booking_button,
        "priceLine": price_line,
        "whatsapp": WHATSAPP,
        "waMsg": wa_msg,
        "cdnPhotoUrl": photo,
        "schemaJson": hotel_schema(name, slug, photo, research, h, from_rate, faq_items),
    }
    content = render(hotel_tpl, data)
    robots = "index,follow" if (h.get("slug") in PARTNER or slug in PARTNER) else "noindex,follow"
    front = (
        "---\n"
        "layout: layouts/base.njk\n"
        f'permalink: "/hotels/{slug}/"\n'
        f"title: {yaml_str(make_title(name, h.get('zone') or 'Zanzibar'))}\n"
        f"description: {yaml_str(truncate(lede_source))}\n"
        "lang: en\n"
        f'metaRobots: "{robots}"\n'
        f'og_image: "{photo}"\n'
        f'preload_image: "{photo.replace('/images/', '', 1)}"\n'
        "---\n"
    )
    (PAGES_HOTELS / f"{slug}.njk").write_text(front + content)

print(f"Generating {len(attractions_build)} attraction pages in src/pages/attractions/...")
for a in attractions_build:
    slug = a["slug"]
    name = a["name"]
    photo = attr_photo(name, a.get("category", "Attraction"))
    desc = a.get("description", "")
    wa_msg = urllib.parse.quote(f"Hi Spice & Sail! I would like to visit {name} in {a.get('zone', 'Zanzibar')}.")
    faq_html, faq_items = attraction_faq(name, a.get("zone", "Zanzibar"))
    data = {
        "attractionNameHtml": esc(name),
        "zoneHtml": esc(a.get("zone") or "Zanzibar"),
        "islandHtml": esc(a.get("island") or "Zanzibar"),
        "categoryHtml": esc(a.get("category") or "Attraction"),
        "ledeHtml": esc(truncate(desc, 240)),
        "descriptionHtml": esc(desc),
        "nearbyTours": nearby_tours(a.get("zone", "Zanzibar")),
        "faqHtml": faq_html,
        "whatsapp": WHATSAPP,
        "waMsg": wa_msg,
        "cdnPhotoUrl": photo,
        "schemaJson": attraction_schema(name, slug, photo, a, faq_items),
    }
    content = render(attr_tpl, data)
    front = (
        "---\n"
        "layout: layouts/base.njk\n"
        f'permalink: "/attractions/{slug}/"\n'
        f"title: {yaml_str(make_title(name, a.get('zone') or 'Zanzibar'))}\n"
        f"description: {yaml_str(truncate(desc))}\n"
        "lang: en\n"
        f'og_image: "{photo}"\n'
        f'preload_image: "{photo.replace('/images/', '', 1)}"\n'
        "---\n"
    )
    (PAGES_ATTR / f"{slug}.njk").write_text(front + content)

print(f"Generated {len(hotels_build)} hotel pages and {len(attractions_build)} attraction pages in src/pages/")
