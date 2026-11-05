'use strict';
/**
 * Photo integrity gates for items actively processed in this workstream.
 *
 * Precondition: `npm run build` has run (dist/ is present).
 *
 * These checks apply only to items whose `photo_source_type` has been set
 * (i.e. items this workstream has processed). Untouched items with legacy
 * broken references are intentionally out of scope here; they are listed in
 * the accompanying report as "not verified".
 *
 * Fails when, for a processed item:
 *   1. its referenced photo file is missing on disk,
 *   2. two unrelated processed items share one photo file (duplicate by hash),
 *   3. its photo_source_type is set but photo_source_url is missing.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const IMGDIR = path.join(ROOT, 'public', 'images');

function readJSON(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function exists(p) { return fs.existsSync(p); }
function sha1(p) {
  return crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex');
}

/* Collect slots that have been processed (photo_source_type set). */
function processedSlots() {
  const out = [];
  const load = (f, keyName, photoKey, idKey, nameKey) => {
    let d;
    try { d = readJSON(path.join(ROOT, 'src', 'data', f)); } catch (e) { return; }
    const items = (d && d[keyName]) || (Array.isArray(d) ? d : []);
    for (const it of items) {
      if (!it.photo_source_type) continue; // not processed by this workstream
      const photo = it[photoKey];
      if (!photo) continue;
      out.push({
        type: keyName, id: it[idKey] || it.slug || '', name: it[nameKey] || '',
        slug: it.slug || '', photo,
        file: path.join(IMGDIR, photo),
        sourceType: it.photo_source_type || '', sourceUrl: it.photo_source_url || '',
        credit: it.photo_credit || '', alt: it.photo_alt || '',
      });
    }
  }
  load('hotels.json', 'hotels', 'photo', 'id', 'name');
  load('attractions.json', 'attractions', 'photo', 'id', 'name');
  load('tours.json', '_list_', 'featured_image', 'id', 'title');
  load('transfers.json', '_list_', 'image', 'id', 'title');
  return out;
}

const SLOTS = processedSlots();

test('photo: processed item has its photo file on disk', () => {
  const missing = SLOTS.filter((s) => s.photo !== 'photo needed' && !exists(s.file));
  assert.strictEqual(
    missing.length, 0,
    'photo file missing on disk for processed item:\n' +
    missing.map((s) => `${s.type}:${s.id} ${s.name} -> ${s.photo}`).join('\n')
  );
});

test('photo: processed item records source url when source type is set', () => {
  const missing = SLOTS.filter((s) => !s.sourceUrl);
  assert.strictEqual(
    missing.length, 0,
    'photo_source_url missing for processed item:\n' +
    missing.map((s) => `${s.type}:${s.id} ${s.name} -> ${s.photo}`).join('\n')
  );
});

test('photo: no two unrelated processed items share one photo file (duplicate by hash)', () => {
  const byHash = {};
  for (const s of SLOTS) {
    if (!exists(s.file)) continue;
    const h = sha1(s.file);
    if (!byHash[h]) byHash[h] = [];
    byHash[h].push(s);
  }
  const dupes = Object.values(byHash).filter((arr) => arr.length > 1);
  for (const group of dupes) {
    const ids = group.map((s) => `${s.type}:${s.id}`).join(', ');
    assert.ok(
      group.every((s) => s.id === group[0].id && s.type === group[0].type),
      `duplicate photo file shared by unrelated processed items: ${group[0].photo} used by ${ids}`
    );
  }
});
