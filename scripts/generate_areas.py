#!/usr/bin/env python3
"""
Generate areas/zones data and pages for local SEO.
Creates area data file and individual area pages with new CSS design.
"""

import json
from pathlib import Path

OUTPUT_DIR = Path("/home/efatha/spiceandsail/src/data")
PAGES_DIR = Path("/home/efatha/spiceandsail/src/pages/areas")
PAGES_DIR.mkdir(parents=True, exist_ok=True)

ZONES = [
    {
        "slug": "stone-town",
        "name": "Stone Town",
        "island": "Unguja",
        "description": "UNESCO World Heritage site — the historic heart of Zanzibar with winding alleys, carved doors, bustling markets, and centuries of Swahili, Arab, Indian, and European heritage.",
        "hotels": ["Emerson Spice", "Emerson on Hurumzi", "Jafferji House & Spa", "The Neela Boutique Hotel", "Zanzibar Palace Hotel", "Africa House Hotel", "Dhow Palace Hotel", "Park Hyatt Mambo"],
        "attractions": ["House of Wonders", "Palace Museum", "Old Fort", "Forodhani Market", "Darajani Market", "Freddie Mercury House", "Anglican Cathedral (former slave market)"],
        "tours": ["stone-town-walking-tour", "stone-town-spice-prison-combo", "spice-farm"],
        "transfer_id": "TRF-01",
    },
    {
        "slug": "nungwi",
        "name": "Nungwi",
        "island": "Unguja",
        "description": "Northern tip of Zanzibar — famous for white-sand beaches, turquoise water, traditional dhow building, and vibrant nightlife. Turtles, diving, and sunset cruises.",
        "hotels": ["Essque Zalu Zanzibar", "Nungwi Dreams by Mantis", "Safira Blu Luxury Resort", "Royal Zanzibar Beach Resort", "Riu Palace Zanzibar", "Riu Jambo", "Zuri Zanzibar", "The Z Hotel", "Coccobello Zanzibar", "Baraka Beach Bungalows"],
        "attractions": ["Nungwi Beach", "Mnarani Marine Turtle Pond", "Baraka Aquarium", "Zanzibar Horse Riding"],
        "tours": ["mnemba-snorkeling", "sunset-dhow-cruise", "kizimkazi-dolphin-tour"],
        "transfer_id": "TRF-03",
    },
    {
        "slug": "kendwa",
        "name": "Kendwa",
        "island": "Unguja",
        "description": "Northwest coast — wide beaches with no tide restrictions, famous for full-moon parties, diving, and easy swimming all day.",
        "hotels": ["Gold Zanzibar Beach House & Spa", "Kilindi Zanzibar", "Nungwi Beach Resort by Turaco", "Spanish Dancer (Kendwa)", "One Ocean (Kendwa)", "Zuri Zanzibar"],
        "attractions": ["Kendwa Beach", "One Ocean Dive Centre"],
        "tours": ["mnemba-snorkeling", "sunset-dhow-cruise"],
        "transfer_id": "TRF-03",
    },
    {
        "slug": "paje",
        "name": "Paje",
        "island": "Unguja",
        "description": "Southeast coast — world-class kite-surfing, shallow turquoise lagoon, laid-back vibe, and easy access to Jozani Forest and Kuza Cave.",
        "hotels": ["B4 Beach Club", "B4 Island", "Aqua Holics Kite & Surf", "Kite Centre Zanzibar", "Airborne Kite Centre", "Zanzibar Pro Kiting", "Cristal Resort Zanzibar", "Villa Tatu"],
        "attractions": ["Seaweed Center Paje", "Airborne Kite Centre", "Aqua Holics Kite & Surf", "Kite Centre Zanzibar", "Zanzibar Pro Kiting"],
        "tours": ["kizimkazi-dolphin-tour", "kuza-cave-seaweed", "jozani-forest"],
        "transfer_id": "TRF-02",
    },
    {
        "slug": "jambiani",
        "name": "Jambiani",
        "island": "Unguja",
        "description": "Southeast fishing village — authentic Swahili culture, seaweed farming, tide pools, and access to Kuza Cave and Chumbe Island.",
        "hotels": ["Seconda Stella a Destra", "Aluna Paje", "Bamboo Design Hotel", "Blue Earth", "Blue Moon Resort", "Blue Oyster Hotel", "East Coast Reef Divers", "Buccaneer Diving"],
        "attractions": ["Kuza Cave", "Seaweed Center Paje", "Dive 710", "Buccaneer Diving", "East Coast Reef Divers"],
        "tours": ["kuza-cave-seaweed", "jozani-forest", "chumbe-island"],
        "transfer_id": "TRF-02",
    },
    {
        "slug": "kiwengwa",
        "name": "Kiwengwa",
        "island": "Unguja",
        "description": "Northeast coast — long white-sand beach, all-inclusive resorts, calm waters protected by reef, and easy access to Mnemba Atoll.",
        "hotels": ["Bluebay Beach Resort & Spa", "Kiwengwa Beach Resort", "Melia Zanzibar", "Villa Stecchini", "Blue Bay Diving Center", "The Z Hotel"],
        "attractions": ["Kiwengwa Beach", "Blue Bay Diving Center"],
        "tours": ["mnemba-snorkeling", "safari-blue"],
        "transfer_id": "TRF-03",
    },
    {
        "slug": "pongwe",
        "name": "Pongwe / Michamvi",
        "island": "Unguja",
        "description": "East-central coast — quiet beaches, mangrove channels, The Rock Restaurant nearby, and Isaraya overwater villas.",
        "hotels": ["Tulia Zanzibar", "Isaraya Luxury Overwater Villas", "Konokono Beach Resort", "Le Mersenne Zanzibar", "Barefoot Beach House", "Baladin Zanzibar", "Azao Resort & Spa", "The Neela Oceanfront"],
        "attractions": ["The Rock Restaurant (nearby)", "Michamvi Kae Beach"],
        "tours": ["mnemba-snorkeling", "safari-blue", "chumbe-island"],
        "transfer_id": "TRF-02",
    },
    {
        "slug": "bwejuu",
        "name": "Bwejuu / Dongwe",
        "island": "Unguja",
        "description": "Southeast coast — tranquil beaches, luxury boutique resorts, seaweed farming, and access to Chumbe Island marine park.",
        "hotels": ["Baraza Resort and Spa", "African Sun Sea Beach Resort", "Anna of Zanzibar", "Breezes Beach Club & Spa", "Xanadu Luxury Villas", "Bellevue Guest House", "Zanzibar White Sand Luxury Villas", "Rising Sun Dive Centre"],
        "attractions": ["Bwejuu Beach", "Rising Sun Dive Centre"],
        "tours": ["chumbe-island", "kuza-cave-seaweed", "safari-blue"],
        "transfer_id": "TRF-02",
    },
    {
        "slug": "michamvi",
        "name": "Michamvi / Pingwe",
        "island": "Unguja",
        "description": "East coast — The Rock Restaurant on a coral outcrop, calm lagoon waters, and boutique luxury resorts.",
        "hotels": ["Qambani Luxury Resort", "The Mora Zanzibar", "Matlai Boutique Hotel", "Le Mersenne Zanzibar", "Barefoot Beach House"],
        "attractions": ["The Rock Restaurant"],
        "tours": ["safari-blue", "chumbe-island"],
        "transfer_id": "TRF-02",
    },
    {
        "slug": "kizimkazi",
        "name": "Kizimkazi / Dimbani",
        "island": "Unguja",
        "description": "South coast — dolphin watching capital, ancient mosque (12th century), and access to Menai Bay Conservation Area.",
        "hotels": ["Fruit & Spice Wellness Resort", "Aya Beach Bungalows", "Kwanza Resort by SUNRISE", "The Residence Zanzibar"],
        "attractions": ["Kizimkazi Dive & Dolphin", "Kizimkazi Mosque (oldest in East Africa)"],
        "tours": ["kizimkazi-dolphin-tour", "safari-blue"],
        "transfer_id": "TRF-02",
    },
    {
        "slug": "fumba",
        "name": "Fumba / Mbweni",
        "island": "Unguja",
        "description": "Southwest peninsula — departure point for Safari Blue, marine conservation area access, and quiet residential beaches.",
        "hotels": ["Fumba Beach Lodge", "The Neela Oceanfront", "The Mora Zanzibar"],
        "attractions": ["Menai Bay Conservation Area", "Fumba Water Sports"],
        "tours": ["safari-blue", "sunset-dhow-cruise"],
        "transfer_id": "TRF-02",
    },
    {
        "slug": "matemwe",
        "name": "Matemwe / Kigomani",
        "island": "Unguja",
        "description": "Northeast coast — pristine beaches, Mnemba Atoll access, turtle nesting sites, and quiet boutique properties.",
        "hotels": ["Kasha Boutique Hotel", "Sunshine Marine Lodge", "Matemwe Retreat", "Che Che Vule", "Scubafish Zanzibar", "Mnemba Atoll Divers"],
        "attractions": ["Matemwe Beach", "Mnemba Atoll Divers", "Scubafish Zanzibar"],
        "tours": ["mnemba-snorkeling", "sunset-dhow-cruise"],
        "transfer_id": "TRF-03",
    },
    {
        "slug": "chake-chake",
        "name": "Chake Chake (Pemba)",
        "island": "Pemba",
        "description": "Main town of Pemba Island — authentic Swahili culture, clove plantations, and access to Pemba's pristine dive sites.",
        "hotels": ["Pemba Island Divers", "Pemba Dive Center"],
        "attractions": ["Pemba Island Divers", "Pemba Dive Center"],
        "tours": ["serengeti-3day-flyin"],
        "transfer_id": None,
    },
    {
        "slug": "wambaa-gulf",
        "name": "Wambaa Gulf / Makangale (Pemba)",
        "island": "Pemba",
        "description": "Pemba's luxury lodge area — Fundu Lagoon, world-class diving, and untouched coral reefs.",
        "hotels": ["Fundu Lagoon", "The Manta Resort", "Dive 360 Pemba", "Fun Divers Zanzibar", "Swahili Divers"],
        "attractions": ["Dive 360 Pemba", "Fundu Lagoon / 710 Dive", "Fun Divers Zanzibar"],
        "tours": [],
        "transfer_id": None,
    },
]


