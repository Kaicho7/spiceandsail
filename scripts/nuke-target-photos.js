#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

const TARGETS = ["LUX* Marijani Zanzibar","Aluna Nungwi","K Kibanda Lodge","Holle House","House of Spices","Fun Beach Resort","Dhow Inn","Blue Oyster Hotel","Blue Moon Resort","&Beyond Mnemba Island","Park Hyatt Zanzibar","Villa Stecchini","Africa House Hotel","Palumbokendwa","Paje By Night","Seasons Lodge Zanzibar","Shaba Boutique Hotel","Zanzibar Pearl Boutique","Al-Minar Hotel","Cheetah's Rock Management Stay","Surfescape Zanzibar","Stone Town Cafe B&B"];

const n = s => String(s||"").toLowerCase().replace(/[^a-z0-9]+/g, "");
const extra = ["marijani","aluna","kibanda","holehouse","hollehouse","houseofspices","funbeach","dhowinn","blueoyster","bluemoon","mnemba","parkhyatt","stecchini","africahouse","palumbo","pajebynight","seasonslodge","shaba","zanzibarpearl","alminar","cheetahsrock","surfescape","stonetowncafe"];
const isTarget = name => {
  const x = n(name);
  return TARGETS.some(t => x.includes(n(t)) || n(t).includes(x)) || extra.some(e => x.includes(e));
};

const JSONS = ["src/data/hotels.json","src/data/attractions.json","src/data/areas.json"];
const DIRS = ["public/images/hotels","public/images","dist/images/hotels","dist/images"];
const nulled = [], deleted = [], notFound = new Set(TARGETS);

function walk(o, cb) {
  if (Array.isArray(o)) return o.forEach(x => walk(x, cb));
  if (o && typeof o === "object") { cb(o); Object.values(o).forEach(v => walk(v, cb)); }
}

for (const rel of JSONS) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) { console.log("missing:", rel); continue; }
  let raw;
  try { raw = JSON.parse(fs.readFileSync(abs, "utf8")); }
  catch (e) { console.log("invalid:", rel, e.message); continue; }
  walk(raw, o => {
    if (o.name && isTarget(o.name) && o.photo) {
      nulled.push({ file: rel, name: o.name, was: o.photo });
      const clean = String(o.photo).replace(/^\//,"").replace(/^hotels\//,"").replace(/^images\/hotels\//,"").replace(/^images\//,"");
      for (const d of DIRS) {
        const abs2 = path.join(ROOT, d, clean);
        if (fs.existsSync(abs2)) { fs.unlinkSync(abs2); deleted.push(path.join(d, clean)); }
      }
      o.photo = null;
    }
  });
  fs.writeFileSync(abs, JSON.stringify(raw, null, 2) + "\n");
  console.log("wrote:", rel);
}

for (const d of DIRS) {
  const abs = path.join(ROOT, d);
  if (!fs.existsSync(abs)) continue;
  for (const f of fs.readdirSync(abs)) {
    const base = f.replace(/\.(jpe?g|png|webp)$/i, "");
    if (isTarget(base)) { fs.unlinkSync(path.join(abs, f)); deleted.push(path.join(d, f)); }
  }
}

console.log("\n=== NULLED ===");
nulled.forEach(x => console.log("  " + x.file + "  " + x.name + "  (was: " + x.was + ")"));
console.log("\n=== DELETED ===");
deleted.forEach(x => console.log("  " + x));
console.log("\n=== NOT FOUND ===");
[...notFound].forEach(x => console.log("  " + x));
console.log("\nSummary: " + nulled.length + " nulled, " + deleted.length + " files deleted");
