'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

test('funnel: area pages have valid Nunjucks expressions and no duplicate weather blocks', () => {
  const areaDir = path.join(ROOT, 'src', 'pages', 'areas');
  for (const f of fs.readdirSync(areaDir)) {
    if (!f.endsWith('.njk')) continue;
    const txt = fs.readFileSync(path.join(areaDir, f), 'utf8');
    assert.ok(!/(?<!\{)\{\s*areaData\./.test(txt), `${f} still has single-brace { areaData.* }`);
    assert.strictEqual((txt.match(/Weather Guide<\/h2>/g) || []).length, 1, `${f} must have exactly 1 Weather Guide section`);
    assert.ok(!txt.includes('excursions.png'), `${f} must not use missing fallback excursions.png`);
  }
  const builtArea = path.join(DIST, 'areas', 'paje', 'index.html');
  assert.ok(fs.existsSync(builtArea));
  assert.ok(!fs.readFileSync(builtArea, 'utf8').includes('{ areaData.'), 'built paje page must have zero unrendered areaData');
});

test('funnel: all 5 contracted hotels & 5 partner hotel transfer pages exist in dist with clean boards', () => {
  const partnerHotels = [
    'the-one-resort-zanzibar',
    'le-paradis-boutique-hotel-zanzibar',
    'mkeka-spice-lodge',
    'the-island-stonetown',
    'stone-town-view-hotel'
  ];
  for (const slug of partnerHotels) {
    const hp = path.join(DIST, 'hotels', slug, 'index.html');
    assert.ok(fs.existsSync(hp), `missing built hotel page: ${slug}`);
    const html = fs.readFileSync(hp, 'utf8');
    assert.ok(!html.includes("'halfBoard':"), `${slug} must not expose raw Python dict`);
    assert.ok(html.includes('data-sns-booking-open'), `${slug} must include instant concierge button`);
  }

  const transferSlugs = [
    'hotel-the-one-resort',
    'hotel-le-paradis-boutique',
    'hotel-mkeka-spice-lodge',
    'hotel-island-stone-town',
    'hotel-stone-town-view'
  ];
  for (const ts of transferSlugs) {
    const tp = path.join(DIST, 'transfers', ts, 'index.html');
    assert.ok(fs.existsSync(tp), `missing partner hotel transfer page: ${ts}`);
    const html = fs.readFileSync(tp, 'utf8');
    assert.ok(html.includes('data-sns-booking-open'), `${ts} must have direct prefilled concierge trigger`);
    assert.ok(!html.includes('"@type": "Product"') && !html.includes('"@type":"Product"'), `${ts} must use Service schema, not Product`);
  }

  const homeHtml = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  for (const slug of partnerHotels) {
    assert.ok(homeHtml.includes('/hotels/' + slug + '/'), `homepage must showcase contracted hotel: ${slug}`);
  }
});

test('funnel: DE and IT transfer calculators use live catalogue /api/quote without browser fare math', () => {
  for (const f of ['src/pages/de/transfers.njk', 'src/pages/it/trasferimenti.njk']) {
    const txt = read(f);
    assert.ok(!txt.includes('function getFareNumbers'), `${f} must not compute transfer fares in browser`);
    assert.ok(txt.includes('airport-transfer-znz-to-matemwe'), `${f} must map Matemwe/Kiwengwa to real matemwe slug`);
    assert.ok(txt.includes('airport-transfer-znz-to-kizimkazi'), `${f} must map Michamvi/Kizimkazi to real kizimkazi slug`);
    assert.ok(txt.includes("fetch('/api/quote'"), `${f} must fetch live quotes from /api/quote`);
    assert.ok(txt.includes('window.snsConcierge.openBooking'), `${f} must hand off calculator routes to Island Concierge`);
  }
});

test('funnel: packages have distinct H1s, safaris expose all 4 itineraries, and inline dataLayer.push is gone', () => {
  const pkgFiles = [
    'adrenaline-and-ocean-safari',
    'bush-to-beach-vip-luxury',
    'zanzibar-essentials-3day',
    'zanzibar-hidden-gems-sacred-caves'
  ];
  const h1s = new Set();
  for (const p of pkgFiles) {
    const txt = read(`src/pages/packages/${p}.njk`);
    const m = txt.match(/<h1>([^<]+)<\/h1>/);
    assert.ok(m, `${p} must have an H1`);
    h1s.add(m[1].trim());
    assert.ok(txt.includes('data-sns-booking-open'), `${p} must expose instant concierge booking trigger`);
  }
  assert.strictEqual(h1s.size, pkgFiles.length, 'each package must have a distinct H1');

  const safaris = read('src/pages/safaris.njk');
  for (const slug of ['mikumi-nyerere-day-safari', 'serengeti-3day-flyin', 'saadani-national-park-safari', 'selous-nyerere-fly-in-safari']) {
    assert.ok(safaris.includes(`data-service-slug="${slug}"`), `/safaris/ must expose concierge booking for ${slug}`);
  }

  assert.ok(!fs.existsSync(path.join(DIST, 'spice-farm-cultural', 'index.html')), 'spice-farm-cultural page must be retired to 301');

  const srcFiles = [
    'src/_includes/header.njk',
    'src/_includes/footer.njk',
    'src/_includes/hotel-card.njk',
    'src/_includes/tour-mobile-sticky.njk',
    'src/_includes/whatsapp-booking-panel.njk',
    'src/pages/index.njk'
  ];
  for (const f of srcFiles) {
    assert.ok(!read(f).includes('window.dataLayer.push'), `${f} must not use inline window.dataLayer.push (use gtag via main.js)`);
  }
});

test('funnel: area pages keep hotel links on-site, packages hub exposes all 4 bookable packages, and transfer/localized tour pages trigger concierge', () => {
  const areaDir = path.join(ROOT, 'src', 'pages', 'areas');
  for (const f of fs.readdirSync(areaDir)) {
    if (!f.endsWith('.njk')) continue;
    const txt = fs.readFileSync(path.join(areaDir, f), 'utf8');
    assert.ok(!txt.includes('hotel.website'), `${f} must route hotel cards internally to /hotels/, not off-site`);
    assert.ok(txt.includes('/hotels/{{ targetHotelSlug }}/'), `${f} must link hotel cards to /hotels/{{ targetHotelSlug }}/`);
  }

  const pkgsDist = fs.readFileSync(path.join(DIST, 'packages', 'index.html'), 'utf8');
  for (const slug of ['zanzibar-essentials-3day', 'zanzibar-hidden-gems-sacred-caves', 'adrenaline-and-ocean-safari', 'bush-to-beach-vip-luxury']) {
    assert.ok(pkgsDist.includes(`/packages/${slug}/`), `/packages/ must link to /packages/${slug}/`);
    assert.ok(pkgsDist.includes(`data-service-slug="${slug}"`), `/packages/ must expose concierge trigger for ${slug}`);
  }

  for (const dir of ['src/pages/transfers', 'src/pages/de/transfers', 'src/pages/it/trasferimenti']) {
    const abs = path.join(ROOT, dir);
    for (const f of fs.readdirSync(abs)) {
      if (!f.endsWith('.njk')) continue;
      const txt = fs.readFileSync(path.join(abs, f), 'utf8');
      assert.ok(!txt.includes('onclick="window.snsConcierge'), `${dir}/${f} must not use inline onclick concierge handler`);
      assert.ok(txt.includes('data-sns-booking-open') || txt.includes('data-sns-open'), `${dir}/${f} must expose concierge booking attribute`);
    }
  }

  for (const f of [
    'src/pages/de/tour/safari-blue.njk',
    'src/pages/de/tour/mnemba-snorkeling.njk',
    'src/pages/de/tour/spice-farm.njk',
    'src/pages/it/tour/safari-blue.njk',
    'src/pages/it/tour/mnemba-snorkeling.njk',
    'src/pages/it/tour/spice-farm.njk',
    'src/pages/fr/tour/mnemba-snorkeling.njk'
  ]) {
    assert.ok(read(f).includes('data-sns-booking-open'), `${f} must expose concierge booking trigger`);
  }

  assert.ok(!/<a\b[^>]*>\s*\{%\s*include\s+["']hotel-card\.njk["']\s*%\}/.test(read('src/pages/hotels.njk')), 'hotels.njk must not wrap hotel-card.njk in outer anchor');
  assert.ok(read('src/_includes/hotel-card.njk').includes('/hotels/{{ hotelDetailSlug }}/'), 'hotel-card.njk must link internally to /hotels/{{ hotelDetailSlug }}/');
});