# Category SVG placeholders for area cards
def get_area_svg(name, island):
    if island == 'Pemba':
        return '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" fill="currentColor" opacity="0.1"/><path d="M32 8L14 30V50H50V30L32 8Z" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    elif name in ['Stone Town', 'Kizimkazi / Dimbani', 'Kizimkazi']:
        return '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" fill="currentColor" opacity="0.1"/><path d="M32 8C28.6863 8 26 10.6863 26 14V24H18V14C18 8.9706 21.9706 5 26 5C30.0294 5 34 8.9706 34 14V24H38V14C38 10.6863 35.3137 8 32 8ZM26 26V38H38V26H26ZM18 38H46V42H18V38Z" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    elif name in ['Nungwi', 'Kendwa']:
        return '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" fill="currentColor" opacity="0.1"/><path d="M12 42C12 37.5817 15.5817 34 20 34H44C48.4183 34 52 37.5817 52 42V46H12V42Z" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    elif name in ['Paje', 'Jambiani']:
        return '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" fill="currentColor" opacity="0.1"/><path d="M32 10C28.134 10 25 13.134 25 17C25 20.866 28.134 24 32 24C35.866 24 39 20.866 39 17C39 13.134 35.866 10 32 10Z" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 24V44" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>'
    else:
        return '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" fill="currentColor" opacity="0.1"/><circle cx="32" cy="32" r="20" stroke="currentColor" stroke-width="2.5"/></svg>'


