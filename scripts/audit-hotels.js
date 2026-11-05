#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const raw = require("../src/data/hotels.json"); const hotels = Array.isArray(raw) ? raw : raw.hotels;
const HOTEL_DIR = path.join(__dirname, "..", "public", "images", "hotels");

let ok = 0;
const missing = [];
const nofield = [];

for (const h of hotels) {
  if (!h.photo || typeof h.photo !== "string") { nofield.push(h.name); continue; }
  const cleaned = String(h.photo).replace(/^\//, "")
    .replace(/^hotels\//, "").replace(/^images\/hotels\//, "");
  if (fs.existsSync(path.join(HOTEL_DIR, cleaned))) ok++;
  else missing.push({ name: h.name, photo: h.photo, expected: `public/images/hotels/${cleaned}` });
}

console.log(`Hotels total:        ${hotels.length}`);
console.log(`Photo file exists:   ${ok}`);
console.log(`File missing:        ${missing.length}`);
console.log(`No photo field:      ${nofield.length}\n`);

if (missing.length) {
  console.log("--- MISSING FILE (photo path set but file not found) ---");
  for (const m of missing) console.log(`  ${m.name}\n    wants: ${m.expected}`);
}
if (nofield.length) {
  console.log("\n--- NO photo FIELD AT ALL ---");
  for (const n of nofield) console.log(`  ${n}`);
}
