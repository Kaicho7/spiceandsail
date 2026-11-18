'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const { getQuote, quotePlan } = require('../src/lib/concierge/pricing');
const { validateLead } = require('../src/lib/concierge/validate');
const { handler: quoteHandler } = require('../netlify/functions/quote');

test('bundle: contracted hotel quote uses seasonal room rate plus per-person levy', () => {
  const q = getQuote({
    serviceSlug: 'hotel:the-one-resort-zanzibar',
    date: '2026-12-20',
    adults: 2,
    children: 0,
    nights: 3,
    rooms: 1,
  });
  assert.strictEqual(q.status, 'quoted');
  assert.strictEqual(q.serviceType, 'hotel');
  assert.ok(q.totalLow > 0 && q.totalHigh >= q.totalLow);
  assert.match(q.totalDisplay, /^\$[\d,]+/);
  assert.ok(q.lines.some((line) => /infrastructure levy/i.test(line.label)), 'levy shown as separate line');
  assert.ok(q.lines[0].note.includes('per room per night'));
});

test('bundle: hotel + multiple services produce one summed server quote', () => {
  const plan = quotePlan(
    ['hotel:stonetown-view-hotel', 'airport-transfer-znz-to-stone-town', 'safari-blue'],
    2,
    0,
    { date: '2026-12-20', nights: 2, rooms: 1 }
  );
  assert.strictEqual(plan.status, 'quoted');
  assert.strictEqual(plan.perService.length, 3);
  assert.strictEqual(plan.totalLow, plan.perService.reduce((sum, q) => sum + q.totalLow, 0));
  assert.strictEqual(plan.totalHigh, plan.perService.reduce((sum, q) => sum + q.totalHigh, 0));
});

test('bundle: GET /quote exposes the five contracted hotels without net rates', async () => {
  const response = await quoteHandler({ httpMethod: 'GET', headers: {}, path: '/quote' });
  assert.strictEqual(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.ok(Array.isArray(body.hotels));
  assert.strictEqual(body.hotels.length, 5);
  assert.ok(body.hotels.every((h) => h.slug.startsWith('hotel:') && Number.isFinite(h.fromRate)));
  assert.doesNotMatch(response.body, /netRate|marginPct/);
});

test('bundle: POST /quote passes hotel nights and rooms through to the plan', async () => {
  const response = await quoteHandler({
    httpMethod: 'POST',
    headers: {},
    body: JSON.stringify({
      serviceSlugs: ['hotel:the-one-resort-zanzibar', 'safari-blue'],
      adults: 2,
      children: 0,
      date: '2026-12-20',
      nights: 3,
      rooms: 1,
    }),
  });
  assert.strictEqual(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.match(body.perService[0].serviceName, /3 nights/);
});

test('bundle: lead validation accepts hotel nights and rooms', () => {
  const result = validateLead({
    name: 'Amina Hassan',
    email: 'amina@example.com',
    date: '2026-12-20',
    travellers: 2,
    services: ['hotel:the-one-resort-zanzibar', 'safari-blue', 'airport-transfer-znz-to-stone-town'],
    nights: 3,
    rooms: 1,
    consent_contact: true,
    privacy_notice_version: 'v1.0',
  });
  assert.deepStrictEqual(result.errors, []);
});

test('bundle: widget exposes multi-select, hotel grid, nights and basket', () => {
  const widget = fs.readFileSync(path.join(ROOT, 'src/_includes/concierge-widget.njk'), 'utf8');
  const js = fs.readFileSync(path.join(ROOT, 'public/js/concierge.js'), 'utf8');
  assert.ok(widget.includes('id="sns-hotel-grid"'));
  assert.ok(widget.includes('id="sns-basket"'));
  assert.ok(widget.includes('id="sns-nights"') && widget.includes('id="sns-rooms"'));
  assert.ok(js.includes("input.type = 'checkbox'"));
  assert.ok(js.includes("state.selectedSlugs = state.selectedServices.concat(state.selectedHotels)"));
  assert.ok(js.includes('serviceSlugs: state.selectedSlugs.slice()'));
});