def get_area_tags(name, tours):
    """Generate tag HTML for area page."""
    # This will be populated from the data at runtime
    return ''


def generate_area_data():
    """Generate the areas data file for Eleventy."""
    # Read hotels to get counts
    with open(OUTPUT_DIR / "hotels.json", 'r') as f:
        hotels = json.load(f)

    # Read attractions
    with open(OUTPUT_DIR / "attractions.json", 'r') as f:
        attractions = json.load(f)

    zones_with_counts = []
    unguja_count = 0
    pemba_count = 0
    unguja_zones = 0
    pemba_zones = 0

    for zone in ZONES:
        # Count hotels by matching names from curated list
        zone_hotels = [h for h in hotels if h['name'] in zone['hotels']]
        zone_attractions = [a for a in attractions if a['name'] in zone['attractions']]

        z = {
            "slug": zone['slug'],
            "name": zone['name'],
            "island": zone['island'],
            "description": zone['description'],
            "hotel_count": len(zone_hotels),
            "attraction_count": len(zone_attractions),
            "hotels": zone['hotels'],
            "attractions": zone['attractions'],
            "tours": zone['tours'],
            "transfer_id": zone['transfer_id'],
        }
        zones_with_counts.append(z)

        if zone['island'] == 'Unguja':
            unguja_count += len(zone_hotels)
            unguja_zones += 1
        else:
            pemba_count += len(zone_hotels)
            pemba_zones += 1

    # Save areas data
    with open(OUTPUT_DIR / "areas.json", 'w') as f:
        json.dump({
            "zones": zones_with_counts,
            "stats": {
                "unguja_hotels": unguja_count,
                "pemba_hotels": pemba_count,
                "unguja_zones": unguja_zones,
                "pemba_zones": pemba_zones,
            }
        }, f, indent=2)
    print(f"Generated areas.json with {len(zones_with_counts)} zones")

    # Generate individual area pages with new CSS design
    for zone in zones_with_counts:
        hotel_list = json.dumps(zone['hotels'])
        attraction_list = json.dumps(zone['attractions'])
        tour_list = json.dumps(zone['tours'])

        # Generate the page template with new CSS
        page = '---\npermalink: "/areas/' + zone["slug"] + '/index.html"\n---\n'
        page += '{% include "seo.njk" %}\n'
        page += '{% include "header.njk" %}\n\n'
        page += '<main class="area-detail">\n'

        # Hero section
        page += f'  <section class="area-hero" style="background: linear-gradient(135deg, var(--dct-ocean) 0%, var(--dct-palm) 100%);">\n'
        page += f'    <div class="area-hero-content">\n'
        page += f'      <div class="area-tags">\n'
        # Add tags based on island/characteristics
        if zone['island'] == 'Pemba':
            page += f'        <span class="area-tag">Pemba Island</span>\n'
        else:
            page += f'        <span class="area-tag">Unguja (Main Island)</span>\n'
        if 'dolphin' in zone['description'].lower():
            page += f'        <span class="area-tag">Dolphin Watching</span>\n'
        if 'kite' in zone['description'].lower():
            page += f'        <span class="area-tag">Kitesurfing</span>\n'
        if 'luxury' in zone['description'].lower():
            page += f'        <span class="area-tag">Luxury Resorts</span>\n'
        if 'heritage' in zone['description'].lower() or 'UNESCO' in zone['description']:
            page += f'        <span class="area-tag">UNESCO Heritage</span>\n'
        if 'full-moon' in zone['description'].lower() or 'nightlife' in zone['description'].lower():
            page += f'        <span class="area-tag">Nightlife</span>\n'
        page += f'      </div>\n'
        page += f'      <h1>{zone["name"]}</h1>\n'
        page += f'      <p class="area-description">{zone["description"]}</p>\n'
        page += f'    </div>\n'
        page += f'  </section>\n\n'

        # Stats section
        page += f'  <section class="section section-alt">\n'
        page += f'    <div class="container">\n'
        page += f'      <div class="section-header reveal">\n'
        page += f'        <span class="section-tag">At a Glance</span>\n'
        page += f'        <h2>{zone["name"]} Quick Stats</h2>\n'
        page += f'      </div>\n'
        page += f'      <div class="stats-grid" style="max-width: 600px; margin: 0 auto;">\n'
        page += f'        <div class="stat-item reveal"><span class="stat-number">{zone["hotel_count"]}</span><span class="stat-label">Partner Hotels</span></div>\n'
        page += f'        <div class="stat-item reveal"><span class="stat-number">{zone["attraction_count"]}</span><span class="stat-label">Attractions</span></div>\n'
        page += f'        <div class="stat-item reveal"><span class="stat-number">{len(zone["tours"])}</span><span class="stat-label">Recommended Tours</span></div>\n'
        page += f'      </div>\n'
        page += f'    </div>\n'
        page += f'  </section>\n\n'

        # Hotels section
        page += f'  <section class="section">\n'
        page += f'    <div class="container">\n'
        page += f'      <div class="section-header reveal">\n'
        page += f'        <span class="section-tag">Where to Stay</span>\n'
        page += f'        <h2>Where to Stay in {zone["name"]}</h2>\n'
        page += f'        <p class="section-subtitle">Boutique hotels and resorts in {zone["name"]}. Click through for direct booking or contact us for referral rates.</p>\n'
        page += f'      </div>\n'
        page += f'      <div class="cards-grid hotel-grid">\n'
        page += '{% for hotel in hotels %}\n'
        page += '  {% if hotel.name in ' + hotel_list + ' %}\n'
        page += '  <article class="card hotel-card reveal" data-tier="{{ hotel.tier }}" data-zone="{{ hotel.zone }}" data-island="{{ hotel.island }}">\n'
        page += '    <div class="card-image image-placeholder">\n'
        page += '      {% if hotel.tier == \'luxury\' %}\n'
        page += '        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" fill="currentColor" opacity="0.1"/><path d="M32 8C28.6863 8 26 10.6863 26 14V24H18V14C18 8.9706 21.9706 5 26 5C30.0294 5 34 8.9706 34 14V24H38V14C38 10.6863 35.3137 8 32 8ZM26 26V38H38V26H26ZM18 38H46V42H18V38Z" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="32" cy="48" r="4" stroke="currentColor" stroke-width="2"/></svg>\n'
        page += '      {% elif hotel.tier == \'upper-mid\' %}\n'
        page += '        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" fill="currentColor" opacity="0.1"/><path d="M32 8L14 30V50H50V30L32 8Z" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="32" cy="22" r="6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>\n'
        page += '      {% elif hotel.tier == \'mid\' %}\n'
        page += '        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" fill="currentColor" opacity="0.1"/><path d="M16 22L32 8L48 22V54H16V22Z" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 34H48" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>\n'
        page += '      {% else %}\n'
        page += '        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" fill="currentColor" opacity="0.1"/><circle cx="32" cy="32" r="20" stroke="currentColor" stroke-width="2.5"/></svg>\n'
        page += '      {% endif %}\n'
        page += '      <button class="card-favorite" aria-label="Add to favorites">♡</button>\n'
        page += '    </div>\n'
        page += '    <div class="card-content">\n'
        page += '      <span class="card-badge badge-{{ hotel.tier | lower | replace(\'upper-\', \'upper-\') }}">{{ hotel.tier | capitalize }}</span>\n'
        page += '      <h3 class="card-title"><a href="{{ hotel.website }}" target="_blank" rel="noopener">{{ hotel.name }}</a></h3>\n'
        page += '      <p class="card-meta">{{ hotel.zone }}, {{ hotel.island }} • {{ hotel.star_rating or "Ungraded" }} star</p>\n'
        page += '      {% if hotel.category %}<p class="card-description">{{ hotel.category }}</p>{% endif %}\n'
        page += '      <div class="card-footer">\n'
        page += '        <span class="card-price">{{ hotel.price_range or "Contact for rates" }}</span>\n'
        page += '        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">\n'
        page += '          <a href="{{ hotel.website }}" target="_blank" rel="noopener" class="btn btn-primary btn-sm">View Website</a>\n'
        page += '          {% if hotel.whatsapp %}\n'
        page += '          <a href="https://wa.me/{{ hotel.whatsapp | replace(\'+\', \'\') | replace(\' \', \'\') }}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm">WhatsApp</a>\n'
        page += '          {% endif %}\n'
        page += '        </div>\n'
        page += '      </div>\n'
        page += '    </div>\n'
        page += '  </article>\n'
        page += '  {% endif %}\n'
        page += '{% endfor %}\n'
        page += '      </div>\n'
        page += '    </div>\n'
        page += '  </section>\n\n'

        # Attractions section
        page += f'  <section class="section section-gradient">\n'
        page += f'    <div class="container">\n'
        page += f'      <div class="section-header reveal">\n'
        page += f'        <span class="section-tag">Attractions</span>\n'
        page += f'        <h2>Attractions in {zone["name"]}</h2>\n'
        page += f'        <p class="section-subtitle">Local attractions, dive centers, and activity providers in {zone["name"]}.</p>\n'
        page += f'      </div>\n'
        page += f'      <div class="cards-grid attraction-grid">\n'
        page += '{% for attraction in attractions %}\n'
        page += '  {% if attraction.name in ' + attraction_list + ' %}\n'
        page += '  <article class="card attraction-card reveal" data-type="{{ attraction.category }}">\n'
        page += '    <div class="card-image image-placeholder">\n'
        page += '      {% if attraction.type contains "Beach" %}\n'
        page += '        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" fill="currentColor" opacity="0.1"/><path d="M12 42C12 37.5817 15.5817 34 20 34H44C48.4183 34 52 37.5817 52 42V46H12V42Z" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 18C32 23.5228 27.5228 28 22 28C16.4772 28 12 23.5228 12 18C12 12.4772 16.4772 8 22 8C27.5228 8 32 12.4772 32 18Z" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>\n'
        page += '      {% elif attraction.type contains "Dive" or attraction.type contains "Diving" %}\n'
        page += '        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" fill="currentColor" opacity="0.1"/><path d="M32 8L14 30V50H50V30L32 8Z" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>\n'
        page += '      {% else %}\n'
        page += '        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" fill="currentColor" opacity="0.1"/><circle cx="32" cy="32" r="20" stroke="currentColor" stroke-width="2.5"/></svg>\n'
        page += '      {% endif %}\n'
        page += '    </div>\n'
        page += '    <div class="card-content">\n'
        page += '      <span class="card-badge badge-cultural">{{ attraction.type }}</span>\n'
        page += '      <h3 class="card-title">{{ attraction.name }}</h3>\n'
        page += '      <p class="card-meta">{{ attraction.zone }}, {{ attraction.island }}</p>\n'
        page += '      {% if attraction.website %}\n'
        page += '        <a href="{{ attraction.website }}" target="_blank" rel="noopener" class="btn btn-primary btn-sm">Visit Website</a>\n'
        page += '      {% else %}\n'
        page += '        <span class="btn btn-sm" style="color: var(--dct-gray); border: 1px solid var(--dct-gray-light);">No public website</span>\n'
        page += '      {% endif %}\n'
        page += '    </div>\n'
        page += '  </article>\n'
        page += '  {% endif %}\n'
        page += '{% endfor %}\n'
        page += '      </div>\n'
        page += '    </div>\n'
        page += '  </section>\n\n'

        # Tours section
        if zone['tours']:
            page += f'  <section class="section">\n'
            page += f'    <div class="container">\n'
            page += f'      <div class="section-header reveal">\n'
            page += f'        <span class="section-tag">Tours</span>\n'
            page += f'        <h2>Recommended Tours from {zone["name"]}</h2>\n'
            page += f'        <p class="section-subtitle">The best day tours and experiences starting from {zone["name"]}.</p>\n'
            page += f'      </div>\n'
            page += f'      <div class="cards-grid tour-grid">\n'
            page += '{% for tour in tours %}\n'
            page += '  {% if tour.seo_slug in ' + tour_list + ' %}\n'
            page += '  <article class="card tour-card reveal" data-category="{{ tour.category }}">\n'
            page += '    <div class="card-image image-placeholder">\n'
            page += '      {% if tour.category == \'CUL\' %}\n'
            page += '        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" fill="currentColor" opacity="0.1"/><path d="M32 8C28.6863 8 26 10.6863 26 14V24H18V14C18 8.9706 21.9706 5 26 5C30.0294 5 34 8.9706 34 14V24H38V14C38 10.6863 35.3137 8 32 8ZM26 26V38H38V26H26ZM18 38H46V42H18V38Z" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>\n'
            page += '      {% elif tour.category == \'MAR\' %}\n'
            page += '        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" fill="currentColor" opacity="0.1"/><path d="M12 42C12 37.5817 15.5817 34 20 34H44C48.4183 34 52 37.5817 52 42V46H12V42Z" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 18C32 23.5228 27.5228 28 22 28C16.4772 28 12 23.5228 12 18C12 12.4772 16.4772 8 22 8C27.5228 8 32 12.4772 32 18Z" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>\n'
            page += '      {% elif tour.category == \'NAT\' %}\n'
            page += '        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" fill="currentColor" opacity="0.1"/><path d="M32 10C28.134 10 25 13.134 25 17C25 20.866 28.134 24 32 24C35.866 24 39 20.866 39 17C39 13.134 35.866 10 32 10Z" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 24V44" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>\n'
            page += '      {% elif tour.category == \'SAF\' %}\n'
            page += '        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" fill="currentColor" opacity="0.1"/><path d="M32 8L14 30V50H50V30L32 8Z" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="32" cy="22" r="6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>\n'
            page += '      {% elif tour.category == \'PKG\' %}\n'
            page += '        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" fill="currentColor" opacity="0.1"/><path d="M16 22L32 8L48 22V54H16V22Z" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 34H48" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>\n'
            page += '      {% else %}\n'
            page += '        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" fill="currentColor" opacity="0.1"/><circle cx="32" cy="32" r="20" stroke="currentColor" stroke-width="2.5"/></svg>\n'
            page += '      {% endif %}\n'
            page += '      <button class="card-favorite" aria-label="Add to favorites">♡</button>\n'
            page += '    </div>\n'
            page += '    <div class="card-content">\n'
            page += '      <span class="card-badge badge-{{ tour.category | lower }}">{{ tour.category }}</span>\n'
            page += '      <h3 class="card-title"><a href="/tours/{{ tour.seo_slug }}/">{{ tour.title }}</a></h3>\n'
            page += '      <p class="card-meta">{{ tour.duration }} • {{ tour.location }}</p>\n'
            page += '      <p class="card-description">{{ tour.short_description }}</p>\n'
            page += '      <div class="card-footer">\n'
            page += '        <span class="card-price">{{ tour.price.display }} <span class="price-basis">per person</span></span>\n'
            page += '        <a href="/tours/{{ tour.seo_slug }}/" class="btn btn-primary btn-sm">Details & Booking</a>\n'
            page += '      </div>\n'
            page += '    </div>\n'
            page += '  </article>\n'
            page += '  {% endif %}\n'
            page += '{% endfor %}\n'
            page += '      </div>\n'
            page += '    </div>\n'
            page += '  </section>\n\n'

        # CTA
        page += f'  <section class="section section-alt">\n'
        page += f'    <div class="container" style="text-align: center; max-width: 600px;">\n'
        page += f'      <div class="reveal">\n'
        page += f'        <h2 style="margin-bottom: 1rem;">Need an Airport Transfer?</h2>\n'
        page += f'        <p style="color: var(--dct-text-muted); margin-bottom: 1.5rem;">Private transfer from ZNZ Airport to {zone["name"]} — fixed price, flight tracking, meet & greet included.</p>\n'
        page += f'        <a href="/transfers/" class="btn btn-primary btn-lg">View Transfer Options</a>\n'
        page += f'      </div>\n'
        page += f'    </div>\n'
        page += f'  </section>\n'

        page += '</main>\n\n'
        page += '{% include "footer.njk" %}\n'

        # Write the area page
        area_page_path = PAGES_DIR / f"{zone['slug']}.njk"
        with open(area_page_path, 'w') as f:
            f.write(page)
        print(f"  Generated pages/areas/{zone['slug']}.njk")

    print(f"\nDone! Generated {len(zones_with_counts)} area pages.")


if __name__ == "__main__":
    generate_area_data()