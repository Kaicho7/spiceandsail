'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

function listNkj(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listNkj(full));
    else if (entry.name.endsWith('.njk')) out.push(full);
  }
  return out;
}

test('tour prices match the concierge catalogue', () => {
  const toursData = readJson('src/data/tours.json');
  const tours = Array.isArray(toursData) ? toursData : toursData.tours;
  const catalogue = readJson('src/data/concierge-catalogue.json').services;
  const bySlug = new Map(catalogue.map((s) => [s.slug, s]));

  assert.ok(Array.isArray(tours), 'tours.json exposes a tours array');
  for (const tour of tours) {
    const service = bySlug.get(tour.slug);
    assert.ok(service, `${tour.slug} exists in concierge catalogue`);
    const tp = tour.price || {};
    const cp = service.pricing || {};
    assert.deepEqual(
      { min: tp.min, max: tp.max, display: tp.display },
      { min: cp.min, max: cp.max, display: cp.display },
      `${tour.slug} price matches catalogue`
    );
    assert.match(cp.display, /^\$\d[\d,]*(–\$\d[\d,]*)?$/, `${tour.slug} display has no stripped currency symbols`);
  }
});

test('templates do not render tour.price.display directly', () => {
  for (const file of listNkj(path.join(ROOT, 'src'))) {
    const content = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(
      content,
      /\{\{\s*tour\.price\.display\s*\}\}/,
      `${path.relative(ROOT, file)} uses catPrice so the catalogue is the single rendering source`
    );
  }
});
