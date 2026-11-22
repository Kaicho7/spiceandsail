'use strict';

/**
 * Gate: only the five contracted hotels are indexable and listed in the
 * sitemap. The remaining directory pages stay crawlable but are noindexed to
 * keep thin, templated pages out of the index.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PARTNER = [
  'the-one-resort-zanzibar',
  'le-paradis-boutique-hotel-zanzibar',
  'mkeka-spice-lodge',
  'the-island-stonetown',
  'stone-town-view-hotel'
];

test('only the 5 contracted hotels are indexable and in the sitemap', () => {
  const sitemap = fs.readFileSync(path.join(DIST, 'sitemap.xml'), 'utf8');
  const hotelUrls = [...sitemap.matchAll(/<loc>https:\/\/spiceandsail\.com\/hotels\/([^/]+)\/<\/loc>/g)]
    .map(match => match[1]);
  assert.deepEqual(hotelUrls.sort(), [...PARTNER].sort());

  for (const slug of PARTNER) {
    const html = fs.readFileSync(path.join(DIST, 'hotels', slug, 'index.html'), 'utf8');
    assert.ok(!/<meta name="robots" content="noindex/i.test(html), slug + ' must be indexable');
  }

  for (const slug of ['kholle-house', 'baraka-beach-bungalows', 'tembo-house-hotel']) {
    const html = fs.readFileSync(path.join(DIST, 'hotels', slug, 'index.html'), 'utf8');
    assert.match(html, /<meta name="robots" content="noindex,follow"/i, slug + ' must be noindex');
  }

  const directory = fs.readFileSync(path.join(DIST, 'hotels', 'index.html'), 'utf8');
  assert.ok(directory.includes('Our 5 Contracted Hotels'), 'directory must feature the contracted hotels');
  assert.ok((directory.match(/data-hotel-index-link/g) || []).length >= 198,
    'directory must still link all 198 properties');
});
