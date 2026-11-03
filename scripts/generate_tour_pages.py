#!/usr/bin/env python3
"""
Generate individual tour detail pages for each SEO keyword cluster.
Creates .njk files in src/pages/tours/ for each product in products_master.csv.
"""

import csv
import json
from pathlib import Path

RESEARCH_DIR = Path("/home/efatha/zanzibar-website-research/extracted/zanzibar-pack/03_DATA")
OUTPUT_DIR = Path("/home/efatha/spiceandsail/src/pages/tours")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

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

# Category to badge class and hero gradient mapping
CATEGORY_CONFIG = {
    'CUL': {'badge': 'badge-cultural', 'hero': 'linear-gradient(135deg, var(--dct-ocean) 0%, var(--dct-palm) 100%)', 'icon': 'CUL — Cultural Tour'},
    'MAR': {'badge': 'badge-marine', 'hero': 'linear-gradient(135deg, var(--dct-palm) 0%, var(--dct-ocean) 100%)', 'icon': 'MAR — Marine Excursion'},
    'NAT': {'badge': 'badge-nature', 'hero': 'linear-gradient(135deg, #8b5e3c 0%, #a67c52 100%)', 'icon': 'NAT — Nature Activity'},
    'SAF': {'badge': 'badge-safari', 'hero': 'linear-gradient(135deg, #b8860b 0%, var(--dct-spice) 100%)', 'icon': 'SAF — Safari'},
    'PKG': {'badge': 'badge-package', 'hero': 'linear-gradient(135deg, var(--dct-spice) 0%, var(--dct-coral) 100%)', 'icon': 'PKG — Package'},
    'TRF': {'badge': 'badge-transfer', 'hero': 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', 'icon': 'TRF — Transfer'},
}

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


def get_category_svg(category):
    """Return SVG for card image placeholder based on category."""
    svgs = {
        'CUL': '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" fill="currentColor" opacity="0.1"/><path d="M32 8C28.6863 8 26 10.6863 26 14V24H18V14C18 8.9706 21.9706 5 26 5C30.0294 5 34 8.9706 34 14V24H38V14C38 10.6863 35.3137 8 32 8ZM26 26V38H38V26H26ZM18 38H46V42H18V38Z" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        'MAR': '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" fill="currentColor" opacity="0.1"/><path d="M12 42C12 37.5817 15.5817 34 20 34H44C48.4183 34 52 37.5817 52 42V46H12V42Z" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 18C32 23.5228 27.5228 28 22 28C16.4772 28 12 23.5228 12 18C12 12.4772 16.4772 8 22 8C27.5228 8 32 12.4772 32 18Z" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 18V34" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
        'NAT': '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" fill="currentColor" opacity="0.1"/><path d="M32 10C28.134 10 25 13.134 25 17C25 20.866 28.134 24 32 24C35.866 24 39 20.866 39 17C39 13.134 35.866 10 32 10Z" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 24V44" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path d="M22 34H42" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path d="M16 44H48" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
        'SAF': '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" fill="currentColor" opacity="0.1"/><path d="M32 8L14 30V50H50V30L32 8Z" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="32" cy="22" r="6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 42H42" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
        'PKG': '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" fill="currentColor" opacity="0.1"/><path d="M16 22L32 8L48 22V54H16V22Z" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 34H48" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path d="M32 22V34" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>',
        'TRF': '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" fill="currentColor" opacity="0.1"/><path d="M8 28L28 8H56V36L36 56H8V28Z" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="24" cy="44" r="4" stroke="currentColor" stroke-width="2"/><circle cx="40" cy="28" r="4" stroke="currentColor" stroke-width="2"/></svg>',
    }
    return svgs.get(category, svgs['CUL'])


def generate_tour_pages():
    """Generate individual tour detail pages with new CSS design."""
    products = {}
    with open(RESEARCH_DIR / "products_master.csv", 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            products[row['product_id']] = row

    for product_id, slug in SEO_SLUG_MAP.items():
        row = products.get(product_id)
        if not row:
            print(f"  WARNING: {product_id} not found in CSV")
            continue

        details = TOUR_DETAILS.get(product_id, {})
        category = product_id.split('-')[0]
        cat_config = CATEGORY_CONFIG.get(category, CATEGORY_CONFIG['CUL'])

        price_min = float(row['price_low_usd'])
        price_max = float(row['price_high_usd'])
        price_display = f"${int(price_min)}–${int(price_max)} per person"

        includes_list = [item.strip() for item in row['includes'].split(';') if item.strip()]
        what_to_expect = details.get('what_to_expect', includes_list)
        important_notes = details.get('important_notes', [])
        itinerary = details.get('itinerary', [])

        includes_html = '\n'.join(f'      <li>{item}</li>' for item in includes_list)
        what_to_expect_html = '\n'.join(f'      <li>{item}</li>' for item in what_to_expect)
        notes_html = '\n'.join(f'      <li>{item}</li>' for item in important_notes)

        # Build itinerary HTML
        itinerary_html = ''
        if itinerary:
            for day in itinerary:
                itinerary_html += f'        <div class="itinerary-day">\n'
                itinerary_html += f'          <div class="day-number">{day["day"].split("—")[0].strip()[-1]}</div>\n'
                itinerary_html += f'          <h3>{day["day"]}</h3>\n'
                itinerary_html += f'          <p>{day["activities"]}</p>\n'
                itinerary_html += f'        </div>\n'

        # Determine badge and hero for this category
        badge_class = cat_config['badge']
        hero_gradient = cat_config['hero']
        badge_text = cat_config['icon']

        # Overview text
        overview_text = details.get('overview', row['notes'].replace('Prices are planning ranges; confirm current supplier net rates, park/marine fees, pickup zone and group size before publishing.', '').strip())

        # Generate the template
        template = f'''---
permalink: "/tours/{slug}/index.html"
---
{{% include "seo.njk" %}}
{{% include "header.njk" %}}

<main class="tour-detail">
  <section class="tour-hero" style="background: {hero_gradient};">
    <div class="tour-hero-content">
      <span class="card-badge {badge_class}">{badge_text}</span>
      <h1>{row["name"]}</h1>
      <p class="tour-meta">{row["duration"]} · {row["location"]}</p>
      <div class="tour-price-box">
        <span class="price-label">From</span>
        <span class="price-amount">${int(price_min)}–${int(price_max)}</span>
        <span class="price-note">per person</span>
      </div>
      <a href="https://wa.me/255672450934?text=I%27d%20like%20to%20book%20{slug.replace("-", "%20")}" target="_blank" rel="noopener" class="btn btn-primary btn-lg">Book via WhatsApp</a>
    </div>
  </section>

  <div class="tour-grid">
    <div class="tour-main">
      <section class="tour-section">
        <h2>Overview</h2>
        <p>{overview_text}</p>
      </section>
'''

        # Add itinerary section if present
        if itinerary:
            template += f'''      <section class="tour-section">
        <h2>Detailed Itinerary</h2>
{itinerary_html}      </section>
'''

        template += f'''      <section class="tour-section">
        <h2>What to Expect</h2>
        <ul class="expect-list">
{what_to_expect_html}
        </ul>
      </section>

      <section class="tour-section">
        <h2>Duration & Meeting Point</h2>
        <p><strong>Duration:</strong> {details.get("duration_detail", row["duration"])}</p>
        <p><strong>Meeting point:</strong> {details.get("meeting_point", "To be confirmed at booking")}</p>
      </section>
'''

        if important_notes:
            template += f'''      <section class="tour-section">
        <h2>Important Notes</h2>
        <ul class="notes-list">
{notes_html}
        </ul>
      </section>
'''

        template += f'''      <section class="tour-section">
        <h2>Inclusions</h2>
        <ul class="includes-list">
{includes_html}
        </ul>
      </section>
    </div>

    <aside class="tour-sidebar">
      <div class="info-card">
        <h4>📍 Tour Details</h4>
        <ul>
          <li><span class="label">Duration:</span><span class="value">{details.get("duration_detail", row["duration"])}</span></li>
          <li><span class="label">Location:</span><span class="value">{row["location"]}</span></li>
          <li><span class="label">Category:</span><span class="value">{category}</span></li>
        </ul>
        <div class="booking-card">
          <h3>Ready to Book?</h3>
          <p style="opacity: 0.8; margin-bottom: 1.5rem;">Send us your preferred date and group size on WhatsApp. We\'ll confirm with a fixed price including all fees.</p>
          <a href="https://wa.me/255672450934" target="_blank" rel="noopener" class="btn btn-accent btn-lg">WhatsApp: +255 7XX XXX XXX</a>
        </div>
      </div>
    </aside>
  </div>
</main>

{{% include "footer.njk" %}}
'''

        output_path = OUTPUT_DIR / f"{slug}.njk"
        with open(output_path, 'w') as f:
            f.write(template)

        print(f"  Generated {slug}.njk")

    print(f"\nDone! Generated {len(SEO_SLUG_MAP)} tour detail pages.")


if __name__ == "__main__":
    generate_tour_pages()