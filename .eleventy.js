module.exports = function(eleventyConfig) {
  // Passthrough copy for static assets - copy contents of public to output root
  eleventyConfig.addPassthroughCopy({"public/css": "css"});
  eleventyConfig.addPassthroughCopy({"public/js": "js"});
  eleventyConfig.addPassthroughCopy({"public/images": "images"});
  eleventyConfig.addPassthroughCopy({"public/favicon.ico": "favicon.ico"});
  // Copy _headers into the publish dir (Netlify applies custom headers from dist)
  eleventyConfig.addPassthroughCopy({"_headers": "_headers"});
  
  // Load tours.json using fs
  const fs = require("fs");
  const path = require("path");
  const slugify = require("slugify");

  // Concierge catalogue is the single source of truth for concierge pricing.
  // These filters render ranges from the catalogue; a missing or unverified
  // price renders as a team-confirms message, never an invented number.
  let conciergeCatalogue = { services: [] };
  try {
    conciergeCatalogue = JSON.parse(fs.readFileSync(path.join("./src", "data", "concierge-catalogue.json"), "utf8"));
  } catch (e) { conciergeCatalogue = { services: [] }; }

  function catService(slug) {
    return (conciergeCatalogue.services || []).find(s => s.slug === slug) || null;
  }
  eleventyConfig.addFilter("catPrice", (slug) => {
    const svc = catService(slug);
    if (!svc) return "Our team will confirm the price.";
    const p = svc.pricing || {};
    if (p.basis === "on_request" || p.min == null || p.max == null) return "Our team will confirm the price.";
    return p.display + " " + (p.basis === "per_person" ? "per person" : "per vehicle") + " (planning range — our team confirms the final price)";
  });
  eleventyConfig.addShortcode("catPrice", (slug) => {
    const svc = catService(slug);
    if (!svc) return "Price on request — our team will confirm";
    const p = svc.pricing || {};
    if (p.basis === "on_request" || p.min == null || p.max == null) return "Price on request — our team will confirm";
    return p.display;
  });
  eleventyConfig.addFilter("catServices", (value, type) =>
    (conciergeCatalogue.services || []).filter(s => !type || s.type === type)
  );
  eleventyConfig.addFilter("catMin", (slug) => {
    const svc = catService(slug);
    if (!svc || !svc.pricing || svc.pricing.min == null) return null;
    return svc.pricing.min;
  });
  eleventyConfig.addFilter("catMax", (slug) => {
    const svc = catService(slug);
    if (!svc || !svc.pricing || svc.pricing.max == null) return null;
    return svc.pricing.max;
  });
  eleventyConfig.addGlobalData("conciergeCat", () => conciergeCatalogue);
  let toursData = {};
  try {
    toursData = JSON.parse(fs.readFileSync(path.join("./src", "data", "tours.json"), "utf8"));
  } catch(e) {
    toursData = {};
  }
  
  // Map tour slug → existing image filename (1-to-1 mandatory verified assets)
  const slugMap = {
    "stone-town-walking-tour": "stone-town-guided-walking-tour-zanzibar.jpg",
    "stone-town-spice-prison-combo": "aldabra-giant-tortoise-changuu-island.jpg",
    "spice-farm": "zanzibar-spice-farm-tour-fresh-nutmeg-cloves.jpg",
    "village-community-tour": "women-walking-beach-zanzibar-village.jpg",
    "safari-blue": "safari-blue-zanzibar-menai-bay-sandbank-dhow.jpg",
    "mnemba-snorkeling": "mnemba-atoll-snorkeling-tour-zanzibar.jpg",
    "prison-island-nakupenda": "prison-island-nakupenda-combo-tour-zanzibar.jpg",
    "nakupenda-sandbank": "nakupenda-sandbank-tour-pristine-beach-zanzibar.jpg",
    "chumbe-island": "underwater-fish-coral-reef-zanzibar.jpg",
    "sunset-dhow-cruise": "sunset-dhow-cruise-zanzibar-stone-town.jpg",
    "kizimkazi-dolphin-tour": "dolphins-swimming-near-boat-tour.jpg",
    "jozani-forest": "jozani-forest-red-colobus-monkey-tour-zanzibar.jpg",
    "kuza-cave-seaweed": "people-swimming-turquoise-water-steps.jpg",
    "mikumi-nyerere-day-safari": "mikumi-day-trip-safari-from-zanzibar.jpg",
    "saadani-national-park-safari": "saadani-national-park-elephant.jpg",
    "selous-nyerere-fly-in-safari": "selous-rufiji-river-boat-safari.jpg",
    "serengeti-3day-flyin": "serengeti-3-day-fly-in-safari-from-zanzibar.jpg",
    "zanzibar-essentials-3day": "aerial-beach-boat-turquoise-water.jpg",
    "zanzibar-essentials-3-day-pass": "tourists-waving-dhow-boat-sea.jpg"
  };

  // Map blog slug → existing image filename for blog post hero images
  const blogSlugMap = {
    "best-time-to-visit-zanzibar": "aerial-beach-zanzibar-turquoise-water.jpg",
    "nungwi-vs-kendwa": "nungwi-beach-aerial-resort-turquoise-water.jpg",
    "packing-guide-zanzibar": "beach-walk-person-colorful-dress.jpg",
    "responsible-tourism-zanzibar": "women-walking-beach-zanzibar-village.jpg",
    "safari-blue-vs-mnemba-snorkeling": "safari-blue-zanzibar-menai-bay-sandbank-dhow.jpg",
    "safari-from-zanzibar-guide": "serengeti-3-day-fly-in-safari-from-zanzibar.jpg",
    "stone-town-walking-tour-guide": "stone-town-walking-tour-people-photograph.jpg",
    "zanzibar-airport-transfer-cost-2026": "white-minivan-zanzibar-transfer-vehicle.jpg",
    "zanzibar-airport-transfer-guide": "zanzibar-airport-transfer-private-minivan-taxi.jpg",
    "zanzibar-in-december": "dhow-sail-sunset-zanzibar-water.jpg",
    "zanzibar-itinerary-3-days": "aerial-coastal-town-beach-turquoise-water.jpg",
    "zanzibar-itinerary-5-days": "aerial-beach-boat-turquoise-water.jpg",
    "zanzibar-itinerary-7-days": "zanzibar-beach-palm-trees-thatched-huts.jpg",
    "zanzibar-mandatory-insurance": "zanzibar-airport-transfer-private-minivan-taxi.jpg",
    "zanzibar-marine-fees-explained": "underwater-fish-coral-reef-zanzibar.jpg"
  };

  // Map area zone name → existing image filename (for /areas/ cards and zone pages)
  const zoneImage = {
    "Stone Town": "stone-town-alleyway-old-buildings.jpg",
    "Nungwi": "dhow-sail-nungwi-beach-zanzibar.jpg",
    "Kendwa": "dhows-beach-sunset-zanzibar.jpg",
    "Paje": "kite-centre-zanzibar-aerial-kitesurfing.jpg",
    "Jambiani": "women-collecting-seaweed-beach-zanzibar.jpg",
    "Kiwengwa": "kiwengwa-beach-zanzibar.jpg",
    "Pongwe / Michamvi": "zanzibar-house-on-rock-beach-scene.jpg",
    "Bwejuu / Dongwe": "zanzibar-beach-palm-trees-thatched-huts.jpg",
    "Michamvi / Pingwe": "zanzibar-beach-women-walking-white-sand.jpg",
    "Kizimkazi / Dimbani": "dolphins-leaping-ocean-zanzibar.jpg",
    "Fumba / Mbweni": "dhow-boat-mangroves-turquoise-water.jpg",
    "Matemwe / Kigomani": "matemwe-beach-zanzibar.jpg",
    "Chake Chake (Pemba)": "chake-chake-pemba-jetty.jpg",
    "Wambaa Gulf / Makangale (Pemba)": "pemba-misali-island-reef.jpg"
  };

  // Load single canonical image catalog (vision-audited)
  const metadataFiles = ["canonical-image-catalog.json"];
  const metadataIndex = {};
  metadataFiles.forEach(metadataFile => {
    try {
      const metadata = JSON.parse(fs.readFileSync(path.join(__dirname, "src", "data", metadataFile), "utf8"));
      const entries = Object.values(metadata);
      entries.forEach(entry => {
        if (entry && entry.file) {
          metadataIndex[entry.file] = entry;
        }
      });
    } catch(e) {
      // Skip metadata files that can't be read
    }
  });

  // Intent map for page intents
  const intentMap = {
    "family-travel": {problem: "safe beaches children turtle snorkeling spice farm kids", cta_text: "Message us on WhatsApp with children's ages and interests"},
    "honeymoon-packages": {problem: "romantic sunset dhow cruise private beach dinner", cta_text: "Message us on WhatsApp with preferred style and budget"},
    "self-drive": {problem: "rental car SUV 4x4 Stone Town east coast", cta_text: "Message us on WhatsApp with preferred vehicle type pickup date duration"},
    "migration-calendar": {problem: "turtle nesting whale watching dolphin bird migration", cta_text: "Message us on WhatsApp with preferred travel month"},
    "health-safety": {problem: "mosquito net repellent antimalarial safe swimming", cta_text: "Message us on WhatsApp with specific health concern"},
    "tribes-culture": {problem: "Swahili culture local tribes authentic traditions", cta_text: "Message us on WhatsApp for custom cultural itineraries"},
    "packing-guide": {problem: "essential packing list seasonal what NOT to bring", cta_text: "Message us on WhatsApp for personalized packing list"},
    "spice-farm-cultural": {problem: "spice trade history cloves vanilla nutmeg cinnamon", cta_text: "Message us on WhatsApp to arrange spice farm visit"},
    "default": {problem: "zanzibar travel planning", cta_text: "Message us on WhatsApp for customized itinerary"}
  };

  // Add global data
  eleventyConfig.addGlobalData("__slugMap", slugMap);
  eleventyConfig.addGlobalData("__zoneImage", zoneImage);

  // Marketplace category metadata (used by /marketplace/ sidebar filters)
  eleventyConfig.addGlobalData("categoryMetadata", () => {
    try {
      const fs = require("fs");
      const path = require("path");
      const marketplaceApiPath = path.join(__dirname, "src", "api", "marketplace.js");
      const marketplaceApi = require(marketplaceApiPath);
      return marketplaceApi.categoryMetadata || {};
    } catch (e) {
      console.error("Error loading marketplace API:", e);
      return {};
    }
  });

  // Category label / icon filters (replaces Vue methods once used on the
  // custom-itinerary page; backed by the same category metadata map)
  function loadCategoryMetadata() {
    try { return require("./src/api/marketplace.js").getCategoryMetadata || (() => null); }
    catch (e) { return () => null; }
  }
  eleventyConfig.addNunjucksFilter("getCategoryName", (cat) => {
    const meta = loadCategoryMetadata()(cat);
    return (meta && meta.label) || cat || "Activity";
  });
  eleventyConfig.addNunjucksFilter("getCategoryIcon", (cat) => {
    const meta = loadCategoryMetadata()(cat);
    return (meta && meta.icon) || "📍";
  });

  // Deduplicated attractions: drop duplicate official/tour/listing variants
  eleventyConfig.addGlobalData("__attractionsDedup", () => {
    const raw = require("./src/data/attractions.json");
    const list = Array.isArray(raw) ? raw : raw.attractions || [];
    const dupPattern = /\((Official|Tour|Tour Desk|Main|Ngome Kongwe|Cultural Desk)\)\s*$/;
    const canonical = {};
    for (const a of list) {
      const base = a.name.replace(dupPattern, "").trim();
      if (canonical[base] === undefined) { const c = Object.assign({}, a); c.name = base; canonical[base] = c; }
    }
    return Object.values(canonical);
  });

  // Map an attraction name/category → existing image filename (real local photos preferred)
  const attractionImage = {
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
    "Nakupenda Sandbank (Tour)": "nakupenda-sandbank-tour-pristine-beach-zanzibar.jpg",
    "Palace Museum": "palace-museum-beit-al-sahel-stone-town.jpg",
    "Palace Museum (Official)": "palace-museum-beit-al-sahel-stone-town.jpg",
    "Old Fort (Cultural Desk)": "stone-town-cannons-sea-boat-tour.jpg",
    "Old Fort (Ngome Kongwe)": "stone-town-cannons-sea-boat-tour.jpg",
    "Princess Salme Spice Garden": "zanzibar-spice-farm-tour-fresh-nutmeg-cloves.jpg",
    "Prison Island": "giant-tortoises-rocky-terrain.jpg",
    "Prison Island (Tour Desk)": "giant-tortoises-rocky-terrain.jpg",
    "Seaweed Center Paje": "people-collecting-sea-items-zanzibar-beach.jpg",
    "Spice Farm Tour (Kidichi)": "people-leaf-crowns-tree-outdoor.jpg",
    "Stone Town Food Market": "zanzibar-stone-town-market-fruit-stall.jpg",
    "Zanzibar Butterfly (Park)": "zanzibar-butterfly-centre-tropical.jpg",
    "Zanzibar Horse Riding (Nungwi)": "women-horse-riding-ocean-water-zanzibar.jpg",
    "ZIFF Festival Center": "historical-photos-wall-zanzibar-exhibit.jpg",
    "The Rock Restaurant": "zanzibar-rock-house-with-tourists.jpg",
    "Old Fort": "stone-town-cannons-sea-boat-tour.jpg",
    "Forodhani Market": "zanzibar-night-food-stall-skewers-bread.jpg",
    "Spice Farm Tour": "hand-holding-nutmeg-fruits-zanzibar.jpg",
    "Nungwi Beach": "nungwi-beach-aerial-resort-turquoise-water.jpg",
    "Mnarani Marine Turtle Pond": "sea-turtles-with-child-zanzibar.jpg",
    "Kuza Cave": "people-swimming-turquoise-water-steps.jpg",
    // Dive centers — explicit diving/underwater/ocean photos
    "Afro Divers (Stone Town)": "scuba-diver-fish-coral-reef-underwater.jpg",
    "Blue Bay Diving Center": "underwater-coral-reef-fish-zanzibar.jpg",
    "Buccaneer Diving (Jambiani)": "coral-reef-fish-snorkeling-zanzibar.jpg",
    "Dive 360 Pemba Ltd": "underwater-beach-dhow-zanzibar.jpg",
    "Dive 710": "divers-on-boat-zanzibar-ocean.jpg",
    "Dive Point (Pongwe)": "coral-reef-snorkeling-zanzibar.jpg",
    "Dive Time Zanzibar": "snorkeler-underwater-with-fish.jpg",
    "East Africa Diving": "tropical-fish-swimming-clear-water.jpg",
    "East Coast Reef Divers": "coral-reef-underwater-fish-zanzibar.jpg",
    "Extreme Blue": "underwater-fish-coral-reef-zanzibar.jpg",
    "Fun Divers Zanzibar (Pemba)": "snorkeling-turquoise-water-boat-people.jpg",
    "Fundu Lagoon / 710 Dive": "boys-snorkeling-shallow-water-zanzibar.jpg",
    "Jambiani Scuba Center": "snorkeler-fish-ocean-blue-water.jpg",
    "Kizimkazi Dive & Dolphin": "dolphins-swimming-near-boat-tour.jpg",
    "Mnemba Atoll Divers": "snorkeling-zanzibar-shallow-water-coral.jpg",
    "Nakupenda Dive Center": "snorkeling-with-fish-underwater.jpg",
    "One Ocean (Kendwa)": "coral-reef-fish-school-underwater.jpg",
    "One Ocean Dive Centre": "sea-turtle-snorkeling-coral-reef.jpg",
    "Paje Dive Center": "snorkeling-with-dolphin-zanzibar-ocean.jpg",
    "Pemba Dive Center": "coral-reef-snorkeling-zanzibar-1.jpg",
    "Pemba Island Divers": "underwater-coral-reef-fish-swimming.jpg",
    "Rising Sun Dive Centre": "snorkeling-underwater-selfie-zanzibar.jpg",
    "Scuba Do Zanzibar": "coral-reef-snorkeling-zanzibar-2.jpg",
    "Scubafish Zanzibar": "underwater-coral-reef-fish-zanzibar-1.jpg",
    "Spanish Dancer (Kendwa)": "child-snorkeling-clear-shallow-water.jpg",
    "Swahili Divers": "boy-snorkeling-shallow-water-zanzibar.jpg",
    "Zanzibar Scuba": "coral-reef-snorkeling-zanzibar-3.jpg",
    // Sports / water-sports centers — explicit kite/ocean action photos
    "Airborne Kite Centre": "airborne-kitesurfing-hero.jpg",
    "Aquaholics Kite & Surf": "aquaholics-kitesurfing-hero.jpg",
    "Fumba Water Sports": "kitesurfing-turquoise-ocean-zanzibar.jpg",
    "Kite Centre Zanzibar": "kite-centre-zanzibar-aerial-kitesurfing.jpg",
    "Zanzibar Pro Kiting": "zanzibar-pro-kiting-kitesurfing.jpg"
  };
  // Read and index all available images from public/images
  let allPublicImages = [];
  try {
    allPublicImages = fs.readdirSync(path.join(__dirname, "public", "images")).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
  } catch (e) {
    allPublicImages = [];
  }

  const attrCategoryArrays = {
    "Dive Center": allPublicImages.filter(f => /snorkel|dive|coral|turtle|dolphin|underwater|fish|reef|sea-turtle/i.test(f)),
    "Water Sports": allPublicImages.filter(f => /kitesurf|atv|horse|boat|dhow|sail|surf|ocean-water|kite|jump|wave|paddle|swim/i.test(f)),
    "Sports Center": allPublicImages.filter(f => /kitesurf|kite|atv|horse|jump|wave|surf|paddle|ocean-water|swim|boys-jumping/i.test(f)),
    "Restaurant": allPublicImages.filter(f => /food|stall|patio|dining|restaurant|rock-house|skewers|market-stall|vegetable/i.test(f)),
    "Food & Dining": allPublicImages.filter(f => /food|stall|patio|dining|restaurant|rock-house|skewers|market-stall|vegetable/i.test(f)),
    "Attraction": allPublicImages.filter(f => /door|fort|church|tower|alley|palace|monkey|jozani|cave|acrobat|monument|ruins|market|stone-town/i.test(f))
  };
  function hashPick(str, arr) { let h=0; const st=String(str||""); for (let i=0;i<st.length;i++) h=(h*31+st.charCodeAt(i))>>>0; return arr[h%arr.length]; }
  eleventyConfig.addFilter("attractionImg", (name, category) => {
    if (attractionImage[name]) return attractionImage[name];
    const catPool = attrCategoryArrays[category] || attrCategoryArrays["Attraction"];
    if (catPool && catPool.length > 0) return hashPick(name, catPool);
    return "default-tour-hero.jpg";
  });

  // Add filter to get descriptive attraction type label (fixes CUL CUL CUL)
  eleventyConfig.addFilter("attractionTypeLabel", (type) => {
    const label = attractionTypeLabels[type.toLowerCase()] || attractionTypeLabels[type] || type || "Attraction";
    return label;
  });

  // Add urlencode filter for WhatsApp message encoding
  eleventyConfig.addFilter("urlencode", (str) => {
    return encodeURIComponent(String(str || ""));
  });

  // Deduplicate tour categories for area cards (fixes Cultural Cultural glitch)
  eleventyConfig.addNunjucksFilter("zoneCategories", function(tourSlugs, toursList) {
    if (!Array.isArray(tourSlugs) || !Array.isArray(toursList)) return [];
    const set = new Set();
    tourSlugs.forEach(slug => {
      const tour = toursList.find(t => t.seo_slug === slug || t.slug === slug);
      if (tour && tour.category) set.add(tour.category);
    });
    return Array.from(set);
  });

// Map attraction type to badge class prefix
  eleventyConfig.addFilter("attractionBadgeClass", (type) => {
    const label = attractionTypeLabels[type.toLowerCase()] || attractionTypeLabels[type] || (type || "").toLowerCase();
    // Map labels to badge class prefixes
    const badgeMap = {
      cultural: "cultural",
      diving: "diving",
      dining: "dining",
      "water activities": "water-activities",
      "ocean & adventure": "ocean-adventure",
      nature: "nature",
      safari: "safari",
      package: "package",
    };
    return badgeMap[label] || "cultural";
  });

  // Map attraction type to descriptive label (fixes CUL CUL CUL: shows 'Cultural' instead of 'CUL/Attraction')
  const attractionTypeLabels = {
    "attraction": "Cultural",
    "attractions": "Cultural",
    "dive center": "Diving",
    "restaurant": "Dining",
    "water sports": "Water Activities",
    "CUL": "Cultural",
    "cul": "Cultural",
    "MAR": "Ocean & Adventure",
    "mar": "Ocean & Adventure",
    "NAT": "Nature",
    "nat": "Nature",
    "SAF": "Safari",
    "saf": "Safari",
    "PKG": "Package",
    "pkg": "Package"
  };

  // Map attraction/hotel zone (free text) → zoneImage pools with rotation
  const zoneAliases = {
    "stone town": "Stone Town", "stonetown": "Stone Town", "korwe": "Stone Town",
    "bungu": "Stone Town", "nungw": "Nungwi", "kendw": "Kendwa", "paje": "Paje", "jamb": "Jambiani",
    "kiwen": "Kiwengwa", "pongw": "Pongwe / Michamvi", "micha": "Michamvi / Pingwe",
    "pingw": "Michamvi / Pingwe", "bwej": "Bwejuu / Dongwe", "dongw": "Bwejuu / Dongwe",
    "kizim": "Kizimkazi / Dimbani", "makund": "Kizimkazi / Dimbani", "fumb": "Fumba / Mbweni", "mbwen": "Fumba / Mbweni",
    "matem": "Matemwe / Kigomani", "kigom": "Matemwe / Kigomani", "muyun": "Matemwe / Kigomani",
    "chake": "Chake Chake (Pemba)", "wete": "Chake Chake (Pemba)", "wambaa": "Wambaa Gulf / Makangale (Pemba)",
    "wamba": "Wambaa Gulf / Makangale (Pemba)", "makang": "Wambaa Gulf / Makangale (Pemba)", "wesha": "Wambaa Gulf / Makangale (Pemba)",
    "north,": "Wambaa Gulf / Makangale (Pemba)", "wambaa gulf": "Wambaa Gulf / Makangale (Pemba)"
  };
  // Hotel/attraction card photo pools — expanded to utilize all available authentic photos
  const zonePatterns = {
    "Stone Town": /stone-town|door|church|clock|alley|colonial|fort|palace|market|port/i,
    "Nungwi": /nungwi|beach-wedding|dhow-boat|children-playing-sand|beach-bicycle/i,
    "Kendwa": /kendwa|turquoise-water|sandbar|aerial-beach|wedding-arch/i,
    "Kiwengwa": /kiwengwa|aerial-resort|beach-front-hotel|palm-trees/i,
    "Pongwe / Michamvi": /pongwe|michamvi|rock-house|house-on-rock|patio/i,
    "Paje": /paje|kitesurf|palm-trees-thatched|white-sand|women-walking/i,
    "Jambiani": /jambiani|tidal-flats|sea-items|women-walking|rock-overhang/i,
    "Bwejuu / Dongwe": /bwejuu|dongwe|tidal-flats|beach-children|coastal/i,
    "Michamvi / Pingwe": /michamvi|pingwe|rock-house|house-on-rock/i,
    "Kizimkazi / Dimbani": /kizimkazi|dimbani|dolphin|boat-dolphins/i,
    "Fumba / Mbweni": /fumba|mbweni|aerial-beach|coastal-town|waterfront/i,
    "Matemwe / Kigomani": /matemwe|kigomani|boys-snorkeling|shallow-water/i,
    "Chake Chake (Pemba)": /pemba|chake|kite|sandbar|turquoise/i,
    "Wambaa Gulf / Makangale (Pemba)": /wambaa|makangale|boat|sea|sand/i
  };

  const zoneFiles = {};
  for (const [zKey, pattern] of Object.entries(zonePatterns)) {
    const matched = allPublicImages.filter(f => pattern.test(f));
    zoneFiles[zKey] = matched.length > 0 ? matched : [zoneImage[zKey] || "default-tour-hero.jpg"];
  }

  const zoneDefault = new Map(Object.entries(zoneImage).map(([k, v]) => [k, v]));
  eleventyConfig.addFilter("zoneImg", (zone, seed) => {
    const z = String(zone || "").toLowerCase().trim();
    for (const [frag, key] of Object.entries(zoneAliases)) {
      if (z.startsWith(frag) || z.includes(frag)) {
        return zoneImage[key] || "default-tour-hero.jpg";
      }
    }
    return zoneImage[zone] || "default-tour-hero.jpg";
  });

  // Dedicated hotel-only photo pool: authentic accommodation imagery (rooms, resorts,
  // beachfront hotels, pool terraces). Explicitly excludes village, classroom, livestock photos.
  const hotelPhotoPool = allPublicImages.filter(f => {
    if (/village|children|classroom|school|sheep|cows|herding|dirt-path|fishing-net|safari|lion|jeep/i.test(f)) return false;
    return /\b(hotel|room|resort|patio|pool|bed|beach-front|thatched-hut-beach)\b/i.test(f) ||
           f.includes("zanzibar-hotel-room-") ||
           f.includes("hotel-room-") ||
           f.includes("beach-front-hotel") ||
           f.includes("aerial-resort") ||
           f === "turquoise-ocean-pier-zanzibar-beach.jpg" ||
           f === "beach-wedding-arch-nungwi-zanzibar.jpg" ||
           f === "ocean-view-with-coastal-buildings.jpg" ||
           f === "zanzibar-beach-palm-trees-thatched-huts.jpg";
  });
  if (hotelPhotoPool.length === 0) {
    hotelPhotoPool.push("beach-front-hotel-palm-trees-people.jpg");
  }
  eleventyConfig.addFilter("hotelImg", () => "image-not-available.svg");

  // Prefer a real per-hotel photo (downloaded from the hotel's own site) when the
  // file exists; otherwise fall back to the hash-picked hotel pool photo.
  // Returns a bare filename (e.g. "hotels/beyond-mnemba-island.jpg") so that the
  // cdnFile filter builds the correct /images/... path.
  eleventyConfig.addFilter("hotelPhoto", (hotel) => {
    const photo = hotel && hotel.photo;
    if (photo && typeof photo === "string") {
      // Handle paths like "hotels/beyond-mnemba-island.jpg", "/images/hotels/baraza-resort-and-spa.jpg", etc.
      const cleaned = String(photo).replace(/^\//, ""); // strip leading slash
      // Strip any "hotels/" or "images/hotels/" prefix since photos live in public/images/hotels/
      const normalized = cleaned.replace(/^hotels\//, "").replace(/^images\/hotels\//, "");
      // Resolve against public/images/hotels/ because per-hotel photos live there
      const exists = fs.existsSync(path.join(__dirname, "public", "images", "hotels", normalized));
      if (exists) {
        // Return with hotels/ prefix for consistency across all mapped hotel photos
        return "hotels/" + normalized;
      }
    }
    return "image-not-available.svg";
  });

  eleventyConfig.addGlobalData("__intentMap", intentMap);

  eleventyConfig.addGlobalData("__metadataIndex", metadataIndex);

  // Helper function to normalize inputPath
  function normalizePath(inputPath) {
    if (!inputPath) return "";
    let p = inputPath;
    // Remove leading ./ or .\\
    if (p.startsWith("./")) p = p.slice(2);
    else if (p.startsWith(".\\")) p = p.slice(2);
    // Remove leading src/
    if (p.startsWith("src/")) p = p.slice(4);
    else if (p.startsWith("src\\")) p = p.slice(4);
    // Remove any leading path separators
    while (p.startsWith("/") || p.startsWith("\\")) {
      p = p.slice(1);
    }
    return p;
  }

  // Standalone featured image lookup (used by both filters)
  function getFeaturedImage(inputPath) {
    let featuredImage = "default-tour-hero.jpg";
    let featuredAlt = "";

    const tourPath = normalizePath(inputPath);

    let slug = "";
    if (tourPath.startsWith("pages/tours/")) {
      slug = tourPath.replace("pages/tours/", "").replace(/\.(njk|md)$/, "");
    }

    if (slug && slugMap[slug]) {
      const mapSlug = slugMap[slug];
      if (metadataIndex[mapSlug]) {
        featuredImage = metadataIndex[mapSlug].file || mapSlug;
        featuredAlt = metadataIndex[mapSlug].alt_text || "";
      } else {
        featuredImage = mapSlug;
        featuredAlt = "";
      }
    }

    // Area pages: use the zone's canonical pool image so og:image matches the
    // visible hero, instead of falling back to default-tour-hero.jpg.
    if (tourPath.startsWith("pages/areas/")) {
      const areaSlug = tourPath.replace("pages/areas/", "").replace(/\.(njk|md)$/, "");
      const zoneKey = (Object.entries(zoneAliases).find(([frag]) => areaSlug.startsWith(frag)) || [])[1] || "Stone Town";
      const pool = zoneFiles[zoneKey] || [zoneImage[zoneKey] || "default-tour-hero.jpg"];
      featuredImage = pool[0];
      featuredAlt = metadataIndex[featuredImage]?.alt_text || "";
    }

    // Blog pages: use blogSlugMap for hero images
    if (tourPath.startsWith("pages/blog/")) {
      const blogSlug = tourPath.replace("pages/blog/", "").replace(/\.(njk|md)$/, "");
      if (blogSlugMap[blogSlug]) {
        const mapSlug = blogSlugMap[blogSlug];
        if (metadataIndex[mapSlug]) {
          featuredImage = metadataIndex[mapSlug].file || mapSlug;
          featuredAlt = metadataIndex[mapSlug].alt_text || "";
        } else {
          featuredImage = mapSlug;
          featuredAlt = "";
        }
      }
    }

    if (!featuredImage && tourPath) {
      const directKey = Object.keys(metadataIndex).find(k => 
        k === tourPath || k.includes(tourPath) || tourPath.includes(k)
      );
      if (directKey && metadataIndex[directKey]) {
        featuredImage = metadataIndex[directKey].file || "";
        featuredAlt = metadataIndex[directKey].alt_text || "";
      }
    }

    if (!featuredImage) {
      featuredImage = "default-tour-hero.jpg";
    }
    if (!featuredAlt) {
      featuredAlt = "";
    }

    return { featuredImage: featuredImage || "default-tour-hero.jpg", featuredAlt: featuredAlt || "" };
  }

  // Add filter to get featured image for a page - prioritizes metadataIndex over slugMap
  // Ensures consistent alt text for the same image across all tour pages (fixes ALT_VARIES_SAME_IMG)
  eleventyConfig.addNunjucksFilter("featuredImage", function(inputPath) {
    return getFeaturedImage(inputPath);
  });

  // Add filter to get hero image with Netlify Image CDN wrapper (fixes IMG_BIG).
  // NB the Netlify CDN needs the path WITH the /images/ prefix, else it 404s.
  // For local development, use direct image paths instead of Netlify CDN
  eleventyConfig.addNunjucksFilter("cdnImage", function(inputPath) {
    const result = getFeaturedImage(inputPath);
    const file = result.featuredImage || "default-tour-hero.jpg";

    // Check if we're running on Netlify or localhost
    const isNetlify = process.env.NETLIFY || process.env.URL || process.env.DEPLOY_PRIME_URL;
    if (isNetlify) {
      return `/.netlify/images?url=${encodeURIComponent("/images/" + file)}&fm=webp&q=85`;
    }

    // For local development, use direct image path
    return `/images/${file}`;
  });

  // Wrap an arbitrary image filename in the Netlify Image CDN URL (for card images
  // selected by hotelImg/zoneImg/trImg/etc, which return bare filenames).
  eleventyConfig.addNunjucksFilter("cdnFile", function(file) {
    const f = String(file || "default-tour-hero.jpg");

    // Check if we're running on Netlify or localhost
    const isNetlify = process.env.NETLIFY || process.env.URL || process.env.DEPLOY_PRIME_URL;
    if (isNetlify) {
      return `/.netlify/images?url=${encodeURIComponent("/images/" + f)}&fm=webp&q=85`;
    }

    // For local development, use direct image path
    return `/images/${f}`;
  });

  // Canonical alt text filter ensuring exact identical alt text for every image site-wide
  eleventyConfig.addNunjucksFilter("canonicalAlt", function(file, fallback) {
    const f = String(file || "").replace(/^\/images\//, "").replace(/\?.*$/, "");
    if (metadataIndex[f] && metadataIndex[f].alt_text) {
      return metadataIndex[f].alt_text;
    }
    return fallback || metadataIndex["default-tour-hero.jpg"]?.alt_text || "Spice and Sail Zanzibar";
  });

  // Add filter to get raw hero image path (for GitHub Pages / non-Netlify hosts)
  eleventyConfig.addNunjucksFilter("rawImage", function(inputPath) {
    const result = getFeaturedImage(inputPath);
    return `/images/${result.featuredImage || "default-tour-hero.jpg"}`;
  });

  // Add filter to get intent for a page
  eleventyConfig.addNunjucksFilter("pageIntent", function(inputPath) {
    if (!inputPath) return intentMap.default;
    const tourPath = normalizePath(inputPath);
    return intentMap[tourPath] || intentMap.default;
  });

  // Enable deep data merging
  eleventyConfig.setDataDeepMerge(true);
  
  // Add a filter for JSON stringification (useful for JSON‑LD)
  eleventyConfig.addNunjucksFilter("json", function(value) {
    return JSON.stringify(value);
  });
  
  // Add limit filter for arrays
  eleventyConfig.addNunjucksFilter("limit", function(arr, n) {
    if (!Array.isArray(arr)) return arr;
    return arr.slice(0, n);
  });
  
  // Add contains filter for strings/arrays
  eleventyConfig.addNunjucksFilter("contains", function(haystack, needle) {
    if (typeof haystack === 'string') {
      return haystack.includes(needle);
    }
    if (Array.isArray(haystack)) {
      return haystack.includes(needle);
    }
    return false;
  });

  // Filter a collection (hotels/attractions/tours) by zone name.
  // Hotels & attractions store their zone in `zone`; tours store a free-text
  // `location` (e.g. "Stone Town / Kidichi / Changuu"). Zone strings and page
  // titles use inconsistent separators ("Bwejuu / Dongwe" vs "Bwejuu & Dongwe",
  // "Chake Chake (Pemba)" vs "Chake Chake, Pemba"), so we normalize punctuation
  // away and match on shared tokens: every significant word in the requested
  // zone must appear in the item's zone/location. This keeps a tour that lists
  // several areas appearing on each of those pages.
  eleventyConfig.addNunjucksFilter("filterByZone", function(items, zone) {
    if (!Array.isArray(items)) return [];
    const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const zTokens = norm(zone).split(/\s+/).filter(Boolean);
    if (zTokens.length === 0) return [];

    // Explicit zone mapping for sub-villages/settlements belonging to a regional area page
    const subZoneMap = {
      "makunduchi": ["kizimkazi", "dimbani"],
    };

    return items.filter(item => {
      const isTour = Boolean(item.location && !item.zone);
      const valTokens = norm(item.zone || item.location || "").split(/\s+/).filter(Boolean);

      // Direct token match (e.g. 'kizimkazi dimbani' in 'kizimkazi / dimbani')
      if (zTokens.every(t => valTokens.includes(t))) return true;

      // Sub-village regional mapping (e.g. Makunduchi belongs to Kizimkazi & Dimbani / South Coast area)
      for (const vt of valTokens) {
        const parents = subZoneMap[vt];
        if (parents && zTokens.every(t => parents.includes(t))) {
          return true;
        }
      }

      // For tours with multi-stop or free-text locations: match if a distinct primary token of the zone is included
      if (isTour) {
        const stopWords = new Set(["and", "or", "unguja", "pemba", "island", "main"]);
        const keyZoneTokens = zTokens.filter(t => !stopWords.has(t));
        if (zTokens.includes("pongwe") && !valTokens.includes("pongwe")) return false;
        return keyZoneTokens.some(t => valTokens.includes(t));
      }

      return false;
    });
  });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      data: "data",
      output: "dist"
    },
    templateFormats: ["njk", "md", "html"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk"
  };
};
