'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('analytics remains disabled until an owner-verified GA ID is configured', () => {
  const site = JSON.parse(read('src/data/site.json'));
  assert.equal(site.ga_enabled, false);
  assert.equal(site.ga_measurement_id, '');
  assert.doesNotMatch(read('src/_includes/seo.njk'), /G-SNSZNZ2026/);
});

test('shared header uses locally hosted fonts and only current language choices', () => {
  const header = read('src/_includes/header.njk');
  assert.doesNotMatch(header, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  assert.match(header, /value="en"/);
  assert.match(header, /value="it"/);
  assert.match(header, /value="de"/);
  assert.doesNotMatch(header, /value="fr"|value="pl"/);
});

test('SEO-critical headings on the three rebuilt routes remain unchanged', () => {
  assert.match(read('src/pages/index.njk'), /Zanzibar Tours, Transfers &amp; <span class="highlight">Island Experiences<\/span>/);
  assert.match(read('src/pages/tours/safari-blue.njk'), /<h1>Safari Blue \/ Menai Bay dhow day<\/h1>/);
  assert.match(read('src/pages/transfers/airport-to-nungwi.njk'), /Zanzibar Airport \(ZNZ\) to Nungwi Private Transfer/);
});

test('booking form includes service, date and guest fields and WhatsApp message handling', () => {
  const panel = read('src/_includes/booking-panel.njk');
  const script = read('public/js/brand.js');
  for (const name of ['service', 'date', 'guests']) assert.match(panel, new RegExp('name="' + name + '"'));
  assert.match(script, /https:\/\/wa\.me\//);
  assert.match(panel, /lang == "it"/);
  assert.match(panel, /lang == "de"/);
});

test('maps are loaded only after explicit activation', () => {
  const contact = read('src/pages/contact.njk');
  assert.match(contact, /data-load-map/);
  assert.match(contact, /data-map-src=/);
  assert.doesNotMatch(contact, /<iframe[\s\S]*?\ssrc="https:\/\/www\.google\.com\/maps\/embed/);
});

test('empty review include contains no fabricated ratings or review cards', () => {
  const reviews = read('src/_includes/tour-reviews.njk');
  assert.doesNotMatch(reviews, /<section|<article|rating/i);
});
