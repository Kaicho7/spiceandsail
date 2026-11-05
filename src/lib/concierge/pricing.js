/**
 * Deterministic quote engine — SERVER ONLY.
 * Rules enforced in code (never by the AI model):
 *   1. Never quote below the catalogue floor.
 *   2. Per-person services price adults only — child pricing is
 *      flagged "team confirms".
 *   3. Per-vehicle transfers quote only within verified capacity.
 *   4. Services with no verified catalogue price return "price on request".
 *   5. Pickup supplements outside a service's zones are flagged.
 *   6. No deposits in this phase — "Request to hold" is just a lead.
 */
'use strict';

const { getService, zoneName, CATALOGUE_VERSION, CONFIG } = require('./catalogue');

function money(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

function range(low, high) {
  if (low == null || high == null) return 'price on request';
  if (low === high) return money(low);
  return money(low) + '–' + money(high);
}

function getQuote(input) {
  const svc = getService(input.serviceSlug);
  const adults = Math.max(1, Math.floor(input.adults || 1));
  const children = Math.max(0, Math.floor(input.children || 0));

  const base = {
    ok: false,
    status: 'needs_team_confirmation',
    serviceSlug: input.serviceSlug,
    serviceName: svc ? svc.name : input.serviceSlug,
    serviceType: svc ? svc.type : 'tour',
    currency: 'USD',
    basis: 'on_request',
    totalLow: null,
    totalHigh: null,
    totalDisplay: 'price on request',
    lines: [],
    includes: svc ? svc.includes : [],
    notes: [],
    flags: [],
    reasons: [],
    catalogueVersion: CATALOGUE_VERSION,
  };

  if (!svc) {
    base.reasons.push('Service not found in the catalogue — our team will check.');
    return base;
  }
  base.ok = true;

  const notes = [];
  const flags = [];
  const lines = [];
  const p = svc.pricing;

  // on-request services
  if (p.basis === 'on_request' || p.min == null || p.max == null) {
    lines.push({ label: svc.name + ' — rate', low: null, high: null, note: 'No verified catalogue price yet; our team confirms the exact rate.' });
    base.lines = lines;
    base.reasons.push('This experience is not in the verified price catalogue yet — our team will confirm the rate.');
    base.totalDisplay = 'price on request';
    return base;
  }

  // per-vehicle (transfers)
  if (p.basis === 'per_vehicle') {
    const capacity = p.vehicleCapacity || 4;
    if (adults + children > capacity) {
      lines.push({ label: svc.name + ' (private vehicle, up to ' + capacity + ' guests)', low: p.min, high: p.max, note: 'Verified rate covers up to ' + capacity + ' guests.' });
      base.lines = lines;
      base.reasons.push('Party of ' + (adults + children) + ' exceeds the verified per-vehicle capacity (' + capacity + '); our team confirms the larger-vehicle rate.');
      return base;
    }
    lines.push({ label: svc.name + ' — private vehicle (up to ' + (adults + children) + ' guests)', low: p.min, high: p.max, note: p.basisNote || 'per private vehicle' });
    base.status = 'quoted';
    base.basis = 'per_vehicle';
    base.totalLow = p.min;
    base.totalHigh = p.max;
    base.totalDisplay = range(p.min, p.max);
    if (svc.duration) notes.push('Duration: ' + svc.duration + '.');
    return finalize(base, lines, notes, flags, input);
  }

  // per-person (tours & packages)
  const adultLine = {
    label: svc.name + ' — ' + adults + ' adult' + (adults > 1 ? 's' : '') + ' × ' + range(p.min, p.max) + ' per person',
    low: p.min * adults,
    high: p.max * adults,
    note: 'From the verified catalogue range (' + p.display + ' per person).',
  };
  lines.push(adultLine);

  if (children > 0) {
    flags.push('child_pricing_on_request');
    notes.push('Child pricing for ' + children + ' child' + (children > 1 ? 'ren' : '') + ' is confirmed by our team (no verified child rates in the catalogue).');
  }

  base.status = 'quoted';
  base.basis = 'per_person';
  base.totalLow = adultLine.low;
  base.totalHigh = adultLine.high;
  base.totalDisplay = range(adultLine.low, adultLine.high);
  if (svc.duration) notes.push('Duration: ' + svc.duration + '.');
  return finalize(base, lines, notes, flags, input);
}

function finalize(base, lines, notes, flags, input) {
  const svc = getService(input.serviceSlug);
  if (svc && input.pickupZone && svc.type === 'tour') {
    if (svc.zones.length > 0 && !svc.zones.includes(input.pickupZone)) {
      flags.push('pickup_supplement_on_request');
      notes.push('Pickup from ' + zoneName(input.pickupZone) + ': our team confirms the exact supplement.');
    } else if (svc.zones.includes(input.pickupZone)) {
      notes.push('Departs from ' + zoneName(input.pickupZone) + ' — pickup is straightforward for you.');
    }
  }
  base.lines = lines;
  base.notes = notes;
  base.flags = flags;
  return base;
}

function quotePlan(serviceSlugs, adults, children) {
  const perService = [];
  let sumLow = 0;
  let sumHigh = 0;
  let allQuoted = true;
  for (const slug of serviceSlugs) {
    const q = getQuote({ serviceSlug: slug, adults: adults, children: children });
    perService.push(q);
    if (q.status === 'quoted' && q.totalLow != null && q.totalHigh != null) {
      sumLow += q.totalLow;
      sumHigh += q.totalHigh;
    } else {
      allQuoted = false;
    }
  }
  return {
    ok: perService.length > 0,
    status: allQuoted ? 'quoted' : 'needs_team_confirmation',
    serviceSlug: serviceSlugs.join('+'),
    serviceName: serviceSlugs.length + '-day plan',
    serviceType: 'tour',
    currency: 'USD',
    basis: 'plan',
    totalLow: allQuoted ? sumLow : null,
    totalHigh: allQuoted ? sumHigh : null,
    totalDisplay: allQuoted ? range(sumLow, sumHigh) : 'partial — team confirms',
    lines: perService.map(function (q) {
      return { label: q.serviceName, low: q.totalLow, high: q.totalHigh, note: q.status === 'quoted' ? 'Verified catalogue range.' : 'Rate on request.' };
    }),
    includes: [],
    notes: ['Each day is priced from the verified catalogue; our team confirms the final total, dates and pickup windows.', 'Accommodation is excluded unless selected — we never quote hotel prices.'],
    flags: [],
    reasons: allQuoted ? [] : ['At least one item is priced on request — our team confirms the full plan.'],
    catalogueVersion: CATALOGUE_VERSION,
    perService: perService,
  };
}

module.exports = { getQuote, quotePlan };
