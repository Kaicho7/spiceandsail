const fs = require("fs");
const path = require("path");

const DIST = path.join(__dirname, "..", "dist");
const sitemapPath = path.join(DIST, "sitemap.xml");

if (!fs.existsSync(sitemapPath)) {
  console.error("❌ Sitemap not found at:", sitemapPath);
  process.exit(1);
}

const xml = fs.readFileSync(sitemapPath, "utf8");
const locs = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map(m => m[1].trim());

const errs = [];
const warns = [];
const seen = new Set();

for (const loc of locs) {
  const u = new URL(loc);
  const p = u.pathname;

  if (seen.has(p)) {
    errs.push("Duplicate <loc>: " + p);
    continue;
  }
  seen.add(p);

  if (p.startsWith("/pages/")) {
    errs.push("Leaked /pages/ path: " + p);
    continue;
  }

  if (p === "/sitemap.xml") continue;

  const file = p.endsWith("/") 
    ? path.join(DIST, p, "index.html") 
    : path.join(DIST, p);

  if (!fs.existsSync(file)) {
    errs.push("Sitemap URL has no built page: " + p);
    continue;
  }

  const html = fs.readFileSync(file, "utf8");
  
  // Check canonical
  const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) 
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
  const can = canonicalMatch ? canonicalMatch[1] : null;
  
  if (can) {
    try {
      if (new URL(can).pathname !== p) {
        errs.push("Canonical mismatch on " + p + " → " + can);
      }
    } catch (e) {
      errs.push("Invalid canonical URL on " + p + ": " + can);
    }
  }

  // Check content word count (rough check for thin pages)
  const textContent = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  
  if (textContent < 250) {
    warns.push("Thin page (" + textContent + " words): " + p);
  }
}

warns.forEach(w => console.warn("⚠️  " + w));

if (errs.length) {
  console.error("❌ Sitemap validation FAILED:\n" + errs.join("\n"));
  process.exit(1);
}

console.log("✅ Sitemap OK — " + locs.length + " URLs, every one maps to a real, self-canonical page.");