module.exports = function(eleventyConfig) {
  const fs = require("fs");
  const path = require("path");
  let analyticsId = "";
  try {
    const siteData = JSON.parse(fs.readFileSync(path.join(__dirname, "src", "data", "site.json"), "utf8"));
    analyticsId = siteData.ga_measurement_id || "";
    console.log("[Eleventy] GA analyticsId from site.json:", analyticsId);
  } catch (e) {
    console.log("[Eleventy] Error reading site.json:", e.message);
    analyticsId = process.env.GA_MEASUREMENT_ID || "";
  }
  console.log("[Eleventy] Final analyticsId:", analyticsId);
  console.log("[Eleventy] Regex test:", /^G-[A-Z0-9]+$/.test(analyticsId));
  eleventyConfig.addGlobalData("analytics", {
    measurementId: /^G-[A-Z0-9]+$/.test(analyticsId) ? analyticsId : ""
  });
  const buildContext = process.env.CONTEXT || "";
  const isPreviewBuild = buildContext === "deploy-preview" || buildContext === "branch-deploy";
  eleventyConfig.addGlobalData("previewRobots", isPreviewBuild ? "noindex,nofollow" : "");
  // Passthrough copy for static assets - copy contents of public to output root
  eleventyConfig.addPassthroughCopy({"public/css": "css"});
  eleventyConfig.addPassthroughCopy({"public/js": "js"});
  eleventyConfig.addPassthroughCopy({"public/fonts": "fonts"});
  eleventyConfig.addPassthroughCopy({"public/images": "images"});
  eleventyConfig.addPassthroughCopy({"public/favicon.ico": "favicon.ico"});
  eleventyConfig.addPassthroughCopy({"public/site.webmanifest": "site.webmanifest"});
  // Client-side review capture lives under src/js; copy it into the served js dir.
  eleventyConfig.addPassthroughCopy({"src/js/review-capture.js": "js/review-capture.js"});
  // Copy _headers into the publish dir (Netlify applies custom headers from dist)
  eleventyConfig.addPassthroughCopy({"_headers": "_headers"});
  // Copy _redirects into the publish dir (Cloudflare Pages applies redirects from dist)
  eleventyConfig.addPassthroughCopy({"_redirects": "_redirects"});
  
  // Load tours.json using fs
  const slugify = require("slugify");
  const { publicFromRate, packageForHotel } = require("./src/lib/concierge/public-data");

  // Load translations for build-time i18n
  let translationsData = { strings: {} };
  try {
    translationsData = JSON.parse(fs.readFileSync(path.join("./src", "data", "translations.json"), "utf8"));
  } catch (e) { translationsData = { strings: {} }; }

  function translate(key, lang) {
    const langCode = lang || 'en';
    const entry = translationsData.strings[key];
    if (entry && entry[langCode]) return entry[langCode];
    if (entry && entry.en) return entry.en;
    console.warn(`Missing translation: ${key} @ ${langCode || 'en'}`);
    return key;
  }

  


  // Expose translationsData globally for template access
  eleventyConfig.addGlobalData("translationsData", () => translationsData);

  // Ensure t() filter uses the enhanced translate function
  eleventyConfig.addNunjucksFilter("t", function(key, lang) {
    return translate(key, lang);
  });

  // Add a debug filter to list available translation keys
  eleventyConfig.addNunjucksFilter("translationKeys", () => {
    return Object.keys(translationsData.strings);
  });

    // nonce generator
    eleventyConfig.addNunjucksFilter('getNonce', function() {
      return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    });
eleventyConfig.addNunjucksFilter("t", function(key, lang) {
    return translate(key, lang);
  });

  function findBySlug(arr, slug) {
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].slug === slug) { return arr[i]; }
    }
    return null;
  }

  eleventyConfig.addNunjucksFilter("findBySlug", findBySlug);

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
    return p.display + " " + (p.basis === "per_person" ? "per person" : "per vehicle") + " (published rate — our team confirms your tier and pickup)";
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

  // Tiered price display - shows "From $X (shared) / From $Y (private)" with tooltip
  eleventyConfig.addFilter("catPriceTiered", (slug) => {
    const svc = catService(slug);
    if (!svc) return "Our team will confirm the price.";
    const p = svc.pricing || {};
    if (p.basis === "on_request" || p.min == null || p.max == null) return "Price on request — our team will confirm";
    
    if (p.tieredDisplay) {
      // Parse tieredDisplay and create a concise "From $X / From $Y" format
      const tiers = p.tieredDisplay.split('•').map(t => t.trim());
      const shared = tiers.find(t => t.toLowerCase().includes('shared') || t.toLowerCase().includes('group') || t.toLowerCase().includes('walking'));
      const privateOption = tiers.find(t => t.toLowerCase().includes('private'));
      
      let display = '';
      if (shared) {
        const match = shared.match(/\$(\d+)/);
        if (match) display += `From $${match[1]} (shared)`;
      }
      if (privateOption) {
        const match = privateOption.match(/\$(\d+)/);
        if (match) display += (display ? ` / ` : '') + `From $${match[1]} (private)`;
      }
      if (!display) display = p.display;
      
      // Return HTML with tooltip
      const escapedTip = p.tieredDisplay.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
      return `<span class="price-tiered" tabindex="0" data-tooltip="${escapedTip}">${display} <span class="price-basis">${p.basis === 'per_person' ? 'per person' : 'per vehicle'}</span></span>`;
    }
    
    return p.display + " " + (p.basis === "per_person" ? "per person" : "per vehicle") + " (published rate — our team confirms your tier and pickup)";
  });

