'use strict';
/**
 * Gate 14: rendered output / dist hygiene.
 *
 * Precondition: `npm run build` has run (dist/ is present). These checks prove
 * the live-rendered site (not source strings) is intact: sitemap/robots exist,
 * JSON-LD on key pages parses, and legacy/hard-coded-price pages are gone.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');

function read(p) { return fs.readFileSync(p, 'utf8'); }
function ldBlocks(html) {
  const blocks = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) blocks.push(m[1].trim());
  return blocks;
}

function exists(p) { return fs.existsSync(p); }

test('gate 14: sitemap.xml and robots.txt are served intact', () => {
  assert.ok(exists(path.join(DIST, 'sitemap.xml')), 'dist/sitemap.xml must exist after build');
  const sm = read(path.join(DIST, 'sitemap.xml'));
  assert.ok(sm.includes('<urlset'), 'sitemap.xml must contain <urlset>');
  assert.ok(sm.match(/<url>/g).length >= 5, 'sitemap.xml should list multiple URLs');
  assert.ok(exists(path.join(DIST, 'robots.txt')), 'dist/robots.txt must exist after build');
  const robots = read(path.join(DIST, 'robots.txt'));
  assert.ok(!/Disallow:\s*\//.test(robots), 'robots.txt must not blanket-block the site');
});

test('gate 14: key pages render valid JSON-LD', () => {
  const pages = [
    path.join(DIST, 'transfers', 'airport-to-nungwi', 'index.html'),
    path.join(DIST, 'experiences', 'index.html')
  ];
  for (const p of pages) {
    assert.ok(exists(p), 'page must exist after build: ' + p);
    const html = read(p);
    for (const block of ldBlocks(html)) {
      assert.doesNotThrow(() => JSON.parse(block), 'JSON-LD must parse on ' + p + ': ' + block.slice(0, 120));
    }
  }
});

test('gate 14: no legacy broken URLs and no literal hard-coded page prices survive render', () => {
  const transfersPage = read(path.join(DIST, 'transfers', 'airport-to-nungwi', 'index.html'));
  assert.ok(!/\$55 Fixed|Book Minivan \(\$55\)|Book Group Van \(\$75\)|Round-Trip \(\$100\)/.test(transfersPage),
    'legacy hard-coded transfer prices must not render');
});
