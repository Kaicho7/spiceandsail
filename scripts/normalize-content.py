#!/usr/bin/env python3
"""
Rewrite templated hotel descriptions into hotel-specific copy and normalize
grammar/proper nouns across the data that feeds the public pages.

Run before the Eleventy build:
    python3 scripts/normalize-content.py
"""
import hashlib
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).parent.parent
DATA = ROOT / "src" / "data"

PARTNER = {
    "le-paradis-boutique-hotel-zanzibar",
    "mkeka-spice-lodge",
    "stone-town-view-hotel",
    "stonetown-view-hotel",
    "the-island-stonetown",
    "the-one-resort-zanzibar",
}

PROPER = {
    "zanzibar": "Zanzibar",
    "swahili": "Swahili",
    "unesco": "UNESCO",
    "forodhani": "Forodhani",
    "darajani": "Darajani",
    "anglican": "Anglican",
    "stone town": "Stone Town",
    "safari blue": "Safari Blue",
    "prison island": "Prison Island",
    "jozani": "Jozani",
    "kuza": "Kuza",
    "chumbe": "Chumbe",
    "nakupenda": "Nakupenda",
    "mnemba": "Mnemba",
    "kendwa": "Kendwa",
    "nungwi": "Nungwi",
    "paje": "Paje",
    "jambiani": "Jambiani",
    "matemwe": "Matemwe",
    "kiwengwa": "Kiwengwa",
    "kizimkazi": "Kizimkazi",
    "michamvi": "Michamvi",
    "bwejuu": "Bwejuu",
    "dongwe": "Dongwe",
    "pongwe": "Pongwe",
    "fumba": "Fumba",
    "mbweni": "Mbweni",
    "makunduchi": "Makunduchi",
    "chake chake": "Chake Chake",
    "pemba": "Pemba",
    "unguja": "Unguja",
}

MONTHS = {
    "jan": "Jan", "feb": "Feb", "mar": "Mar", "apr": "Apr", "may": "May",
    "jun": "Jun", "jul": "Jul", "aug": "Aug", "sep": "Sep", "sept": "Sep",
    "oct": "Oct", "nov": "Nov", "dec": "Dec",
}

TEXT_KEYS = {
    "name", "title", "description", "short_description", "shortDescription",
    "overview", "meta_description", "category", "board", "zone", "location",
    "duration", "duration_detail", "meeting_point", "important_notes",
    "includes", "what_to_expect", "itinerary", "features", "amenities",
    "viewTypes", "airportDistance", "address", "boards", "basis", "basisNote",
    "label", "dates", "occupancy", "roomType", "highlights", "notes",
    "summary", "tagline", "subtitle", "longDescription", "locationNotes",
    "viewFacts", "distanceFacts",
}

ZONE_BLURBS = {
    "Stone Town": "Stone Town is Zanzibar's UNESCO-listed historic quarter, known for carved doors, coral-stone lanes, Forodhani night market and the ferry terminal.",
    "Nungwi": "Nungwi sits at Zanzibar's northern tip, where the beach stays swimmable through most tides and dhow builders still work near the shore.",
    "Matemwe": "Matemwe and Kigomani face the Mnemba Atoll on the quiet northeast coast, with seaweed farms and long sunrise views.",
    "Jambiani": "Jambiani is a long southeast beach village with a wide tidal lagoon, local restaurants and reliable kite-surfing winds.",
    "Paje": "Paje is Zanzibar's kite-surfing hub, with a broad tidal beach, beach bars and easy access to the southeast coast.",
    "Michamvi": "Michamvi and Pingwe sit on the quiet southeast peninsula, close to The Rock restaurant and the Michamvi sunset side.",
    "Bwejuu": "Bwejuu and Dongwe are palm-lined east-coast villages with a reef-protected beach and a quieter pace.",
    "Pongwe": "Pongwe and Michamvi are small east-coast coves known for calm water, greenery and low-key resorts.",
    "Kiwengwa": "Kiwengwa is a long northeast beach with resort frontage, soft sand and easy access to Mnemba boat trips.",
    "Kizimkazi": "Kizimkazi and Dimbani are south-coast fishing villages, the usual departure point for dolphin trips.",
    "Kendwa": "Kendwa is a north-coast beach that stays swimmable at low tide, with sunset bars and a lively evening scene.",
    "Wambaa": "The Wambaa Gulf and Makangale area is on Pemba, quieter than Unguja and known for diving, cloves and deep-water bays.",
    "Fumba": "Fumba and Mbweni are on the southwest coast, close to the airport and the usual Safari Blue departure point.",
    "Makunduchi": "Makunduchi is a south-coast village with a strong local identity, long beach and the annual Mwaka Kogwa festival.",
    "Chake Chake": "Chake Chake is Pemba's main town and airport gateway, with a market, harbour and access to the island's dive sites.",
}

AUDIENCE = {
    "Boutique": "couples and culture-minded travellers who prefer small-scale, characterful stays",
    "Luxury Resort": "travellers who want a full-service resort stay with dining and pool time",
    "Resort": "beach-focused travellers who want facilities on site",
    "Hotel": "travellers who want a practical base and straightforward comfort",
    "Lodge": "nature-minded travellers who want a quieter, low-key base",
    "Guesthouse": "budget-conscious travellers who want a local, personal stay",
    "Villa": "families and groups who want private space",
    "Apartment": "independent travellers who want space and flexibility",
}

STAR_NOTE = {
    "5-Star": "The property is rated 5-star; confirm the current facilities and board before booking.",
    "4-Star": "The property is rated 4-star; confirm the current facilities and board before booking.",
    "3-Star": "The property is rated 3-star; confirm the current facilities and board before booking.",
    "2-Star": "Expect a simple, budget-friendly base; confirm the current facilities before booking.",
    "1-Star": "Expect a simple, budget-friendly base; confirm the current facilities before booking.",
}

