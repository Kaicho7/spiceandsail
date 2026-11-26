/**
 * Recommendation engine — deterministic, geography-aware ranking.
 */
'use strict';

const { catalogue, zoneName } = require('./catalogue');

const AREA_GRAPH = {
  west: ['southwest', 'north'],
  north: ['west', 'northeast'],
  northeast: ['north', 'east'],
  east: ['northeast', 'southeast'],
  southeast: ['east', 'south'],
  south: ['southeast', 'southwest'],
  southwest: ['south', 'west'],
  pemba: [],
};

const INTEREST_ALIASES = {
  beach: ['beach', 'ocean', 'snorkeling', 'sailing', 'sandbank', 'sunset'],
  ocean: ['ocean', 'beach', 'snorkeling', 'sailing', 'dolphins', 'sandbank'],
  snorkeling: ['snorkeling', 'ocean', 'dolphins', 'turtle', 'tortoises'],
  diving: ['snorkeling', 'ocean', 'adventure', 'chumbe'],
  kite: ['beach', 'ocean', 'adventure', 'kite'],
  adventure: ['adventure', 'quad', 'horses', 'ocean', 'snorkeling', 'safari', 'unique', 'cave'],
  wildlife: ['wildlife', 'safari', 'dolphins', 'tortoises', 'monkeys', 'nature', 'animals'],
  nature: ['nature', 'wildlife', 'monkeys', 'forest', 'cave', 'ecolodge'],
  safari: ['safari', 'wildlife', 'coastal safari', 'boat safari', 'fly-in safari'],
  culture: ['culture', 'history', 'town', 'spice', 'food', 'community'],
  history: ['history', 'culture', 'town'],
  spice: ['spice', 'food', 'culture'],
  honeymoon: ['honeymoon', 'romance', 'couples', 'sunset'],
  romance: ['romance', 'honeymoon', 'couples', 'sunset'],
  family: ['family', 'tortoises', 'monkeys', 'beach'],
  caves: ['cave', 'swimming', 'unique'],
  cave: ['cave', 'swimming', 'unique'],
  horses: ['horses', 'unique', 'adventure'],
  quad: ['quad', 'adventure'],
};

function expandInterests(rawInterests) {
  const expanded = new Set();
  (rawInterests || []).forEach(function (item) {
    const k = String(item || '').toLowerCase().trim();
    if (!k) return;
    expanded.add(k);
    (INTEREST_ALIASES[k] || []).forEach(function (alias) { expanded.add(alias); });
  });
  return Array.from(expanded);
}

function recommend(profile, limit) {
  if (!limit) limit = 5;
  const zone = profile.pickupZone || null;
  const zoneArea = zone ? (catalogue.zones.find(function (z) { return z.slug === zone; }) || {}).area || null : null;
  const rawInterests = (profile.interests || []).map(function (i) { return String(i).toLowerCase(); });
  const interests = expandInterests(rawInterests);
  const children = profile.children || 0;
  const childAges = profile.childrenAges || [];
  const hasSmallKids = childAges.some(function (a) { return a > 0 && a < 7; });

  const items = [];

  for (const s of catalogue.services) {
    if (s.type === 'transfer' || s.type === 'rental') continue;
    if (s.type === 'package' && !rawInterests.includes('package') && !rawInterests.includes('multi-day')) continue;
    let value = 0;
    const reasons = [];
    const sInterests = s.interests || [];

    // interest overlap (direct match scores higher than alias)
    let matchedInterest = false;
    for (const ri of rawInterests) {
      if (sInterests.some(function (si) { return si.includes(ri) || ri.includes(si); })) {
        value += 4;
        reasons.push('matches "' + ri + '"');
        matchedInterest = true;
        break;
      }
    }
    if (!matchedInterest) {
      for (const interest of interests) {
        if (sInterests.some(function (si) { return si.includes(interest) || interest.includes(si); })) {
          value += 3;
          reasons.push('matches "' + interest + '"');
          break;
        }
      }
    }

    // geography
    const sZones = s.zones || [];
    if (zone && sZones.length > 0) {
      if (sZones.includes(zone)) {
        value += 4;
        reasons.push('departs from ' + zoneName(zone) + ' — no long transfers');
      } else {
        const svcArea = (catalogue.zones.find(function (z) { return z.slug === s.zones[0]; }) || {}).area;
        if (svcArea && zoneArea && svcArea === zoneArea) {
          value += 2;
          reasons.push('close to ' + zoneName(zone));
        } else if (svcArea && zoneArea && (AREA_GRAPH[zoneArea] || []).includes(svcArea)) {
          value += 1;
          reasons.push('a reasonable trip from ' + zoneName(zone));
        } else if (svcArea) {
          value -= 4;
          reasons.push('crosses the island from ' + zoneName(zone));
        }
      }
    }

    // group composition
    if (children > 0) {
      if (sInterests.includes('family')) { value += 2; reasons.push('family-friendly'); }
      if (hasSmallKids && s.timeOfDay && s.timeOfDay.includes('morning')) value += 1;
      if (sInterests.includes('romance') || sInterests.includes('honeymoon')) { value -= 2; }
    }
    if (sInterests.includes('honeymoon') && interests.some(function (i) { return ['honeymoon', 'romance', 'anniversary'].includes(i); })) {
      value += 3;
    }

    // budget band
    const budget = (profile.budgetBand || '').toLowerCase();
    if (s.pricing && s.pricing.verified && s.pricing.min != null) {
      if (budget.startsWith('low') && s.pricing.min >= 100) { value -= 2; }
      if (budget.startsWith('lux') && s.pricing.min < 80) value -= 1;
    }

    if (value > 0 || sZones.includes(zone || '')) {
      items.push({
        slug: s.slug,
        name: s.name,
        type: s.type,
        category: s.category,
        priceDisplay: (s.pricing && s.pricing.display) || 'price on request',
        duration: s.duration || '',
        zoneNames: sZones.map(zoneName),
        score: value,
        reasons: reasons.slice(0, 3),
      });
    }
  }

  return items.sort(function (a, b) { return b.score - a.score; }).slice(0, limit);
}

function scoreLead(profile, hasContact) {
  const reasons = [];
  let score = 20;
  let points = 0;

  const hasDates = Boolean(profile.travelStartDate);
  const hasService = (profile.serviceSlugs || []).length > 0;
  const hasParty = (profile.adults || 0) > 1 || (profile.children || 0) > 0;

  if (hasDates) { points += 1; reasons.push('travel dates given'); }
  if (hasService) { points += 1; reasons.push('specific service(s) discussed'); }
  if (hasContact) { reasons.push('contact captured with consent'); }
  if (hasParty) { reasons.push('party details given'); }
  if (profile.tripType === 'book') { points += 1; reasons.push('booking intent stated'); }

  const hot = hasDates && hasContact && hasService;
  const warm = !hot && (points >= 2 || hasContact);

  if (hot) { score = 90; reasons.unshift('HOT: dates + contact + specific service'); }
  else if (warm) { score = 55; reasons.unshift('WARM: substantial trip detail'); }
  else { reasons.unshift('COLD: exploratory / FAQ stage'); score = Math.max(20, 20 + points * 5); }

  return { score: score, label: hot ? 'hot' : warm ? 'warm' : 'cold', reasons: reasons };
}

module.exports = { recommend, scoreLead };
