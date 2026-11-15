'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('redesign: shared header loads self-hosted fonts and mobile contact actions', () => {
  const header = read('src/_includes/header.njk');
  const css = read('public/css/eco-swahili.css');
  assert.ok(header.includes('/fonts/fraunces-latin-wght-normal.woff2'));
  assert.ok(header.includes('/fonts/figtree-latin-wght-normal.woff2'));
  assert.ok(!/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(header + css));
  assert.ok(css.includes('font-display:swap'));
  assert.ok(header.includes('class="mobile-contact-bar"'));
  for (const action of ['WhatsApp', 'Call', 'Enquire']) assert.ok(header.includes('>' + action + '<'));
});

test('redesign: language menu and runtime only enable published language routes', () => {
  const header = read('src/_includes/header.njk');
  const i18n = read('public/js/i18n-currency.js');
  assert.ok(header.includes('value="en"') && header.includes('value="it"') && header.includes('value="de"'));
  assert.ok(!header.includes('value="fr"') && !header.includes('value="pl"'));
  const langs = (i18n.match(/var\s+LANGS\s*=\s*\{([\s\S]*?)\n  \};/) || [])[1] || '';
  assert.ok(langs.includes('en:') && langs.includes('it:') && langs.includes('de:'));
  assert.ok(!/\bfr:|\bpl:/.test(langs));
});

test('redesign: all tour detail pages use the date and guest WhatsApp booking panel', () => {
  const dir = path.join(ROOT, 'src', 'pages', 'tours');
  const pages = fs.readdirSync(dir).filter(name => name.endsWith('.njk'));
  assert.ok(pages.length >= 15, 'expected the existing tour detail set');
  for (const page of pages) {
    const source = fs.readFileSync(path.join(dir, page), 'utf8');
    assert.ok(
      source.includes('tour-booking-panel.njk') || source.includes('whatsapp-booking-panel.njk'),
      page + ' must include a WhatsApp booking panel'
    );
  }
  const home = read('src/pages/index.njk');
  const transfer = read('src/pages/transfers/airport-to-nungwi.njk');
  assert.ok(home.includes('whatsapp-booking-panel.njk'));
  assert.ok(transfer.includes('whatsapp-booking-panel.njk'));
});

test('redesign: Google Maps contact iframe is inserted only after a click', () => {
  const contact = read('src/pages/contact.njk');
  const script = read('public/js/eco-swahili.js');
  assert.ok(!/<iframe\b/i.test(contact), 'contact page must not ship a live map iframe');
  assert.ok(contact.includes('data-map-src="https://www.google.com/maps/embed?'));
  assert.ok(script.includes("button.addEventListener('click'"));
  assert.ok(script.includes("document.createElement('iframe')"));
  assert.ok(script.includes("initClickToLoadMaps();"));
});

test('redesign: analytics remains disabled until a verified build ID is configured', () => {
  const site = JSON.parse(read('src/data/site.json'));
  const eleventy = read('.eleventy.js');
  const seo = read('src/_includes/seo.njk');
  assert.strictEqual(site.ga_measurement_id, '');
  assert.ok(eleventy.includes('process.env.GA_MEASUREMENT_ID'));
  assert.ok(eleventy.includes('/^G-[A-Z0-9]+$/'));
  assert.ok(seo.includes('requestIdleCallback'));
  assert.ok(!seo.includes('G-SNSZNZ2026'));
});

test('redesign: responsive image helper makes heroes high priority and other images lazy', () => {
  const helper = read('scripts/add-responsive-images.js');
  assert.ok(helper.includes("setAttr(next, 'loading', 'eager')"));
  assert.ok(helper.includes("setAttr(next, 'fetchpriority', 'high')"));
  assert.ok(helper.includes("setAttr(next, 'loading', 'lazy')"));
  assert.ok(helper.includes("type=\\"image/avif\\""));
  assert.ok(helper.includes("type=\\"image/webp\\""));
});

test('redesign: browser scripts are syntactically valid', () => {
  for (const file of ['public/js/eco-swahili.js', 'public/js/concierge.js', 'public/js/i18n-currency.js']) {
    const code = read(file);
    assert.doesNotThrow(() => new Function(code), file + ' must parse');
  }
});
