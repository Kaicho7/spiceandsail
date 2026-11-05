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

function recommend(profile, limit) {
  if (!limit) limit = 5;
  const zone = profile.pickupZone || null;
  const zoneArea = zone ? (catalogue.zones.find(function (z) { return z.slug === zone; }) || {}).area || null : null;
  const interests = (profile.interests || []).map(function (i) { return i.toLowerCase(); });
  const children = profile.children || 0;
  const childAges = profile.childrenAges || [];
  const hasSmallKids = childAges.some(function (a) { return a > 0 && a < 7; });

  const items = [];

  for (const s of catalogue.services) {
    if (s.type === 'transfer') continue;
    let value = 0;
    const reasons = [];

    // interest overlap
    for (const interest of interests) {
      if (s.interests.some(function (si) { return si.includes(interest) || interest.includes(si); })) {
        value += 3;
        reasons.push('matches "' + interest + '"');
        break;
      }
    }

    // geography
    if (zone && s.zones.length > 0) {
      if (s.zones.includes(zone)) {
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
      if (s.interests.includes('family')) { value += 2; reasons.push('family-friendly'); }
      if (hasSmallKids && s.timeOfDay && s.timeOfDay.includes('morning')) value += 1;
      if (s.interests.includes('romance') || s.interests.includes('honeymoon')) { value -= 2; }
    }
    if (s.interests.includes('honeymoon') && interests.some(function (i) { return ['honeymoon', 'romance', 'anniversary'].includes(i); })) {
      value += 3;
    }

    // budget band
    const budget = (profile.budgetBand || '').toLowerCase();
    if (s.pricing.verified && s.pricing.min != null) {
      if (budget.startsWith('low') && s.pricing.min >= 100) { value -= 2; }
      if (budget.startsWith('lux') && s.pricing.min < 80) value -= 1;
    }

    if (value > 0 || s.zones.includes(zone || '')) {
      items.push({
        slug: s.slug,
        name: s.name,
        type: s.type,
        priceDisplay: s.pricing.display,
        duration: s.duration,
        zoneNames: s.zones.map(zoneName),
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
