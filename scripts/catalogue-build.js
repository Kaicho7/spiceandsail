#!/usr/bin/env node
/**
 * Catalogue build script — validates concierge-catalogue.json
 * against the canonical tours.json and transfers.json.
 * The repo JSON wins on any floor price difference.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'src', 'data');
const catalogue = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'concierge-catalogue.json'), 'utf8'));
const tours = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'tours.json'), 'utf8'));
const transfers = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'transfers.json'), 'utf8'));

let changed = false;
let errors = 0;

// Build lookup from tours and transfers by ID
const repoServices = {};
for (const t of tours) {
  repoServices[t.id] = { min: t.price.min, max: t.price.max, source: 'tours.json' };
}
for (const t of transfers) {
  repoServices[t.id] = { min: t.price.min, max: t.price.max, source: 'transfers.json' };
}

// Check each catalogue service
for (const svc of catalogue.services) {
  if (!svc.pricing || svc.pricing.basis === 'on_request') continue;
  const repo = repoServices[svc.id];
  if (!repo) continue;

  if (svc.pricing.min !== repo.min || svc.pricing.max !== repo.max) {
    console.log(`[FIX] ${svc.id} (${svc.slug}): catalogue ${svc.pricing.min}-${svc.pricing.max} → repo ${repo.min}-${repo.max} (from ${repo.source})`);
    svc.pricing.min = repo.min;
    svc.pricing.max = repo.max;
    svc.pricing.display = '$' + repo.min + '–$' + repo.max;
    changed = true;
  }
}

if (changed) {
  fs.writeFileSync(path.join(DATA_DIR, 'concierge-catalogue.json'), JSON.stringify(catalogue, null, 1) + '\n');
  console.log('Updated concierge-catalogue.json with repo prices.');
} else {
  console.log('All catalogue prices match the repo. No changes needed.');
}

// Validate floors
for (const svc of catalogue.services) {
  if (!svc.pricing || svc.pricing.basis === 'on_request') continue;
  const repo = repoServices[svc.id];
  if (repo && svc.pricing.min < repo.min) {
    console.error(`[ERROR] ${svc.id}: catalogue floor ${svc.pricing.min} is below repo floor ${repo.min}`);
    errors++;
  }
}

if (errors > 0) {
  console.error(`${errors} floor violation(s) found.`);
  process.exit(1);
}

console.log(`Catalogue validated: ${catalogue.services.length} services, ${catalogue.zones.length} zones.`);