// Short version for cards - just "From $X" with tiered tooltip
  eleventyConfig.addFilter("catPriceShort", (slug) => {
    const svc = catService(slug);
    if (!svc) return "Price on request";
    const p = svc.pricing || {};
    if (p.basis === "on_request" || p.min == null || p.max == null) return "Price on request";
    
    if (p.tieredDisplay) {
      const tiers = p.tieredDisplay.split('•').map(t => t.trim());
      const lowest = tiers.reduce((min, t) => {
        const match = t.match(/\$(\d+)/);
        return match ? Math.min(min, parseInt(match[1])) : min;
      }, Infinity);
      if (lowest !== Infinity) {
        const escapedTip = p.tieredDisplay.replace(/&/g, '&').replace(/"/g, '"');
        return `<span class="price-short" tabindex="0" data-tooltip="${escapedTip}">From $${lowest} <span class="price-basis">${p.basis === 'per_person' ? 'per person' : 'per vehicle'}</span></span>`;
      }
    }
    return p.display + " " + (p.basis === "per_person" ? "per person" : "per vehicle");
  });

  // Premium pricing display filters for hybrid+premium UX
  eleventyConfig.addFilter("catViatorAnchor", (slug) => {
    const svc = catService(slug);
    if (!svc || !svc.pricing || svc.pricing.viatorAnchor == null) return null;
    return svc.pricing.viatorAnchor;
  });

  eleventyConfig.addFilter("catDepositPercent", (slug) => {
    const svc = catService(slug);
    if (!svc || !svc.pricing || svc.pricing.depositPercent == null) return 0;
    return svc.pricing.depositPercent;
  });

  eleventyConfig.addFilter("catDepositAmount", (slug) => {
    const svc = catService(slug);
    if (!svc || !svc.pricing || svc.pricing.depositAmount == null) return 0;
    return svc.pricing.depositAmount;
  });

  eleventyConfig.addFilter("catSavingsVsViator", (slug) => {
    const svc = catService(slug);
    if (!svc || !svc.pricing || svc.pricing.savingsVsViator == null) return null;
    return svc.pricing.savingsVsViator;
  });

  eleventyConfig.addFilter("catSavingsPercent", (slug) => {
    const svc = catService(slug);
    if (!svc || !svc.pricing || svc.pricing.savingsPercent == null) return null;
    return svc.pricing.savingsPercent;
  });

  eleventyConfig.addFilter("catIsMarine", (slug) => {
    const svc = catService(slug);
    if (!svc) return false;
    return svc.category === 'MAR' || svc.type === 'experience';
  });

  eleventyConfig.addFilter("catIsTransfer", (slug) => {
    const svc = catService(slug);
    if (!svc) return false;
    return svc.type === 'transfer';
  });

  // Truncate filter for text
  eleventyConfig.addFilter("truncate", (str, length = 120) => {
    if (!str) return '';
    if (str.length <= length) return str;
    return str.substring(0, length).trim() + '…';
  });

  // Word-boundary clamp used for <title> (max 70) and meta description (max ~158)
  // Measures HTML-escaped length so entities like &amp; do not push the output over the limit.
  function escapedLength(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .length;
  }

  function seoClamp(str, max) {
    const s = String(str || '').replace(/\s+/g, ' ').trim();
    if (escapedLength(s) <= max) return s;
    const words = s.split(' ');
    while (words.length > 1 && escapedLength(words.join(' ') + '…') > max) {
      words.pop();
    }
    return words.join(' ').replace(/[\s,;:.\-–—|&]+$/, '') + '…';
  }

  eleventyConfig.addFilter("seoTitle", (str, max = 70) => {
    const s = String(str || '').replace(/\s+/g, ' ').trim();
    if (escapedLength(s) <= max) return s;
    // Drop the trailing brand suffix before clamping so the descriptive part survives.
    const brandRe = /\s*[|—–-]\s*Spice (?:and|&) Sail(?: Zanzibar)?\s*$/i;
    const base = s.replace(brandRe, '').trim();
    if (escapedLength(base) <= max) return base;
    return seoClamp(base, max);
  });

  eleventyConfig.addFilter("seoDesc", (str, max = 158) => seoClamp(str, max));

  eleventyConfig.addFilter("isoDate", (d) => {
    const dt = d instanceof Date ? d : new Date(d || Date.now());
    return isNaN(dt.getTime()) ? new Date().toISOString().slice(0, 10) : dt.toISOString().slice(0, 10);
  });

  // Strip HTML filter for schema
  eleventyConfig.addFilter("strip_html", (str) => {
    if (!str) return '';
    return str.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  });

  // Hotel public rates lookup
  let hotelPublicRates = { hotels: [] };
  try {
    hotelPublicRates = JSON.parse(fs.readFileSync(path.join("./src", "data", "hotelPublicRates.json"), "utf8"));
  } catch (e) {
    hotelPublicRates = { hotels: [] };
  }

  // Area micro-content data for enhanced area pages
  let areaMicroContent = { areas: {} };
  try {
    areaMicroContent = JSON.parse(fs.readFileSync(path.join("./src", "data", "areaMicroContent.json"), "utf8"));
  } catch (e) {
    areaMicroContent = { areas: {} };
  }
  eleventyConfig.addGlobalData("areaMicroContent", () => areaMicroContent);

  function rateFor(slug) {
    return (hotelPublicRates.hotels || []).find(h => h.slug === slug) || null;
  }

  eleventyConfig.addFilter("rateFor", (slug) => rateFor(slug));
  eleventyConfig.addFilter("bundleFor", (slug) => {
    const svc = packageForHotel(slug);
    if (svc) {
      const p = svc.pricing || {};
      return {
        id: svc.id || svc.slug,
        name: svc.name,
        nights: svc.nights,
        perPersonMin: p.min,
        perPersonMax: p.max,
        includes: svc.includes || []
      };
    }
    const bundle = (hotelPublicRates.bundles || []).find(b => b.hotelSlug === slug);
    if (bundle) return bundle;
    const h = rateFor(slug);
    return h ? h.package : null;
  });
  eleventyConfig.addFilter("getFromRate", (slug) => {
    const rate = publicFromRate(rateFor(slug));
    return rate == null ? 0 : rate;
  });

  // Featured partner hotels global data for homepage "Where to Stay" strip
  let hotelsJsonList = [];
  try {
    const h = JSON.parse(fs.readFileSync(path.join("./src", "data", "hotels.json"), "utf8"));
    hotelsJsonList = Array.isArray(h) ? h : (h.hotels || []);
  } catch(e) {
    hotelsJsonList = [];
  }
  const hotelPageSlugAliases = {
    "stonetown-view-hotel": "stone-town-view-hotel"
  };
  const hotelPriority = [
    "the-one-resort-zanzibar",
    "le-paradis-boutique-hotel-zanzibar",
    "mkeka-spice-lodge",
    "the-island-stonetown",
    "stonetown-view-hotel"
  ];
  const featuredPartnerHotels = [...(hotelPublicRates.hotels || [])].sort((a, b) => {
    const ia = hotelPriority.indexOf(a.slug);
    const ib = hotelPriority.indexOf(b.slug);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  }).map((ph) => {
    const dirMatch = hotelsJsonList.find((x) => x.slug === ph.slug) || {};
    const pageSlug = hotelPageSlugAliases[ph.slug] || ph.slug;
    const fromRate = publicFromRate(ph) || 0;
    const rateUnit = ph.slug === "the-one-resort-zanzibar" ? "per room for 2 adults, per night" : "per room / night";
    return {
      slug: ph.slug,
      pageSlug,
      name: ph.name,
      area: ph.area,
      board: ph.board,
      tier: dirMatch.tier || "partner",
      photo: ph.photo || dirMatch.photo || "default-hotel-hero.jpg",
      fromRate: Number.isFinite(fromRate) ? fromRate : 0,
      rateUnit,
      summary: dirMatch.category || `${ph.board} • Verified partner rate (${ph.taxPerPersonPerNight ? `$${ph.taxPerPersonPerNight}/pp/night local levy` : "direct concierge booking"})`,
      packageSlug: (packageForHotel(ph.slug) || {}).slug || ""
    };
  });
  eleventyConfig.addGlobalData("featuredPartnerHotels", () => featuredPartnerHotels);

  // Build a set of all page URLs for quick lookup in sitemap
  eleventyConfig.addGlobalData("pageUrlSet", function() {
    const set = new Set();
    // This will be populated during the build
    return set;
  });

  eleventyConfig.addGlobalData("conciergeCat", () => conciergeCatalogue);
  eleventyConfig.addGlobalData("hotelPublicRates", () => hotelPublicRates);
  eleventyConfig.addGlobalData("reviews", () => require("./src/data/reviews.json"));
  eleventyConfig.addGlobalData("cataloguePackages", () => (conciergeCatalogue.services || [])
    .filter(s => s.type === "package" && s.hotelSlug)
    .map(s => {
      const p = s.pricing || {};
      return {
        id: s.id,
        slug: s.slug,
        name: s.name,
        nights: s.nights,
        perPerson: { min: p.min, max: p.max },
        display: p.display,
        includes: s.includes || [],
        solves: s.shortDescription || ""
      };
    }));
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

  // Add filter for hidden gem type icons
  eleventyConfig.addFilter("gemIcon", (type) => {
    const icons = {
      "Marine": "🐠",
      "Natural": "🌿",
      "Viewpoint": "🌅",
      "Cultural": "🏛️",
      "Event": "🎉",
      "Nature": "🌳",
      "Dining": "🍽️",
      "Wildlife": "🦋",
      "Activity": "🏄",
      "Wellness": "🧘",
      "History": "📜",
      "default": "✨"
    };
    return icons[type] || icons["default"];
});
  
  // Add urlencode filter for WhatsApp message encoding
  eleventyConfig.addFilter("urlencode", (str) => {
    return encodeURIComponent(String(str || ""));
  });

  // Add filter to find a page by URL in collections
  eleventyConfig.addFilter("findPage", function(url, collections) {
    if (!url || !collections || !collections.all) return null;
    return collections.all.find(page => page.url === url) || null;
  });

  // Add Nunjucks filter version for use in templates with collections context
  eleventyConfig.addNunjucksFilter("pageExists", function(url, collections) {
    if (!url || !collections || !collections.all) return false;
    return collections.all.some(page => page.url === url);
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
    let featuredImage = null;
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
    if (!featuredImage && tourPath.startsWith("pages/areas/")) {
      const areaSlug = tourPath.replace("pages/areas/", "").replace(/\.(njk|md)$/, "");
      const zoneKey = (Object.entries(zoneAliases).find(([frag]) => areaSlug.startsWith(frag)) || [])[1] || "Stone Town";
      const pool = zoneFiles[zoneKey] || [zoneImage[zoneKey] || "default-tour-hero.jpg"];
      featuredImage = pool[0];
      featuredAlt = metadataIndex[featuredImage]?.alt_text || "";
    }

    // Hotel landing pages: resolve partner hotel photo from hotelPublicRates.json
    if (!featuredImage && tourPath.startsWith("pages/hotels/")) {
      const rawSlug = tourPath.replace("pages/hotels/", "").replace(/\.(njk|md)$/, "");
      const canonSlug = rawSlug === "stone-town-view-hotel" ? "stonetown-view-hotel" : rawSlug;
      const partner = rateFor(canonSlug);
      if (partner && partner.photo) {
        featuredImage = partner.photo;
        featuredAlt = `${partner.name} in ${partner.area}, Zanzibar`;
      }
    }

    // Blog pages: use blogSlugMap for hero images
    if (!featuredImage && tourPath.startsWith("pages/blog/")) {
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

    // Commercial/static pages: assign specific hero images
    const pageHeroMap = {
      "pages/transfers.njk": "zanzibar-airport-transfer-private-minivan-taxi.jpg",
      "pages/packages.njk": "aerial-beach-boat-turquoise-water.jpg",
      "pages/safaris.njk": "serengeti-3-day-fly-in-safari-from-zanzibar.jpg",
      "pages/experiences.njk": "horse-riding-beach-zanzibar-sunset.jpg",
      "pages/about.njk": "aerial-coastal-town-beach-turquoise-water.jpg",
      "pages/contact.njk": "zanzibar-airport-transfer-private-minivan-taxi.jpg",
      "pages/travel-guide.njk": "aerial-beach-zanzibar-turquoise-water.jpg",
      "pages/cancellation.njk": "dhow-boat-turquoise-water-zanzibar.jpg",
      "pages/health-safety.njk": "beach-walk-person-colorful-dress.jpg",
      "pages/migration-calendar.njk": "turtle-hatching-zanzibar-beach.jpg",
      "pages/packing-guide.njk": "beach-walk-person-colorful-dress.jpg",
      "pages/self-drive.njk": "toyota-land-cruiser-prado-zanzibar.jpg",
      "pages/fourty-activities/index.njk": "aerial-beach-boat-turquoise-water.jpg",
      "pages/marketplace.njk": "marketplace-zanzibar-handicrafts.jpg",
    };
    if (!featuredImage && pageHeroMap[tourPath]) {
      featuredImage = pageHeroMap[tourPath];
      featuredAlt = "";
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

  // Hero image filter: always return the local /images/ path.
  eleventyConfig.addNunjucksFilter("cdnImage", function(inputPath) {
    const result = getFeaturedImage(inputPath);
    const file = result.featuredImage || "default-tour-hero.jpg";

    // Check if we're running on Netlify or localhost

    // For local development, use direct image path
    return `/images/${file}`;
  });

  // Wrap an arbitrary image filename in the local /images/ path.
  eleventyConfig.addNunjucksFilter("cdnFile", function(file) {
    const f = String(file || "default-tour-hero.jpg");

    // Check if we're running on Netlify or localhost

    // For local development, use direct image path
    return `/images/${f}`;
  });

  // File modification time filter for sitemap lastmod — reads actual file mtime from disk
  eleventyConfig.addNunjucksFilter("fileMtime", function(inputPath) {
    if (!inputPath) return new Date().toISOString().split("T")[0];
    try {
      const stat = fs.statSync(path.resolve(__dirname, inputPath));
      return stat.mtime.toISOString().split("T")[0];
    } catch (e) {
      return new Date().toISOString().split("T")[0];
    }
  });

  // Content-based deterministic date filter for sitemap lastmod — generates unique past ISO date from string hash (never in the future)
  eleventyConfig.addNunjucksFilter("contentDate", function(inputStr) {
    const today = new Date("2026-11-24");
    if (!inputStr) return today.toISOString().split("T")[0];
    let hash = 0;
    for (let i = 0; i < inputStr.length; i++) {
      hash = ((hash << 5) - hash) + inputStr.charCodeAt(i);
      hash |= 0;
    }
    const daysAgo = (Math.abs(hash) % 180) + 1;
    const pastDate = new Date(today);
    pastDate.setDate(pastDate.getDate() - daysAgo);
    return pastDate.toISOString().split("T")[0];
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

  // ---- Permanent expansion: content-gated page datasets ----
  const PARTNER_PAGE_SLUGS = new Set([
    "le-paradis-boutique-hotel-zanzibar","mkeka-spice-lodge","stone-town-view-hotel",
    "stonetown-view-hotel","the-island-stonetown","the-one-resort-zanzibar"
  ]);
  const SLUG_ALIAS = { "stonetown-view-hotel": "stone-town-view-hotel" };
  const wc = (s) => String(s||"").trim().split(/\s+/).filter(Boolean).length;
  const BOILERPLATE = /^Located in .+\. A popular .+ for visitors to Zanzibar\.$/i;
  const MIN_WORDS = 50; // quality gate — raise, never lower, to ship stubs

  const hotelsRaw = JSON.parse(fs.readFileSync(path.join(__dirname,"src","data","hotels.json"),"utf8"));
  const hotelsAll = Array.isArray(hotelsRaw) ? hotelsRaw : (hotelsRaw.hotels||[]);
  
  // Helper to compute CDN photo URL for a hotel (replicates hotelPhoto + cdnFile filters)
  function computeHotelCdnPhotoUrl(hotel) {
    const photo = hotel && hotel.photo;
    let file = "image-not-available.svg";
    if (photo && typeof photo === "string") {
      const cleaned = String(photo).replace(/^\//, "");
      const normalized = cleaned.replace(/^hotels\//, "").replace(/^images\/hotels\//, "");
      const exists = fs.existsSync(path.join(__dirname, "public", "images", "hotels", normalized));
      if (exists) {
        file = "hotels/" + normalized;
      }
    }
    return `/images/${file}`;
  }
  
  eleventyConfig.addGlobalData("hotelsToBuild", () => {
    const seen = new Set();
    return hotelsAll
      .filter(h => h && h.slug && h.name)
      .filter(h => wc(h.description) >= MIN_WORDS && !BOILERPLATE.test(h.description.trim()))
      .map(h => Object.assign({}, h, { 
        slug: SLUG_ALIAS[h.slug] || h.slug,
        indexable: PARTNER_PAGE_SLUGS.has(SLUG_ALIAS[h.slug] || h.slug),
        cdnPhotoUrl: computeHotelCdnPhotoUrl(h)
      }))
      .filter(h => { if (seen.has(h.slug)) return false; seen.add(h.slug); return true; });
  });

  const attrRaw = JSON.parse(fs.readFileSync(path.join(__dirname,"src","data","attractions.json"),"utf8"));
  const attrAll = Array.isArray(attrRaw) ? attrRaw : (attrRaw.attractions||[]);
  const ATTRACTION_SKIP = new Set([ /* slugs that already have a dedicated /tours/ page — keep in sync */ ]);

  // Helper to compute CDN photo URL for an attraction (replicates attractionImg + cdnFile filters)
  function computeAttractionCdnPhotoUrl(attractionName, category) {
    let file = "default-tour-hero.jpg";
    if (attractionImage[attractionName]) {
      file = attractionImage[attractionName];
    } else {
      const catPool = attrCategoryArrays[category] || attrCategoryArrays["Attraction"];
      if (catPool && catPool.length > 0) file = hashPick(attractionName, catPool);
    }
    return `/images/${file}`;
  }
  
  eleventyConfig.addGlobalData("attractionsToBuild", () => {
    const seen = new Set();
    return attrAll
      .filter(a => a && a.slug && a.name && a.island !== "Pemba" && !ATTRACTION_SKIP.has(a.slug))
      .filter(a => wc(a.description) >= MIN_WORDS && !BOILERPLATE.test(a.description.trim()))
      .map(a => Object.assign({}, a, { 
        cdnPhotoUrl: computeAttractionCdnPhotoUrl(a.name, a.category)
      }))
      .filter(a => { if (seen.has(a.slug)) return false; seen.add(a.slug); return true; });
  });

  // Load canonical rates as single source of truth
  let canonicalRates = {};
  try {
    canonicalRates = JSON.parse(fs.readFileSync(path.join(__dirname,"src","data","canonical-rates.json"),"utf8"));
  } catch(e) {
    canonicalRates = {};
  }
  eleventyConfig.addGlobalData("rates", () => canonicalRates);

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

  // Shortcode for hotel photo CDN URL (avoids filter chaining in templates)
  eleventyConfig.addShortcode("hotelPhotoCdn", function(hotel) {
    // Replicate hotelPhoto filter logic
    const photo = hotel && hotel.photo;
    let file = "image-not-available.svg";
    if (photo && typeof photo === "string") {
      const cleaned = String(photo).replace(/^\//, "");
      const normalized = cleaned.replace(/^hotels\//, "").replace(/^images\/hotels\//, "");
      const exists = fs.existsSync(path.join(__dirname, "public", "images", "hotels", normalized));
      if (exists) {
        file = "hotels/" + normalized;
      }
    }
    // Apply cdnFile logic
    return `/images/${file}`;
  });

  // Shortcode for attraction photo CDN URL
  eleventyConfig.addShortcode("attractionPhotoCdn", function(attractionName, category) {
    // Replicate attractionImg filter logic
    let file = "default-tour-hero.jpg";
    if (attractionImage[attractionName]) {
      file = attractionImage[attractionName];
    } else {
      const catPool = attrCategoryArrays[category] || attrCategoryArrays["Attraction"];
      if (catPool && catPool.length > 0) file = hashPick(attractionName, catPool);
    }
    // Apply cdnFile logic
    return `/images/${file}`;
  });

  // Shortcode for canonical alt text
  eleventyConfig.addShortcode("canonicalAltText", function(file, fallback) {
    const f = String(file || "").replace(/^\/images\//, "").replace(/\?.*$/, "");
    if (metadataIndex[f] && metadataIndex[f].alt_text) {
      return metadataIndex[f].alt_text;
    }
    return fallback || metadataIndex["default-tour-hero.jpg"]?.alt_text || "Spice and Sail Zanzibar";
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

  // Convert slug to title case for breadcrumbs
  eleventyConfig.addNunjucksFilter("slugToTitle", function(slug) {
    if (!slug) return "";
    return String(slug)
      .split("-")
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  });

  // String startsWith filter for Nunjucks
  eleventyConfig.addNunjucksFilter("startsWith", function(str, prefix) {
    if (!str || !prefix) return false;
    return String(str).startsWith(String(prefix));
  });

  // Blog post date filter for sitemap
  eleventyConfig.addNunjucksFilter("blogDate", function(page) {
    if (!page || !page.data || !page.data.date) return new Date().toISOString().split("T")[0];
    return new Date(page.data.date).toISOString().split("T")[0];
  });

  // Event schema filter for blog posts about events
  eleventyConfig.addNunjucksFilter("eventSchema", function(page) {
    if (!page || !page.data || !page.data.event) return "";
    const e = page.data.event;
    return JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Event",
      "name": e.name || page.title,
      "startDate": e.startDate,
      "endDate": e.endDate || e.startDate,
      "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
      "eventStatus": "https://schema.org/EventScheduled",
      "location": {
        "@type": "Place",
        "name": e.location || "Zanzibar, Tanzania",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "Zanzibar",
          "addressRegion": "Zanzibar",
          "addressCountry": "TZ"
        }
      },
      "description": page.data.description || page.data.excerpt || "",
      "url": "https://spiceandsail.com" + page.url,
      "organizer": {
        "@type": "Organization",
        "name": "Spice and Sail Zanzibar",
        "url": "https://spiceandsail.com"
      }
    }, null, 2);
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
