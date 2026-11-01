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
    "stone-town-walking-tour": "mariola-grobelska-4DhGPppqcDE-unsplash.jpg",
    "stone-town-spice-prison-combo": "zanzibar-stone-town-nakupenda-dhow-boats.jpg",
    "spice-farm": "nutmeg-spice-farm-zanzibar.jpg",
    "village-community-tour": "stone-town-darajani-market-fresh-produce-vegetables.jpg",
    "safari-blue": "zanzibar-traditional-wooden-boat-turquoise-water.jpg",
    "mnemba-snorkeling": "mnemba-atoll-snorkeling-green-sea-turtle.jpg",
    "prison-island-nakupenda": "prison-island-wooden-pier-boats-zanzibar.jpg",
    "nakupenda-sandbank": "zanzibar-nakupenda-sandbank-prison-island-tour.jpg",
    "chumbe-island": "mnemba-atoll-snorkeling-tropical-fish-coral.jpg",
    "sunset-dhow-cruise": "zanzibar-nungwi-sunset-dhow-cruise-ocean.jpg",
    "kizimkazi-dolphin-tour": "kizimkazi-zanzibar-dolphins-jumping-indian-ocean.jpg",
    "jozani-forest": "jozani-forest-red-colobus-monkeys.jpg",
    "kuza-cave-seaweed": "seaweed-farming-zanzibar-coast.jpg",
    "mikumi-nyerere-day-safari": "lukasz-lu8BMgAs64Q-unsplash.jpg",
    "serengeti-3day-flyin": "masai-giraffe-close-up-tanzania-safari.jpg",
    "zanzibar-essentials-3day": "packing-beach.jpg",
    "zanzibar-essentials-3-day-pass": "packing-beach.jpg"
  };

  // Map area zone name → existing image filename (for /areas/ cards and zone pages)
  const zoneImage = {
    "Stone Town": "mariola-grobelska-4DhGPppqcDE-unsplash.jpg",
    "Nungwi": "nungwi-beach-children-swimming-traditional-dhow-boats.jpg",
    "Kendwa": "zanzibar-kendwa-beach-aerial-dhow-kayak.jpg",
    "Paje": "paje-beach-zanzibar-kitesurfing-indian-ocean.jpg",
    "Jambiani": "zanzibar-jambiani-beach-village-life-women.jpg",
    "Kiwengwa": "zanzibar-northeast-coast-fishing-boats-low-tide.jpg",
    "Pongwe / Michamvi": "the-rock-restaurant-michamvi-pingwe-zanzibar.jpg",
    "Bwejuu / Dongwe": "zanzibar-jambiani-beach-low-tide-local-children.jpg",
    "Michamvi / Pingwe": "the-rock-restaurant-michamvi-pingwe-zanzibar.jpg",
    "Kizimkazi / Dimbani": "kizimkazi-zanzibar-dolphins-jumping-indian-ocean.jpg",
    "Fumba / Mbweni": "zanzibar-fumba-beach-aerial-view-turquoise-water.jpg",
    "Matemwe / Kigomani": "zanzibar-local-snorkeling-mnemba-atoll-matemwe.jpg",
    "Chake Chake (Pemba)": "chake-chake-town.jpg",
    "Wambaa Gulf / Makangale (Pemba)": "zanzibar-traditional-wooden-boat-turquoise-water.jpg"
  };

  // Load all 6 metadata JSON files to build a filename→metadata lookup
  const metadataFiles = [
    "complete-image-metadata.json",
    "image-metadata.json",
    "personal-photo-metadata-updated.json",
    "personal-photo-metadata.json",
    "stock-photo-metadata-updated.json",
    "stock-photo-metadata.json"
  ];
  const metadataIndex = {};
  metadataFiles.forEach(metadataFile => {
    try {
      const metadata = JSON.parse(fs.readFileSync(path.join(__dirname, "src", "data", metadataFile), "utf8"));
      const entries = Array.isArray(metadata) ? metadata : (metadata.images || metadata.metadata || []);
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
    "Baraka Aquarium (Main)": "mnemba-atoll-snorkeling-green-sea-turtle.jpg",
    "Baraka Natural Aquarium": "migration-turtle.jpg",
    "Cheetah's Rock": "jozani-forest-sykes-monkey-zanzibar-wildlife-2.jpg",
    "Forodhani Market (Official)": "stone-town-forodhani-gardens-night-food-market.jpg",
    "Fukuchani Ruins": "stone-town-old-fort-guided-walking-tour.jpg",
    "House of Wonders": "stone-town-house-of-wonders.jpg",
    "House of Wonders (Official)": "stone-town-house-of-wonders.jpg",
    "Jozani Chwaka Bay Nat. Park": "jozani-forest-red-colobus-monkey.jpg",
    "Kuza Cave": "zanzibar-jambiani-beach-low-tide-local-children.jpg",
    "Mangapwani Slave Chambers": "stone-town-former-slave-market.jpg",
    "Menai Bay Conservation": "zanzibar-traditional-wooden-boat-turquoise-water.jpg",
    "Mnarani Marine Turtle Pond": "migration-turtle.jpg",
    "Mrembo Spa & Traditional Services": "stone-town-courtyard-restaurant-emerson-spice.jpg",
    "Nakupenda Sandbank": "zanzibar-nakupenda-sandbank-prison-island-tour.jpg",
    "Nakupenda Sandbank (Tour)": "zanzibar-nakupenda-sandbank-prison-island-tour.jpg",
    "Old Fort (Cultural Desk)": "stone-town-old-fort-guided-walking-tour.jpg",
    "Old Fort (Ngome Kongwe)": "stone-town-old-fort-guided-walking-tour.jpg",
    "Palace Museum": "stone-town-port-and-beach.jpg",
    "Palace Museum (Official)": "stone-town-port-and-beach.jpg",
    "Princess Salme Spice Garden": "nutmeg-spice-farm-zanzibar.jpg",
    "Prison Island (Changuu)": "prison-island-wooden-pier-boats-zanzibar.jpg",
    "Prison Island (Tour Desk)": "prison-island-wooden-pier-boats-zanzibar.jpg",
    "Seaweed Center Paje": "seaweed-farming-zanzibar-coast.jpg",
    "Spice Farm Tour (Kidichi)": "nutmeg-spice-farm-zanzibar.jpg",
    "Stone Town Food Market": "stone-town-darajani-market-fresh-produce-vegetables.jpg",
    "Zanzibar Butterfly (Park)": "jozani-forest-red-colobus-monkeys.jpg",
    "Zanzibar Horse Riding (Nungwi)": "horse-riding-in-zanzibar-ocean-2.jpg",
    "ZIFF Festival Center": "stone-town-courtyard-restaurant-emerson-spice.jpg",
    "The Rock Restaurant": "the-rock-restaurant-michamvi-pingwe-zanzibar.jpg",
    "Old Fort": "stone-town-old-fort-guided-walking-tour.jpg",
    "Palace Museum": "stone-town-port-and-beach.jpg",
    "Nakupenda Sandbank": "zanzibar-nakupenda-sandbank-prison-island-tour.jpg",
    "House of Wonders": "stone-town-house-of-wonders.jpg",
    "Forodhani Market": "stone-town-forodhani-gardens-night-food-market.jpg",
    "Prison Island": "prison-island-wooden-pier-boats-zanzibar.jpg",
    "Baraka Aquarium": "mnemba-atoll-snorkeling-green-sea-turtle.jpg",
    "Spice Farm Tour": "nutmeg-spice-farm-zanzibar.jpg",
    "Nungwi Beach": "nungwi-beach-children-swimming-traditional-dhow-boats.jpg",
    "Mnarani Marine Turtle Pond": "migration-turtle.jpg",
    "Kuza Cave": "zanzibar-jambiani-beach-low-tide-local-children.jpg"
  };
  const attrCategoryArrays = {
    "Dive Center": ["zanzibar-marine-1.jpg","jozani-forest-red-colobus-monkey.jpg","zanzibar-snorkeling-coral-reef-shallow-water.jpg","mnemba-atoll-snorkeling-blue-tang-fish.jpg","mnemba-atoll-snorkeling-coral-reef-fish-2.jpg","mnemba-atoll-snorkeling-coral-reef-fish-3.jpg","mnemba-atoll-snorkeling-coral-reef-fish-4.jpg","mnemba-atoll-snorkeling-coral-reef-fish-5.jpg","mnemba-atoll-snorkeling-coral-reef-fish-6.jpg","mnemba-atoll-snorkeling-coral-reef-fish-7.jpg","zanzibar-diving-boat-trip.jpg","snorkeling-underwater-boat-ladder.jpg","zanzibar-local-snorkeling-mnemba-atoll-matemwe.jpg","mnemba-atoll-snorkeling-tropical-fish-coral.jpg","mnemba-atoll-snorkeling-green-sea-turtle.jpg"],
    "Water Sports": ["zanzibar-marine-1.jpg","jozani-forest-red-colobus-monkey.jpg","paje-beach-zanzibar-kitesurfing-indian-ocean.jpg","horse-riding-in-zanzibar-ocean-2.jpg","quad-biking-zanzibar-countryside.jpg"],
    "Restaurant": ["zanzibar-food-1.jpg","zanzibar-food-2.jpg","the-rock-restaurant-michamvi-pingwe-zanzibar.jpg"],
    "Attraction": ["kizimkazi-dolphin-snorkeling.jpg","stone-town-culture-2.jpg","zanzibar-stone-town-waterfront-view-from-ocean.jpg","zanzibar-market-scene-local-life.jpg","maasai-herder-traditional-village-zanzibar.jpg"]
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
  const zoneFiles = {
    "Stone Town": ["mariola-grobelska-4DhGPppqcDE-unsplash.jpg","stone-town-house-of-wonders.jpg","anglican-cathedral-stone-town.jpg","stone-town-st-josephs-cathedral.jpg","stone-town-port-and-beach.jpg","stone-town-courtyard-restaurant-emerson-spice.jpg","stone-town-forodhani-gardens-night-food-market.jpg","stone-town-former-slave-market.jpg"],
    "Nungwi": ["nungwi-beach-children-swimming-traditional-dhow-boats.jpg","nungwi-beach-aerial-view-resorts-coastline.jpg","zanzibar-fishermen-traditional-ngalawa-boat-nungwi.jpg","zanzibar-beach-bicycle-coconuts-nungwi.jpg","zanzibar-nungwi-sunset-dhow-cruise-ocean.jpg"],
    "Kendwa": ["zanzibar-kendwa-beach-aerial-dhow-kayak.jpg","zanzibar-beach-wedding-setup-nungwi-kendwa.jpg"],
    "Paje": ["paje-beach-zanzibar-kitesurfing-indian-ocean.jpg","zanzibar-paje-beach-women-walking-palm-trees.jpg","traditional-zanzibar-ngalawa-fishing-boat-paje.jpg"],
    "Jambiani": ["zanzibar-jambiani-beach-village-life-women.jpg","zanzibar-jambiani-beach-low-tide-local-children.jpg","seaweed-farming-zanzibar-coast.jpg"],
    "Bwejuu / Dongwe": ["zanzibar-jambiani-beach-low-tide-local-children.jpg","zanzibar-jambiani-beach-village-life-women.jpg"],
    "Michamvi / Pingwe": ["the-rock-restaurant-michamvi-pingwe-zanzibar.jpg","the-rock-restaurant-michamvi-pingwe-zanzibar-3.jpg","michamvi-rock-restaurant-interaction.jpg"],
    "Kizimkazi / Dimbani": ["kizimkazi-zanzibar-dolphins-jumping-indian-ocean.jpg","kizimkazi-dolphin-snorkeling.jpg"],
    "Fumba / Mbweni": ["zanzibar-fumba-beach-aerial-view-turquoise-water.jpg","zanzibar-traditional-wooden-boat-turquoise-water.jpg"],
    "Matemwe / Kigomani": ["zanzibar-local-snorkeling-mnemba-atoll-matemwe.jpg","mnemba-atoll-snorkeling-coral-reef-fish-6.jpg"],
    "Chake Chake (Pemba)": ["chake-chake-town.jpg"],
    "Wambaa Gulf / Makangale (Pemba)": ["zanzibar-traditional-wooden-boat-turquoise-water.jpg","zanzibar-diving-boat-trip.jpg"]
  };
  const zoneDefault = new Map(Object.entries(zoneImage).map(([k, v]) => [k, v]));
  eleventyConfig.addFilter("zoneImg", (zone, seed) => {
    const z = String(zone || "").toLowerCase().trim();
    for (const [frag, key] of Object.entries(zoneAliases)) if (z.startsWith(frag)) {
      return hashPick(seed || zone, zoneFiles[key] || [zoneImage[key]]);
    }
    return hashPick(seed || z, ["zanzibar-beach-1.jpg", "zanzibar-beach-2.jpg", "zanzibar-northeast-coast-fishing-boats-low-tide.jpg", "zanzibar-kendwa-beach-aerial-dhow-kayak.jpg", "zanzibar-jambiani-beach-village-life-women.jpg", "zanzibar-stone-town-waterfront-view-from-ocean.jpg"]);
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

  // Add filter to get hero image with Netlify Image CDN wrapper (fixes IMG_BIG)
  eleventyConfig.addNunjucksFilter("cdnImage", function(inputPath) {
    const result = getFeaturedImage(inputPath);
    const cdnUrl = `/.netlify/images?url=${encodeURIComponent(result.featuredImage || "default-tour-hero.jpg")}&fm=webp&q=85`;
    return cdnUrl;
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
