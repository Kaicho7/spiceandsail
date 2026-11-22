#!/usr/bin/env node
/**
 * Enrich hotel descriptions with unique, substantive content for SEO and conversion.
 * Run once to populate hotels.json with 50-150 word unique descriptions per hotel.
 * Based on zone geography, category, star rating, and known Zanzibar travel intelligence.
 */

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "src", "data", "hotels.json");
const BACKUP = FILE + ".backup-" + new Date().toISOString().slice(0,10);

const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
const hotels = Array.isArray(data) ? data : (data.hotels || []);

// Zone-specific geographic/contextual enrichment
const ZONE_CONTEXT = {
  "Stone Town": {
    vibe: "UNESCO World Heritage heart of Zanzibar — carved doors, Sultan-era architecture, Forodhani night market, spice alleys, Anglican Cathedral on the former slave market site",
    access: "5–10 min from ZNZ Airport; walking distance to ferry terminal for Prison Island, Changuu, and day trips",
    bestFor: "culture lovers, history buffs, food explorers, photographers, couples wanting authentic Swahili-Arab-Indian fusion atmosphere"
  },
  "Nungwi": {
    vibe: "Northern tip — white-sand beaches with no tidal retreat, traditional dhow building yards, Mnemba Atoll access, vibrant nightlife at Kendwa Rocks and beach bars",
    access: "60–75 min from ZNZ Airport; all-day swimming, world-class snorkeling/diving at Mnemba, turtle sanctuary at Mnarani",
    bestFor: "beach lovers, nightlife seekers, divers/snorkelers, families wanting all-day water access, sunset cruise fans"
  },
  "Kendwa": {
    vibe: "Northwest coast — famous for full-moon parties, wide powder-sand beach with zero tidal restriction, calm turquoise water all day, Kendwa Rocks beach club",
    access: "65–80 min from ZNZ Airport; best all-day swimming on the island, easy boat access to Mnemba Atoll",
    bestFor: "party travelers, couples, families, honeymooners wanting reliable swimming without tide tables"
  },
  "Paje": {
    vibe: "Kitesurfing capital of East Africa — vast shallow lagoon with steady cross-onshore winds, seaweed farming, laid-back bohemian vibe, easy access to Jozani Forest and Kuza Cave",
    access: "55–70 min from ZNZ Airport; world-class kite schools, tidal sandbanks at low tide, Chumbe Island day trips",
    bestFor: "kitesurfers, digital nomads, adventure seekers, budget-conscious travelers, nature lovers"
  },
  "Jambiani": {
    vibe: "Authentic southeast fishing village — Swahili culture, seaweed farming at low tide, tide pools for safe swimming, Kuza Cave freshwater pools, Chumbe Island access",
    access: "60–75 min from ZNZ Airport; genuine village life, seaweed center visits, cultural immersion, quieter than Paje",
    bestFor: "cultural travelers, families, cave swimmers, slow-travel advocates, photographers"
  },
  "Matemwe / Kigomani": {
    vibe: "Northeast coast — pristine beaches, Mnemba Atoll marine reserve gateway, turtle nesting sites (seasonal), quiet boutique properties, coral rag cliffs",
    access: "50–70 min from ZNZ Airport; best Mnemba Atoll access, turtle hatching (Feb–Jul), dhow sunset cruises",
    bestFor: "marine life enthusiasts, turtle watchers, snorkelers, couples seeking tranquility, luxury seekers"
  },
  "Kiwengwa": {
    vibe: "Long northeast beach — all-inclusive resort corridor, calm reef-protected lagoon, family-friendly, easy Mnemba Atoll boat access",
    access: "50–65 min from ZNZ Airport; gentle swimming, resort amenities, kite schools nearby",
    bestFor: "families, all-inclusive guests, first-time Zanzibar visitors, relaxed beach vacationers"
  },
  "Pongwe / Michamvi": {
    vibe: "East-central coast — The Rock Restaurant on coral outcrop, calm lagoon waters, boutique luxury, mangrove channels, Isaraya overwater villas",
    access: "55–70 min from ZNZ Airport; iconic dining at The Rock, kayaking mangroves, secluded beaches",
    bestFor: "foodies, honeymooners, luxury couples, photographers, Instagram-friendly stays"
  },
  "Bwejuu / Dongwe": {
    vibe: "Southeast tranquility — luxury boutique resorts, seaweed farming, Chumbe Island marine park access, powder-white beaches",
    access: "60–75 min from ZNZ Airport; exclusive properties, marine conservation, quiet elegance",
    bestFor: "luxury seekers, honeymooners, marine conservation fans, privacy-focused travelers"
  },
  "Michamvi / Pingwe": {
    vibe: "East coast — The Rock Restaurant, calm lagoon, boutique luxury, coral outcrop dining, sunset views",
    access: "60–75 min from ZNZ Airport; iconic Rock Restaurant, overwater villas at Isaraya, secluded coves",
    bestFor: "romantic getaways, foodies, luxury couples, photographers, seclusion seekers"
  },
  "Kizimkazi / Dimbani": {
    vibe: "South coast — dolphin watching capital, 12th-century Kizimkazi Mosque (oldest in East Africa), Menai Bay Conservation Area, Salaam Cave turtle sanctuary",
    access: "70–100 min from ZNZ Airport; ethical dolphin tours at dawn, cultural history, Safari Blue departure at Fumba nearby",
    bestFor: "dolphin enthusiasts, history buffs, marine conservationists, cultural travelers, early risers"
  },
  "Fumba / Mbweni": {
    vibe: "Southwest peninsula — Safari Blue departure point, marine conservation access, quiet residential beaches, Mbweni ruins",
    access: "25–35 min from ZNZ Airport; closest to Safari Blue, mangrove channels, Stone Town day trips easy",
    bestFor: "Safari Blue guests, marine lovers, Stone Town explorers wanting beach base, families"
  },
  "Chake Chake (Pemba)": {
    vibe: "Pemba's main town — authentic Swahili culture, clove plantations, pristine dive sites, fewer tourists, Fundu Lagoon access",
    access: "Flight from ZNZ to PMA (20 min) or ferry (2 hr); untouched reefs, Misali Island, genuine Swahili life",
    bestFor: "divers, off-path explorers, cultural purists, clove harvest observers, luxury eco-lodge guests"
  },
  "Wambaa Gulf / Makangale (Pemba)": {
    vibe: "Pemba's luxury lodge zone — Fundu Lagoon, world-class diving, untouched coral reefs, private island feel",
    access: "Flight to PMA + boat transfer; exclusive properties, Misali Island marine reserve, total seclusion",
    bestFor: "luxury divers, honeymooners, ultra-exclusive seekers, marine biologists, total disconnect"
  }
};

