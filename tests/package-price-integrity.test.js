'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

const catalogue = readJson('src/data/concierge-catalogue.json');
const hotelRates = readJson('src/data/hotelRates.json');
const publicRates = readJson('src/data/hotelPublicRates.json');
const { publicFromRate } = require('../src/lib/concierge/public-data');

const packageServices = (catalogue.services || []).filter(
  (service) => service.type === 'package' && service.hotelSlug
);

function price(service) {
  const pricing = service.pricing || {};
  return [pricing.min, pricing.max];
}

test('catalogue packages carry a description and both price bounds', () => {
  assert.strictEqual(packageServices.length, 5);
  for (const service of packageServices) {
    const description = (service.description || service.shortDescription || '').trim();
    assert.ok(description.length > 0, service.slug + ' needs a description');
    const [min, max] = price(service);
    assert.ok(Number.isFinite(min) && Number.isFinite(max), service.slug + ' needs numeric min/max');
    assert.ok(min <= max, service.slug + ' min must not exceed max');
  }
});

test('hotelRates.json package prices match the catalogue', () => {
  const byId = new Map((hotelRates.packages || []).map((pkg) => [pkg.id, pkg]));
  for (const service of packageServices) {
    const legacy = byId.get(service.id);
    assert.ok(legacy, service.id + ' missing from hotelRates.json');
    assert.deepStrictEqual(
      [legacy.perPerson.min, legacy.perPerson.max],
      price(service),
      service.id + ' price drifted from the catalogue'
    );
  }
});

test('hotelPublicRates.json bundle and hotel package prices match the catalogue', () => {
  const bundles = new Map((publicRates.bundles || []).map((bundle) => [bundle.id, bundle]));
  const perHotel = new Map();
  for (const hotel of publicRates.hotels || []) {
    if (hotel.package && hotel.package.id) perHotel.set(hotel.package.id, hotel.package);
  }
  for (const service of packageServices) {
    const bundle = bundles.get(service.id);
    assert.ok(bundle, service.id + ' missing from hotelPublicRates bundles');
    assert.deepStrictEqual(
      [bundle.perPersonMin, bundle.perPersonMax],
      price(service),
      service.id + ' bundle price drifted from the catalogue'
    );
    const hotelPackage = perHotel.get(service.id);
    assert.ok(hotelPackage, service.id + ' missing from hotel package data');
    assert.deepStrictEqual(
      [hotelPackage.perPersonMin, hotelPackage.perPersonMax],
      price(service),
      service.id + ' hotel package price drifted from the catalogue'
    );
  }
});

test('public hotel from-rates match the catalogue hotel pricing', () => {
  for (const hotel of catalogue.hotels || []) {
    const publicHotel = (publicRates.hotels || []).find((h) => h.slug === hotel.slug);
    assert.ok(publicHotel, hotel.slug + ' missing from hotelPublicRates.json');
    const rate = publicFromRate(publicHotel);
    assert.ok(Number.isFinite(rate) && rate > 0, hotel.slug + ' needs a positive from-rate');
    assert.strictEqual(rate, hotel.pricing.min, hotel.slug + ' from-rate drifted from the catalogue');
  }
});
