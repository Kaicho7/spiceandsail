'use strict';
/**
 * Gate: every hreflang alternate declared in dist/sitemap.xml must resolve to
 * a built page in dist/. Preconditions: `npm run build` has run.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SITE = 'https://spiceandsail.com';

function pathForUrl(url) {
  const u = new URL(url);
  let p = decodeURIComponent(u.pathname).replace(/^\/+|\/+$/g, '');
  if (p === '') p = 'index';
  const candidate = path.join(DIST, p, 'index.html');
  if (fs.existsSync(candidate)) return candidate;
  const htmlCandidate = path.join(DIST, p + '.html');
  if (fs.existsSync(htmlCandidate)) return htmlCandidate;
  return null;
}

test('sitemap hreflang alternates resolve to built pages', () => {
  const sitemapPath = path.join(DIST, 'sitemap.xml');
  assert.ok(fs.existsSync(sitemapPath), 'dist/sitemap.xml missing — run `npm run build` first');
  const xml = fs.readFileSync(sitemapPath, 'utf8');
  const alternates = [];
  for (const m of xml.matchAll(/<xhtml:link[^>]*rel="alternate"[^>]*href="([^"]+)"[^>]*\/>/g)) {
    alternates.push(m[1]);
  }
  assert.ok(alternates.length > 0, 'no hreflang alternates found in sitemap');
  const missing = alternates.filter((u) => u.startsWith(SITE) && !pathForUrl(u));
  assert.deepStrictEqual(missing, [],
    `${missing.length} sitemap alternate(s) have no built page:\n  ` + missing.join('\n  '));
});
