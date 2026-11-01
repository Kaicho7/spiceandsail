module.exports = function(eleventyConfig) {
  // Passthrough copy for static assets - copy contents of public to output root
  eleventyConfig.addPassthroughCopy({"public/css": "css"});
  eleventyConfig.addPassthroughCopy({"public/js": "js"});
  eleventyConfig.addPassthroughCopy({"public/images": "images"});
  
  // Load tours.json using fs
  const fs = require("fs");
  const path = require("path");
  const slugify = require("slugify");
  let toursData = {};
  try {
    toursData = JSON.parse(fs.readFileSync(path.join("./", "_data", "tours.json"), "utf8"));
  } catch(e) {
    try {
      toursData = JSON.parse(fs.readFileSync(path.join("./src", "data", "tours.json"), "utf8"));
    } catch(e2) {
      toursData = {};
    }
  }
  
  // Map tour slug → existing image filename (keyword-scored heroes from SEO re-tag)
  const slugMap = {
    "stone-town-walking-tour": "stone-town-alley-walking-tour-people.jpg",
    "stone-town-spice-prison-combo": "dhows-floating-turquoise-sea-zanzibar.jpg",
    "spice-farm": "hand-holding-nutmeg-fruits-zanzibar.jpg",
    "village-community-tour": "vegetable-stall-at-outdoor-market.jpg",
    "safari-blue": "dhow-boat-turquoise-water-zanzibar.jpg",
    "mnemba-snorkeling": "sea-turtle-snorkeling-coral-reef.jpg",
    "prison-island-nakupenda": "boats-pier-under-cloudy-sky-water.jpg",
    "nakupenda-sandbank": "beach-stairs-people-boats-cloudy-sky.jpg",
    "chumbe-island": "underwater-fish-coral-reef-zanzibar.jpg",
    "sunset-dhow-cruise": "dhow-sail-at-sunset-ocean.jpg",
    "kizimkazi-dolphin-tour": "dolphins-leaping-ocean-zanzibar.jpg",
    "jozani-forest": "jozani-forest-tourists-monkeys-wildlife.jpg",
    "kuza-cave-seaweed": "people-collecting-sea-items-zanzibar-beach.jpg",
    "mikumi-nyerere-day-safari": "safari-vehicle-lion-afar.jpg",
    "serengeti-3day-flyin": "giraffe-head-profile-trees-background.jpg",
    "zanzibar-essentials-3day": "stone-town-ornate-carved-door-calligraphy.jpg",
    "zanzibar-essentials-3-day-pass": "stone-town-ornate-carved-door-calligraphy.jpg"
  };

  // Map area zone name → existing image filename (for /areas/ cards and zone pages)
  const zoneImage = {
    "Stone Town": "stone-town-alley-walking-tour-people.jpg",
    "Nungwi": "children-wading-beach-dhow-boats.jpg",
    "Kendwa": "aerial-beach-boat-turquoise-water.jpg",
    "Paje": "zanzibar-beach-palm-trees-thatched-huts.jpg",
    "Jambiani": "women-walking-beach-zanzibar-palm-trees.jpg",
    "Kiwengwa": "dhow-boats-beach-zanzibar-sand.jpg",
    "Pongwe / Michamvi": "zanzibar-rock-house-with-tourists.jpg",
    "Bwejuu / Dongwe": "children-walking-tidal-flats-zanzibar.jpg",
    "Michamvi / Pingwe": "zanzibar-rock-house-with-tourists.jpg",
    "Kizimkazi / Dimbani": "dolphins-leaping-ocean-zanzibar.jpg",
    "Fumba / Mbweni": "aerial-beach-zanzibar-turquoise-water.jpg",
    "Matemwe / Kigomani": "boys-snorkeling-shallow-water-zanzibar.jpg",
    "Chake Chake (Pemba)": "zanzibar-beach-people-playing-kites.jpg",
    "Wambaa Gulf / Makangale (Pemba)": "dhow-boat-turquoise-water-zanzibar.jpg"
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
    "Baraka Aquarium (Main)": "sea-turtle-snorkeling-coral-reef.jpg",
    "Baraka Natural Aquarium": "josephine-monkey-jozani-forest-zanzibar-1.jpg",
    "Cheetah's Rock": "janzibar-jozani-forest-monkey-peeking-leaves.jpg",
    "Forodhani Market (Official)": "zanzibar-night-food-stall-skewers-bread.jpg",
    "Fukuchani Ruins": "stone-town-walking-tour-people-photograph.jpg",
    "House of Wonders": "stone-town-colonial-building-clock-tower.jpg",
    "House of Wonders (Official)": "stone-town-colonial-building-clock-tower.jpg",
    "Jozani Chwaka Bay Nat. Park": "woman-smiling-next-to-monkey-jozani-forest.jpg",
    "Kuza Cave": "children-walking-tidal-flats-zanzibar.jpg",
    "Mangapwani Slave Chambers": "stone-town-church-palm-tree-statues.jpg",
    "Menai Bay Conservation": "dhow-boat-turquoise-water-zanzibar.jpg",
    "Mnarani Marine Turtle Pond": "josephine-monkey-jozani-forest-zanzibar-1.jpg",
    "Mrembo Spa & Traditional Services": "zanzibar-restaurant-patio-with-palm-trees.jpg",
    "Nakupenda Sandbank": "beach-stairs-people-boats-cloudy-sky.jpg",
    "Nakupenda Sandbank (Tour)": "beach-stairs-people-boats-cloudy-sky.jpg",
    "Old Fort (Cultural Desk)": "stone-town-walking-tour-people-photograph.jpg",
    "Old Fort (Ngome Kongwe)": "stone-town-walking-tour-people-photograph.jpg",
    "Palace Museum": "aerial-port-coastal-beach-zebra.jpg",
    "Palace Museum (Official)": "aerial-port-coastal-beach-zebra.jpg",
    "Princess Salme Spice Garden": "hand-holding-nutmeg-fruits-zanzibar.jpg",
    "Prison Island (Changuu)": "boats-pier-under-cloudy-sky-water.jpg",
    "Prison Island (Tour Desk)": "boats-pier-under-cloudy-sky-water.jpg",
    "Seaweed Center Paje": "people-collecting-sea-items-zanzibar-beach.jpg",
    "Spice Farm Tour (Kidichi)": "hand-holding-nutmeg-fruits-zanzibar.jpg",
    "Stone Town Food Market": "vegetable-stall-at-outdoor-market.jpg",
    "Zanzibar Butterfly (Park)": "jozani-forest-tourists-monkeys-wildlife.jpg",
    "Zanzibar Horse Riding (Nungwi)": "women-horse-riding-ocean-water-zanzibar.jpg",
    "ZIFF Festival Center": "zanzibar-restaurant-patio-with-palm-trees.jpg",
    "The Rock Restaurant": "zanzibar-rock-house-with-tourists.jpg",
    "Old Fort": "stone-town-walking-tour-people-photograph.jpg",
    "Palace Museum": "aerial-port-coastal-beach-zebra.jpg",
    "Nakupenda Sandbank": "beach-stairs-people-boats-cloudy-sky.jpg",
    "House of Wonders": "stone-town-colonial-building-clock-tower.jpg",
    "Forodhani Market": "zanzibar-night-food-stall-skewers-bread.jpg",
    "Prison Island": "boats-pier-under-cloudy-sky-water.jpg",
    "Baraka Aquarium": "sea-turtle-snorkeling-coral-reef.jpg",
    "Spice Farm Tour": "hand-holding-nutmeg-fruits-zanzibar.jpg",
    "Nungwi Beach": "children-wading-beach-dhow-boats.jpg",
    "Mnarani Marine Turtle Pond": "josephine-monkey-jozani-forest-zanzibar-1.jpg",
    "Kuza Cave": "children-walking-tidal-flats-zanzibar.jpg"
  };
  const attrCategoryArrays = {
    "Dive Center": ["jozani-forest-group-coconut-pose.jpg","woman-smiling-next-to-monkey-jozani-forest.jpg","snorkeling-zanzibar-shallow-water-coral.jpg","tropical-fish-swimming-clear-water.jpg","coral-reef-underwater-fish-zanzibar.jpg","coral-reef-fish-snorkeling-zanzibar.jpg","underwater-coral-reef-fish-zanzibar-1.jpg","underwater-coral-reef-fish-zanzibar.jpg","underwater-coral-reef-fish-swimming.jpg","coral-reef-snorkeling-zanzibar-1.jpg","divers-on-boat-zanzibar-ocean.jpg","snorkeling-underwater-selfie-zanzibar.jpg","boys-snorkeling-shallow-water-zanzibar.jpg","underwater-fish-coral-reef-zanzibar.jpg","sea-turtle-snorkeling-coral-reef.jpg"],
    "Water Sports": ["jozani-forest-group-coconut-pose.jpg","woman-smiling-next-to-monkey-jozani-forest.jpg","kitesurfing-turquoise-ocean-zanzibar.jpg","women-horse-riding-ocean-water-zanzibar.jpg","atv-ride-dirt-path-green-landscape.jpg"],
    "Restaurant": ["zanzibar-night-food-stall-skewers-bread.jpg","street-food-stall-waterfront-zanzibar.jpg","zanzibar-rock-house-with-tourists.jpg"],
    "Attraction": ["snorkeling-with-dolphin-zanzibar-ocean.jpg","zanzibar-classroom-children-students.jpg","ocean-view-with-coastal-buildings.jpg","zanzibar-market-stalls-people-umbrellas.jpg","man-herding-sheep-village-huts.jpg"]
  };
  function hashPick(str, arr) { let h=0; const st=String(str||""); for (let i=0;i<st.length;i++) h=(h*31+st.charCodeAt(i))>>>0; return arr[h%arr.length]; }
eleventyConfig.addFilter("attractionImg", (name, category) =>
attractionImage[name] || hashPick(name, attrCategoryArrays[category] || attrCategoryArrays["Attraction"]));

  // Add filter to get descriptive attraction type label (fixes CUL CUL CUL)
  eleventyConfig.addFilter("attractionTypeLabel", (type) => {
    const label = attractionTypeLabels[type.toLowerCase()] || attractionTypeLabels[type] || type || "Attraction";
    return label;
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
    "kizim": "Kizimkazi / Dimbani", "fumb": "Fumba / Mbweni", "mbwen": "Fumba / Mbweni",
    "matem": "Matemwe / Kigomani", "kigom": "Matemwe / Kigomani", "muyun": "Matemwe / Kigomani",
    "chake": "Chake Chake (Pemba)", "wete": "Chake Chake (Pemba)", "wambaa": "Wambaa Gulf / Makangale (Pemba)",
    "wamba": "Wambaa Gulf / Makangale (Pemba)", "makang": "Wambaa Gulf / Makangale (Pemba)", "wesha": "Wambaa Gulf / Makangale (Pemba)",
    "north,": "Wambaa Gulf / Makangale (Pemba)", "wambaa gulf": "Wambaa Gulf / Makangale (Pemba)"
  };
  // Hotel/attraction card photo pools — several distinct existing images per zone, rotated by seed (name) so cards don't repeat
  // All pools are neutral beach/resort/landscape images suitable for hotel cards (no marine/wildlife/attraction photos)
  const zoneFiles = {
    "Stone Town": ["stone-town-alley-walking-tour-people.jpg","stone-town-colonial-building-clock-tower.jpg","church-altar-colorful-lights-religious-icons.jpg","stone-town-church-twin-towers-green-gate.jpg","aerial-port-coastal-beach-zebra.jpg","zanzibar-restaurant-patio-with-palm-trees.jpg","zanzibar-night-food-stall-skewers-bread.jpg","stone-town-church-palm-tree-statues.jpg"],
    "Nungwi": ["nungwi-beach-children-playing-sand.jpg","nungwi-beach-aerial-resort-turquoise-water.jpg","beach-bicycle-white-sand-zanzibar.jpg","zanzibar-beach-people-playing-kites.jpg","woman-child-beach-zanzibar-ocean.jpg"],
    "Kendwa": ["aerial-beach-boat-turquoise-water.jpg","beach-wedding-arch-nungwi-zanzibar.jpg","turquoise-water-sandbar-lone-boat.jpg"],
    "Kiwengwa": ["nungwi-beach-aerial-resort-turquoise-water.jpg","zanzibar-beach-palm-trees-sand-water.jpg","beach-front-hotel-palm-trees-people.jpg","zanzibar-beach-palm-trees-thatched-huts.jpg"],
    "Pongwe / Michamvi": ["zanzibar-rock-house-with-tourists.jpg","beach-front-hotel-palm-trees-people.jpg","zanzibar-house-on-rock-ocean-people.jpg","zanzibar-beach-palm-trees-sand-water.jpg"],
    "Paje": ["zanzibar-beach-palm-trees-thatched-huts.jpg","women-walking-beach-zanzibar-palm-trees.jpg","zanzibar-beach-women-walking-white-sand.jpg"],
    "Jambiani": ["women-walking-beach-zanzibar-palm-trees.jpg","children-walking-beach-zanzibar-sand-water.jpg","rock-overhang-beach-zanzibar-coast.jpg"],
    "Bwejuu / Dongwe": ["children-walking-tidal-flats-zanzibar.jpg","women-walking-beach-zanzibar-palm-trees.jpg","beach-children-sand-zanzibar.jpg"],
    "Michamvi / Pingwe": ["zanzibar-rock-house-with-tourists.jpg","zanzibar-house-on-rock-ocean-people.jpg","man-child-beach-fist-bump-nungwi-zanzibar.jpg"],
    "Kizimkazi / Dimbani": ["zanzibar-beach-people-playing-kites.jpg","children-walking-beach-zanzibar-sand-water.jpg","woman-walking-beach-palm-trees-zanzibar.jpg"],
    "Fumba / Mbweni": ["aerial-beach-zanzibar-turquoise-water.jpg","aerial-coastal-town-beach-turquoise-water.jpg","waterfront-buildings-zanzibar-coast.jpg"],
    "Matemwe / Kigomani": ["zanzibar-beach-palm-trees-thatched-huts.jpg","beach-children-sand-zanzibar.jpg","woman-child-beach-zanzibar-ocean.jpg"],
    "Chake Chake (Pemba)": ["zanzibar-beach-people-playing-kites.jpg","woman-child-beach-zanzibar-ocean.jpg","turquoise-water-sandbar-lone-boat.jpg"],
    "Wambaa Gulf / Makangale (Pemba)": ["woman-child-beach-zanzibar-ocean.jpg","turquoise-water-sandbar-lone-boat.jpg","zanzibar-beach-people-playing-kites.jpg"]
  };
  const zoneDefault = new Map(Object.entries(zoneImage).map(([k, v]) => [k, v]));
  eleventyConfig.addFilter("zoneImg", (zone, seed) => {
    const z = String(zone || "").toLowerCase().trim();
    for (const [frag, key] of Object.entries(zoneAliases)) if (z.startsWith(frag)) {
      return hashPick(seed || zone, zoneFiles[key] || [zoneImage[key]]);
    }
    return hashPick(seed || z, ["zanzibar-beach-people-playing-kites.jpg","woman-child-beach-zanzibar-ocean.jpg","turquoise-water-sandbar-lone-boat.jpg","aerial-beach-boat-turquoise-water.jpg","women-walking-beach-zanzibar-palm-trees.jpg","thatched-hut-beach-zanzibar-coast.jpg"]);
  });

  // Dedicated hotel-only photo pool: real accommodation imagery (rooms, resorts,
  // beachfront hotels). NEVER contains dhow/marine/tour/excursion photos.
  const hotelPhotoPool = [
    "nungwi-beach-aerial-resort-turquoise-water.jpg",
    "beach-front-hotel-palm-trees-people.jpg",
    "hotel-room-red-plaid-bed.jpg",
    "hotel-room-with-red-accent-bed.jpg",
    "hotel-room-with-two-beds-red-blankets.jpg",
    "zanzibar-hotel-room-orange-bed.jpg",
    "zanzibar-hotel-room-two-beds-red-linens.jpg",
    "zanzibar-hotel-room-three-beds.jpg",
    "zanzibar-hotel-room-bed-mosquito-net.jpg",
    "zanzibar-hotel-room-two-beds-mosquito-net.jpg",
    "zanzibar-hotel-room-bed-plaid-curtains.jpg",
    "zanzibar-hotel-room-three-beds-plaid.jpg",
    "zanzibar-hotel-room-two-beds.jpg",
    "zanzibar-hotel-room-two-single-beds.jpg",
    "zanzibar-hotel-room-two-beds-red-blankets.jpg"
  ];
  eleventyConfig.addFilter("hotelImg", (name) => hashPick(name || "hotel", hotelPhotoPool));

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
  eleventyConfig.addNunjucksFilter("cdnImage", function(inputPath) {
    const result = getFeaturedImage(inputPath);
    const file = result.featuredImage || "default-tour-hero.jpg";
    return `/.netlify/images?url=${encodeURIComponent("/images/" + file)}&fm=webp&q=85`;
  });

  // Wrap an arbitrary image filename in the Netlify Image CDN URL (for card images
  // selected by hotelImg/zoneImg/trImg/etc, which return bare filenames).
  eleventyConfig.addNunjucksFilter("cdnFile", function(file) {
    const f = String(file || "default-tour-hero.jpg");
    return `/.netlify/images?url=${encodeURIComponent("/images/" + f)}&fm=webp&q=85`;
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
