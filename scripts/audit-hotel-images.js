#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const IMG_DIR = path.join(ROOT, "public", "images", "hotels");
const raw = require("../src/data/hotels.json");
const hotels = Array.isArray(raw) ? raw : raw.hotels;

const STOP = new Set(["hotel","resort","spa","lodge","the","and","of","in","at","a","an","zanzibar","boutique","beach","island","villa","villas","palace","house"]);
const tokens = s => String(s||"").toLowerCase()
  .replace(/\.(jpe?g|png|webp)$/,"").replace(/[^a-z0-9]+/g," ").split(" ")
  .filter(t => t.length >= 4 && !STOP.has(t));

const hashCache = new Map();
const hashOf = f => {
  if (hashCache.has(f)) return hashCache.get(f);
  const h = crypto.createHash("sha1").update(fs.readFileSync(path.join(IMG_DIR, f))).digest("hex").slice(0, 12);
  hashCache.set(f, h);
  return h;
};

const issues = [];
const byHash = new Map();
const rows = [];

for (const h of hotels) {
  if (!h.photo || typeof h.photo !== "string") {
    rows.push({ name: h.name, photo: null, issues: ["NO PHOTO FIELD"] });
    continue;
  }
  const cleaned = String(h.photo).replace(/^\//,"").replace(/^hotels\//,"").replace(/^images\/hotels\//,"");
  const abs = path.join(IMG_DIR, cleaned);
  if (!fs.existsSync(abs)) {
    rows.push({ name: h.name, photo: cleaned, issues: ["FILE MISSING"] });
    continue;
  }
  const itemIssues = [];
  const size = fs.statSync(abs).size;
  const hash = hashOf(cleaned);

  if (size < 15_000) itemIssues.push(`TINY (${Math.round(size/1024)}KB) — logo or placeholder?`);
  if (size > 3_000_000) itemIssues.push(`HUGE (${Math.round(size/1024/1024)}MB) — raw file?`);
  if (/^(photo|image|download|img|untitled)[-_ ]?\d*\.(jpe?g|png|webp)$/i.test(cleaned))
    itemIssues.push("GENERIC FILENAME — no provenance");
  if (!tokens(h.name).some(t => tokens(cleaned).some(u => u===t || u.startsWith(t) || t.startsWith(u))))
    itemIssues.push("NAME MISMATCH — filename doesn't resemble hotel name");

  byHash.set(hash, (byHash.get(hash) || []).concat(h.name));
  rows.push({ name: h.name, photo: cleaned, size, hash, issues: itemIssues });
  if (itemIssues.length) issues.push({ name: h.name, photo: cleaned, issues: itemIssues });
}

// dupe hashes
for (const [hash, names] of byHash) if (names.length > 1) {
  for (const n of names) {
    const row = rows.find(r => r.name === n);
    row.issues.push(`DUPLICATE HASH — shared with: ${names.filter(x=>x!==n).join(", ")}`);
  }
  issues.push({ name: names.join(" / "), photo: hash, issues: [`DUPLICATE IMAGE — ${names.length} hotels share the same file`] });
}

const pad = (s,n)=>String(s).padEnd(n).slice(0,n);
console.log(`\nHotel image audit`);
console.log(`  total hotels:   ${hotels.length}`);
console.log(`  checked files:  ${[...hashCache.keys()].length}`);
console.log(`  issues:         ${issues.length}\n`);
if (issues.length) {
  console.log(pad("HOTEL",40)+pad("FILE",40)+"FLAGS");
  console.log("-".repeat(130));
  for (const i of issues) console.log(pad(i.name,40)+pad(i.photo,40)+i.issues.join(" · "));
  console.log();
}

// ---- build visual gallery ----
const esc = s => String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const cards = rows.map((r,i) => `
  <div class="card ${r.issues.length?"bad":""}">
    <div class="num">#${i+1} · ${esc(r.name)}</div>
    ${r.photo ? `<img src="/images/hotels/${esc(r.photo)}" loading="lazy" alt="${esc(r.name)}">` : `<div class="ph">no photo</div>`}
    <div class="file">${esc(r.photo||"—")}</div>
    ${r.issues.length ? `<div class="flags">${r.issues.map(esc).join("<br>")}</div>` : ""}
  </div>`).join("");

const html = `<!doctype html><meta charset="utf-8"><title>Hotel image review</title>
<style>
  body{font-family:system-ui,sans-serif;margin:0;background:#f5f5f5}
  header{position:sticky;top:0;background:#111;color:#fff;padding:12px 20px;z-index:10}
  header b{font-size:18px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;padding:16px}
  .card{background:#fff;border-radius:8px;overflow:hidden;border:2px solid #e5e5e5;display:flex;flex-direction:column}
  .card.bad{border-color:#dc2626}
  .card img{width:100%;height:180px;object-fit:cover;background:#ddd}
  .card .ph{height:180px;background:#eee;display:flex;align-items:center;justify-content:center;color:#999}
  .card .num{padding:8px 10px;font-weight:600;font-size:13px;background:#111;color:#fff}
  .card .file{padding:6px 10px;font-size:11px;color:#666;word-break:break-all}
  .card .flags{padding:6px 10px 10px;font-size:11px;color:#dc2626;background:#fef2f2}
</style>
<header><b>Hotel image review</b> &nbsp;—&nbsp; ${rows.length} hotels · ${issues.length} flagged (red border). Scroll and eyeball each name vs photo.</header>
<div class="grid">${cards}</div>`;

const out = path.join(ROOT, "hotel-images-review.html");
fs.writeFileSync(out, html);
console.log(`Visual gallery written: ${out}`);
console.log(`Open it:  xdg-open "${out}"\n`);
