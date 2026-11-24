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

test('redesign: language menu and runtime expose all five supported languages', () => {
  const header = read('src/_includes/header.njk');
  const i18n = read('public/js/i18n-currency.js');
  const langs = (i18n.match(/var\s+LANGS\s*=\s*\{([\s\S]*?)\n  \};/) || [])[1] || '';
  for (const lang of ['en', 'it', 'de', 'fr', 'pl', 'ar', 'ru']) {
    assert.ok(header.includes('value="' + lang + '"'), 'header must offer ' + lang);
    assert.ok(new RegExp('\\b' + lang + ':').test(langs), 'LANGS must include ' + lang);
  }
  assert.ok(i18n.includes("includedLanguages: 'en,it,de,fr,pl,ar,ru'"), 'Google Translate must include all seven languages');
  assert.ok(i18n.includes('fr: "Bonjour Spice and Sail'), 'French WhatsApp greeting must be restored');
  assert.ok(i18n.includes('pl: "Dzień dobry Spice and Sail'), 'Polish WhatsApp greeting must be restored');
  assert.ok(i18n.includes('ar: "مرحباً Spice and Sail'), 'Arabic WhatsApp greeting must be restored');
  assert.ok(i18n.includes('ru: "Здравствуйте'), 'Russian WhatsApp greeting must be restored');
  assert.ok(!/window\.googleTranslateElementInit\s*&&\s*lang\s*!==\s*'en'/.test(i18n), 'translator must load on the first non-English selection');
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

test('redesign: business hours are single-sourced and reflect 09:00-17:00 EAT', () => {
  const config = JSON.parse(read('src/data/concierge-catalogue.json'));
  const site = JSON.parse(read('src/data/site.json'));
  const chat = read('src/lib/api/chat.js');
  const { getBusinessHoursLabel } = require('../src/lib/concierge/catalogue');
  assert.strictEqual(config.config.businessHours.start, 9);
  assert.strictEqual(config.config.businessHours.end, 17);
  assert.ok(config.config.replyWindow.includes('09:00–17:00 EAT'));
  assert.strictEqual(site.hours.open, '09:00');
  assert.strictEqual(site.hours.close, '17:00');
  assert.strictEqual(getBusinessHoursLabel(), 'Mon–Sat, 09:00–17:00 EAT');
  assert.ok(chat.includes('getBusinessHoursLabel'));
  assert.ok(!chat.includes('08:00–18:00') && !chat.includes('08:00-18:00'));
});

test('redesign: responsive image helper makes heroes high priority and other images lazy', () => {
  const helper = read('scripts/add-responsive-images.js');
  assert.ok(helper.includes("setAttr(next, 'loading', 'eager')"));
  assert.ok(helper.includes("setAttr(next, 'fetchpriority', 'high')"));
  assert.ok(helper.includes("setAttr(next, 'loading', 'lazy')"));
  assert.ok(helper.includes(`type="image/avif"`));
  assert.ok(helper.includes(`type="image/webp"`));
});

test('redesign: concierge date and WhatsApp prefill validators match real values', () => {
  const concierge = read('public/js/concierge.js');
  const chat = read('src/lib/api/chat.js');
  assert.ok(concierge.includes('/^\\d{4}-\\d{2}-\\d{2}$/'), 'booking date must match YYYY-MM-DD');
  assert.ok(concierge.includes('/^\\d{8,15}$/'), 'concierge must accept digit-only international WhatsApp numbers');
  assert.ok(chat.includes('/^\\d{8,15}$/'), 'server chat must validate digit-only WhatsApp configuration');
});
 
test('redesign: browser scripts are syntactically valid', () => {
  for (const file of ['public/js/eco-swahili.js', 'public/js/concierge.js', 'public/js/i18n-currency.js']) {
    const code = read(file);
    assert.doesNotThrow(() => new Function(code), file + ' must parse');
  }
});

test('redesign: tour and transfer booking CTAs use the same verified concierge lead flow', () => {
  const panel = read('src/_includes/whatsapp-booking-panel.njk');
  const tourPanel = read('src/_includes/tour-booking-panel.njk');
  const concierge = read('public/js/concierge.js');
  const bookingScript = read('public/js/eco-swahili.js');
  const widget = read('src/_includes/concierge-widget.njk');
  assert.ok(panel.includes('data-concierge-booking-form'));
  assert.ok(panel.includes('data-service-slug="{{ booking_slug }}"'));
  assert.ok(panel.includes('type="number" min="1" max="50"'));
  assert.ok(panel.includes('Enter your exact group size (1–50)'));
  assert.ok(!panel.includes('wa.me/'), 'booking panel must not bypass the enquiry reference flow');
  assert.ok(tourPanel.includes('booking_slug = tour_slug or page.fileSlug'));
  assert.ok(bookingScript.includes("window.snsConcierge.openBooking(options)"));
  assert.ok(bookingScript.includes("querySelectorAll('[data-sns-booking-open]')"));
  assert.ok(concierge.includes('openBooking: openBooking'));
  assert.ok(concierge.includes("(state.services || []).find(function (service)"));
  assert.ok(concierge.includes("goToStep(2)"));
  assert.ok(widget.includes('type="number" id="sns-travelers"'));
  assert.ok(widget.includes('min="1" max="50"'));
  const tourDir = path.join(ROOT, 'src', 'pages', 'tours');
  for (const page of fs.readdirSync(tourDir).filter(name => name.endsWith('.njk'))) {
    const source = fs.readFileSync(path.join(tourDir, page), 'utf8');
    assert.ok(source.includes('data-sns-booking-open'), page + ' primary booking CTA must open the concierge');
    assert.ok(source.includes('data-service-slug="{{ tour_slug }}"'), page + ' must pass its canonical catalogue slug');
  }
  const nungwi = read('src/pages/transfers/airport-to-nungwi.njk');
  assert.ok(nungwi.includes('data-service-slug="airport-transfer-znz-to-nungwikendwa"'));
});

test('redesign: hotel directory loads all 198 properties progressively and keeps search complete', () => {
  const page = read('src/pages/hotels.njk');
  const fragment = read('src/pages/hotels-more.json.njk');
  const partial = read('src/_includes/hotel-card.njk');
  const helper = read('scripts/add-responsive-images.js');
  assert.ok(page.includes('hotels.hotels.slice(0, 16)'));
  assert.ok(page.includes('Showing 16 of {{ hotels.hotels | length }} properties'), 'count indicator must match the initial 16 cards');
  assert.ok(page.includes('The first 16 properties remain available.'), 'fallback must not promise 48 cards');
  assert.ok(!page.includes('Showing 48'), 'stale 48-card count must be removed');
  assert.ok(!page.includes('first 48'), 'stale 48-card fallback must be removed');
  assert.ok(page.includes('id="load-more-hotels"'));
  assert.ok(page.includes('data-total-hotels="{{ hotels.hotels | length }}"'));
  assert.ok(page.includes("ensureAllCardsLoaded().then(filterHotels)"));
  assert.ok(page.includes("fetch('/data/hotels-more.json'"));
  assert.ok(fragment.includes('permalink: /data/hotels-more.json'));
  assert.ok(fragment.includes('hotels.hotels.slice(16)'));
  assert.ok(fragment.includes('hotel-card.njk'));
  assert.ok(partial.includes('hotelIndex < 2'));
  assert.ok(partial.includes('fetchpriority="high"'));
  assert.ok(helper.includes("attrs.loading !== 'eager'"), 'build helper must preserve eagerly loaded first cards');
  assert.ok(page.includes('{% for hotel in hotels.hotels.slice(0, 16) %}'), 'main listing must render only the first 16 cards up front');
  assert.ok(page.includes('data-hotel-index-link="{{ hotel.slug }}"'), 'all properties must have crawlable index links');
});

test('redesign: hotel search and filters have a single progressive controller', () => {
  const page = read('src/pages/hotels.njk');
  assert.ok(!page.includes('<!-- Client-side Unified Filter & Search Script -->'));
  assert.strictEqual(page.split('function filterHotels()').length - 1, 1);
  assert.ok(page.includes('function ensureAllCardsLoaded()'));
  assert.ok(page.includes("fetch('/data/hotels-more.json'"));
});

test('redesign: built hotel directory keeps the full catalogue in deferred batches', () => {
  const source = JSON.parse(read('src/data/hotels.json'));
  const page = fs.readFileSync(path.join(ROOT, 'dist', 'hotels', 'index.html'), 'utf8');
  const deferred = JSON.parse(fs.readFileSync(path.join(ROOT, 'dist', 'data', 'hotels-more.json'), 'utf8'));
  const initialCount = (page.match(/<article[^>]*class="card hotel-card/g) || []).length;
  const indexCount = (page.match(/data-hotel-index-link=/g) || []).length;
  assert.strictEqual(initialCount, Math.min(16, source.hotels.length));
  assert.strictEqual(indexCount, source.hotels.length, 'every property must be present in server-rendered HTML');
  assert.strictEqual(deferred.total, source.hotels.length);
  assert.strictEqual(deferred.cards.length, Math.max(0, source.hotels.length - 16));
  assert.ok(deferred.cards.every(card => /<article[^>]*class="card hotel-card/.test(card)));
});

test('redesign: homepage mobile hero uses a valid single-column rule', () => {
  const css = read('public/css/eco-swahili.css');
  assert.ok(!css.includes('\\n.home .hero{'), 'CSS must not contain a literal backslash-n selector');
  assert.ok(css.includes('.home .hero{grid-template-columns:minmax(0,1fr);'));
  assert.ok(css.includes('.home .hero-content { grid-column:1;'));
});

test('redesign: first tour card and directory hero images are eagerly loaded', () => {
  const tours = read('src/pages/tours.njk');
  const seo = read('src/_includes/seo.njk');
  const hotels = read('src/pages/hotels.njk');
  const transfers = read('src/pages/transfers.njk');
  assert.ok(tours.includes('loading="{% if loop.index <= 2 %}eager{% else %}lazy{% endif %}"'));
  assert.ok(tours.includes('fetchpriority="high"'));
  assert.ok(seo.includes('<link rel="preload" as="image" href="{{ preload_image | cdnFile }}" fetchpriority="high">'));
  for (const page of [hotels, transfers]) {
    assert.ok(page.includes('class="page-header-bg-image"'));
    assert.ok(page.includes('sizes="100vw"'));
    assert.ok(page.includes('loading="eager"'));
    assert.ok(page.includes('fetchpriority="high"'));
  }
  assert.ok(!hotels.includes('preload_image:'));
  assert.ok(!transfers.includes('preload_image:'));
});

test('redesign: transfer calculator labels, visible accessible names and contrast hooks are present', () => {
  const transfers = read('src/pages/transfers.njk');
  const header = read('src/_includes/header.njk');
  const widget = read('src/_includes/concierge-widget.njk');
  const css = read('public/css/eco-swahili.css');
  for (const id of ['calc-pickup', 'calc-dest', 'calc-pax', 'calc-date', 'calc-driver-lang']) {
    assert.ok(transfers.includes('<label for="' + id + '"'), id + ' must have an associated visible label');
  }
  assert.ok(header.includes('aria-label="S&amp;S Spice &amp; Sail Zanzibar home"'));
  assert.ok(widget.includes('aria-label="Plan My Trip — Open Zanzibar Trip Concierge"'));
  assert.ok(css.includes('.section-header .section-tag'));
  assert.ok(css.includes('.page-header .btn-secondary'));
  assert.ok(css.includes('span[style*="background: #059669"]'));
  assert.ok(css.includes('a[style*="#25D366"]'));
});

test('redesign: transfer calculator only quotes verified destinations and hands supported routes to concierge', () => {
  const transfers = read('src/pages/transfers.njk');
  const catalogue = JSON.parse(read('src/data/concierge-catalogue.json'));
  const verifiedTransfers = catalogue.services.filter(service => service.type === 'transfer').map(service => service.slug);
  assert.deepStrictEqual(verifiedTransfers.sort(), [
    'airport-transfer-znz-to-stone-town',
    'airport-transfer-znz-to-fumba',
    'airport-transfer-znz-to-nungwikendwa',
    'airport-transfer-znz-to-pajejambiani',
    'airport-transfer-znz-to-matemwe',
    'airport-transfer-znz-to-kizimkazi',
    'stone-town-to-nungwi',
    'full-day-island-hire'
  ].sort());
  for (const id of ['calc-pickup', 'calc-dest', 'calc-pax', 'calc-date', 'calc-flight', 'calc-driver-lang']) {
    assert.ok(transfers.includes('<label for="' + id + '"'), id + ' must have an associated label');
  }
  assert.ok(transfers.includes('type="number" id="calc-pax" min="1" max="50"'));
  assert.ok(transfers.includes('data-slug="airport-transfer-znz-to-matemwe"'));
  assert.ok(transfers.includes('data-zone="Kiwengwa / Pongwe"'));
  assert.ok(transfers.includes('data-slug="airport-transfer-znz-to-kizimkazi"'));
  assert.ok(transfers.includes("fetch('/api/quote'"));
  assert.ok(transfers.includes("window.snsConcierge.openBooking(options)"));
  assert.ok(transfers.includes('serviceSlug: route.slug'));
  assert.ok(transfers.includes('guests: route.passengers'));
  assert.ok(transfers.includes("'Flight number: ' + route.flight"));
  assert.ok(transfers.includes("paxEl.reportValidity()") && transfers.includes("dateEl.reportValidity()"));
  assert.ok(!transfers.includes('function getFareNumbers'), 'browser must not compute transfer fares');
  assert.ok(!transfers.includes('return [35, 40]') && !transfers.includes('return [50, 60]'));
  assert.ok(transfers.includes('calc-concierge-btn'));
  assert.ok(!transfers.includes("open('airport-transfer-znz-to-nungwikendwa')"), 'secondary concierge shortcut must not force a fixed route');
  assert.ok(transfers.includes('function formatQuoteDisplay(quote)'));
  assert.ok(transfers.includes('lastQuote = quote'));
  assert.ok(!transfers.includes('reserve%20a%20Private%20Airport%20Transfer%20to%20Nungwi'), 'static fallback must not force Nungwi');
  const site = JSON.parse(read('src/data/site.json'));
  assert.strictEqual(site.contact.whatsapp, catalogue.config.whatsappNumber, 'site links and concierge must use the same configured business number');
});



test('redesign: CI Lighthouse audits the static build without requiring a hosting account', () => {
  const config = JSON.parse(read('lighthouserc.json'));
  const workflow = read('.github/workflows/deploy.yml');
  assert.strictEqual(config.ci.collect.staticDistDir, './dist');
  assert.deepStrictEqual(config.ci.collect.url, [
    'http://localhost/',
    'http://localhost/tours/',
    'http://localhost/transfers/',
    'http://localhost/hotels/'
  ]);
  assert.strictEqual(config.ci.assert.assertions['categories:performance'][1].minScore, 0.9);
  assert.strictEqual(config.ci.assert.assertions['categories:seo'][1].minScore, 0.9);
  assert.strictEqual(config.ci.assert.assertions['categories:accessibility'][1].minScore, 0.95);
  assert.ok(workflow.includes('lighthouse-ci-action@v11'));
  assert.ok(!/NETLIFY_AUTH_TOKEN|NETLIFY_SITE_ID|netlify deploy|preview-deploy/.test(workflow));
});

test('redesign: unified CSS eliminates conflicting styles.css, copies fonts, and keeps brand/hero visible', () => {
  const header = read('src/_includes/header.njk');
  const css = read('public/css/eco-swahili.css');
  assert.ok(!header.includes('/css/styles.css'), 'header must not load conflicting legacy styles.css');
  assert.ok(css.includes('url("/fonts/fraunces-latin-wght-italic.woff2")'), 'Fraunces italic must point to fraunces woff2');
  assert.ok(fs.existsSync(path.join(ROOT, 'dist', 'fonts', 'fraunces-latin-wght-normal.woff2')));
  assert.ok(fs.existsSync(path.join(ROOT, 'dist', 'fonts', 'figtree-latin-wght-normal.woff2')));
  assert.ok(css.includes('-webkit-text-fill-color:#fff') && css.includes('-webkit-text-fill-color:var(--wood)'));
  assert.ok(css.includes('-webkit-text-fill-color:var(--clay-text)'));
});

test('redesign: homepage renders featured partner hotels, valid FAQPage schema, and honest claims', () => {
  const html = fs.readFileSync(path.join(ROOT, 'dist', 'index.html'), 'utf8');
  assert.ok(!html.includes('247 reviews'), 'must not render fabricated aggregate review counts');
  assert.ok(!html.includes('Stone Town Based'), 'business base must reflect confirmed Mbuzini location');
  assert.ok(html.includes('Mbuzini, Zanzibar Based'));
  assert.ok(html.includes('/hotels/the-one-resort-zanzibar/'));
  assert.ok(html.includes('/hotels/le-paradis-boutique-hotel-zanzibar/'));
  const faqMatches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];
  const parsed = faqMatches.map(b => JSON.parse(b.replace(/^<script[^>]*>|<\/script>$/g, '')));
  assert.ok(parsed.some(d => d['@type'] === 'FAQPage' && Array.isArray(d.mainEntity) && d.mainEntity.length > 0), 'homepage must include valid FAQPage JSON-LD');
});

test('redesign: partner hotel landing pages render bundle titles, dollar rates, and concierge triggers', () => {
  const slugs = [
    'the-one-resort-zanzibar',
    'le-paradis-boutique-hotel-zanzibar',
    'mkeka-spice-lodge',
    'stone-town-view-hotel',
    'the-island-stonetown'
  ];
  for (const slug of slugs) {
    const html = fs.readFileSync(path.join(ROOT, 'dist', 'hotels', slug, 'index.html'), 'utf8');
    assert.match(html, /<span class="price-amount">\$\d+<\/span>/, slug + ' must show $ price amount');
    assert.ok(!html.includes('<h3></h3>'), slug + ' bundle title must not be empty');
    assert.ok(html.includes('data-sns-booking-open'), slug + ' must trigger concierge modal');
  }
});