OPENERS = (
    "{name} is a {star} {cat} in {zone}, {island}.",
    "{name} sits in {zone} on {island}, a {star} {cat}.",
    "In {zone}, {name} is a {star} {cat}.",
    "{name} is a {cat} in {zone}, {island}, rated {star}.",
)


def normalize_text(value):
    if not isinstance(value, str):
        return value
    t = value
    t = re.sub(r"\bznz airport\b", "Zanzibar Airport", t, flags=re.I)
    t = re.sub(r"\bznz\b", "ZNZ", t)
    for phrase, proper in sorted(PROPER.items(), key=lambda kv: -len(kv[0])):
        t = re.sub(r"\b" + re.escape(phrase) + r"\b", proper, t, flags=re.I)
    t = re.sub(
        r"\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b",
        lambda m: m.group(1) + " " + MONTHS[m.group(2).lower()],
        t,
        flags=re.I,
    )
    t = re.sub(
        r"\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})\b",
        lambda m: MONTHS[m.group(1).lower()] + " " + m.group(2),
        t,
        flags=re.I,
    )
    t = re.sub(r"\b(\d+[–-]\d+)\s*min\b", r"\1 minutes", t)
    t = re.sub(r"\b(\d+)\s*min\b", r"\1 minutes", t)
    t = re.sub(r"\b(\d+)\s*pax\b", r"\1 guests", t, flags=re.I)
    t = re.sub(r"(?<!\.)\.\.(?!\.)", ".", t)
    t = re.sub(r"\s+([,.;:!?])", r"\1", t)
    t = re.sub(r"\s{2,}", " ", t).strip()
    return t


def walk(obj, parent_key=None):
    if isinstance(obj, str):
        return normalize_text(obj) if parent_key in TEXT_KEYS else obj
    if isinstance(obj, list):
        return [walk(v, parent_key) for v in obj]
    if isinstance(obj, dict):
        return {k: walk(v, k) for k, v in obj.items()}
    return obj


def zone_blurb(zone):
    z = zone or ""
    for key, blurb in ZONE_BLURBS.items():
        if z.startswith(key):
            return blurb
    return f"{z or 'Zanzibar'} is one of Zanzibar's coastal areas."


def partner_description(h, research, public):
    name = h["name"]
    star = research.get("starRating") or h.get("star_rating") or "well-rated"
    area = research.get("area") or public.get("area") or h.get("zone") or "Zanzibar"
    parts = [f"{name} is a {star} property in {area}, Zanzibar."]
    if research.get("viewFacts"):
        parts.append(research["viewFacts"].rstrip(".") + ".")
    if research.get("rooms"):
        parts.append(f"The property has {research['rooms']} rooms.")
    if research.get("airportDistance"):
        parts.append(research["airportDistance"].rstrip(".") + ".")
    if research.get("amenities"):
        parts.append("Facilities include " + ", ".join(research["amenities"][:4]).rstrip(".") + ".")
    if public.get("board"):
        parts.append(f"The published board basis is {public['board']}.")
    parts.append("Spice and Sail holds a contracted direct rate and can add a private airport transfer and licensed excursions.")
    return " ".join(parts)


def standard_description(h, index):
    name = h["name"]
    star = h.get("star_rating") or "unrated"
    cat = (h.get("category") or "property").lower()
    island = h.get("island") or "Unguja"
    zone = h.get("zone") or "Zanzibar"
    audience = AUDIENCE.get(h.get("category"), "travellers who want a well-located Zanzibar base")
    opener = OPENERS[index % len(OPENERS)].format(name=name, star=star, cat=cat, zone=zone, island=island)
    parts = [
        opener,
        zone_blurb(zone),
        f"It suits {audience}.",
        STAR_NOTE.get(star, "Confirm the current facilities and board before booking."),
    ]
    if h.get("website_domain"):
        parts.append(f"The property's official site is {h['website_domain']}.")
    parts.append("Ask Spice and Sail to compare the direct rate for your dates and add a private transfer or licensed excursion.")
    return " ".join(parts)


def main():
    hotels_path = DATA / "hotels.json"
    hotels_doc = json.loads(hotels_path.read_text())
    hotels = hotels_doc["hotels"] if isinstance(hotels_doc, dict) else hotels_doc
    public_doc = json.loads((DATA / "hotelPublicRates.json").read_text())
    public_by_slug = {h.get("slug"): h for h in public_doc.get("hotels", []) if h.get("slug")}
    research = json.loads((DATA / "partnerPropertyResearch.json").read_text()).get("properties", {})

    changed = 0
    for index, h in enumerate(hotels):
        slug = h.get("slug")
        if slug in PARTNER:
            desc = partner_description(h, research.get(slug, {}), public_by_slug.get(slug, {}))
        else:
            desc = standard_description(h, index)
        desc = normalize_text(desc)
        if h.get("description") != desc:
            h["description"] = desc
            changed += 1

    if isinstance(hotels_doc, dict):
        hotels_doc["hotels"] = hotels
    else:
        hotels_doc = hotels
    hotels_path.write_text(json.dumps(hotels_doc, indent=2, ensure_ascii=False) + "\n")

    for name in ("attractions.json", "tours.json", "packages.json", "concierge-catalogue.json",
                 "partnerPropertyResearch.json", "hotelRates.json", "hotelPublicRates.json"):
        path = DATA / name
        if not path.exists():
            continue
        doc = json.loads(path.read_text())
        path.write_text(json.dumps(walk(doc), indent=2, ensure_ascii=False) + "\n")

    print(f"Rewrote {changed} hotel descriptions and normalized text in data files.")


if __name__ == "__main__":
    main()
