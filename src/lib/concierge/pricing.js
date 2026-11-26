/**
 * Deterministic quote engine — SERVER ONLY.
 * Rules enforced in code (never by the AI model):
 *   1. Never quote below the catalogue floor.
 *   2. Per-person services use the published group tier, zone and child rate
 *      where the catalogue provides them; otherwise "team confirms".
 *   3. Per-vehicle transfers quote the vehicle class that fits the party.
 *   4. Services with no verified catalogue price return "price on request".
 *   5. Pickup supplements outside a service's zones are flagged.
 *   6. Seasonal discounts apply only when a travel date is supplied.
 *   7. No deposits in this phase — "Request to hold" is just a lead.
 */
'use strict';

const { getService, zoneName, CATALOGUE_VERSION, CONFIG } = require('./catalogue');
const hotelContracts = require('./hotel-contracts');

function money(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

function range(low, high) {
  if (low == null || high == null) return 'price on request';
  if (low === high) return money(low);
  return money(low) + '–' + money(high);
}

/** Parse published tier strings into selectable group tiers with price options. */
function parseTieredDisplay(tieredDisplay) {
  if (!tieredDisplay) return [];
  const tiers = [];
  for (const part of tieredDisplay.split('•')) {
    const text = String(part).trim();
    if (!text) continue;
    const label = (text.split(/\$\s*\d/)[0] || text).replace(/[:\s]+$/, '').trim();
    const lower = text.toLowerCase();
    const group = text.match(/(\d+)\s*(?:[–-]\s*(\d+))?\s*(?:guests?|pax|riders?|passengers?)/i);
    const options = [];
    for (const sub of text.split('/')) {
      const match = sub.match(/\$\s*(\d+(?:\.\d+)?)\s*(?:[–-]\s*\$?\s*(\d+(?:\.\d+)?))?/);
      if (!match) continue;
      const low = Number(match[1]);
      const high = match[2] ? Number(match[2]) : low;
      let zone = 'any';
      if (/stone\s*town/i.test(sub)) zone = 'stone-town';
      else if (/beach|north|nungwi|kendwa/i.test(sub)) zone = 'beach';
      options.push({ low, high, zone, label: sub.trim() });
    }
    if (!options.length) continue;
    tiers.push({
      label,
      min: group ? Number(group[1]) : null,
      max: group ? (group[2] ? Number(group[2]) : Number(group[1])) : null,
      kind: /shared|group|budget/i.test(lower) ? 'shared' : /private/i.test(lower) ? 'private' : 'variant',
      options,
    });
  }
  return tiers;
}

function selectTier(tiers, adults) {
  if (!tiers.length) return { tier: null, note: '' };
  const counted = tiers.filter(t => t.min != null);
  if (counted.length) {
    const exact = counted.filter(t => adults >= t.min && adults <= t.max);
    if (exact.length) {
      return {
        tier: {
          label: exact.map(t => t.label).join(' / '),
          options: exact.reduce((all, t) => all.concat(t.options), []),
        },
        note: '',
      };
    }
    const shared = tiers.find(t => t.kind === 'shared');
    if (shared) return { tier: shared, shared: true, note: 'Shared/group rate quoted; our team confirms private options.' };
    const nearest = counted.slice().sort((a, b) =>
      Math.abs(a.min - adults) - Math.abs(b.min - adults))[0];
    return { tier: nearest, note: 'Party size is outside the published tiers — our team confirms the final rate.' };
  }
  const shared = tiers.find(t => t.kind === 'shared');
  const priv = tiers.find(t => t.kind === 'private');
  if (shared && priv) {
    return adults > 1
      ? { tier: priv, note: 'Private rate quoted; shared from ' + money(shared.options[0].low) + ' pp.' }
      : { tier: shared, note: 'Shared rate quoted; private from ' + money(priv.options[0].low) + ' pp.' };
  }
  const variant = tiers.find(t => t.kind === 'variant');
  return { tier: shared || priv || variant || tiers[0], note: '' };
}

function selectOption(tier, pickupZone) {
  if (!tier || !tier.options.length) return null;
  const zoned = tier.options.filter(o => o.zone !== 'any');
  if (!zoned.length) {
    if (tier.options.length === 1) return tier.options[0];
    return {
      low: Math.min.apply(null, tier.options.map(o => o.low)),
      high: Math.max.apply(null, tier.options.map(o => o.high)),
      label: tier.options.map(o => o.label).join(' / '),
      multi: true,
    };
  }
  if (pickupZone) {
    const wanted = pickupZone === 'stone-town' ? 'stone-town' : 'beach';
    const match = zoned.find(o => o.zone === wanted);
    if (match) return match;
  }
  return {
    low: Math.min.apply(null, tier.options.map(o => o.low)),
    high: Math.max.apply(null, tier.options.map(o => o.high)),
    label: tier.options.map(o => o.label).join(' / '),
    multi: true,
  };
}

function seasonForDate(dateValue) {
  if (!dateValue) return null;
  const match = String(dateValue).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const mmdd = match[2] + '-' + match[3];
  for (const season of CONFIG.seasons || []) {
    if (mmdd >= season.from && mmdd <= season.to) return season;
  }
  return null;
}

function applySeason(low, high, season, serviceType, category) {
  if (!season) return { low, high, note: '' };
  const pct = category === 'SAF' ? season.safariDiscount : season.dayTripDiscount;
  if (!pct) return { low, high, note: '' };
  return {
    low: Math.round(low * (1 - pct)),
    high: Math.round(high * (1 - pct)),
    note: Math.round(pct * 100) + '% ' + season.name + ' discount applied (' + season.from + '–' + season.to + ').',
  };
}

function getQuote(input) {
  if (input.serviceSlug && input.serviceSlug.indexOf('hotel:') === 0) {
    const hotelQuote = hotelContracts.hotelQuote(input.serviceSlug.slice(6), input);
    if (hotelQuote) return hotelQuote;
  }
  const svc = getService(input.serviceSlug);
  const adults = Math.max(1, Math.floor(input.adults || 1));
  const children = Math.max(0, Math.floor(input.children || 0));
  const p = svc ? svc.pricing || {} : {};

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
  const season = seasonForDate(input.date);

  if (p.basis === 'on_request' || p.min == null || p.max == null) {
    lines.push({ label: svc.name + ' — rate', low: null, high: null, note: 'No verified catalogue price yet; our team confirms the exact rate.' });
    base.lines = lines;
    base.reasons.push('This experience is not in the verified price catalogue yet — our team will confirm the rate.');
    base.totalDisplay = 'price on request';
    return base;
  }

  // Per-vehicle transfers: choose the vehicle class by party size.
  if (p.basis === 'per_vehicle') {
    const vehicles = Array.isArray(p.vehicles) && p.vehicles.length ? p.vehicles : [
      { maxPax: p.vehicleCapacity || 4, min: p.min, max: p.max, label: 'Private vehicle' },
    ];
    const pax = adults + children;
    const vehicle = vehicles.find(v => pax <= v.maxPax);
    if (!vehicle) {
      lines.push({ label: svc.name, low: p.min, high: p.max, note: 'Larger vehicles are confirmed by our team.' });
      base.lines = lines;
      base.reasons.push('Party of ' + pax + ' exceeds the largest verified vehicle (' + vehicles[vehicles.length - 1].maxPax + '); our team confirms the larger-vehicle rate.');
      return base;
    }
    const priced = applySeason(vehicle.min, vehicle.max, season, svc.type, svc.category);
    lines.push({
      label: svc.name + ' — ' + vehicle.label + ' (up to ' + vehicle.maxPax + ' guests)',
      low: priced.low,
      high: priced.high,
      note: 'Private, fuel-inclusive, no night surcharge.',
    });
    base.status = 'quoted';
    base.basis = 'per_vehicle';
    base.vehicle = vehicle.label;
    base.totalLow = priced.low;
    base.totalHigh = priced.high;
    base.totalDisplay = range(priced.low, priced.high) + ' (' + vehicle.label + ')';
    if (priced.note) notes.push(priced.note);
    if (vehicles.length > 1) notes.push('Larger vehicle available: ' + vehicles[vehicles.length - 1].label + ' from ' + money(vehicles[vehicles.length - 1].min) + '.');
    if (svc.duration) notes.push('Duration: ' + svc.duration + '.');
    return finalize(base, lines, notes, flags, input);
  }

  // Per-quad: raters are capped by the verified quad capacity.
  if (p.basis === 'per_quad') {
    const riders = p.riderCapacity || 2;
    if (adults > riders) {
      lines.push({ label: svc.name + ' (quad, up to ' + riders + ' riders)', low: p.min, high: p.max, note: 'Verified rate covers up to ' + riders + ' riders.' });
      base.lines = lines;
      base.reasons.push('Party of ' + adults + ' exceeds the verified quad rider capacity (' + riders + '); our team confirms the larger-vehicle rate.');
      return base;
    }
    lines.push({ label: svc.name + ' — quad (up to ' + riders + ' riders)', low: p.min, high: p.max, note: p.basisNote || 'per quad' });
    base.status = 'quoted';
    base.basis = 'per_quad';
    base.totalLow = p.min;
    base.totalHigh = p.max;
    base.totalDisplay = range(p.min, p.max);
    if (svc.duration) notes.push('Duration: ' + svc.duration + '.');
    return finalize(base, lines, notes, flags, input);
  }

  // Per-boat charters are priced per vessel, not per guest.
  if (p.basis === 'per_boat') {
    lines.push({ label: svc.name + ' — per boat', low: p.min, high: p.max, note: p.basisNote || 'per boat' });
    base.status = 'quoted';
    base.basis = 'per_boat';
    base.totalLow = p.min;
    base.totalHigh = p.max;
    base.totalDisplay = range(p.min, p.max);
    if (svc.duration) notes.push('Duration: ' + svc.duration + '.');
    return finalize(base, lines, notes, flags, input);
  }

  // Per-vehicle / per-scooter daily rentals: priced per unit per day, never multiplied by guests.
  if (p.basis === 'per_vehicle_per_day' || p.basis === 'per_scooter_per_day') {
    const days = Math.max(1, Math.floor(input.days || input.nights || 1));
    let dailyRate = null;
    if (p.tieredDisplay) {
      for (const part of String(p.tieredDisplay).split('•')) {
        const rangeMatch = part.match(/(\d+)\s*[–-]\s*(\d+)\s*days?\s*:\s*\$\s*([\d,]+)/i);
        const plusMatch = part.match(/(\d+)\+\s*days?\s*:\s*\$\s*([\d,]+)/i);
        if (rangeMatch && days >= Number(rangeMatch[1]) && days <= Number(rangeMatch[2])) {
          dailyRate = Number(rangeMatch[3].replace(/,/g, ''));
          break;
        }
        if (plusMatch && days >= Number(plusMatch[1]) && !/month/i.test(part)) {
          dailyRate = Number(plusMatch[2].replace(/,/g, ''));
        }
      }
    }
    if (!dailyRate) {
      if (days >= 14) dailyRate = p.min;
      else if (days >= 7) dailyRate = p.weeklyRate ? Math.round(p.weeklyRate / 7) : p.min;
      else if (days >= 4) dailyRate = Math.floor((p.min + p.max) / 2);
      else dailyRate = p.max;
    }
    const total = dailyRate * days;
    const unitNoun = p.basis === 'per_scooter_per_day' ? 'scooter' : 'vehicle';
    lines.push({
      label: svc.name + ' — ' + days + ' day' + (days > 1 ? 's' : '') + ' × ' + money(dailyRate) + '/' + unitNoun + '/day',
      low: total,
      high: total,
      note: p.basisNote || 'per ' + unitNoun + ' per day',
    });
    base.status = 'quoted';
    base.basis = p.basis;
    base.totalLow = total;
    base.totalHigh = total;
    base.totalDisplay = money(total) + ' (' + days + ' day' + (days > 1 ? 's' : '') + ' @ ' + money(dailyRate) + '/day)';
    if (p.permitFee) notes.push('Temporary Zanzibar driving permit ($10–$' + p.permitFee + ') arranged on delivery.');
    if (svc.duration) notes.push('Duration: ' + svc.duration + '.');
    return finalize(base, lines, notes, flags, input);
  }

  // Per-person tours, experiences and packages.
  const tiers = parseTieredDisplay(p.tieredDisplay);
  const ladder = Array.isArray(p.groupLadder) && p.groupLadder.length
    ? p.groupLadder.find(g => adults >= g.minPax && adults <= g.maxPax)
    : null;
  const chosen = ladder
    ? {
        tier: {
          label: ladder.label || adults + ' guests',
          options: [{ low: ladder.perPerson, high: ladder.perPerson, zone: 'any', label: ladder.label || adults + ' guests' }],
        },
        note: 'Published group-size ladder.',
      }
    : selectTier(tiers, adults);
  if (chosen.shared && svc.category === 'MAR' && CONFIG.sharedMinGuests && adults < CONFIG.sharedMinGuests) {
    lines.push({
      label: svc.name + ' — shared boat departure',
      low: null,
      high: null,
      note: 'Shared departures require ' + CONFIG.sharedMinGuests + '+ confirmed guests; a private departure is confirmed by our team.',
    });
    base.lines = lines;
    base.reasons.push('Party of ' + adults + ' is below the ' + CONFIG.sharedMinGuests + '-guest minimum for shared boat departures; our team confirms a private departure.');
    return base;
  }
  const tier = chosen.tier;
  const option = tier ? selectOption(tier, input.pickupZone) : null;
  const perLow = option ? option.low : p.min;
  const perHigh = option ? option.high : p.max;
  const tierLabel = option ? (option.multi ? option.label : (tier ? tier.label : '')) : '';

  const adultLow = perLow * adults;
  const adultHigh = perHigh * adults;
  const childRate = p.childRate;
  const childLow = childRate != null ? childRate * children : 0;
  const childHigh = childLow;
  const priced = applySeason(adultLow + childLow, adultHigh + childHigh, season, svc.type, svc.category);

  const adultLine = {
    label: svc.name + ' — ' + adults + ' adult' + (adults > 1 ? 's' : '') + ' × ' + range(perLow, perHigh) + ' per person',
    low: priced.low - childLow,
    high: priced.high - childHigh,
    note: tierLabel ? 'Published ' + tierLabel + ' rate.' : 'From the verified catalogue range (' + p.display + ' per person).',
  };
  lines.push(adultLine);

  if (children > 0) {
    if (childRate != null) {
      lines.push({
        label: svc.name + ' — ' + children + ' child' + (children > 1 ? 'ren' : '') + ' × ' + money(childRate) + ' per child',
        low: childLow,
        high: childHigh,
        note: 'Published child rate (ages 6–14) from the launch rate card.',
      });
    } else {
      flags.push('child_pricing_on_request');
      notes.push('Child pricing for ' + children + ' child' + (children > 1 ? 'ren' : '') + ' is confirmed by our team (no published child rate for this service).');
    }
  }

  if (chosen.note) notes.push(chosen.note);
  if (priced.note) notes.push(priced.note);
  if (svc.category === 'SAF' && p.parkFeePerPersonPerDay != null) {
    const days = p.parkDays || 1;
    lines.push({
      label: 'Park fees — $' + p.parkFeePerPersonPerDay.toFixed(2) + ' × ' + days + ' day' + (days > 1 ? 's' : '') + ' × ' + adults + ' adult' + (adults > 1 ? 's' : ''),
      low: 0,
      high: 0,
      note: 'Included in the quoted rate; shown for transparency. Subject to TANAPA tariff changes.',
    });
  }

  base.status = 'quoted';
  base.basis = tier || ladder ? 'per_person_tier' : 'per_person';
  base.totalLow = priced.low;
  base.totalHigh = priced.high;
  base.totalDisplay = range(priced.low, priced.high) + (tierLabel ? ' (' + tierLabel + ')' : '');
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

function quotePlan(serviceSlugs, adults, children, options) {
  const opts = options || {};
  const perService = [];
  let sumLow = 0;
  let sumHigh = 0;
  let allQuoted = true;
  for (const slug of serviceSlugs) {
    const q = getQuote(Object.assign({ serviceSlug: slug, adults, children }, opts));
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
      return { label: q.serviceName, low: q.totalLow, high: q.totalHigh, note: q.status === 'quoted' ? 'Verified catalogue rate.' : 'Rate on request.' };
    }),
    includes: [],
    notes: ['Each day is priced from the published catalogue rate; our team confirms the final total, dates and pickup windows.', 'Accommodation is excluded unless selected — we never quote hotel prices.'],
    flags: [],
    reasons: allQuoted ? [] : ['At least one item is priced on request — our team confirms the full plan.'],
    catalogueVersion: CATALOGUE_VERSION,
    perService: perService,
  };
}

module.exports = { getQuote, quotePlan, parseTieredDisplay, selectTier, seasonForDate };
