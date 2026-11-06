#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const DIRS = ["public/images", "public/images/hotels"];

const all = [];
for (const rel of DIRS) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) continue;
  for (const f of fs.readdirSync(abs)) {
    if (!/\.(jpe?g|png|webp)$/i.test(f)) continue;
    const stat = fs.statSync(path.join(abs, f));
    all.push({ rel: path.join(rel, f), file: f, size: stat.size });
  }
}
all.sort((a, b) => b.size - a.size);

const buckets = { "> 5 MB": 0, "2–5 MB": 0, "1–2 MB": 0, "500 KB–1 MB": 0, "200–500 KB": 0, "< 200 KB": 0 };
for (const i of all) {
  if (i.size > 5_000_000) buckets["> 5 MB"]++;
  else if (i.size > 2_000_000) buckets["2–5 MB"]++;
  else if (i.size > 1_000_000) buckets["1–2 MB"]++;
  else if (i.size > 500_000) buckets["500 KB–1 MB"]++;
  else if (i.size > 200_000) buckets["200–500 KB"]++;
  else buckets["< 200 KB"]++;
}

const total = all.reduce((s, i) => s + i.size, 0);
console.log(`\nTotal: ${all.length} images, ${(total/1024/1024).toFixed(1)} MB on disk\n`);
console.log("=== SIZE BUCKETS ===");
for (const [k, v] of Object.entries(buckets)) console.log(`  ${k.padEnd(14)} ${v}`);
console.log("\n=== TOP 40 OVERSIZED (by file size) ===");
const pad = (s, n) => String(s).padEnd(n).slice(0, n);
console.log(pad("SIZE", 10) + pad("FILE", 62));
console.log("-".repeat(74));
for (const i of all.slice(0, 40)) {
  console.log(pad((i.size/1024/1024).toFixed(2) + " MB", 10) + i.rel);
}

const oversized = all.filter(i => i.size > 300_000);
console.log(`\n${oversized.length} images > 300 KB — these are the optimization targets.`);
console.log("Estimated reduction: 60–80% (to ~150–300 KB each).");
