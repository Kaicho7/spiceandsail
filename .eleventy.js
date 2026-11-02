module.exports = function(eleventyConfig) {
  // Passthrough copy for static assets - copy contents of public to output root
  eleventyConfig.addPassthroughCopy({"public/css": "css"});
  eleventyConfig.addPassthroughCopy({"public/js": "js"});
  eleventyConfig.addPassthroughCopy({"public/images": "images"});
  // Copy _headers into the publish dir (Netlify applies custom headers from dist)
  eleventyConfig.addPassthroughCopy({"_headers": "_headers"});
  
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
  
  // Map tour slug → existing image filename (1-to-1 mandatory verified assets)
  const slugMap = {
    "stone-town-walking-tour": "stone-town-ornate-carved-door-arch.jpg",
    "stone-town-spice-prison-combo": "stone-town-ornate-carved-door-arch.jpg",
    "spice-farm": "pineapples-growing-in-tropical-plantation.jpg",
    "village-community-tour": "vegetable-stall-at-outdoor-market.jpg",
    "safari-blue": "aerial-beach-dhow-people-turquoise-water.jpg",
    "mnemba-snorkeling": "dolphins-swimming-near-boat-tour.jpg",
    "prison-island-nakupenda": "boats-pier-under-cloudy-sky-water.jpg",
    "nakupenda-sandbank": "turquoise-water-sandbar-lone-boat.jpg",
    "chumbe-island": "underwater-fish-coral-reef-zanzibar.jpg",
    "sunset-dhow-cruise": "dhow-sail-nungwi-beach-zanzibar.jpg",
    "kizimkazi-dolphin-tour": "dolphins-swimming-near-boat-tour.jpg",
    "jozani-forest": "red-colobus-monkey-baby-jozani-forest.jpg",
    "kuza-cave-seaweed": "people-swimming-turquoise-water-steps.jpg",
    "mikumi-nyerere-day-safari": "elephant-savanna-landscape-tanzania.jpg",
    "serengeti-3day-flyin": "elephant-savanna-landscape-tanzania.jpg",
    "zanzibar-essentials-3day": "aerial-beach-dhow-people-turquoise-water.jpg",
    "zanzibar-essentials-3-day-pass": "aerial-beach-dhow-people-turquoise-water.jpg"
  };

  // Map area zone name → existing image filename (for /areas/ cards and zone pages)
  const zoneImage = {
    "Stone Town": "stone-town-ornate-carved-door-arch.jpg",
    "Nungwi": "nungwi-beach-aerial-resort-turquoise-water.jpg",
    "Kendwa": "nungwi-beach-aerial-resort-turquoise-water.jpg",
    "Paje": "zanzibar-beach-palm-trees-thatched-huts.jpg",
    "Jambiani": "women-walking-beach-zanzibar-palm-trees.jpg",
    "Kiwengwa": "beach-front-hotel-palm-trees-people.jpg",
    "Pongwe / Michamvi": "zanzibar-rock-house-with-tourists.jpg",
    "Bwejuu / Dongwe": "beach-front-hotel-palm-trees-people.jpg",
    "Michamvi / Pingwe": "zanzibar-rock-house-with-tourists.jpg",
    "Kizimkazi / Dimbani": "dolphins-swimming-near-boat-tour.jpg",
    "Fumba / Mbweni": "aerial-beach-dhow-people-turquoise-water.jpg",
    "Matemwe / Kigomani": "sea-turtle-snorkeling-coral-reef.jpg",
    "Chake Chake (Pemba)": "zanzibar-beach-people-playing-kites.jpg",
    "Wambaa Gulf / Makangale (Pemba)": "dhow-sail-nungwi-beach-zanzibar.jpg"
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
    "Baraka Aquarium (Main)": "sea-turtles-swimming-zanzibar-water.jpg",
    "Baraka Natural Aquarium": "sea-turtles-swimming-zanzibar-water.jpg",
    "Cheetah's Rock": "janzibar-jozani-forest-monkey-peeking-leaves.jpg",
    "Forodhani Market (Official)": "zanzibar-night-food-stall-skewers-bread.jpg",
    "Fukuchani Ruins": "stone-town-walking-tour-people-photograph.jpg",
    "House of Wonders": "stone-town-colonial-building-clock-tower.jpg",
    "House of Wonders (Official)": "stone-town-colonial-building-clock-tower.jpg",
    "Jozani Chwaka Bay Nat. Park": "woman-smiling-next-to-monkey-jozani-forest.jpg",
    "Kuza Cave": "people-swimming-turquoise-water-steps.jpg",
    "Mangapwani Slave Chambers": "stone-statue-chained-person-zanzibar.jpg",
    "Menai Bay Conservation": "dhow-boat-turquoise-water-zanzibar.jpg",
    "Mnarani Marine Turtle Pond": "sea-turtles-with-child-zanzibar.jpg",
    "Mrembo Spa & Traditional Services": "hand-holding-nutmeg-fruits-zanzibar.jpg",
    "Nakupenda Sandbank": "turquoise-water-sandbar-lone-boat.jpg",
    "Nakupenda Sandbank (Tour)": "turquoise-water-sandbar-lone-boat.jpg",
    "Old Fort (Cultural Desk)": "stone-town-walking-tour-people-photograph.jpg",
    "Old Fort (Ngome Kongwe)": "stone-town-walking-tour-people-photograph.jpg",
    "Palace Museum": "waterfront-buildings-zanzibar-coast.jpg",
    "Palace Museum (Official)": "waterfront-buildings-zanzibar-coast.jpg",
    "Princess Salme Spice Garden": "hand-holding-nutmeg-fruits-zanzibar.jpg",
    "Prison Island (Changuu)": "boats-pier-under-cloudy-sky-water.jpg",
    "Prison Island (Tour Desk)": "boats-pier-under-cloudy-sky-water.jpg",
    "Seaweed Center Paje": "people-collecting-sea-items-zanzibar-beach.jpg",
    "Spice Farm Tour (Kidichi)": "hand-holding-nutmeg-fruits-zanzibar.jpg",
    "Stone Town Food Market": "vegetable-stall-at-outdoor-market.jpg",
    "Zanzibar Butterfly (Park)": "jozani-forest-walking-path-green-arches.jpg",
    "Zanzibar Horse Riding (Nungwi)": "women-horse-riding-ocean-water-zanzibar.jpg",
    "ZIFF Festival Center": "stone-town-colonial-building-clock-tower.jpg",
    "The Rock Restaurant": "zanzibar-rock-house-with-tourists.jpg",
    "Old Fort": "stone-town-walking-tour-people-photograph.jpg",
    "Palace Museum": "waterfront-buildings-zanzibar-coast.jpg",
    "Nakupenda Sandbank": "turquoise-water-sandbar-lone-boat.jpg",
    "House of Wonders": "stone-town-colonial-building-clock-tower.jpg",
    "Forodhani Market": "zanzibar-night-food-stall-skewers-bread.jpg",
    "Prison Island": "boats-pier-under-cloudy-sky-water.jpg",
    "Baraka Aquarium": "sea-turtles-swimming-zanzibar-water.jpg",
    "Spice Farm Tour": "hand-holding-nutmeg-fruits-zanzibar.jpg",
    "Nungwi Beach": "children-wading-beach-dhow-boats.jpg",
    "Mnarani Marine Turtle Pond": "sea-turtles-with-child-zanzibar.jpg",
    "Kuza Cave": "people-swimming-turquoise-water-steps.jpg"
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
    "Water Sports": allPublicImages.filter(f => /kitesurf|atv|horse|boat|dhow|sail|surf|ocean-water/i.test(f)),
    "Restaurant": allPublicImages.filter(f => /food|stall|patio|dining|restaurant|rock-house|skewers|market-stall|vegetable/i.test(f)),
    "Attraction": allPublicImages.filter(f => /door|fort|church|tower|alley|palace|monkey|jozani|cave|acrobat|monument|ruins|market|stone-town/i.test(f))
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
    for (const [frag, key] of Object.entries(zoneAliases)) if (z.startsWith(frag)) {
      return hashPick(seed || zone, zoneFiles[key] || [zoneImage[key]]);
    }
    return hashPick(seed || z, ["zanzibar-beach-people-playing-kites.jpg","woman-child-beach-zanzibar-ocean.jpg","turquoise-water-sandbar-lone-boat.jpg","aerial-beach-boat-turquoise-water.jpg","women-walking-beach-zanzibar-palm-trees.jpg","thatched-hut-beach-zanzibar-coast.jpg"]);
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
