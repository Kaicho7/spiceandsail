#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const SRC_DIR = path.join(__dirname, "..", "src");
const DIST_DIR = path.join(__dirname, "..", "dist");

const hotelsRaw = JSON.parse(fs.readFileSync(path.join(SRC_DIR, "data", "hotels.json"), "utf8"));
const hotelsAll = Array.isArray(hotelsRaw) ? hotelsRaw : (hotelsRaw.hotels || []);
const attractionsRaw = JSON.parse(fs.readFileSync(path.join(SRC_DIR, "data", "attractions.json"), "utf8"));
const attractionsAll = Array.isArray(attractionsRaw) ? attractionsRaw : (attractionsRaw.attractions || []);
const siteData = JSON.parse(fs.readFileSync(path.join(SRC_DIR, "data", "site.json"), "utf8"));
const hotelPublicRates = JSON.parse(fs.readFileSync(path.join(SRC_DIR, "data", "hotelPublicRates.json"), "utf8"));

const PARTNER_PAGE_SLUGS = new Set([
  "le-paradis-boutique-hotel-zanzibar","mkeka-spice-lodge","stone-town-view-hotel",
  "stonetown-view-hotel","the-island-stonetown","the-one-resort-zanzibar"
]);
const SLUG_ALIAS = { "stonetown-view-hotel": "stone-town-view-hotel" };
const wc = (s) => String(s||"").trim().split(/\\s+/).filter(Boolean).length;
const BOILERPLATE = /^Located in .+\\. A popular .+ for visitors to Zanzibar\\.$/i;
const MIN_WORDS = 50;

const hotelsToBuild = hotelsAll
  .filter(h => h && h.slug && h.name && !h.partnerStay && !PARTNER_PAGE_SLUGS.has(h.slug))
  .filter(h => wc(h.description) >= MIN_WORDS)
  .map(h => Object.assign({}, h, { slug: SLUG_ALIAS[h.slug] || h.slug }));

const ATTRACTION_SKIP = new Set();
const attractionsToBuild = attractionsAll
  .filter(a => a && a.slug && a.name && a.island !== "Pemba")
  .filter(a => wc(a.description) >= MIN_WORDS);

