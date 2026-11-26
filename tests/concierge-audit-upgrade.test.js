'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

delete process.env.GEMINI_API_KEY;
delete process.env.OPENAI_COMPAT_BASE_URL;
delete process.env.OPENAI_COMPAT_API_KEY;

const ROOT = path.resolve(__dirname, '..');
const { handler: chatHandler } = require('../src/lib/api/chat');
const { getQuote } = require('../src/lib/concierge/pricing');
const { recommend } = require('../src/lib/concierge/recommend');
const { InMemoryStore, setGlobalStore } = require('../src/lib/concierge/store');

async function ask(message, profile, history) {
  setGlobalStore(new InMemoryStore());
  const res = await chatHandler({
    httpMethod: 'POST',
    headers: { origin: 'https://spiceandsail.com' },
    body: JSON.stringify({ message, profile: profile || {}, history: history || [] }),
  });
  return JSON.parse(res.body);
}

test('concierge pricing: daily car & scooter rentals scale by days, never by adults', () => {
  const car1 = getQuote({ serviceSlug: 'self-drive-compact', adults: 4, days: 1 });
  const car5 = getQuote({ serviceSlug: 'self-drive-compact', adults: 4, days: 5 });
  assert.strictEqual(car1.status, 'quoted');
  assert.strictEqual(car1.totalLow, 35);
  assert.strictEqual(car5.totalLow, 160); // 5 days * $32/day
  assert.strictEqual(car5.totalLow, car5.totalHigh);

  const scooter7 = getQuote({ serviceSlug: 'scooter-moped-rental', adults: 2, days: 7 });
  assert.strictEqual(scooter7.status, 'quoted');
  assert.ok(scooter7.totalLow >= 130 && scooter7.totalLow <= 140);
});

test('concierge recommend: interest aliases beach, diving, adventure, wildlife return relevant items', () => {
  const adv = recommend({ interests: ['diving', 'kite'], pickupZone: 'nungwi' }, 5);
  assert.ok(adv.length > 0, 'diving/kite must match snorkeling/adventure services');
  assert.ok(adv.some((r) => r.slug === 'mnemba-snorkeling' || r.slug === 'safari-blue'));

  const wild = recommend({ interests: ['wildlife'] }, 5);
  assert.ok(wild.some((r) => r.category === 'SAF' || r.slug === 'jozani-forest'));
});

test('concierge matching: fixed mikumi slug, all transfer routes, experiences, packages, and rentals match accurately', async () => {
  const cases = [
    ['How much is Mikumi day safari?', 'mikumi-nyerere-day-safari'],
    ['Tell me about Saadani National Park safari', 'saadani-national-park-safari'],
    ['Price for Selous Nyerere fly-in safari', 'selous-nyerere-fly-in-safari'],
    ['Airport transfer to Matemwe or Kiwengwa', 'airport-transfer-znz-to-matemwe'],
    ['Airport transfer to Kizimkazi or Michamvi', 'airport-transfer-znz-to-kizimkazi'],
    ['Airport transfer to Fumba', 'airport-transfer-znz-to-fumba'],
    ['Transfer from Stone Town to Nungwi', 'stone-town-to-nungwi'],
    ['Full day island hire with private driver', 'full-day-island-hire'],
    ['How much is swimming with horses?', 'horse-swimming'],
    ['Quad buggy safari price', 'quad-buggy-safari'],
    ['Maalum secret cenote swim', 'maalum-kuza-caves'],
    ['Uzi island Moses Road excursion', 'uzi-island-moses-road'],
    ['Private catamaran charter cost', 'private-catamaran-charter'],
    ['Adrenaline and Ocean Safari package price', 'adrenaline-and-ocean-safari'],
    ['Rent a 4x4 SUV for 5 days', 'self-drive-suv-4x4'],
    ['Scooter rental price', 'scooter-moped-rental'],
  ];
  for (const [q, expectedSlug] of cases) {
    const body = await ask(q);
    assert.ok(body.matchedSlugs.includes(expectedSlug), `"${q}" expected ${expectedSlug}, got ${JSON.stringify(body.matchedSlugs)}`);
    assert.ok(body.quote && body.quote.serviceSlug === expectedSlug, `"${q}" must return quote for ${expectedSlug}`);
  }
});