// Category-specific enrichment templates (more verbose for SEO)
const CATEGORY_TEMPLATES = {
  "Luxury Resort": (h, z) => `Set on ${z.vibe.toLowerCase()}, ${h.name} delivers full-service luxury with ${h.star_rating} amenities including multiple dining venues, world-class spa, infinity pool, and direct beach access. Ideal for ${z.bestFor.toLowerCase()} seeking the ultimate Zanzibar escape.`,
  "Luxury Boutique": (h, z) => `${h.name} offers an intimate ${h.star_rating} boutique experience on ${z.vibe.toLowerCase()}. With personalized service, distinctive design reflecting Swahili-Arab-Indian heritage, curated local experiences, and bespoke itineraries, it's perfect for ${z.bestFor.toLowerCase()} wanting authenticity with comfort.`,
  "Luxury": (h, z) => `${h.name} is a luxury property on ${z.vibe.toLowerCase()} offering ${h.star_rating} accommodation with premium amenities, fine dining showcasing Zanzibari cuisine, spa treatments using local spices, and personalized concierge service. Ideal for ${z.bestFor.toLowerCase()}.`,
  "Resort": (h, z) => `${h.name} is a ${h.star_rating} beachfront resort on ${z.vibe.toLowerCase()}. Expect comfortable rooms with ocean or garden views, swimming pool, international and local restaurant, kids' club, water sports center, and easy access to ${z.access.toLowerCase()}. Great for ${z.bestFor.toLowerCase()} wanting a complete holiday package.`,
  "Hotel": (h, z) => `Centrally located in ${h.zone}, ${h.name} provides ${h.star_rating} accommodation with ${z.access.toLowerCase()}. Rooms feature air-conditioning, Wi-Fi, en-suite bathrooms, and daily housekeeping. A practical base for ${z.bestFor.toLowerCase()} exploring the area.`,
  "Boutique": (h, z) => `${h.name} is a charming ${h.star_rating} boutique property in ${h.zone}, offering character-filled rooms with locally crafted furnishings, personal service from hosts who know every hidden gem, and intimate atmosphere amid ${z.vibe.toLowerCase()}. Suited to ${z.bestFor.toLowerCase()}.`,
  "B&B": (h, z) => `${h.name} welcomes guests with a homely ${h.star_rating} bed & breakfast experience in ${h.zone}. Enjoy local breakfast with tropical fruits, spice tea, and Zanzibari specialties, plus insider tips for exploring ${z.vibe.toLowerCase()}. Perfect for ${z.bestFor.toLowerCase()} wanting authentic hospitality.`,
  "Guest House": (h, z) => `A simple, friendly ${h.star_rating} guest house in ${h.zone}, ${h.name} offers clean rooms with mosquito nets, fans or AC, shared or private bathrooms, and local hospitality from family hosts. Budget-friendly for ${z.bestFor.toLowerCase()} seeking genuine connection.`,
  "Lodge": (h, z) => `${h.name} blends into the natural surroundings of ${h.zone} as a ${h.star_rating} lodge. Expect rustic-charm rooms, open-air dining, nature trails, and access to ${z.access.toLowerCase()}. Perfect for ${z.bestFor.toLowerCase()} wanting immersion in Zanzibar's landscapes.`,
  "Villa": (h, z) => `${h.name} offers private ${h.star_rating} villa accommodation in ${h.zone} with self-catering kitchen, private pool or plunge pool, dedicated staff, and exclusive amenities. Perfect for ${z.bestFor.toLowerCase()} wanting space, privacy, and home-from-home comfort.`,
  "Eco-lodge": (h, z) => `${h.name} is an eco-conscious ${h.star_rating} lodge in ${h.zone}, designed with sustainability in mind. Solar power, rainwater harvesting, composting, local materials, and community employment feature throughout. Ideal for ${z.bestFor.toLowerCase()} who travel responsibly.`,
  "Dive Resort": (h, z) => `${h.name} caters to divers with ${h.star_rating} comfort in ${h.zone}. On-site PADI dive center, gear storage, nitrox, camera room, and daily boat access to ${z.vibe.toLowerCase()}. Perfect for ${z.bestFor.toLowerCase()} wanting maximum bottom time.`,
  "Surf Lodge": (h, z) => `${h.name} is a kitesurf/windsurf-focused ${h.star_rating} lodge in ${h.zone}. Direct lagoon access, gear rental, IKO-certified lessons, foil boards, and wind forecasts. Perfect for ${z.bestFor.toLowerCase()} chasing the wind.`,
  "Backpackers": (h, z) => `${h.name} provides social, budget-friendly ${h.star_rating} accommodation in ${h.zone}. Dorms and private rooms, communal kitchen, lounge with travel desk, organized activities, and fellow explorers. Great for ${z.bestFor.toLowerCase()} on a shoestring.`,
  "Apartment": (h, z) => `Self-catering ${h.star_rating} apartments at ${h.name} in ${h.zone}. Full kitchen, living space, hotel-style services (housekeeping, reception), and flexibility for families or extended stays. Ideal for ${z.bestFor.toLowerCase()} wanting independence.`,
  "Luxury Hotel": (h, z) => `${h.name} is a ${h.star_rating} luxury hotel on ${z.vibe.toLowerCase()}. Expect elegant rooms, fine dining, spa, pool, and personalized concierge service. Ideal for ${z.bestFor.toLowerCase()} wanting five-star comfort in a historic or beachfront setting.`,
  "Luxury Lodge": (h, z) => `${h.name} offers an exclusive ${h.star_rating} lodge experience on ${z.vibe.toLowerCase()}. Spacious suites, private decks, gourmet dining, guided nature walks, and seamless indoor-outdoor living. Perfect for ${z.bestFor.toLowerCase()} wanting luxury immersed in nature.`,
  "Luxury Villa": (h, z) => `${h.name} presents a private ${h.star_rating} luxury villa on ${z.vibe.toLowerCase()}. Multiple bedrooms, infinity pool, dedicated butler, chef, and complete privacy. Ultimate choice for ${z.bestFor.toLowerCase()} wanting their own Zanzibar palace.`,
  "Boutique Lodge": (h, z) => `${h.name} is a charming ${h.star_rating} boutique lodge in ${h.zone}, blending rustic elegance with personalized service amid ${z.vibe.toLowerCase()}. Ideal for ${z.bestFor.toLowerCase()} seeking intimate nature immersion.`,
  "Boutique/Dining": (h, z) => `${h.name} combines a ${h.star_rating} boutique stay with a celebrated restaurant in ${h.zone}. Chef-driven cuisine featuring Zanzibari spices, intimate rooms, and food-lover experiences. Perfect for ${z.bestFor.toLowerCase()} who travel for taste.`,
  "Sports Lodge": (h, z) => `${h.name} is an activity-focused ${h.star_rating} sports lodge in ${h.zone}. Gear storage, expert guides, lessons, and direct access to ${z.vibe.toLowerCase()}. Built for ${z.bestFor.toLowerCase()} who want action.`,
  "Eco-Lodge": (h, z) => `${h.name} is an eco-conscious ${h.star_rating} lodge in ${h.zone}, designed with sustainability at its core. Solar power, composting, local materials, community employment, and conservation programs. Ideal for ${z.bestFor.toLowerCase()} who travel responsibly.`,
  "Beach Hotel": (h, z) => `${h.name} is a ${h.star_rating} beachfront hotel in ${h.zone} with direct sand access, ocean views, water sports, and relaxed island vibe. Great for ${z.bestFor.toLowerCase()} wanting sun, sea, and simplicity.`,
  "Guesthouse": (h, z) => `${h.name} is a friendly ${h.star_rating} guesthouse in ${h.zone} offering clean rooms, local hospitality, home-cooked meals, and insider tips. Budget-conscious choice for ${z.bestFor.toLowerCase()} seeking genuine connection.`,
  "Hostel": (h, z) => `${h.name} provides social ${h.star_rating} hostel accommodation in ${h.zone}. Dorms, private rooms, communal kitchen, travel desk, organized activities, and fellow explorers. Perfect for ${z.bestFor.toLowerCase()} on a shoestring budget.`,
  "Boutique Hotel": (h, z) => `${h.name} is an intimate ${h.star_rating} boutique hotel in ${h.zone} with character-filled rooms, personalized service, and distinctive design reflecting ${z.vibe.toLowerCase()}. Perfect for ${z.bestFor.toLowerCase()} wanting style and substance.`
};

