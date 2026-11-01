#!/usr/bin/env node
// Post-build pass: enforce one image = one alt across the published HTML.
// Canonical alt per filename is read from the metadata catalogs.
const fs = require('fs');
const path = require('path');

const catalogs = [
  'src/data/canonical-image-catalog.json',
];

const canon = {};
for (const c of catalogs) {
  const p = path.join(__dirname, '..', c);
  if (!fs.existsSync(p)) continue;
  let d;
  try { d = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { console.error('bad json', c); continue; }
  const out = d.images || d.metadata || {};
  let entries = [];
  try { entries = Array.isArray(out) ? out : Object.entries(out); } catch (e) { entries = []; }
  for (const pair of entries) {
    let k, v;
    if (Array.isArray(pair)) { [k, v] = pair; } else { v = pair; k = (pair && (pair.filename || pair.file)) || ''; }
    if (!v || typeof v !== 'object') continue;
    const key = (typeof k === 'string' && (k.endsWith('.jpg') || k.endsWith('.png'))) ? k : ((v && (v.filename || v.file)) || k || '');
    if (!key || typeof key !== 'string') continue;
    const alt = v.alt_text || v.alt;
    if (alt && !canon[key]) canon[key] = String(alt);
  }
}

let nAltFiles = 0;
function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) { walk(p); continue; }
    if (!f.name.endsWith('.html')) continue;
    let t = fs.readFileSync(p, 'utf8');
    const before = t;
    t = t.replace(/<img\b[^>]*>/g, (tag) => {
      const srcm = tag.match(/src="([^"]+)"/);
      const m = srcm && srcm[1].match(/([A-Za-z0-9_\-]+\.(?:jpg|jpeg|png|JPG|PNG))/);
      if (!m) return tag;
      const alt = canon[m[1]];
      if (!alt) return tag;
      if (tag.includes('alt="')) {
        return tag.replace(/alt="[^"]*"/, `alt="${alt.replace(/"/g, '&quot;')}"`);
      }
      return tag.replace(/(<img\b)/, `$1 alt="${alt.replace(/"/g, '&quot;')}"`);
    });
    if (t !== before) {
      fs.writeFileSync(p, t);
      nAltFiles++;
    }
  }
}
walk(path.join(__dirname, '..', 'dist'));
console.log(`normalize_img_alt: ${nAltFiles} HTML files rewritten`);
