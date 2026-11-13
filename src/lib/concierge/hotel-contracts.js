/**
 * Hotel contract loader — CommonJS, bundled by esbuild.
 * Server-side only: net partner stay rates for private concierge quoting.
 * Never expose rates on public pages or to the client bundle.
 */
'use strict';

const contractsData = require('../../data/hotel-contracts.json');
const publicRates = require('../../data/hotelRates.json');

const HOTELS = contractsData.hotels || [];

/** Public display rates (net+margin, OTA-20% or rack-15%) for guest-facing quotes. */
function publicRateSheet(slug) {
  if (!slug || !publicRates.bySlug) return null;
  return publicRates.bySlug[slug] || null;
}

/** Month/day ranges of the current season for a seasonal rate sheet. */
function currentSeason(pub) {
  if (!pub || !Array.isArray(pub.seasons)) return null;
  return pub.seasons.find((s) => s.id === pub.currentSeasonId) || pub.seasons[0] || null;
}

/** Numeric month*100+day so ranges can be compared arithmetically. */
function mdValue(month, day) {
  return month * 100 + day;
}

/** True when a month/day falls inside one {from:[m,d], to:[m,d]} range (wraps year end). */
function inSeasonRange(month, day, range) {
  if (!range || !range.from || !range.to) return false;
  const v = mdValue(month, day);
  const from = mdValue(range.from[0], range.from[1]);
  const to = mdValue(range.to[0], range.to[1]);
  if (from <= to) return v >= from && v <= to;
  return v >= from || v <= to;
}

/** Season whose machine-readable ranges cover a month/day (1-12, 1-31). */
function seasonForMonthDay(pub, month, day) {
  if (!pub || !Array.isArray(pub.seasons) || !month) return null;
  for (const s of pub.seasons) {
    if (Array.isArray(s.ranges) && s.ranges.some((r) => inSeasonRange(month, day, r))) return s;
  }
  return null;
}

const MONTH_INDEX = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};
const MONTH_RE = 'jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec';

/**
 * Extract a travel month/day from free text: ISO dates, "21 Dec",
 * "21st of December", "December 21", or a bare month used with a
 * preposition/qualifier ("in August", "for December", "August rates").
 * A bare "may" is ignored otherwise so "may I ask" is not read as May.
 * Returns [month, day] or null.
 */
