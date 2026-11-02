#!/usr/bin/env python3
"""
Transform Zanzibar research CSV data into JSON for Eleventy static site.
Reads from /home/efatha/zanzibar-website-research/extracted/zanzibar-pack/03_DATA/
Writes to /home/efatha/dhow-coast-travels/src/data/
"""

import csv
import json
import re
from pathlib import Path
from typing import Dict, List, Any

RESEARCH_DIR = Path("/home/efatha/zanzibar-website-research/extracted/zanzibar-pack/03_DATA")
OUTPUT_DIR = Path("/home/efatha/dhow-coast-travels/src/data")

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def slugify(text: str) -> str:
    """Create URL-friendly slug from text."""
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    text = re.sub(r'\s+', '-', text)
    text = re.sub(r'-+', '-', text)
    return text.strip('-')


def parse_price_range(price_low: str, price_high: str, price_basis: str) -> Dict[str, Any]:
    """Parse price fields into structured format."""
    try:
        low = float(price_low) if price_low else None
        high = float(price_high) if price_high else None
    except ValueError:
        low = high = None

    display = f"${int(low)}–${int(high)}" if low and high else f"${int(low)}" if low else "Contact for price"

    return {
        "min": low,
        "max": high,
        "basis": price_basis,
        "display": display
    }


