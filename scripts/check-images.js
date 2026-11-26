#!/usr/bin/env node
// Fails the build if any <img src> in dist/*.html points to a missing file.
// Note: uses \ssrc (space before src) to skip Vue's :src bindings.
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const errors = [];

if (!fs.existsSync(DIST)) {
  console.error("dist/ not found — run `npm run build` first");
  process.exit(1);
}

function walk(dir, cb) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, cb);
    else cb(full);
  }
}

function resolveSrc(src) {
  // Decode HTML entities first (raw HTML has &amp; not &)
  let s = src.replace(/&amp;/g, "&").replace(/^https?:\/\/(?:www\.)?spiceandsail\.com/i, "").replace(/^\/+/, "");
  // Unwrap Netlify Image CDN: /.netlify/images?url=<encoded-path>&...
  const cdn = s.match(/^\.netlify\/images\?url=([^&]+)/);
  if (cdn) s = decodeURIComponent(cdn[1]).replace(/^\/+/, "");   // ← THE FIX: strip leading / after decode
  // Strip "images/" so we can resolve against dist/images/
  if (s.startsWith("images/")) s = s.slice("images/".length);
  // Strip any leftover query/fragment
  s = s.replace(/[?#].*$/, "");
  return s;
}

function checkLocalImageRef(errors, file, rawUrl, label) {
  if (!rawUrl || /^(data:)/i.test(rawUrl)) return;
  if (/^https?:/i.test(rawUrl) && !/^https?:\/\/(?:www\.)?spiceandsail\.com\/images\//i.test(rawUrl)) return;
  const rel = resolveSrc(rawUrl);
  const onDisk = path.join(DIST, "images", rel);
  if (!fs.existsSync(onDisk)) {
    errors.push(`${path.relative(ROOT, file)} (${label}) -> ${rawUrl}`);
  }
}

walk(DIST, (file) => {
  if (!/\.html$/i.test(file)) return;
  const html = fs.readFileSync(file, "utf8");
  const imgRe = /<img\b[^>]*?\ssrc\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = imgRe.exec(html))) {
    checkLocalImageRef(errors, file, m[1], "img");
  }

  const linkRe = /<link\b[^>]*>/gi;
  while ((m = linkRe.exec(html))) {
    const tag = m[0];
    if (!/\brel\s*=\s*["']preload["']/i.test(tag)) continue;
    if (!/\bas\s*=\s*["']image["']/i.test(tag)) continue;
    const hrefMatch = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i);
    if (hrefMatch) checkLocalImageRef(errors, file, hrefMatch[1], "preload");
  }

  const metaRe = /<meta\b[^>]*>/gi;
  while ((m = metaRe.exec(html))) {
    const tag = m[0];
    if (!/\b(?:property|name)\s*=\s*["'](?:og:image|twitter:image)["']/i.test(tag)) continue;
    const contentMatch = tag.match(/\bcontent\s*=\s*["']([^"']+)["']/i);
    if (contentMatch) checkLocalImageRef(errors, file, contentMatch[1], "social-meta");
  }
});

if (errors.length) {
  console.error(`\n✗ ${errors.length} broken image reference(s):\n`);
  errors.forEach(e => console.error("   " + e));
  process.exit(1);
}

console.log("✓ all image refs in dist/ resolve");
