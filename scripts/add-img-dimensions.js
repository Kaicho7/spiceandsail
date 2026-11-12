#!/usr/bin/env node
// Injects width/height attributes into every <img> in dist/**/*.html using the
// intrinsic dimensions of the referenced local file (prevents layout shift).
// Skips external/data URIs and tags that already declare both attributes.
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const IMGDIR = path.join(DIST, "images");

if (!fs.existsSync(DIST)) {
  console.error("dist/ not found — run eleventy first");
  process.exit(1);
}

function walk(dir, cb) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, cb);
    else cb(full);
  }
}

const dimCache = new Map();

function resolveSrc(src) {
  let s = src.replace(/&amp;/g, "&").replace(/^\/+/, "");
  const cdn = s.match(/^\.netlify\/images\?url=([^&]+)/);
  if (cdn) s = decodeURIComponent(cdn[1]).replace(/^\/+/, "");
  if (s.startsWith("images/")) s = s.slice("images/".length);
  s = s.replace(/[?#].*$/, "");
  return s;
}

function jpegDims(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9) || marker === 0x01) { i += 2; continue; }
    const len = buf.readUInt16BE(i + 2);
    // SOF0–SOF15 except DHT (0xc4), JPG (0xc8), DAC (0xcc)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

function pngDims(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function webpDims(buf) {
  if (buf.length < 30 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const fourcc = buf.toString('ascii', 12, 16);
  if (fourcc === 'VP8 ') { // lossy: frame header after chunk header + 3-byte tag + 3-byte sync code
    return { width: 1 + buf.readUInt16LE(26), height: 1 + buf.readUInt16LE(28) };
  }
  if (fourcc === 'VP8L') { // lossless: 14-bit width-1 / height-1 packed into 4 bytes at +21
    const b = buf.readUInt32LE(21);
    return { width: 1 + (b & 0x3fff), height: 1 + ((b >> 14) & 0x3fff) };
  }
  if (fourcc === 'VP8X') { // extended: 24-bit canvas width-1 at +24, height-1 at +27
    const w = buf[24] | (buf[25] << 8) | (buf[26] << 16);
    const h = buf[27] | (buf[28] << 8) | (buf[29] << 16);
    return { width: 1 + w, height: 1 + h };
  }
  return null;
}

// Minimal ISOBMFF walk for AVIF: meta > iprp > ipco > ispe (first image item).
function avifDims(buf) {
  if (buf.length < 12 || buf.toString('ascii', 4, 8) !== 'ftyp') return null;
  const brand = buf.toString('ascii', 8, 12);
  if (!/^(avif|avis|heic|mif1|msf1)$/.test(brand)) return null;

  function walkBox(start, end, path, cb) {
    let off = start;
    while (off + 8 <= end) {
      let size = buf.readUInt32BE(off);
      const type = buf.toString('ascii', off + 4, off + 8);
      let hdr = 8;
      if (size === 1) { size = Number(buf.readBigUInt64BE(off + 8)); hdr = 16; }
      else if (size === 0) { size = end - off; }
      if (size < hdr) return;
      cb(path.concat(type), off + hdr, off + size);
      if (['meta', 'iprp', 'ipco'].includes(type)) walkBox(off + hdr + (type === 'meta' ? 4 : 0), off + size, path.concat(type), cb);
      off += size;
    }
  }
  let dims = null;
  walkBox(0, buf.length, [], (p, bodyStart, bodyEnd) => {
    if (p.length === 4 && p[3] === 'ispe' && !dims && bodyEnd - bodyStart >= 8) {
      dims = { width: buf.readUInt32BE(bodyStart + 4), height: buf.readUInt32BE(bodyStart + 8) };
    }
  });
  return dims;
}

function sniffDims(buf, ext) {
  if (buf[0] === 0xff && buf[1] === 0xd8) return jpegDims(buf);
  if (buf.readUInt32BE(0) === 0x89504e47) return pngDims(buf);
  if (buf.toString('ascii', 0, 4) === 'RIFF') return webpDims(buf);
  if (buf.toString('ascii', 4, 8) === 'ftyp') return avifDims(buf);
  if (ext === '.svg') return svgDims(buf);
  return null;
}

function svgDims(buf) {
  const s = buf.toString("utf8");
  const w = s.match(/\swidth="([\d.]+)/), h = s.match(/\sheight="([\d.]+)/);
  if (w && h) return { width: Math.round(+w[1]), height: Math.round(+h[1]) };
  const vb = s.match(/viewBox="[\d.+-]+\s+[\d.+-]+\s+([\d.]+)\s+([\d.]+)"/);
  if (vb) return { width: Math.round(+vb[1]), height: Math.round(+vb[2]) };
  return null;
}

function getDims(rel) {
  if (dimCache.has(rel)) return dimCache.get(rel);
  let dims = null;
  try {
    const file = path.join(IMGDIR, rel);
    if (fs.existsSync(file)) {
      const buf = fs.readFileSync(file);
      const ext = path.extname(rel).toLowerCase();
      // Sniff by magic bytes — some scraped hotel files carry webp/avif bytes
      // inside .jpg/.webp extensions. Only fall back to SVG parsing by ext.
      dims = ext === '.svg' ? svgDims(buf) : sniffDims(buf, ext);
    }
  } catch (e) { /* leave dims null */ }
  if (dims) dimCache.set(rel, dims);
  return dims;
}

let scanned = 0, patched = 0, skippedNoDims = 0, alreadyHave = 0;

walk(DIST, (file) => {
  if (!/\.html$/i.test(file)) return;
  const html = fs.readFileSync(file, "utf8");
  scanned++;
  let changed = false;
  const out = html.replace(/<img\b[^>]*?>/gi, (tag) => {
    const srcM = tag.match(/\ssrc\s*=\s*["']([^"']+)["']/i);
    if (!srcM) return tag;
    const src = srcM[1];
    if (/^(data:|https?:|\/\/)/i.test(src)) return tag;
    if (/\swidth\s*=/i.test(tag) && /\sheight\s*=/i.test(tag)) { alreadyHave++; return tag; }
    const rel = resolveSrc(src);
    const dims = getDims(rel);
    if (!dims || !dims.width || !dims.height) { skippedNoDims++; return tag; }
    patched++;
    changed = true;
    return tag.replace(/\/?>$/, ` width="${dims.width}" height="${dims.height}"$&`);
  });
  if (changed) fs.writeFileSync(file, out);
});

console.log(`✓ img-dimensions: ${patched} <img> tags patched across ${scanned} HTML files` +
  ` (${alreadyHave} already sized, ${skippedNoDims} without resolvable intrinsic size)`);