test('concierge context: multi-turn follow-up party size updates recalculate active service quote', async () => {
  const t1 = await ask('How much is Safari Blue?');
  assert.strictEqual(t1.profile.activeSlug, 'safari-blue');
  assert.strictEqual(t1.quote.totalLow, 190); // 2 * $95

  const t2 = await ask('Actually we are 4 adults', t1.profile, [
    { role: 'user', content: 'How much is Safari Blue?' },
    { role: 'assistant', content: t1.message },
  ]);
  assert.strictEqual(t2.intent, 'quote');
  assert.strictEqual(t2.quote.serviceSlug, 'safari-blue');
  assert.strictEqual(t2.quote.totalLow, 340); // 4 * $85
});

test('concierge Zanzibar & Tanzania knowledge: seasons/tides, areas, ferry/flights, packages, safaris, fees, partner hotels', async () => {
  const weather = await ask('When is the best time to visit Zanzibar and how do tides work?');
  assert.strictEqual(weather.intent, 'weather_seasons');
  assert.match(weather.message, /Nungwi & Kendwa/i);
  assert.match(weather.message, /Green Season/i);

  const areas = await ask('Where should I stay in Zanzibar — Stone Town vs Nungwi vs Paje?');
  assert.strictEqual(areas.intent, 'area_guide');
  assert.match(areas.message, /Stone Town/);
  assert.match(areas.message, /Mkeka Spice Lodge/);

  const ferry = await ask('How do I get from Dar es Salaam ferry to my hotel?');
  assert.strictEqual(ferry.intent, 'ferry_flights');
  assert.match(ferry.message, /Azam Marine/i);

  const pkgs = await ask('What multi-day packages do you offer?');
  assert.strictEqual(pkgs.intent, 'packages_list');
  assert.ok(pkgs.recommendedSlugs.includes('zanzibar-hidden-gems-sacred-caves'));
  assert.ok(pkgs.recommendedSlugs.includes('bush-to-beach-vip-luxury'));

  const safs = await ask('Tell me about your mainland Tanzania safaris');
  assert.strictEqual(safs.intent, 'safaris_list');
  assert.match(safs.message, /Great Migration/i);

  const hotels = await ask('Which partner hotels do you recommend?');
  assert.strictEqual(hotels.intent, 'hotels_list');
  assert.strictEqual(hotels.matchedHotels.length, 5);

  const fees = await ask('Are marine park fees and infrastructure tax included?');
  assert.strictEqual(fees.intent, 'fees_overview');
  assert.match(fees.message, /Menai Bay/i);
  assert.match(fees.message, /Mnemba/i);
});

test('concierge multilingual queries: IT/DE/FR price and transfer questions route accurately', async () => {
  const itQ = await ask('Quanto costa Safari Blue?');
  assert.strictEqual(itQ.intent, 'quote');
  assert.ok(itQ.matchedSlugs.includes('safari-blue'));

  const deQ = await ask('Was kostet Flughafentransfer Nungwi?');
  assert.strictEqual(deQ.intent, 'quote');
  assert.ok(deQ.matchedSlugs.includes('airport-transfer-znz-to-nungwikendwa'));

  const frQ = await ask('Combien coûte Mnemba?');
  assert.strictEqual(frQ.intent, 'quote');
  assert.ok(frQ.matchedSlugs.includes('mnemba-snorkeling'));
});

test('concierge frontend & widget: valid JS syntax, XSS link guards, no broken Search onclick', () => {
  const chatJs = fs.readFileSync(path.join(ROOT, 'public/js/sns-chat.js'), 'utf8');
  const ecoJs = fs.readFileSync(path.join(ROOT, 'public/js/eco-swahili.js'), 'utf8');
  const widget = fs.readFileSync(path.join(ROOT, 'src/_includes/concierge-widget.njk'), 'utf8');

  assert.doesNotThrow(() => new Function(chatJs), 'sns-chat.js must parse cleanly');
  assert.ok(!widget.includes('onclick="userBubble'), 'widget must not contain broken inline userBubble onclick');
  assert.ok(widget.includes('aria-label="Plan My Trip — Open Zanzibar Trip Concierge"'));
  assert.ok(chatJs.includes("'%5c'") || chatJs.includes('%5c'), 'sns-chat.js must reject encoded backslashes in URLs');
  assert.ok(chatJs.includes("['tour', 'experience', 'package', 'transfer', 'rental']"), 'sns-chat.js must load rentals');
  assert.ok(chatJs.includes('r.json.hotels'), 'sns-chat.js must load partner hotels');
  assert.ok(chatJs.includes('showBundleQuote'), 'sns-chat.js must support multi-service bundle quotes');
  assert.ok(ecoJs.includes('data-hotel-slug'), 'eco-swahili.js must pass hotel context into openBooking');
});
