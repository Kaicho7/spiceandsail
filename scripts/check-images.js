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
  let s = src.replace(/^\/?/, "");
  const cdn = s.match(/^\.netlify\/images\?url=([^&]+)/);
  if (cdn) s = decodeURIComponent(cdn[1]);
  if (s.startsWith("images/")) s = s.slice("images/".length);
  return s;
}

walk(DIST, (file) => {
  if (!/\.html$/i.test(file)) return;
  const html = fs.readFileSync(file, "utf8");
  const re = /<img\b[^>]*?\ssrc\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    const src = m[1];
    if (/^(data:|https?:)/i.test(src)) continue;
    const rel = resolveSrc(src);
    const onDisk = path.join(DIST, "images", rel);
    if (!fs.existsSync(onDisk)) {
      errors.push(`${path.relative(ROOT, file)} -> ${src}`);
    }
  }
});

if (errors.length) {
  console.error(`\n✗ ${errors.length} broken image reference(s):\n`);
  errors.forEach(e => console.error("   " + e));
  process.exit(1);
}

console.log("✓ all image refs in dist/ resolve");