function computeHotelCdnPhotoUrl(hotel) {
  const photo = hotel && hotel.photo;
  let file = "image-not-available.svg";
  if (photo && typeof photo === "string") {
    const cleaned = String(photo).replace(/^\\//, "");
    const normalized = cleaned.replace(/^hotels\\//, "").replace(/^images\\/hotels\\//, "");
    const exists = fs.existsSync(path.join(__dirname, "..", "public", "images", "hotels", normalized));
    if (exists) file = "hotels/" + normalized;
  }
  return "/images/" + file;
}

const attractionImageMap = {
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
  "Old Fort": "stone-town-cannons-sea-boat-tour.jpg",
  "Palace Museum": "palace-museum-beit-al-sahel-stone-town.jpg",
  "Princess Salme Spice Garden": "zanzibar-spice-farm-tour-fresh-nutmeg-cloves.jpg",
  "Prison Island": "giant-tortoises-rocky-terrain.jpg",
  "Seaweed Center Paje": "people-collecting-sea-items-zanzibar-beach.jpg",
  "Spice Farm Tour (Kidichi)": "people-leaf-crowns-tree-outdoor.jpg",
  "Stone Town Food Market": "zanzibar-stone-town-market-fruit-stall.jpg",
  "Zanzibar Butterfly (Park)": "zanzibar-butterfly-centre-tropical.jpg",
  "Zanzibar Horse Riding (Nungwi)": "women-horse-riding-ocean-water-zanzibar.jpg",
  "ZIFF Festival Center": "historical-photos-wall-zanzibar-exhibit.jpg",
  "The Rock Restaurant": "zanzibar-rock-house-with-tourists.jpg",
};

const attrCategoryArrays = {
  "Dive Center": ["scuba-diver-fish-coral-reef-underwater.jpg", "underwater-coral-reef-fish-zanzibar.jpg"],
  "Water Sports": ["kitesurfing-turquoise-ocean-zanzibar.jpg", "kite-centre-zanzibar-aerial-kitesurfing.jpg"],
  "Attraction": ["stone-town-cannons-sea-boat-tour.jpg", "people-swimming-turquoise-water-steps.jpg"],
  "Restaurant": ["zanzibar-rock-house-with-tourists.jpg", "zanzibar-night-food-stall-skewers-bread.jpg"]
};

function hashPick(str, arr) { let h=0; for(let i=0;i<str.length;i++) h=(h*31+str.charCodeAt(i))>>>0; return arr[h%arr.length]; }

function computeAttractionCdnPhotoUrl(name, category) {
  let file = attractionImageMap[name] || "default-tour-hero.jpg";
  if (file === "default-tour-hero.jpg") {
    const catPool = attrCategoryArrays[category] || attrCategoryArrays["Attraction"];
    if (catPool && catPool.length > 0) file = hashPick(name, catPool);
  }
  return "/images/" + file;
}

function esc(s) {
  return String(s||"").replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, """);
}
const urlenc = (s) => encodeURIComponent(String(s||""));
const stripHtml = (s) => String(s||"").replace(/<[^>]*>/g,"").replace(/\\s+/g," ").trim();
const truncate = (s, n=150) => { const t=stripHtml(s); return t.length<=n?t:t.substring(0,n).trim()+"..."; }

const hotelTemplate = fs.readFileSync(path.join(__dirname, "templates", "hotel-detail.html"), "utf8");
const attractionTemplate = fs.readFileSync(path.join(__dirname, "templates", "attraction-detail.html"), "utf8");

function render(tpl, data) {
  return tpl.replace(/\\{\\{(\\w+)\\}\\}/g, (_, k) => data[k] || "")
           .replace(/\\{\\{#if (\\w+)\\}\\}([\\s\\S]*?)\\{\\{/if\\}\\}/g, (_, k, content) => data[k] ? content : "");
}

function computeHotelCdnPhotoUrl(hotel) {
  const photo = hotel && hotel.photo;
  let file = "image-not-available.svg";
  if (photo && typeof photo === "string") {
    const cleaned = String(photo).replace(/^\\//, "");
    const normalized = cleaned.replace(/^hotels\\//, "").replace(/^images\\/hotels\\//, "");
    const exists = fs.existsSync(path.join(__dirname, "..", "public", "images", "hotels", normalized));
    if (exists) file = "hotels/" + normalized;
  }
  return "/images/" + file;
}

const attractionImageMap = {
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
  "Old Fort": "stone-town-cannons-sea-boat-tour.jpg",
  "Palace Museum": "palace-museum-beit-al-sahel-stone-town.jpg",
  "Princess Salme Spice Garden": "zanzibar-spice-farm-tour-fresh-nutmeg-cloves.jpg",
  "Prison Island": "giant-tortoises-rocky-terrain.jpg",
  "Seaweed Center Paje": "people-collecting-sea-items-zanzibar-beach.jpg",
  "Spice Farm Tour (Kidichi)": "people-leaf-crowns-tree-outdoor.jpg",
  "Stone Town Food Market": "zanzibar-stone-town-market-fruit-stall.jpg",
  "Zanzibar Butterfly (Park)": "zanzibar-butterfly-centre-tropical.jpg",
  "Zanzibar Horse Riding (Nungwi)": "women-horse-riding-ocean-water-zanzibar.jpg",
  "ZIFF Festival Center": "historical-photos-wall-zanzibar-exhibit.jpg",
  "The Rock Restaurant": "zanzibar-rock-house-with-tourists.jpg",
};

const attrCategoryArrays = {
  "Dive Center": ["scuba-diver-fish-coral-reef-underwater.jpg", "underwater-coral-reef-fish-zanzibar.jpg"],
  "Water Sports": ["kitesurfing-turquoise-ocean-zanzibar.jpg", "kite-centre-zanzibar-aerial-kitesurfing.jpg"],
  "Attraction": ["stone-town-cannons-sea-boat-tour.jpg", "people-swimming-turquoise-water-steps.jpg"],
  "Restaurant": ["zanzibar-rock-house-with-tourists.jpg", "zanzibar-night-food-stall-skewers-bread.jpg"]
};

function hashPick(str, arr) { let h=0; for(let i=0;i<str.length;i++) h=(h*31+str.charCodeAt(i))>>>0; return arr[h%arr.length]; }

function computeAttractionCdnPhotoUrl(name, category) {
  let file = attractionImageMap[name] || "default-tour-hero.jpg";
  if (file === "default-tour-hero.jpg") {
    const catPool = attrCategoryArrays[category] || attrCategoryArrays["Attraction"];
    if (catPool && catPool.length > 0) file = hashPick(name, catPool);
  }
  return "/images/" + file;
}

const esc = (s) => String(s||"").replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, """);
const urlenc = (s) => encodeURIComponent(String(s||""));
const stripHtml = (s) => String(s||"").replace(/<[^>]*>/g,"").replace(/\\s+/g," ").trim();
const truncate = (s, n=150) => { const t=stripHtml(s); return t.length<=n?t:t.substring(0,n).trim()+"..."; }

const hotelTemplate = fs.readFileSync(path.join(__dirname, "templates", "hotel-detail.html"), "utf8");
const attractionTemplate = fs.readFileSync(path.join(__dirname, "templates", "attraction-detail.html"), "utf8");

function render(tpl, data) {
  return tpl.replace(/\\{\\{(\\w+)\\}\\}/g, (_, k) => data[k] || "")
           .replace(/\\{\\{#if (\\w+)\\}\\}([\\s\\S]*?)\\{\\{/if\\}\\}/g, (_, k, content) => data[k] ? content : "");
}

function computeHotelCdnPhotoUrl(hotel) {
  const photo = hotel && hotel.photo;
  let file = "image-not-available.svg";
  if (photo && typeof photo === "string") {
    const cleaned = String(photo).replace(/^\\//, "");
    const normalized = cleaned.replace(/^hotels\\//, "").replace(/^images\\/hotels\\//, "");
    const exists = fs.existsSync(path.join(__dirname, "..", "public", "images", "hotels", normalized));
    if (exists) file = "hotels/" + normalized;
  }
  return "/images/" + file;
}

const attractionImageMap = {
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
  "Old Fort": "stone-town-cannons-sea-boat-tour.jpg",
  "Palace Museum": "palace-museum-beit-al-sahel-stone-town.jpg",
  "Princess Salme Spice Garden": "zanzibar-spice-farm-tour-fresh-nutmeg-cloves.jpg",
  "Prison Island": "giant-tortoises-rocky-terrain.jpg",
  "Seaweed Center Paje": "people-collecting-sea-items-zanzibar-beach.jpg",
  "Spice Farm Tour (Kidichi)": "people-leaf-crowns-tree-outdoor.jpg",
  "Stone Town Food Market": "zanzibar-stone-town-market-fruit-stall.jpg",
  "Zanzibar Butterfly (Park)": "zanzibar-butterfly-centre-tropical.jpg",
  "Zanzibar Horse Riding (Nungwi)": "women-horse-riding-ocean-water-zanzibar.jpg",
  "ZIFF Festival Center": "historical-photos-wall-zanzibar-exhibit.jpg",
  "The Rock Restaurant": "zanzibar-rock-house-with-tourists.jpg",
};

const attrCategoryArrays = {
  "Dive Center": ["scuba-diver-fish-coral-reef-underwater.jpg", "underwater-coral-reef-fish-zanzibar.jpg"],
  "Water Sports": ["kitesurfing-turquoise-ocean-zanzibar.jpg", "kite-centre-zanzibar-aerial-kitesurfing.jpg"],
  "Attraction": ["stone-town-cannons-sea-boat-tour.jpg", "people-swimming-turquoise-water-steps.jpg"],
  "Restaurant": ["zanzibar-rock-house-with-tourists.jpg", "zanzibar-night-food-stall-skewers-bread.jpg"]
};

function hashPick(str, arr) { let h=0; for(let i=0;i<str.length;i++) h=(h*31+str.charCodeAt(i))>>>0; return arr[h%arr.length]; }

function computeAttractionCdnPhotoUrl(name, category) {
  let file = attractionImageMap[name] || "default-tour-hero.jpg";
  if (file === "default-tour-hero.jpg") {
    const catPool = attrCategoryArrays[category] || attrCategoryArrays["Attraction"];
    if (catPool && catPool.length > 0) file = hashPick(name, catPool);
  }
  return "/images/" + file;
}

const PARTNER_PAGE_SLUGS = new Set([
  "le-paradis-boutique-hotel-zanzibar","mkeka-spice-lodge","stone-town-view-hotel",
  "stonetown-view-hotel","the-island-stonetown","the-one-resort-zanzibar"
]);
const SLUG_ALIAS = { "stonetown-view-hotel": "stone-town-view-hotel" };
const wc = (s) => String(s||"").trim().split(/\\s+/).filter(Boolean).length;
const BOILERPLATE = /^Located in .+\\. A popular .+ for visitors to Zanzibar\\.$/i;
const MIN_WORDS = 50;

const SRC_DIR = path.join(__dirname, "..", "src");
const DIST_DIR = path.join(__dirname, "..", "dist");

const hotelsRaw = JSON.parse(fs.readFileSync(path.join(SRC_DIR, "data", "hotels.json"), "utf8"));
const hotelsAll = Array.isArray(hotelsRaw) ? hotelsRaw : (hotelsRaw.hotels || []);
const attractionsRaw = JSON.parse(fs.readFileSync(path.join(SRC_DIR, "data", "attractions.json"), "utf8"));
const attractionsAll = Array.isArray(attractionsRaw) ? attractionsRaw : (attractionsRaw.attractions || []);
const siteData = JSON.parse(fs.readFileSync(path.join(SRC_DIR, "data", "site.json"), "utf8"));
const hotelPublicRates = JSON.parse(fs.readFileSync(path.join(SRC_DIR, "data", "hotelPublicRates.json"), "utf8"));

const PARTNER_PAGE_SLUGS = new Set([
  "le-paradis-boutique-hotel-zanzibar","mkeka-spice-lodge","stone-town-view-hotel",
  "stonetown-view-hotel","the-island-stonetown","the-one-resort-zanzibar"
]);
const SLUG_ALIAS = { "stonetown-view-hotel": "stone-town-view-hotel" };
const wc = (s) => String(s||"").trim().split(/\\s+/).filter(Boolean).length;
const BOILERPLATE = /^Located in .+\\. A popular .+ for visitors to Zanzibar\\.$/i;
const MIN_WORDS = 50;

const hotelsToBuild = hotelsAll
  .filter(h => h && h.slug && h.name && !h.partnerStay && !PARTNER_PAGE_SLUGS.has(h.slug))
  .filter(h => wc(h.description) >= MIN_WORDS)
  .map(h => Object.assign({}, h, { slug: SLUG_ALIAS[h.slug] || h.slug }));

const ATTRACTION_SKIP = new Set();
const attractionsToBuild = attractionsAll
  .filter(a => a && a.slug && a.name && a.island !== "Pemba")
  .filter(a => wc(a.description) >= MIN_WORDS);

console.log("Generating " + hotelsToBuild.length + " hotel detail pages...");
let hotelCount = 0;
for (const hotel of hotelsToBuild) {
  const slug = SLUG_ALIAS[hotel.slug] || hotel.slug;
  const cdnPhotoUrl = computeHotelCdnPhotoUrl(hotel);
  const desc = hotel.description || "";
  const data = {
    title: esc(hotel.name) + " - " + esc(hotel.zone) + ", Zanzibar | Spice & Sail",
    description: truncate(desc),
    canonicalUrl: "/hotels/" + slug + "/",
    hotelName: esc(hotel.name),
    zone: esc(hotel.zone),
    starRating: esc(hotel.star_rating),
    category: esc(hotel.category),
    board: esc(hotel.board || "Bed & Breakfast"),
    island: esc(hotel.island),
    website: esc(hotel.website),
    websiteDomain: esc(hotel.website_domain),
    email: esc(hotel.email || ""),
    phone: esc(hotel.phone || ""),
    tax: esc(hotel.taxPerPersonPerNight || ""),
    description: desc,
    whatsapp: siteData.contact.whatsapp,
    waMsg: encodeURIComponent("Hi Spice & Sail! I would like to book " + hotel.name + " for 2 guests."),
    cdnPhotoUrl
  };
  const html = render(hotelTemplate, data);
  const outDir = path.join(DIST_DIR, "hotels", slug);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), html);
  hotelCount++;
}

console.log("Generating " + attractionsToBuild.length + " attraction detail pages...");
let attrCount = 0;
for (const attr of attractionsToBuild) {
  const slug = attr.slug;
  const cdnPhotoUrl = computeAttractionCdnPhotoUrl(attr.name, attr.category);
  const data = {
    title: esc(attr.name) + " - " + esc(attr.zone) + ", Zanzibar | Spice & Sail",
    description: truncate(attr.description),
    canonicalUrl: "/attractions/" + slug + "/",
    attractionName: esc(attr.name),
    zone: esc(attr.zone),
    island: esc(attr.island),
    category: esc(attr.category),
    website: esc(attr.website || ""),
    description: attr.description || "",
    whatsapp: siteData.contact.whatsapp,
    waMsg: encodeURIComponent("Hi Spice & Sail! I would like to visit " + attr.name + " in " + attr.zone + "."),
    cdnPhotoUrl
  };
  const html = render(attractionTemplate, data);
  const outDir = path.join(DIST_DIR, "attractions", slug);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), html);
  attrCount++;
}

console.log("Generated " + hotelCount + " hotel pages and " + attrCount + " attraction pages.");