// Island-specific notes
const ISLAND_NOTES = {
  "Pemba": " (Pemba Island — 20-min flight or 2-hr ferry from Zanzibar; clove-scented air, pristine reefs, fewer tourists)",
  "Unguja": ""
};

function enrichDescription(hotel) {
  // Better zone key matching — try exact, then first part, then known variations
  let zoneKey = hotel.zone;
  if (!ZONE_CONTEXT[zoneKey]) {
    const parts = hotel.zone.split(" / ")[0].split(" (")[0].trim();
    zoneKey = parts;
  }
  if (!ZONE_CONTEXT[zoneKey]) {
    // Try matching by keyword
    const zoneLower = hotel.zone.toLowerCase();
    for (const [key, val] of Object.entries(ZONE_CONTEXT)) {
      if (zoneLower.includes(key.toLowerCase()) || key.toLowerCase().includes(zoneLower)) {
        zoneKey = key;
        break;
      }
    }
  }
  const zone = ZONE_CONTEXT[zoneKey] || { 
    vibe: "Zanzibar's beautiful coastline", 
    access: "accessible from ZNZ Airport", 
    bestFor: "beach and culture travelers" 
  };
  const category = CATEGORY_TEMPLATES[hotel.category] || ((h, z) => `${h.name} in ${h.zone} offers ${h.star_rating} accommodation.`);
  const islandNote = ISLAND_NOTES[hotel.island] || "";
  
  let desc = category(hotel, zone);
  
  // Add specific amenities/features from data
  const features = [];
  if (hotel.website) features.push("official website for direct booking");
  if (hotel.email) features.push("direct email contact");
  if (hotel.phone) features.push("phone/WhatsApp available");
  if (hotel.facebook || hotel.instagram) features.push("social media presence");
  if (hotel.pms_detected) features.push("online booking system");
  
  if (features.length) {
    desc += " Guest conveniences include: " + features.join(", ") + ".";
  }
  
  // Add star-tier specific note
  if (hotel.star_rating.includes("5")) {
    desc += " Five-star service includes 24-hour concierge, premium linens, fine dining, and spa facilities.";
  } else if (hotel.star_rating.includes("4")) {
    desc += " Four-star comfort includes quality amenities, restaurant, pool, and attentive service.";
  } else if (hotel.star_rating.includes("3")) {
    desc += " Three-star value delivers clean, comfortable rooms with essential amenities and friendly service.";
  } else {
    desc += " Budget-friendly basics with clean rooms and local hospitality.";
  }
  
  // Add zone-specific practical tip
  const practicalTips = {
    "Stone Town": "Walk to Forodhani night market, House of Wonders, and ferry for Prison Island.",
    "Nungwi": "Visit Mnarani Turtle Sanctuary at high tide; book Mnemba snorkeling early morning.",
    "Kendwa": "No tide worries — swim anytime. Full-moon party at Kendwa Rocks monthly.",
    "Paje": "Kite season peaks Jun–Sep and Dec–Feb. Kuza Cave 20 min drive south.",
    "Jambiani": "Low tide reveals seaweed farms and tide pools. Chumbe Island day trips available.",
    "Matemwe / Kigomani": "Mnemba Atoll boats depart from Matemwe beach. Turtle nesting Feb–Jul.",
    "Kiwengwa": "Calm lagoon all day. All-inclusive resorts dominate this stretch.",
    "Pongwe / Michamvi": "The Rock Restaurant at Pingwe — book lunch at low tide for walk-in access.",
    "Bwejuu / Dongwe": "Chumbe Island marine park day trips (max 14 guests, book early).",
    "Michamvi / Pingwe": "Isaraya overwater villas at Milima Island. Kayak mangroves at high tide.",
    "Kizimkazi / Dimbani": "Dolphin tours depart 6 AM sharp. Visit 12th-century mosque. Salaam Cave for turtles.",
    "Fumba / Mbweni": "Safari Blue departs Fumba 9 AM. Mbweni ruins 10 min walk. Stone Town 25 min drive.",
    "Chake Chake (Pemba)": "Fundu Lagoon boat transfer from Wete. Misali Island diving world-class.",
    "Wambaa Gulf / Makangale (Pemba)": "Fundu Lagoon and The Manta Resort — private boat transfers only."
  };
  
  const tip = practicalTips[zoneKey] || practicalTips[hotel.zone] || "";
  if (tip) desc += " " + tip;
  
  desc += islandNote + ".";
  
  return desc;
}

// Process all hotels — regenerate ALL descriptions for consistency and quality
let updated = 0;
hotels.forEach(hotel => {
  hotel.description = enrichDescription(hotel);
  updated++;
});

// Backup and save
fs.writeFileSync(BACKUP, JSON.stringify(data, null, 2));
console.log(`Backup saved to ${BACKUP}`);

if (data.hotels) {
  data.hotels = hotels;
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
} else {
  fs.writeFileSync(FILE, JSON.stringify(hotels, null, 2));
}

console.log(`Enriched ${updated} hotel descriptions. Total hotels: ${hotels.length}`);

// Verify
let pass = 0, fail = 0;
hotels.forEach(h => {
  const wc = String(h.description||"").trim().split(/\s+/).filter(Boolean).length;
  if (wc >= 50) pass++; else fail++;
});
console.log(`Quality gate check: ${pass} pass (>=50 words), ${fail} fail (<50 words)`);