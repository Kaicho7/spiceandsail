#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", ".eleventy.js");
const imgDir = path.join(__dirname, "..", "public", "images");
let src = fs.readFileSync(file, "utf8");
fs.writeFileSync(file + ".backup-mappings", src);
console.log("backup:", file + ".backup-mappings");

// ---- 1. Replace slugMap block ----
const newSlugMap = `  const slugMap = {
    "stone-town-walking-tour": "stone-town-alley-walking-tour-people.jpg",
    "stone-town-spice-prison-combo": "giant-tortoises-rocky-terrain.jpg",
    "spice-farm": "hand-holding-nutmeg-fruits-zanzibar.jpg",
    "village-community-tour": "child-walking-dirt-path-village.jpg",
    "safari-blue": "aerial-beach-dhow-people-turquoise-water.jpg",
    "mnemba-snorkeling": "sea-turtle-snorkeling-coral-reef.jpg",
    "prison-island-nakupenda": "boat-deck-view-turquoise-water-island.jpg",
    "nakupenda-sandbank": "turquoise-water-sandbar-lone-boat.jpg",
    "chumbe-island": "underwater-fish-coral-reef-zanzibar.jpg",
    "sunset-dhow-cruise": "dhow-sail-at-sunset-ocean.jpg",
    "kizimkazi-dolphin-tour": "dolphins-swimming-near-boat-tour.jpg",
    "jozani-forest": "red-colobus-monkey-baby-jozani-forest.jpg",
    "kuza-cave-seaweed": "people-swimming-turquoise-water-steps.jpg",
    "mikumi-nyerere-day-safari": "elephant-savanna-landscape-tanzania.jpg",
    "serengeti-3day-flyin": "lions-resting-dry-savanna.jpg",
    "zanzibar-essentials-3day": "zanzibar-beach-palm-trees-thatched-huts.jpg",
    "zanzibar-essentials-3-day-pass": "tourists-waving-dhow-boat-sea.jpg"
  };`;
if (!/  const slugMap = \{[\s\S]*?\n  \};/.test(src)) { console.error("slugMap not found"); process.exit(1); }
src = src.replace(/  const slugMap = \{[\s\S]*?\n  \};/, newSlugMap);

// ---- 2. Replace zoneImage block ----
const newZoneImage = `  const zoneImage = {
    "Stone Town": "stone-town-alleyway-old-buildings.jpg",
    "Nungwi": "dhow-sail-nungwi-beach-zanzibar.jpg",
    "Kendwa": "dhows-beach-sunset-zanzibar.jpg",
    "Paje": "kite-centre-zanzibar-aerial-kitesurfing.jpg",
    "Jambiani": "women-collecting-seaweed-beach-zanzibar.jpg",
    "Kiwengwa": "beach-front-hotel-palm-trees-people.jpg",
    "Pongwe / Michamvi": "zanzibar-house-on-rock-beach-scene.jpg",
    "Bwejuu / Dongwe": "zanzibar-beach-palm-trees-thatched-huts.jpg",
    "Michamvi / Pingwe": "zanzibar-beach-women-walking-white-sand.jpg",
    "Kizimkazi / Dimbani": "dolphins-leaping-ocean-zanzibar.jpg",
    "Fumba / Mbweni": "dhow-boat-mangroves-turquoise-water.jpg",
    "Matemwe / Kigomani": "snorkeling-zanzibar-shallow-water-coral.jpg",
    "Chake Chake (Pemba)": "aerial-coastal-town-beach-turquoise-water.jpg",
    "Wambaa Gulf / Makangale (Pemba)": "boardwalk-sea-boats-cloudy-sky.jpg"
  };`;
if (!/  const zoneImage = \{[\s\S]*?\n  \};/.test(src)) { console.error("zoneImage not found"); process.exit(1); }
src = src.replace(/  const zoneImage = \{[\s\S]*?\n  \};/, newZoneImage);

// ---- 3. Targeted fixes inside attractionImage ----
const attractionFixes = [
  ['"Fumba Water Sports": "women-horse-riding-ocean-water-zanzibar.jpg"',
   '"Fumba Water Sports": "kitesurfing-turquoise-ocean-zanzibar.jpg"'],
  ['"ZIFF Festival Center": "stone-town-colonial-building-clock-tower.jpg"',
   '"ZIFF Festival Center": "historical-photos-wall-zanzibar-exhibit.jpg"'],
  ['"Palace Museum": "stone-town-colonial-building-clock-tower.jpg"',
   '"Palace Museum": "waterfront-buildings-zanzibar-coast.jpg"'],
  ['"Palace Museum (Official)": "stone-town-colonial-building-clock-tower.jpg"',
   '"Palace Museum (Official)": "waterfront-buildings-zanzibar-coast.jpg"'],
  ['"Prison Island": "boats-pier-under-cloudy-sky-water.jpg"',
   '"Prison Island": "giant-tortoises-rocky-terrain.jpg"'],
  ['"Prison Island (Tour Desk)": "boats-pier-under-cloudy-sky-water.jpg"',
   '"Prison Island (Tour Desk)": "giant-tortoises-rocky-terrain.jpg"'],
  ['"Nungwi Beach": "children-wading-beach-dhow-boats.jpg"',
   '"Nungwi Beach": "nungwi-beach-aerial-resort-turquoise-water.jpg"']
];
let applied = 0;
for (const [oldStr, newStr] of attractionFixes) {
  if (src.includes(oldStr)) { src = src.replace(oldStr, newStr); applied++; }
  else console.warn("NOT FOUND:", oldStr.slice(0, 55));
}
console.log("attractionImage fixes applied:", applied, "/", attractionFixes.length);

fs.writeFileSync(file, src);
console.log("wrote", file);

// ---- 4. Validate every mapped filename exists ----
const allImages = new Set(
  fs.readdirSync(imgDir).filter(f => /\.(jpe?g|png|webp)$/i.test(f))
);
function validate(label, re) {
  const block = src.match(re);
  if (!block) { console.log(label + ": BLOCK NOT FOUND"); return; }
  const map = block[0];
  const missing = [];
  let total = 0;
  const entryRe = /"([^"]+)"\s*:\s*"([^"]+\.(?:jpe?g|png|webp))"/gi;
  let m;
  while ((m = entryRe.exec(map)) !== null) {
    total++;
    if (!allImages.has(m[2])) missing.push(`${m[1]} -> ${m[2]}`);
  }
  console.log(`${label}: ${total} entries, ${missing.length} missing`);
  missing.forEach(x => console.log("   MISSING:", x));
}
console.log("");
validate("slugMap",         /  const slugMap = \{[\s\S]*?\n  \};/);
validate("zoneImage",       /  const zoneImage = \{[\s\S]*?\n  \};/);
validate("attractionImage", /  const attractionImage = \{[\s\S]*?\n  \};/);
