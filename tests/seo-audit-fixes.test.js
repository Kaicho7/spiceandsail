'use strict';

/**
 * Regression gate for the 2026-11-22 full-audit remediation sprint.
 * Covers P1-4, P1-6, P1-7, P1-8, P1-9, P1-11 (wiring) and P1-12 skip links.
 * Runs against dist/ which is produced by `npm run build`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

const htmlFiles = fs.existsSync(DIST) ? walk(DIST) : [];

test('P1-4: rendered titles <= 70 chars and descriptions <= 160 chars', () => {
  const bad = [];
  for (const f of htmlFiles) {
    if (path.basename(f) === '404.html') continue;
    const c = fs.readFileSync(f, 'utf8');
    const title = (c.match(/<title>([^<]+)<\/title>/) || [])[1];
    if (title && title.trim().length > 70) bad.push(`title ${title.trim().length}: ${f}`);
    const desc = (c.match(/<meta name="description" content="([^"]*)">/) || [])[1];
    if (desc && desc.trim().length > 160) bad.push(`desc ${desc.trim().length}: ${f}`);
  }
  assert.deepEqual(bad, [], `over-length metadata:\n${bad.slice(0, 10).join('\n')}`);
});

test('P1-6: every blog post emits exactly one BlogPosting schema', () => {
  const blog = htmlFiles.filter(f => f.includes(`${path.sep}blog${path.sep}`) && path.basename(path.dirname(f)) !== 'blog');
  assert.ok(blog.length > 0, 'no blog pages in dist');
  for (const f of blog) {
    const n = (fs.readFileSync(f, 'utf8').match(/"@type":\s*"BlogPosting"/g) || []).length;
    assert.equal(n, 1, `${f} should have exactly one BlogPosting, found ${n}`);
  }
});

test('P1-6: every area page emits exactly one TouristDestination schema', () => {
  const areas = htmlFiles.filter(f => f.includes(`${path.sep}areas${path.sep}`) && path.basename(path.dirname(f)) !== 'areas');
  assert.ok(areas.length > 0, 'no area pages in dist');
  for (const f of areas) {
    const n = (fs.readFileSync(f, 'utf8').match(/"@type":\s*"TouristDestination"/g) || []).length;
    assert.equal(n, 1, `${f} should have exactly one TouristDestination, found ${n}`);
  }
});

test('P1-6: homepage emits exactly one FAQPage node', () => {
  const home = path.join(DIST, 'index.html');
  const n = (fs.readFileSync(home, 'utf8').match(/"@type":\s*"FAQPage"/g) || []).length;
  assert.equal(n, 1, `homepage FAQPage nodes: ${n}`);
});

test('P1-7: package page has an explicit html lang', () => {
  const p = path.join(DIST, 'packages', 'zanzibar-essentials-3day', 'index.html');
  assert.match(fs.readFileSync(p, 'utf8'), /<html lang="en">/);
});

test('P1-8: /about.html 301 redirect exists', () => {
  const r = fs.readFileSync(path.join(ROOT, '_redirects'), 'utf8');
  assert.match(r, /^\/about\.html\s+\/about\/\s+301$/m);
});

test('P1-9: sitemap lastmod values are real ISO dates, not a blanket single date', () => {
  const sm = fs.readFileSync(path.join(DIST, 'sitemap.xml'), 'utf8');
  const dates = [...sm.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map(m => m[1]);
  assert.ok(dates.length > 0, 'no lastmod values');
  for (const d of dates) assert.match(d, /^\d{4}-\d{2}-\d{2}$/, `bad lastmod: ${d}`);
  assert.ok(new Set(dates).size > 1, 'all lastmod values are identical');
});

test('P1-9: every sitemap xhtml:link alternate resolves to a built page', () => {
  const sm = fs.readFileSync(path.join(DIST, 'sitemap.xml'), 'utf8');
  const hrefs = [...sm.matchAll(/<xhtml:link[^>]*href="([^"]+)"/g)].map(m => m[1]);
  for (const h of hrefs) {
    let p = new URL(h).pathname;
    if (p.endsWith('/')) p += 'index.html';
    assert.ok(fs.existsSync(path.join(DIST, p)), `dangling alternate: ${h}`);
  }
});

test('P1-11: GA4 loader is consent-gated', () => {
  const js = fs.readFileSync(path.join(ROOT, 'public', 'js', 'sns-ga4-config.js'), 'utf8');
  assert.match(js, /sns-analytics-consent/, 'GA loader must read consent key');
  assert.match(js, /getConsent\(\)\s*===\s*'granted'/, 'GA must only init after granted consent');
  assert.ok(fs.existsSync(path.join(ROOT, 'public', 'js', 'sns-consent.js')), 'consent banner script missing');
});

test('P1-12: generated detail pages have a working skip link target', () => {
  const hotel = path.join(DIST, 'hotels', 'the-one-resort-zanzibar', 'index.html');
  assert.ok(fs.existsSync(hotel), 'no generated hotel page found');
  const c = fs.readFileSync(hotel, 'utf8');
  assert.match(c, /href="#main-content"/);
  assert.match(c, /id="main-content"/);
});

test('P1-12: hotel search input has an accessible name', () => {
  const c = fs.readFileSync(path.join(DIST, 'hotels', 'index.html'), 'utf8');
  assert.match(c, /id="hotel-search-input"[^>]*aria-label="[^"]+"/);
});