function extractTravelMonthDay(text) {
  if (!text) return null;
  const t = String(text).toLowerCase();
  const iso = t.match(/\b\d{4}-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return [Number(iso[1]), Number(iso[2])];
  const dmy = t.match(new RegExp('\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(' + MONTH_RE + ')[a-z]*'));
  if (dmy) return [MONTH_INDEX[dmy[2]], Number(dmy[1])];
  const mdy = t.match(new RegExp('\\b(' + MONTH_RE + ')[a-z]*\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b'));
  if (mdy) return [MONTH_INDEX[mdy[1]], Number(mdy[2])];
  const qualified = t.match(new RegExp(
    '\\b(?:in|for|during|from|around|early|mid|late|this|next|end\\s+of|start\\s+of|beginning\\s+of)\\s+(?:the\\s+)?(' +
    MONTH_RE + ')[a-z]*\\b'
  ));
  if (qualified) return [MONTH_INDEX[qualified[1]], 15];
  const trailing = t.match(new RegExp(
    '\\b(' + MONTH_RE + ')[a-z]*\\s+(?:rates?|prices?|pricing|trip|holiday|stay|travel|booking)\\b'
  ));
  if (trailing) return [MONTH_INDEX[trailing[1]], 15];
  return null;
}

const KEYWORDS = [
  { slug: 'stonetown-view-hotel', patterns: [/stone\s*town\s*view/i] },
  { slug: 'the-island-stonetown', patterns: [/island\s*stonetown/i, /kokoni/i] },
  { slug: 'mkeka-spice-lodge', patterns: [/mkeka/i] },
  { slug: 'le-paradis-boutique-hotel-zanzibar', patterns: [/le\s*paradis/i, /leparadis/i] },
  { slug: 'the-one-resort-zanzibar', patterns: [/the\s*one\s*resort/i, /one\s*resort\s*zanzibar/i, /the\s*one\s*zanzibar/i] },
];

/** Look up a hotel contract by slug. */
function getHotelContract(slug) {
  if (!slug) return null;
  return HOTELS.find(function (h) { return h.slug === slug; }) || null;
}

/** Match hotel contracts mentioned in free text. */
function matchHotelContracts(text) {
  if (!text) return [];
  const found = [];
  for (const entry of KEYWORDS) {
    if (entry.patterns.some(function (p) { return p.test(text); })) {
      const contract = getHotelContract(entry.slug);
      if (contract) found.push(contract);
    }
  }
  return found;
}

/** True when the text looks like a stay-rate question (not just a transfer query). */
function isStayRateQuestion(text) {
  if (!text) return false;
  return /\b(rate|rates|price|prices|pricing|cost|how much|per night|room rate|stay|rooms? available|sleeps?|book a room|hotel room)\b/i.test(text);
}

/** True when the text asks about what a property has (rooms, views, facilities). */
function isPropertyFactQuestion(text) {
  if (!text) return false;
  return /\b(sea\s*view|ocean\s*view|beach\s*view|have a pool|swimming pool|does it have|do they have|is there|are there|facilities|amenities|what rooms|room types|breakfast|restaurant|spa|free wifi|wifi|airport distance|how far|how many rooms|family room|triple room|twins?)\b/i.test(text);
}

/** Reply answering property-fact questions from the verified research facts. */
function propertyFactReply(contract) {
  if (!contract) return null;
  const lines = [];
  lines.push('**' + contract.name + '** (' + (contract.area || 'Zanzibar') + ')');
  if (contract.propertyFacts) {
    lines.push('');
    lines.push(contract.propertyFacts);
  }
  if (contract.viewFacts) {
    lines.push('');
    lines.push('**Views:** ' + contract.viewFacts);
  }
  if (contract.distanceFacts) {
    lines.push('**Getting there:** ' + contract.distanceFacts);
  }
  const pub = publicRateSheet(contract.slug);
  if (pub && pub.rooms && pub.rooms.length) {
    lines.push('');
    lines.push('From $' + pub.fromRate + '/night through us — send your dates and we will confirm the exact rate and availability.');
  } else {
    lines.push('');
    lines.push('Send us your dates and we will confirm the exact rate and availability.');
  }
  return {
    message: lines.join('\n'),
    quickReplies: ['Stay rates for ' + contract.name, '💬 Open WhatsApp to Reserve', 'Airport transfer quote'],
    requestContact: false,
  };
}

/** Format a contract into a deterministic concierge reply. */
function hotelStayReply(contract, text) {
  if (!contract) return null;
  const pub = publicRateSheet(contract.slug);
  const lines = [];
  lines.push('**' + contract.name + ' — Our Partner Hotel** (' + contract.area + ')');

  const defaultSeason = currentSeason(pub);
  const guestDate = extractTravelMonthDay(text);
  const requestedSeason = guestDate ? seasonForMonthDay(pub, guestDate[0], guestDate[1]) : null;
  const season = requestedSeason || defaultSeason;
  const seasonForDates = !!(requestedSeason && requestedSeason !== defaultSeason);

  let rateRooms;
  if (requestedSeason && Array.isArray(requestedSeason.rooms) && requestedSeason.rooms.length) {
    rateRooms = requestedSeason.rooms.map((r) => ({
      roomType: r.roomType,
      ourRate: r.ourHalfBoard != null ? r.ourHalfBoard : r.ourRate,
      ourAllInclusive: r.ourAllInclusive,
    }));
  } else {
    rateRooms = (pub && pub.rooms && pub.rooms.length) ? pub.rooms : (contract.rooms || []);
  }
  if (rateRooms.length) {
    lines.push('');
    if (season && seasonForDates) {
      lines.push('For your dates — ' + season.label + ' (' + season.dates + ') — per room per night for 2 people:');
    } else if (season) {
      lines.push('Our current partner stay rates, ' + season.label + ' (' + season.dates + ') — per room per night for 2 people:');
    } else {
      lines.push('Our current partner stay rates (per room per night):');
    }
    for (const room of rateRooms) {
      const rate = (room.ourRate != null) ? room.ourRate : room.rate;
      let line = '• **' + room.roomType + '** — $' + rate;
      if (room.maxOccupancy) line += ' (max ' + room.maxOccupancy + ')';
      lines.push(line);
    }
    if (season) {
      const ai = season.rooms.map((r) => r.ourAllInclusive).filter((v) => v != null);
      if (ai.length) {
        lines.push('All Inclusive is also available: $' + Math.min.apply(null, ai) + '–$' + Math.max.apply(null, ai) + ' per room per night.');
      }
      lines.push('That is ' + (pub.discountPct || 15) + '% below the hotel\'s own published rack rate, and we quote every season, not just the cheapest.');
    }
    const supp = contract.boardSupplements || {};
    if (contract.policy && /half board/i.test(contract.policy.basis || '')) {
      lines.push('Half board included (breakfast & dinner).');
    } else if (contract.breakfastIncluded || (pub && /breakfast/i.test(pub.basis || ''))) {
      lines.push('Breakfast included.');
    }
    if (supp.halfBoardPerPersonPerNight) {
      lines.push('Half board +$' + supp.halfBoardPerPersonPerNight + ' pp/night; full board +$' + supp.fullBoardPerPersonPerNight + ' pp/night.');
    }
    if (pub && pub.extraPerson && pub.extraPerson.halfBoard) {
      const ep = pub.extraPerson;
      let extra = 'Extra person +$' + ep.halfBoard + '/night Half Board';
      const aiRate = ep.allInclusive || ep.allInclusive75;
      if (aiRate) {
        extra += ' (All Inclusive +$' + aiRate;
        if (ep.allInclusiveChild4to16) extra += ', ages 4–16 +$' + ep.allInclusiveChild4to16;
        extra += ')';
      }
      if (ep.childFreeUnder) {
        extra += '; under ' + ep.childFreeUnder.allInclusive + ' free on All Inclusive, under ' + ep.childFreeUnder.halfBoard + ' free on Half Board';
      }
      lines.push(extra + '.');
    }
    if (pub && pub.singleOccupancyDiscount && pub.singleOccupancyDiscount.halfBoard) {
      lines.push('Single occupancy −$' + pub.singleOccupancyDiscount.halfBoard + ' Half Board.');
    }
    if (contract.policy && contract.policy.minStay) {
      lines.push('Min stay: ' + contract.policy.minStay + '.');
    }
    if (contract.policy && contract.policy.cancellationPolicy) {
      lines.push('Cancellation: ' + contract.policy.cancellationPolicy);
    }
    if (contract.infrastructureTaxPerPersonPerNight) {
      lines.push('Zanzibar infrastructure tax ($' + contract.infrastructureTaxPerPersonPerNight + ' per person per night) is payable at check-in.');
    }
    lines.push('Final confirmation is pending team confirmation — quote via WhatsApp.');
  } else {
    const plans = contract.policy && contract.policy.ratePlans;
    lines.push('');
    if (plans) lines.push('Available plans: ' + plans + '.');
    if (contract.policy && contract.policy.basis) {
      lines.push('Rates are quoted on a ' + contract.policy.basis + ' basis.');
    }
    if (contract.policy && contract.policy.childPolicy) {
      lines.push('Children: ' + contract.policy.childPolicy + '.');
    }
    lines.push('Best available rates are quoted privately by our team on WhatsApp — final confirmation is pending team confirmation.');
  }

  lines.push('');
  lines.push('Combine your stay with our licensed tours and private transfers for a complete package!');

  return {
    message: lines.join('\n'),
    quickReplies: ['💬 Open WhatsApp to Reserve', 'Airport transfer quote', 'Plan my trip'],
    requestContact: false,
  };
}

/** Reply when a partner hotel is mentioned but no rate question — soft partner mention. */
function partnerMentionReply(contract) {
  if (!contract) return null;
  return {
    message: '**' + contract.name + '** (' + contract.area + ') is one of our contracted partner hotels — we can quote your stay together with licensed tours and private airport transfers. Ask me for stay rates or open WhatsApp to reserve!',
    quickReplies: ['Stay rates for ' + contract.name, '💬 Open WhatsApp to Reserve', 'Plan my trip'],
    requestContact: false,
  };
}

/** Price sheet strings so the guardrail approves these figures in LLM replies. */
function approvedPriceSheets(contracts) {
  return contracts.map(function (c) {
    const pub = publicRateSheet(c.slug);
    const rateRooms = (pub && pub.rooms && pub.rooms.length) ? pub.rooms : (c.rooms || []);
    const parts = rateRooms.map(function (r) {
      const rate = (r.ourRate != null) ? r.ourRate : r.rate;
      return '$' + rate;
    });
    const season = currentSeason(pub);
    if (season) {
      for (const r of season.rooms) {
        if (r.ourAllInclusive != null) parts.push('$' + r.ourAllInclusive);
      }
    }
    if (pub && pub.extraPerson) {
      if (pub.extraPerson.halfBoard) parts.push('$' + pub.extraPerson.halfBoard);
      const ai = pub.extraPerson.allInclusive || pub.extraPerson.allInclusive75;
      if (ai) parts.push('$' + ai);
    }
    if (pub && pub.singleOccupancyDiscount) {
      if (pub.singleOccupancyDiscount.halfBoard) parts.push('$' + pub.singleOccupancyDiscount.halfBoard);
      if (pub.singleOccupancyDiscount.allInclusive) parts.push('$' + pub.singleOccupancyDiscount.allInclusive);
    }
    const supp = c.boardSupplements || {};
    if (supp.halfBoardPerPersonPerNight) {
      parts.push('$' + supp.halfBoardPerPersonPerNight, '$' + supp.fullBoardPerPersonPerNight);
    }
    if (c.infrastructureTaxPerPersonPerNight) parts.push('$' + c.infrastructureTaxPerPersonPerNight);
    const pol = c.policy || {};
    if (pol.fullBoardUpgradePerPersonPerDay) parts.push('$' + pol.fullBoardUpgradePerPersonPerDay);
    if (pol.childPolicy) {
      const m = pol.childPolicy.match(/USD (\d+)/);
      if (m) parts.push('$' + m[1]);
    }
    if (pol.earlyCheckInFee) parts.push('$' + pol.earlyCheckInFee);
    return 'Approved partner stay rates for ' + c.name + ': ' + parts.join(' ');
  });
}

module.exports = {
  getHotelContract: getHotelContract,
  matchHotelContracts: matchHotelContracts,
  isStayRateQuestion: isStayRateQuestion,
  isPropertyFactQuestion: isPropertyFactQuestion,
  propertyFactReply: propertyFactReply,
  hotelStayReply: hotelStayReply,
  currentSeason: currentSeason,
  seasonForMonthDay: seasonForMonthDay,
  extractTravelMonthDay: extractTravelMonthDay,
  partnerMentionReply: partnerMentionReply,
  approvedPriceSheets: approvedPriceSheets,
};