def load_csv(path: Path) -> List[Dict]:
    """Load CSV file into list of dicts."""
    with open(path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        return list(reader)


# SEO slug mapping from product_id to URL slug
SEO_SLUG_MAP = {
    'CUL-01': 'stone-town-walking-tour',
    'CUL-02': 'spice-farm',
    'CUL-03': 'village-community-tour',
    'CUL-04': 'stone-town-spice-prison-combo',
    'MAR-01': 'safari-blue',
    'MAR-02': 'mnemba-snorkeling',
    'MAR-03': 'prison-island-nakupenda',
    'MAR-04': 'nakupenda-sandbank',
    'MAR-05': 'chumbe-island',
    'MAR-06': 'sunset-dhow-cruise',
    'MAR-07': 'kizimkazi-dolphin-tour',
    'NAT-01': 'jozani-forest',
    'NAT-02': 'kuza-cave-seaweed',
    'SAF-01': 'mikumi-nyerere-day-safari',
    'SAF-02': 'serengeti-3day-flyin',
    'PKG-01': 'zanzibar-essentials-3day',
}

# Detailed descriptions for each tour
TOUR_DETAILS = {
    'CUL-01': {
        'meta_description': 'Book Stone Town walking tour with a licensed Zanzibar guide. Explore UNESCO-listed architecture, markets, museums, and Sultan Ahmed Said\'s legacy. From $13 per person.',
        'overview': 'Walk through the heart of Zanzibar\'s UNESCO World Heritage site with a licensed local guide. Discover 200 years of history — from the Sultan\'s palace to the bustling-forbidden market scene, the House of Wonders, and the Old Fort.',
        'what_to_expect': [
            '2–4 hour guided walk led by a Zanzibar-licensed guide',
            'Visit Forodhani Gardens night market (if evening)',
            'Explore the Old Fort, House of Wonders, and Sultan\'s Palace Museum',
            'Browse the Darajani and Forodhani markets',
            'Stroll the seafront promenade and the Old City gates',
        ],
        'duration_detail': '2–4 hours (customizable: morning or late afternoon)',
        'meeting_point': 'Forodhani Gardens, Stone Town waterfront',
        'important_notes': [
            'Entry fees to museums are not included — budget $5–10 extra',
            'Wear comfortable walking shoes; Stone Town has uneven surfaces',
            'Bring a hat and water; midday sun is intense',
            'Licensed guides charge per group, not per person — perfect for families',
        ],
    },
    'CUL-02': {
        'meta_description': 'Book Zanzibar spice farm tour with expert guide. Taste cloves, cinnamon, vanilla, and cardamom. Learn the island\'s spice trade history. From $15 per person.',
        'overview': 'Journey into Zanzibar\'s lush interior to a working spice farm. Your guide will explain the history of the spice trade — how Zanzibar became the "Spice Island" — while you taste fresh nutmeg, cloves, cinnamon, and cardamom straight from the source.',
        'what_to_expect': [
            '3–4 hour farm tour with a local expert guide',
            'Hands-on tasting of 8+ tropical spices and fruits',
            'History of Zanzibar\'s clove trade and colonial plantations',
            'Traditional hand-grinding demonstration',
            'Optional lunch featuring local ingredients',
        ],
        'duration_detail': '3–4 hours (half-day)',
        'meeting_point': 'Kidichi, Kizimbani, or island interior (pickup from Stone Town available)',
        'important_notes': [
            'Tipping pressure: some guides take visitors to craft shops — we only work with transparent operators',
            'Bring cash for optional lunch ($5–10)',
            'Wear long sleeves if you have sensitive skin (spice contact)',
        ],
    },
    'CUL-03': {
        'meta_description': 'Experience Zanzibar village life with a community tour. Visit seaweed farms, craft workshops, and traditional households. From $15 per person.',
        'overview': 'Go beyond the tourist trail to a local village in Kizimbani, Jambiani, or the southeast coast. Meet families, learn about seaweed farming, traditional crafts, and daily life in rural Zanzibar.',
        'what_to_expect': [
            '2–4 hour guided village visit',
            'Seaweed farm demonstration and hands-on participation',
            'Traditional craft workshop (basket weaving, pottery)',
            'Home-cooked local lunch in a family setting',
            'Community donation included in price',
        ],
        'duration_detail': '2–4 hours',
        'meeting_point': 'Kizimbani, Jambiani, or southeast villages (pickup included from south/east coast hotels)',
        'important_notes': [
            'This is a community experience — respectful dress (shoulders and knees covered) is required',
            'Donation goes directly to the village development fund',
            'Not a staged performance — real community interaction',
        ],
    },
    'CUL-04': {
        'meta_description': 'Book combined Stone Town + Spice Farm + Prison Island tour. Full-day itinerary with licensed guide, transport, and entry fees. From $50 per person.',
        'overview': 'Maximize your day with the most popular Zanzibar combination tour. Start with a Stone Town walking tour, then head to a spice farm for lunch, and finish with a boat trip to Prison Island for giant tortoises and snorkeling.',
        'what_to_expect': [
            'Morning: Stone Town walking tour with licensed guide (2 hours)',
            'Midday: Spice farm tour with tasting and lunch (2 hours)',
            'Afternoon: Boat to Prison Island — visit tortoise sanctuary and snorkel at Nakupenda (2–3 hours)',
            'All transport included in air-conditioned vehicle',
            'Entry fees to all sites included',
        ],
        'duration_detail': '5–8 hours (full day)',
        'meeting_point': 'Stone Town hotel pickup or Forodhani Gardens',
        'important_notes': [
            'This is a high-intent bundle — book early, especially June–October and December–January',
            'Lunch at spice farm is typically a set Zanzibar menu',
            'Bring swimwear for the Prison Island snorkeling portion',
        ],
    },
    'MAR-01': {
        'meta_description': 'Book Safari Blue Zanzibar — Menai Bay dhow day trip with snorkeling, sandbank lunch, and marine conservation fee included. From $45 per person.',
        'overview': 'Zanzibar\'s most famous dhow excursion: cruise to the Menai Bay Conservation Area, snorkel over vibrant coral reefs, feast on a seafood barbecue on a private sandbank, and visit Kwale Island. Operated by the original Safari Blue since 1990.',
        'what_to_expect': [
            'Full-day dhow sailing trip (7–9 hours)',
            'Snorkeling over coral reefs with mask, snorkel, and life jacket provided',
            'Seafood barbecue lunch (grilled fish, prawns, calamari) on a sandbank',
            'Fresh fruit, water, and soft drinks throughout',
            'Menai Bay conservation fee included in package price',
            'Visit to Kwale Island for swimming',
        ],
        'duration_detail': '7–9 hours (full day)',
        'meeting_point': 'Fumba Peninsula — pickup from Stone Town hotels available',
        'important_notes': [
            'Marine conservation fee: $10 for non-EAC adults (included in our price)',
            'Bring a towel, hat, sunscreen (reef-safe), and swimwear',
            'Limited daily capacity — booking essential',
            'Copycat products and overcrowding are key risks — we only recommend the licensed original Safari Blue',
        ],
    },
    'MAR-02': {
        'meta_description': 'Book Mnemba Atoll snorkeling tour. Swim with sea turtles, explore coral gardens, and enjoy fresh fruit on the boat. From $50 per person.',
        'overview': 'Snorkel the pristine waters of Mnemba Atoll, Zanzibar\'s premier marine conservation area. Spot green sea turtles, observe colorful fish over healthy coral reefs, and enjoy fruit and water on a traditional dhow.',
        'what_to_expect': [
            '3–6 hour boat trip to Mnemba Atoll marine reserve',
            'Two snorkeling spots over vibrant coral reefs',
            'Sea turtle sightings common (resident population)',
            'Fresh fruit, water, and soft drinks on board',
            'Snorkel gear provided (mask, snorkel, life jacket)',
            'Marine park fee included',
        ],
        'duration_detail': '3–6 hours (morning departure recommended)',
        'meeting_point': 'Matemwe, Nungwi, or Kendwa — pickup from nearby hotels included',
        'important_notes': [
            'Marine conservation fee: $25 for non-EAC adults (included in our price)',
            'Best condition: June–October and December–March',
            'Avoid "guaranteed dolphin" claims — these are unethical and often illegal',
            'Weather dependent; trips may be rescheduled in rough seas',
        ],
    },
    'MAR-03': {
        'meta_description': 'Book Prison Island + Nakupenda sandbank tour. Visit giant Aldabra tortoises and snorkel the coral reef. From $42 per person.',
        'overview': 'A classic Zanzibar half-day or full-day excursion: take a short boat ride to Changuu (Prison Island) to meet the resident giant Aldabra tortoises, then cruise to Nakupenda sandbank for snorkeling over coral gardens.',
        'what_to_expect': [
            'Boat transfer from Stone Town (20 minutes)',
            'Prison Island visit — feed and photograph giant tortoises (aged 70–190)',
            'Nakupenda sandbank — wade in shallow turquoise waters',
            'Snorkeling at the coral reef (gear provided)',
            'Island entry fee included',
            'Duration: half day (3 hours) or full day (6 hours with lunch)',
        ],
        'duration_detail': 'Half day (3 hours) to full day (6 hours)',
        'meeting_point': 'Stone Town waterfront — Forodhani Gardens pier',
        'important_notes': [
            'Peak season (June–October) gets crowded — book early morning for fewer people',
            'Bring reef-safe sunscreen and a hat',
            'Lunch at Nakupenda is typically a simple seafood grill — add $10–15 if desired',
        ],
    },
    'MAR-04': {
        'meta_description': 'Book Nakupenda sandbank only tour from Stone Town. Swim in turquoise waters and snorkel the coral reef. From $45 per person.',
        'overview': 'A relaxed half-day trip to Nakupenda sandbank — Zanzibar\'s most famous white-sand strip that emerges at low tide. Perfect for swimming, sunbathing, and snorkeling right off the beach.',
        'what_to_expect': [
            'Boat transfer from Stone Town (30 minutes)',
            'Time on Nakupenda sandbank — swim, sunbathe, relax',
            'Snorkeling directly from the beach over healthy coral',
            'Seafood lunch on the sand (optional upgrade)',
            'Fresh fruit, water, and soft drinks included',
        ],
        'duration_detail': 'Half day (3 hours)',
        'meeting_point': 'Stone Town waterfront — Forodhani Gardens pier',
        'important_notes': [
            'Best at low tide — timing depends on tides, not departure time',
            'Bring your own towel or rent one on-site ($3)',
            'Very popular with cruise ship passengers — book early morning for quiet',
        ],
    },
    'MAR-05': {
        'meta_description': 'Book Chumbe Island Coral Park day tour. Limited to 14 guests. Snorkel pristine reefs with a marine biologist. From $115 per person.',
        'overview': 'Visit the world\'s first private marine conservation park. Chumbe Island limits visitors to just 14 per day to protect its fragile coral ecosystem. Snorkel guided by a marine biologist, learn about coral restoration, and support conservation.',
        'what_to_expect': [
            'Full-day trip from Mbweni (south of Stone Town)',
            'Small-group snorkeling (max 14 guests per day)',
            'Marine biologist guide explains coral reef ecology',
            'Snorkel over pristine, protected coral walls',
            'Organic lunch and refreshments included',
            'Day room access for changing and relaxing',
        ],
        'duration_detail': 'Full day (8–9 hours)',
        'meeting_point': 'Mbweni Beach (pickup from central hotels by arrangement)',
        'important_notes': [
            'Advance booking essential — strictly limited to 14 visitors per day',
            'All profits support the Chumbe Conservation Fund',
            'Bring your own snorkel mask if you have one',
            'No single supplement for solo travelers',
        ],
    },
    'MAR-06': {
        'meta_description': 'Book sunset dhow cruise in Zanzibar. Sail the Indian Ocean at golden hour, enjoy drinks and fresh fruit. From $10 per person (group) or $85 private.',
        'overview': 'End your day with a traditional dhow sailing cruise along Zanzibar\'s coastline. Watch the sun dip into the Indian Ocean, sip refreshing drinks, and enjoy fresh fruit on deck as the sky turns gold and purple.',
        'what_to_expect': [
            '2–3 hour sunset cruise on a traditional wooden dhow',
            'Departure from Nungwi, Kendwa, or Stone Town (your choice)',
            'Soft drinks, fresh fruit, and light snacks on board',
            'Life jackets provided; safety briefing included',
            'Photography-friendly — golden hour lighting',
        ],
        'duration_detail': '2–3 hours (1 hour before sunset to 30 minutes after)',
        'meeting_point': 'Nungwi Beach, Kendwa Beach, or Stone Town waterfront — choose at booking',
        'important_notes': [
            'Weather dependent — trips may be rescheduled if seas are rough',
            'Bring a light jacket; evenings can get cool on the water',
            'Perfect as a romantic experience or group activity',
            'Private charters available at higher end of price range',
        ],
    },
    'MAR-07': {
        'meta_description': 'Book Kizimkazi dolphin tour (responsibly). We only partner with operators who follow ethical dolphin-watching guidelines. From $35 per person.',
        'overview': 'Kizimkazi on Zanzibar\'s southeast coast is the only place in East Africa where you can see wild bottlenose dolphins in their natural habitat. We only work with operators certified by the Zanzibar Marine Conservation Society.',
        'what_to_expect': [
            'Early morning departure (dolphins most active at dawn, 6–9 AM)',
            '3–4 hour boat trip to the dolphin hotspot',
            'Ethical dolphin watching (no feeding, no chasing, minimal engine noise)',
            'Snorkeling in the lagoon after dolphin viewing',
            'Fresh fruit and water included',
        ],
        'duration_detail': '3–4 hours (early morning departure)',
        'meeting_point': 'Kizimkazi fishing village, southeast coast (pickup from nearby hotels included)',
        'important_notes': [
            'ETHICAL WARNING: Many operators use illegal methods — feeding, chasing, herding. We only book with certified ethical operators.',
            'Dolphin sightings are NOT guaranteed — it\'s wildlife, not a show',
            'Bring your own snorkel gear if possible',
            'Best period: June–October and December–March',
        ],
    },
    'NAT-01': {
        'meta_description': 'Book Jozani Forest tour — see rare red colobus monkeys and explore Zanzibar\'s only national park. From $12 per person.',
        'overview': 'Venture into Jozani Chwaka Bay National Park, Zanzibar\'s only national park. Walk guided forest trails to see the endangered rare red colobus monkey (endemic to Zanzibar), plus blue monkeys, bushbabies, and over 200 bird species.',
        'what_to_expect': [
            '2–4 hour guided walk through mangrove and coastal forest',
            'Red colobus monkey sighting — Zanzibar\'s endemic primate',
            'Blue Sykes monkey, lesser bushbaby, and birdwatching opportunities',
            'Visit the visitor center and turtle sanctuary at the park entrance',
            'Can combine with Kuza Cave to the south or The Rock Restaurant',
        ],
        'duration_detail': '2–4 hours (half day)',
        'meeting_point': 'Jozani Chwaka Bay National Park entrance (pickup from south coast hotels available)',
        'important_notes': [
            'Park entry fee: varies by nationality — included in our package price',
            'Best visited early morning or late afternoon for wildlife activity',
            'Wear long pants and closed shoes; the forest is humid and buggy',
            'Combine with a south-coast day including Kuza Cave, The Rock, and lunch at a beach club',
        ],
    },
    'NAT-02': {
        'meta_description': 'Book Kuza Cave + seaweed farm experience in Jambiani/Paje. Swim in freshwater caves and learn about seaweed farming. From $25 per person.',
        'overview': 'Descend into Kuza Cave — a series of freshwater caverns near Jambiani — then visit a working seaweed farm to learn about Zanzibar\'s second-largest export crop.',
        'what_to_expect': [
            '3–5 hour experience combining cave exploration and farm visit',
            'Swim in natural freshwater pools inside the limestone cave system',
            'Seaweed farm demonstration — learn about cultivation and processing',
            'Hands-on participation: harvest seaweed or try traditional dyeing',
            'Traditional lunch with local family',
        ],
        'duration_detail': '3–5 hours (half day)',
        'meeting_point': 'Jambiani or Paje area (pickup from nearby hotels included)',
        'important_notes': [
            'Tide-dependent — cave access varies with water levels',
            'Bring a towel and change of clothes',
            'Flashlights provided for the cave portion',
            'Community-run; part of the fee supports local cooperatives',
        ],
    },
    'SAF-01': {
        'meta_description': 'Book Mikumi or Nyerere (Selous) day safari from Zanzibar. Fly-in game drives with licensed guide. From $400 per person.',
        'overview': 'Escape to mainland Tanzania for a thrilling day safari. Fly from Zanzibar to either Mikumi National Park (famous for the "S" curve of the river) or Nyerere National Park (formerly Selous Game Reserve, vast wetlands and wildlife). Return the same evening.',
        'what_to_expect': [
            'Morning flight from Zanzibar to Mwanza or Dar es Salaam (chartered, 1.5 hours)',
            '4-hour game drive in 4x4 with a licensed Tanzanian guide',
            'Park fees, lunch, and refreshments included',
            'Evening return flight to Zanzibar',
            'Spot elephants, lions, hippos, crocodiles, giraffes, and over 400 bird species',
        ],
        'duration_detail': 'Full day (8–10 hours including flights)',
        'meeting_point': 'Abeid Amani Karume International Airport (ZNZ) — transfer from your hotel included',
        'important_notes': [
            'Flight-dependent — weather permitting only',
            'Must use a licensed mainland operator (we handle this)',
            'Minimum 2 passengers for charter flights — single supplement applies',
            'Best months: June–October and December–March (dry seasons)',
        ],
    },
    'SAF-02': {
        'meta_description': 'Book 3-day Serengeti fly-in safari from Zanzibar. Luxury tented camp, full board, all park fees included. From $900 per person.',
        'overview': 'Experience the legendary Serengeti on a 3-day fly-in safari. Stay at a luxury tented camp inside the park, enjoy full-board dining, and witness the Great Migration (seasonal) or resident wildlife year-round.',
        'what_to_expect': [
            'Day 1: Flight Zanzibar → Seronera, transfer to luxury tented camp, afternoon game drive',
            'Day 2: Full-day game drives in the Seronera valley (prime wildlife viewing area)',
            'Day 3: Morning game drive, flight back to Zanzibar',
            'All park fees, flights, accommodation, meals, and game drives included',
            'Professional guide and 4x4 safari vehicle',
        ],
        'duration_detail': '3 days / 2 nights',
        'meeting_point': 'Transferred from your Zanzibar hotel to ZNZ airport for flights',
        'important_notes': [
            'Requires a licensed mainland tour operator — we handle all logistics',
            'Best for Great Migration (July–October: Ndutu; December–March: Mara River crossings)',
            'Single supplement: add ~25% for solo travelers',
            'Weather-dependent flights — flexible date policy',
        ],
    },
    'PKG-01': {
        'meta_description': 'Book Zanzibar Essentials 3-day package — return transfer, Safari Blue, Stone Town walking tour, and spice farm. From $185 per person.',
        'overview': 'Our signature introduction to Zanzibar. This 3-day package covers the island\'s must-see highlights: the spice heritage, the marine wonderland of Menai Bay, and the cultural treasures of Stone Town — all in one seamless itinerary.',
        'duration_detail': '3 days / 2 nights (can extend)',
        'meeting_point': 'Abeid Amani Karume International Airport (ZNZ)',
        'important_notes': [
            'Hotels not included — we can arrange partner accommodation at wholesale rates',
            'Marine conservation fees included: Menai Bay $10, Mnemba $25',
            'Price assumes 2+ travelers — single supplement applies',
            'Book 3+ days in advance during peak season (July–August, December–January)',
        ],
        'itinerary': [
            {
                'day': 'Day 1 — Culture',
                'activities': 'Airport arrival transfer (any zone) + Stone Town walking tour with licensed guide + Forodhani night market dinner',
            },
            {
                'day': 'Day 2 — Marine',
                'activities': 'Safari Blue dhow day trip to Menai Bay Conservation Area + snorkeling + sandbank lunch',
            },
            {
                'day': 'Day 3 — Nature',
                'activities': 'Spice farm tour with lunch + airport departure transfer (any zone)',
            },
        ],
    },
}


def transform_tours():
    """Transform products_master.csv into tours.json with full detail."""
    products = load_csv(RESEARCH_DIR / "products_master.csv")
    tours = []

    for p in products:
        # Skip pure transfers - they go to transfers data
        if p['product_type'] == 'Transfer':
            continue

        slug = SEO_SLUG_MAP.get(p['product_id'], slugify(p['name']))
        price = parse_price_range(p['price_low_usd'], p['price_high_usd'], p['price_basis'])
        includes = [item.strip() for item in p['includes'].split(';') if item.strip()]
        details = TOUR_DETAILS.get(p['product_id'], {})

        # Strip the planning disclaimer from notes
        notes = p['notes'].replace(
            'Prices are planning ranges; confirm current supplier net rates, '
            'park/marine fees, pickup zone and group size before publishing.', ''
        ).strip()

        tour = {
            "id": p['product_id'],
            "slug": slug,
            "seo_slug": slug,
            "title": p['name'],
            "description": details.get('overview', notes),
            "short_description": (details.get('overview', notes)[:120] + '...') if details.get('overview') else notes[:120] + '...',
            "duration": p['duration'],
            "location": p['location'],
            "price": price,  # nested object: {min, max, basis, display}
            "price_display": price['display'],
            "includes": includes,
            "product_type": p['product_type'],
            "source_quality": p['source_quality'],
            "source_files": p['source_files'],
            "category": p['product_id'].split('-')[0],  # CUL, MAR, NAT, SAF, PKG
            "meta_description": details.get('meta_description', ''),
            "overview": details.get('overview', notes),
            "what_to_expect": details.get('what_to_expect', includes),
            "duration_detail": details.get('duration_detail', p['duration']),
            "meeting_point": details.get('meeting_point', ''),
            "important_notes": details.get('important_notes', []),
            "itinerary": details.get('itinerary', []),
            "has_itinerary": bool(details.get('itinerary')),
        }

        tours.append(tour)

    return tours


def transform_hotels():
    """Transform zanzibar_hotels_master.csv into hotels.json, filtered and tiered."""
    hotels_raw = load_csv(RESEARCH_DIR / "zanzibar_hotels_master.csv")
    hotels = []

    for h in hotels_raw:
        # Skip failed scrapes with no contacts
        if h['scrape_status'] == 'failed' and h['main_email'] in ['no email found', '']:
            continue

        star_tier = h.get('star_tier', '')
        tier_map = {'tier1': 'luxury', 'tier2': 'upper-mid', 'tier3': 'mid', '': 'standard'}
        tier = tier_map.get(star_tier, 'standard')

        has_contact = h['main_email'] not in ['no email found', ''] and h['email_check'] != 'domain differs from website - check'
        has_website = h['website'] and h['website'] != 'NOT PUBLICLY FOUND'

        if not has_website:
            continue

        hotel = {
            "id": h['property_id'],
            "name": h['name'],
            "category": h['category'],
            "star_rating": h['star_rating'],
            "star_tier": star_tier,
            "tier": tier,
            "island": h['island'],
            "zone": h['zone'],
            "website": h['website'],
            "website_domain": h['website_domain'],
            "host_type": h['host_type'],
            "pms_detected": h['pms_detected'],
            "email": h['main_email'] if has_contact else None,
            "phone": h['phone'] if h['phone'] and h['phone'] != '' else None,
            "whatsapp": h['whatsapp'] if h['whatsapp'] and h['whatsapp'] != '' else None,
            "facebook": h['facebook'] if h['facebook'] else None,
            "instagram": h['instagram'] if h['instagram'] else None,
            "linkedin": h['linkedin'] if h['linkedin'] else None,
            "contact_form_url": h['contact_form_url'] if h['contact_form_url'] else None,
            "scrape_status": h['scrape_status'],
            "slug": slugify(h['name']),
            "description": f"{h['category']} in {h['zone']}, {h['island']}. {h['star_rating'] or ''} star rating.",
            "price_range": "",  # to be filled manually later
        }
        hotels.append(hotel)

    return hotels


def transform_attractions():
    """Transform attractions_activities.csv into attractions.json."""
    attractions_raw = load_csv(RESEARCH_DIR / "attractions_activities.csv")
    attractions = []
    seen_slugs = set()

    for a in attractions_raw:
        slug = slugify(a['name'])
        if slug in seen_slugs:
            continue
        seen_slugs.add(slug)

        cat = a['category']
        if cat == 'Attraction':
            type_label = 'Attraction'
        elif cat == 'Dive Center':
            type_label = 'Dive Center'
        elif cat == 'Sports Center':
            type_label = 'Water Sports'
        else:
            type_label = cat

        attraction = {
            "id": slug,
            "slug": slug,
            "name": a['name'],
            "title": a['name'],
            "type": type_label,
            "category": cat,
            "island": a['island'],
            "zone": a['zone'],
            "website": a['website'] if a['website'] != 'NOT PUBLICLY FOUND' else None,
            "directory_url": a['directory_url'],
            "description": f"Located in {a['zone']}, {a['island']}. A popular {cat.lower()} for visitors to Zanzibar.",
            "source_dataset": a['source_dataset'],
        }
        attractions.append(attraction)

    return attractions


def transform_transfers():
    """Transform transfer products into transfers.json."""
    products = load_csv(RESEARCH_DIR / "products_master.csv")
    transfers = []

    for p in products:
        if p['product_type'] != 'Transfer':
            continue

        price = parse_price_range(p['price_low_usd'], p['price_high_usd'], p['price_basis'])
        includes = [item.strip() for item in p['includes'].split(';') if item.strip()]

        transfer = {
            "id": p['product_id'],
            "slug": slugify(p['name']),
            "title": p['name'],
            "description": p['notes'].replace(
                'Prices are planning ranges; confirm current supplier net rates, '
                'park/marine fees, pickup zone and group size before publishing.', ''
            ).strip(),
            "route": p['location'],
            "duration": p['duration'],
            "price": price,
            "price_display": price['display'],
            "includes": includes,
            "source_quality": p['source_quality'],
            "source_files": p['source_files'],
        }
        transfers.append(transfer)

    return transfers


def transform_packages():
    """Transform package products into packages.json."""
    products = load_csv(RESEARCH_DIR / "products_master.csv")
    packages = []

    for p in products:
        if p['product_type'] != 'Package':
            continue

        price = parse_price_range(p['price_low_usd'], p['price_high_usd'], p['price_basis'])
        includes = [item.strip() for item in p['includes'].split(';') if item.strip()]

        package = {
            "id": p['product_id'],
            "slug": slugify(p['name']),
            "title": p['name'],
            "description": p['notes'].replace(
                'Prices are planning ranges; confirm current supplier net rates, '
                'park/marine fees, pickup zone and group size before publishing.', ''
            ).strip(),
            "duration": p['duration'],
            "price": price,
            "price_display": price['display'],
            "includes": includes,
            "source_quality": p['source_quality'],
            "source_files": p['source_files'],
        }
        packages.append(package)

    return packages


def main():
    print("Transforming research data...")

    tours = transform_tours()
    with open(OUTPUT_DIR / "tours.json", 'w') as f:
        json.dump(tours, f, indent=2)
    print(f"  Generated tours.json: {len(tours)} tours")

    hotels = transform_hotels()
    with open(OUTPUT_DIR / "hotels.json", 'w') as f:
        json.dump(hotels, f, indent=2)
    print(f"  Generated hotels.json: {len(hotels)} hotels")

    attractions = transform_attractions()
    with open(OUTPUT_DIR / "attractions.json", 'w') as f:
        json.dump(attractions, f, indent=2)
    print(f"  Generated attractions.json: {len(attractions)} attractions")

    transfers = transform_transfers()
    with open(OUTPUT_DIR / "transfers.json", 'w') as f:
        json.dump(transfers, f, indent=2)
    print(f"  Generated transfers.json: {len(transfers)} transfers")

    packages = transform_packages()
    with open(OUTPUT_DIR / "packages.json", 'w') as f:
        json.dump(packages, f, indent=2)
    print(f"  Generated packages.json: {len(packages)} packages")

    # Summary stats for homepage
    zones_list = list(set(h['zone'] for h in hotels if h['zone']))
    islands_list = list(set(h['island'] for h in hotels))

    stats = {
        "total_tours": len(tours),
        "total_hotels": len(hotels),
        "total_attractions": len(attractions),
        "total_transfers": len(transfers),
        "total_packages": len(packages),
        "luxury_hotels": len([h for h in hotels if h['tier'] == 'luxury']),
        "zones_covered": len(zones_list),
        "islands_covered": len(islands_list),
        "zones_list": zones_list,
        "islands_list": islands_list,
    }
    with open(OUTPUT_DIR / "stats.json", 'w') as f:
        json.dump(stats, f, indent=2)
    print(f"  Generated stats.json")

    # Also generate _data/site.json for global site metadata
    site_data = {
        "name": "Spice and Sail Zanzibar",
        "description": "Licensed Zanzibar tour operator offering tours, airport transfers, and multi-day packages. WhatsApp-first booking with transparent pricing including marine park fees.",
        "url": "https://spiceandsail.com",
        "logo": "/images/logo.png",
    }
    site_dir = OUTPUT_DIR  # .eleventy.js uses src/data as data dir
    with open(site_dir / "_site.json", 'w') as f:
        json.dump(site_data, f, indent=2)
    print(f"  Generated _site.json (global site data)")

    print("\nDone!")


if __name__ == "__main__":
    main()