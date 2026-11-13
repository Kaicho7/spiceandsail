/**
 * Chat endpoint — hybrid zero-cost concierge.
 * 1. Deterministic engine first (recommendations, quotes)
 * 2. Optional LLM layer (Gemini or OpenAI-compatible)
 * 3. Guardrail check on any LLM output
 * 4. Fallback to deterministic on any failure
 */
'use strict';

const { corsHeaders, checkRateLimit, getClientIP, isAllowedOrigin } = require('../../src/lib/concierge/security');
const { getGlobalStore, createStore, setGlobalStore } = require('../../src/lib/concierge/store');
const { recommend } = require('../../src/lib/concierge/recommend');
const { getQuote } = require('../../src/lib/concierge/pricing');
const { checkReply } = require('../../src/lib/concierge/guardrail');
const { tryLLM } = require('../../src/lib/concierge/llm');
const { catalogue, CONFIG, isWithinBusinessHours, getService } = require('../../src/lib/concierge/catalogue');
const hotelContracts = require('../../src/lib/concierge/hotel-contracts');

function ensureStore() {
  try { getGlobalStore(); } catch (e) {
    setGlobalStore(createStore(process.env.NETLIFY ? 'blob' : 'memory'));
  }
}

/** Deterministic intent detection */
function detectIntent(text) {
  const lower = (text || '').toLowerCase();
  if (/\b(how long to|how long does it take|travel time|drive time|distance to|how far)\b/i.test(lower)) return 'travel_time';
  if (/\b(larger group|large group|big group|more than 4|minivan|coaster|luggage)\b/i.test(lower)) return 'group_luggage';
  if (/\b(what('?s| is) included|what to bring|inclusions?|what do i bring|bring along|what is in it)\b/i.test(lower)) return 'inclusions';
  if (/\b(cancel|cancellation|refund|reschedule|weather policy|bad weather)\b/i.test(lower)) return 'cancellation';
  if (/\b(how do i pay|payment|pay for|payment method|pay by|mpesa|m-pesa|cash|card|deposit|prepayment|down.?payment)\b/i.test(lower)) return 'payments';
  if (/\b(honeymoon|romantic|anniversary|couples?\s+trip)\b/i.test(lower)) return 'honeymoon';
  if (/\b(availab(?:le|ility)|spots? left|seats? left|sold out|booked out|open on)\b/i.test(lower)) return 'availability';
  if (/\b(private|shared|join (?:a )?group|group tours?|small group|semi.?private)\b/i.test(lower) && /\b(tours?|trips?|excursions?|dhow|safari|boat|snorkel)\b/i.test(lower)) return 'tour_type';
  const hotelMentions = hotelContracts.matchHotelContracts(text);
  if (hotelMentions.length > 0 && hotelContracts.isStayRateQuestion(text) && !/\b(transfer|transfers|airport|pickup|drop.?off|taxi|cab|drive|ride|tour|tours|safari|excursion|snorkel|dhow|cruise)\b/i.test(lower)) return 'hotel_stay';
  if (hotelMentions.length > 0 && hotelContracts.isPropertyFactQuestion(text) && !/\b(transfer|transfers|airport|pickup|drop.?off|taxi|cab|drive|ride|tour|tours|safari|excursion|snorkel|dhow|cruise)\b/i.test(lower)) return 'hotel_facts';
  if (/\b(get a quote|price|cost|how much|quote|rate)\b/i.test(lower)) return 'quote';
  if (/\b(family|kids|children|child|toddler|teenager)\b/i.test(lower)) return 'family';
  if (/\b(book|reserve|confirm|hold|how do i book|book an experience|book this)\b/i.test(lower)) return 'book';
  if (/\b(show all tours|view all tours|all tours|list tours|see all tours|browse tours)\b/i.test(lower)) return 'all_tours';
  if (/\b(recommend|suggest|what should|best|popular|must.?do|plan my (zanzibar )?trip|help me plan|itinerary)\b/i.test(lower)) return 'recommend';

  // If text mentions a specific service (or specific transfer route), treat as quote/service query
  const matched = matchServices(text);
  if (matched.length === 1) return 'quote';
  if (matched.length > 1 && !/^\s*(transfers?|airport transfers?)\s*$/i.test(lower.trim())) return 'quote';

  if (/\b(transfer|transfers|airport|pickup|drop.?off)\b/i.test(lower)) return 'transfer';
  if (/\b(visas?|insurance|health|safety|malaria|yellow.?fever|travel info|travel advice|entry requirements|dress code)\b/i.test(lower)) return 'info';
  if (/\b(hours|open|close|when|contact)\b/i.test(lower)) return 'hours';
  if (/\b(languages?|italian|italiano|german|deutsch|french|fran[cç]ais|polish|polski|driver language|guide language|multilingual|speak english|speak italian|speak german|speak french|speak polish)\b/i.test(lower)) return 'language';
  if (matched.length > 0) return 'quote';
  return 'general';
}

/** Match service slugs from text with scoring & route disambiguation */
function matchServices(text) {
  const raw = (text || '').trim();
  if (!raw) return [];
  const lower = raw.toLowerCase().replace(/[—–-]/g, ' ');

  const STOP_WORDS = new Set(['zanzibar', 'hotel', 'hotels', 'trip', 'day', 'the', 'and', 'with', 'from', 'per', 'vehicle', 'person', 'tour', 'tours']);

  const isAskingTransfer = /\b(transfer|airport|drive|ride|taxi|cab|pickup|drop.?off)\b/i.test(lower);
  const isAskingTour = /\b(tour|trip|excursion|walk|safari|cruise|snorkel)\b/i.test(lower);

  const scores = [];

  for (const svc of catalogue.services) {
    let score = 0;
    const slugClean = svc.slug.replace(/-/g, ' ');
    const nameClean = svc.name.toLowerCase().replace(/[—–-]/g, ' ');

    if (lower.includes(svc.name.toLowerCase()) || lower.includes(svc.slug)) {
      score += 700;
    } else if (lower.includes(nameClean) || lower.includes(slugClean)) {
      score += 600;
    }

    // Type affinity bonuses
    if (svc.type === 'transfer' && isAskingTransfer) score += 50;
    if (svc.type === 'tour' && isAskingTour) score += 50;

    // Specific destination / route keywords
    if (svc.slug === 'airport-transfer-znz-to-pajejambiani' && (lower.includes('paje') || lower.includes('jambiani'))) {
      score += 400;
    }
    if (svc.slug === 'airport-transfer-znz-to-nungwikendwa' && (lower.includes('nungwi') || lower.includes('kendwa'))) {
      score += 400;
    }
    if (svc.slug === 'airport-transfer-znz-to-stone-town' && (lower.includes('stone town') || lower.includes('ferry')) && isAskingTransfer) {
      score += 400;
    }
    if (svc.slug === 'safari-blue' && (lower.includes('safari blue') || lower.includes('menai'))) {
      score += 500;
    }
    if (svc.slug === 'mnemba-snorkeling' && (lower.includes('mnemba') || lower.includes('atoll'))) {
      score += 500;
    }
    if (svc.slug === 'stone-town-walking-tour' && (lower.includes('stone town') || lower.includes('walking')) && isAskingTour) {
      score += 400;
    }
    if (svc.slug === 'prison-island-nakupenda' && (lower.includes('prison island') || lower.includes('nakupenda') || lower.includes('tortoise'))) {
      score += 400;
    }
    if (svc.slug === 'spice-farm' && (lower.includes('spice farm') || lower.includes('spices') || lower.includes('vanilla'))) {
      score += 400;
    }
    if (svc.slug === 'jozani-forest' && (lower.includes('jozani') || lower.includes('colobus') || lower.includes('monkeys'))) {
      score += 400;
    }
    if (svc.slug === 'sunset-dhow-cruise' && (lower.includes('sunset') || lower.includes('dhow cruise'))) {
      score += 400;
    }
    if (svc.slug === 'mikumi-day-trip' && (lower.includes('mikumi') || lower.includes('day safari'))) {
      score += 400;
    }

    // Multi-word exact fragment (distinctive 2+ words together)
    const nameWords = nameClean.split(/\s+/).filter(function (w) { return w.length > 3 && !STOP_WORDS.has(w); });
    if (nameWords.length >= 2) {
      for (let i = 0; i < nameWords.length - 1; i++) {
        const pair = nameWords[i] + ' ' + nameWords[i + 1];
        if (lower.includes(pair)) {
          score += 250;
        }
      }
    }

    if (score >= 200) {
      scores.push({ slug: svc.slug, score: score });
    }
  }

  if (scores.length === 0) return [];
  scores.sort(function (a, b) { return b.score - a.score; });
  const maxScore = scores[0].score;
  return scores.filter(function (s) { return s.score >= maxScore * 0.75; }).map(function (s) { return s.slug; });
}

/* ---- Zone alias map for pickup extraction ---- */
const ZONE_ALIASES = {};
(catalogue.zones || []).forEach(function (z) {
  ZONE_ALIASES[z.slug] = z.slug;
  if (z.name) ZONE_ALIASES[z.name.toLowerCase()] = z.slug;
});

/* ---- Profile entity extraction from free text ---- */
const INTEREST_KEYWORDS = ['snorkeling', 'spice', 'safari', 'culture', 'beach', 'honeymoon', 'family', 'diving', 'kite'];

function extractEntities(text, profile) {
  const lower = (text || '').toLowerCase();
  const extracted = {};

  // dates — "12 December", "next week", "March 2026", "we arrive on the 5th"
  if (!profile.dates) {
    const datePatterns = [
      /(\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+\d{4})?)/i,
      /((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:\s*,?\s*\d{4})?)/i,
      /((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4})/i,
      /\b(next\s+week)\b/i,
      /\b(this\s+weekend)\b/i,
      /\b(tomorrow)\b/i,
      /\barrive\s+(?:on\s+)?(?:the\s+)?(\d{1,2}(?:st|nd|rd|th)?(?:\s+(?:of\s+)?(?:january|february|march|april|may|june|july|august|september|october|november|december))?(?:\s+\d{4})?)/i,
      /(\d{4}-\d{2}-\d{2})/,
      /(\d{1,2}\/\d{1,2}\/\d{2,4})/
    ];
    for (const pat of datePatterns) {
      const m = lower.match(pat);
      if (m) { extracted.dates = m[1] || m[0]; break; }
    }
  }

  // group_size → adults (and optionally children)
  if (!profile.adults) {
    const groupPatterns = [
      { re: /\b(\d+)\s*adults?\b/i, field: 'adults' },
      { re: /\bfamily\s+of\s+(\d+)\b/i, field: 'familyOf' },
      { re: /\bwe\s+are\s+(\d+)\b/i, field: 'adults' },
      { re: /\bjust\s+me\s+and\s+my\s+(?:wife|husband|partner)\b/i, field: 'couple' },
      { re: /\b(\d+)\s+(?:people|persons?|travell?ers?|of\s+us|pax)\b/i, field: 'adults' },
      { re: /\bcouple\b/i, field: 'couple' },
      { re: /\bjust\s+me\b/i, field: 'solo' },
      { re: /\bsolo\b/i, field: 'solo' },
    ];
    for (const gp of groupPatterns) {
      const m = lower.match(gp.re);
      if (m) {
        if (gp.field === 'couple') { extracted.adults = 2; }
        else if (gp.field === 'solo') { extracted.adults = 1; }
        else if (gp.field === 'familyOf') {
          const total = parseInt(m[1], 10);
          if (total > 0 && total <= 50) {
            extracted.adults = Math.max(1, Math.ceil(total * 0.4));
            extracted.children = total - extracted.adults;
          }
        }
        else if (gp.field === 'adults') {
          const n = parseInt(m[1], 10);
          if (n > 0 && n <= 50) extracted.adults = n;
        }
        break;
      }
    }
    // Check for children mention even if adults already set
    if (!profile.children && !extracted.children) {
      const childMatch = lower.match(/\b(\d+)\s*(?:kids?|children|child)\b/i);
      if (childMatch) {
        const c = parseInt(childMatch[1], 10);
        if (c > 0 && c <= 20) extracted.children = c;
      }
    }
  } else {
    // Profile already has adults — check for group_size update ("actually we are 6")
    const actuallyMatch = lower.match(/\bactually\s+(?:we\s+are|there\s+are|it'?s)\s+(\d+)\b/i);
    if (actuallyMatch) {
      const n = parseInt(actuallyMatch[1], 10);
      if (n > 0 && n <= 50) extracted.adults = n;
    }
    // Also check "not X" pattern: "actually we are 6 not 4"
    const notMatch = lower.match(/\b(\d+)\s+not\s+\d+\b/i);
    if (notMatch) {
      const n = parseInt(notMatch[1], 10);
      if (n > 0 && n <= 50) extracted.adults = n;
    }
  }

  // name — only when the guest explicitly introduces it
  if (!profile.name) {
    const nameMatch = text.match(/(?:\b(?:[Mm]y name is|[Ii] am|[Ii]'m|[Nn]ame\s*[:\-]))\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/);
    if (nameMatch) extracted.name = nameMatch[1];
  }

  // interests — append if not already present
  if (!profile.interests || profile.interests.length === 0) {
    const found = [];
    for (const kw of INTEREST_KEYWORDS) {
      if (lower.includes(kw) && !(profile.interests || []).includes(kw)) {
        found.push(kw);
      }
    }
    if (found.length > 0) extracted.interests = found;
  } else {
    // Still detect new interests and append
    const newInterests = [];
    for (const kw of INTEREST_KEYWORDS) {
      if (lower.includes(kw) && !profile.interests.includes(kw)) {
        newInterests.push(kw);
      }
    }
    if (newInterests.length > 0) extracted._appendInterests = newInterests;
  }

  // budget → budgetBand
  if (!profile.budgetBand) {
    if (/\b(budget|cheap|under\s+\$?\d+|low.?cost|affordable)\b/i.test(lower)) extracted.budgetBand = 'low';
    else if (/\b(splurge|luxury|premium|high.?end|vip|no\s+limit)\b/i.test(lower)) extracted.budgetBand = 'luxury';
    else if (/\b(mid|moderate|mid.?range|reasonable)\b/i.test(lower)) extracted.budgetBand = 'mid';
  }

  // pickupZone — match zone slugs and names
  if (!profile.pickupZone) {
    for (const alias of Object.keys(ZONE_ALIASES)) {
      if (lower.includes(alias)) {
        extracted.pickupZone = ZONE_ALIASES[alias];
        break;
      }
    }
  }

  return extracted;
}

/** Merge extracted entities into the profile (incoming wins) */
function mergeProfile(incomingProfile, extracted) {
  const merged = Object.assign({}, incomingProfile);

  if (extracted.dates) merged.dates = extracted.dates;
  if (extracted.name) merged.name = extracted.name;
  if (extracted.adults != null) merged.adults = extracted.adults;
  if (extracted.children != null) merged.children = extracted.children;
  if (extracted.budgetBand) merged.budgetBand = extracted.budgetBand;
  if (extracted.pickupZone) merged.pickupZone = extracted.pickupZone;

  if (extracted.interests) {
    merged.interests = (merged.interests || []).concat(extracted.interests);
  }
  if (extracted._appendInterests) {
    merged.interests = (merged.interests || []).concat(extracted._appendInterests);
  }

  // Track matched service slugs
  return merged;
}

/** Count how many profile fields are populated */
function profileCompleteness(profile) {
  let count = 0;
  if (profile.dates) count++;
  if (profile.name) count++;
  if (profile.adults) count++;
  if (profile.interests && profile.interests.length > 0) count++;
  if (profile.pickupZone) count++;
  if (profile.budgetBand) count++;
  return count;
}

/** Build WhatsApp handoff URL from profile and matched services */
function buildWhatsAppUrl(profile, serviceSlugs) {
  const tourNames = [];
  const slugsToUse = Array.isArray(serviceSlugs) ? [...new Set(serviceSlugs)].slice(0, 5) : [];
  for (const slug of slugsToUse) {
    const svc = getService(slug);
    if (svc) tourNames.push(svc.name);
  }
  const parts = ['Hi Spice & Sail! I\'d like to book: ' + (tourNames.length > 0 ? tourNames.join(', ') : 'a Zanzibar experience') + '.'];
  if (profile.name) parts.push('Name: ' + profile.name + '.');
  if (profile.dates) parts.push('Dates: ' + profile.dates + '.');
  if (profile.adults) parts.push('Group: ' + profile.adults + (profile.children ? ' adults + ' + profile.children + ' children' : ' traveller' + (profile.adults > 1 ? 's' : '')) + '.');
  if (profile.pickupZone) {
    const zoneLbl = (catalogue.zones.find(function (z) { return z.slug === profile.pickupZone; }) || {}).name || profile.pickupZone;
    parts.push('Pickup: ' + zoneLbl + '.');
  }
  return 'https://wa.me/255672450934?text=' + encodeURIComponent(parts.join(' '));
}

/** Build deterministic reply with quick-reply buttons */
function buildDeterministicReply(intent, text, profile, turnCount) {
  const afterHours = !isWithinBusinessHours();
  const replyWindow = CONFIG.replyWindow || 'within a few hours during business hours';

  function unitLabel(svc) {
    const p = svc.pricing || {};
    if (p.basis === 'per_vehicle') return 'per vehicle';
    if (p.basis === 'per_person') return 'per person';
    return 'per person';
  }

  const hoursNote = (afterHours && turnCount === 1)
    ? '\n\n*Note: Our human operations desk is offline right now — messages are answered the next business morning (Mon–Sat, 08:00–18:00 EAT).*'
    : '';

  // ---- hotel stay rates (partner hotels, private quoting) ----
  if (intent === 'hotel_stay') {
    const hotelMentions = hotelContracts.matchHotelContracts(text);
    if (hotelMentions.length > 0) {
      const hotelReply = hotelContracts.hotelStayReply(hotelMentions[0], text);
      if (hotelReply) return hotelReply;
    }
  }

  // ---- hotel property facts (rooms, views, facilities, distance) ----
  if (intent === 'hotel_facts') {
    const hotelMentions = hotelContracts.matchHotelContracts(text);
    if (hotelMentions.length > 0) {
      const factReply = hotelContracts.propertyFactReply(hotelMentions[0]);
      if (factReply) return factReply;
    }
  }

  // ---- inclusions intent ----
  if (intent === 'inclusions') {
    let targetSlug = null;
    const slugs = matchServices(text);
    if (slugs.length > 0) {
      targetSlug = slugs[0];
    } else if (profile.activeSlug) {
      targetSlug = profile.activeSlug;
    } else if (Array.isArray(profile.serviceSlugs) && profile.serviceSlugs.length > 0) {
      targetSlug = profile.serviceSlugs[0];
    }

    if (targetSlug) {
      const svc = getService(targetSlug);
      if (svc) {
        const inc = (svc.includes || []).map(function (i) { return '• ' + i; }).join('\n') || '• Licensed guide, equipment & government permits';
        const notes = (svc.importantNotes || []).map(function (n) { return '• ' + n; }).join('\n');
        return {
          message: '**' + svc.name + ' — What\'s Included:**\n\n' + inc + (notes ? '\n\n**What to Bring & Important Notes:**\n' + notes : '') + hoursNote,
          quickReplies: ['💬 Open WhatsApp to Reserve', 'Get a quote', 'Check another tour'],
          requestContact: false,
        };
      }
    }
    return {
      message: 'Which experience would you like to know about? Choose a tour below and I\'ll detail what\'s included and what to bring:' + hoursNote,
      quickReplies: ['Safari Blue', 'Mnemba snorkeling', 'Stone Town tour', 'Sunset dhow cruise'],
      requestContact: false,
    };
  }

  // ---- payments intent ----
  if (intent === 'payments') {
    return {
      message: '**Payment Methods & Deposit Policy:**\n\n' +
        '• **Airport & Hotel Transfers**: Zero advance deposit — reserve with peace of mind and pay your private driver on arrival (USD cash or card).\n' +
        '• **Sea Tours & Boat Charters (Safari Blue, Mnemba, Prison Island + Nakupenda, Catamaran)**: 20% advance deposit via a secure DPO or Pesapal payment link our team sends on WhatsApp (Visa/Mastercard) to lock in your boat captain, fuel, and morning fresh seafood market procurement. The remaining 80% balance is paid on the day of the tour.\n' +
        '• **Fly-in Safaris (Serengeti, Nyerere)**: 30% advance deposit to secure non-refundable scheduled domestic airline seats and TANAPA national park entry permits.\n' +
        '• **Captain\'s Weather Guarantee**: If sea conditions or weather prevent sailing, you receive an immediate **100% full refund** or priority rescheduling!' + hoursNote,
      quickReplies: ['Cancellation policy', 'Plan my trip', 'Book an experience'],
      requestContact: false,
    };
  }

  // ---- cancellation intent ----
  if (intent === 'cancellation') {
    return {
      message: '**Cancellation & Weather Policy:**\n\n' +
        '• **Transfers & Land Walking Tours**: 100% free cancellation up to 12 hours before pickup.\n' +
        '• **Sea Tours & Boat Charters (Safari Blue, Mnemba, Prison Island)**: 100% free cancellation up to **24 hours before pickup** with a full refund of your deposit. Within 24 hours, the 20% deposit is retained to cover pre-paid boat captain bookings, fuel, and fresh seafood market procurement.\n' +
        '• **Captain\'s Weather Guarantee**: In the event of adverse sea conditions, swells, or weather advisories from the Zanzibar Maritime Authority, we offer an immediate **100% full refund** or complimentary rescheduling.\n' +
        '• **Fly-in Safaris**: Governed by scheduled domestic airline cancellation and TANAPA national park rules.\n\n' +
        'Our team manages all adjustments swiftly on WhatsApp: +255 672 450 934.' + hoursNote,
      quickReplies: ['Plan my trip', 'Payment methods', 'Book an experience'],
      requestContact: false,
    };
  }

  // ---- honeymoon intent ----
  if (intent === 'honeymoon') {
    const romanticSvcs = catalogue.services.filter(function (s) {
      return (s.interests || []).some(function (i) { return ['honeymoon', 'romance', 'couples', 'sunset'].includes(i); });
    }).slice(0, 4);
    const list = romanticSvcs.map(function (s) {
      return '• **' + s.name + '** — ' + s.pricing.display + ' (' + s.duration + ')';
    }).join('\n');
    return {
      message: '**Romantic & Honeymoon Experiences:**\n\n' + list + '\n\nAll of these are perfect for couples. Our team can help you plan the perfect romantic itinerary — just say the word!' + hoursNote,
      quickReplies: romanticSvcs.slice(0, 3).map(function (s) { return s.name; }).concat(['Plan a honeymoon trip']),
      requestContact: false,
    };
  }

  // ---- family intent ----
  if (intent === 'family') {
    const familySvcs = catalogue.services.filter(function (s) {
      return (s.interests || []).some(function (i) { return i === 'family'; });
    }).slice(0, 5);
    const list = familySvcs.map(function (s) {
      return '• **' + s.name + '** — ' + s.pricing.display + ' (' + s.duration + ')';
    }).join('\n');
    return {
      message: '**Family-Friendly Experiences:**\n\n' + list + '\n\nThese are tried and tested with families. Child pricing is confirmed by our team for each specific tour.' + hoursNote,
      quickReplies: familySvcs.slice(0, 3).map(function (s) { return s.name; }).concat(['Plan a family trip']),
      requestContact: false,
    };
  }

  if (intent === 'availability') {
    const availabilitySlugs = matchServices(text);
    const availabilityService = availabilitySlugs.length > 0 ? getService(availabilitySlugs[0]) : null;
    const waMsg = 'Jambo Spice & Sail! I would like to check availability' +
      (availabilityService ? ' for ' + availabilityService.name : '') +
      (profile.dates ? ' on ' + profile.dates : '') +
      (profile.adults ? ' for ' + profile.adults + (profile.children ? ' adults + ' + profile.children + ' children' : ' guests') : '') +
      (profile.name ? '. My name is ' + profile.name : '') + '.';
    const waUrl = 'https://wa.me/255672450934?text=' + encodeURIComponent(waMsg);
    return {
      message: '**Live Availability**\n\n' +
        (availabilityService ? 'For **' + availabilityService.name + '**, ' : '') +
        'I can\'t see the live booking calendar from this chat, so I won\'t guess. Send us the date, number of adults/children and pickup area, and our operations team will confirm availability and hold options on WhatsApp (+255 672 450 934).\n\n[💬 Check availability on WhatsApp](' + waUrl + ')',
      quickReplies: ['💬 Check on WhatsApp', 'Get a quote', 'Show all tours'],
      requestContact: false,
      whatsapp_url: waUrl,
    };
  }

  if (intent === 'tour_type') {
    return {
      message: '**Private vs Shared Tours**\n\nMost of our day tours and boat trips can run as a **private** charter or a **shared** seat, depending on the experience and date. Published rates are planning ranges; private charters and small-group seats are quoted separately.\n\nTell me the tour, date and number of adults/children and our team will confirm both options on WhatsApp.' + hoursNote,
      quickReplies: ['Safari Blue', 'Mnemba snorkeling', 'Get a quote', '💬 Open WhatsApp'],
      requestContact: false,
    };
  }

  if (intent === 'quote') {
    let targetSlug = null;
    const slugs = matchServices(text);
    if (slugs.length > 0) {
      targetSlug = slugs[0];
    } else if (profile.activeSlug && profile.activeSlug !== 'general') {
      targetSlug = profile.activeSlug;
    } else if (Array.isArray(profile.serviceSlugs) && profile.serviceSlugs.length > 0) {
      targetSlug = profile.serviceSlugs[0];
    }

    if (targetSlug) {
      const svc = getService(targetSlug);
      if (svc && svc.pricing && svc.pricing.min != null) {
        const quote = getQuote({ serviceSlug: targetSlug, adults: profile.adults || 2 });
        const isTransfer = svc.type === 'transfer';
        const isSeaTour = ['safari-blue', 'mnemba-snorkeling', 'prison-island-nakupenda', 'nakupenda-sandbank', 'kizimkazi-dolphin-tour', 'sunset-dhow-cruise', 'chumbe-island'].includes(svc.slug);
        const isSafari = svc.category === 'safari' || (svc.slug.includes('safari') && !svc.slug.includes('safari-blue'));

        const depositNotice = isSafari
          ? '(30% advance deposit locks scheduled domestic flights & TANAPA permits)'
          : isSeaTour
            ? '(20% advance deposit via a DPO/Pesapal link sent on WhatsApp locks boat captain & fresh seafood lunch, backed by our 100% Weather Guarantee)'
            : isTransfer
              ? '(zero advance deposit — pay your driver on arrival)'
              : '(zero advance deposit — pay on arrival)';

        const waMsg = (isTransfer
          ? 'Jambo Spice & Sail! I would like to book a private transfer: ' + svc.name + (profile.dates ? ' on ' + profile.dates : '') + '.'
          : 'Jambo Spice & Sail! I would like to check availability and book ' + svc.name + ' for ' + (profile.adults || 2) + ' guests.') +
          (profile.name ? ' My name is ' + profile.name + '.' : '');
        const waUrl = 'https://wa.me/255672450934?text=' + encodeURIComponent(waMsg);
        const inc = (svc.includes || []).join(', ') || 'Licensed guide, gear & marine fees';

        const quickReplies = isTransfer
          ? ['💬 Open WhatsApp to Reserve', 'Larger group?', 'How long to Nungwi?', 'Show all tours']
          : ['What is included?', '💬 Open WhatsApp', 'Check another tour', 'Airport transfers'];

        return {
          message: '**' + svc.name + '**\n\n' +
            '• **Planning Rate:** ' + svc.pricing.display + ' ' + unitLabel(svc) + '\n' +
            '• **Duration:** ' + svc.duration + '\n' +
            '• **Includes:** ' + inc + '\n\n' +
            (profile.children ? '• **Family:** ' + profile.children + ' child' + (profile.children > 1 ? 'ren' : '') + ' — child pricing is confirmed by our team.\n\n' : '') +
            'Hold your date directly with our local operations team via WhatsApp ' + depositNotice + ':\n\n' +
            '[💬 Chat on WhatsApp to Confirm & Reserve](' + waUrl + ')',
          quickReplies: quickReplies,
          requestContact: false,
          quote: quote,
          whatsapp_url: waUrl
        };
      }
    }
    return {
      message: 'I can help with pricing and instant availability! Which experience would you like to explore?' + hoursNote,
      quickReplies: ['Safari Blue', 'Mnemba snorkeling', 'Stone Town tour', 'Airport transfers', 'Show all tours'],
      requestContact: false,
    };
  }

  if (intent === 'all_tours') {
    const list = [
      '• **Safari Blue / Menai Bay dhow day** — $60–$160 pp (7–9 hrs, seafood BBQ & sandbank)',
      '• **Mnemba Atoll Snorkeling & Dolphins** — $70–$150 pp (3–6 hrs, marine reserve reefs)',
      '• **Stone Town Historical Walking Tour** — $45–$80 pp (2–4 hrs, UNESCO heritage)',
      '• **Prison Island & Nakupenda Sandbank** — $55–$120 pp (4–6 hrs, giant tortoises)',
      '• **Organic Spice Farm Cultural Tour** — $30–$50 pp (2–3 hrs, tasting & village lunch)',
      '• **Jozani Forest & Red Colobus Monkeys** — $40–$70 pp (2–4 hrs, mangrove boardwalk)',
      '• **Sunset Dhow Sailing Cruise** — $45–$85 pp (2–3 hrs, Stone Town / Kendwa coast)',
      '• **Private Airport & Inter-Hotel Transfers** — $35–$60 per vehicle (door-to-door)'
    ].join('\n');
    return {
      message: '**Spice & Sail Zanzibar Experiences Catalogue:**\n\n' + list + '\n\nWhich experience would you like to explore or get an exact quote for?' + hoursNote,
      quickReplies: ['Safari Blue', 'Mnemba snorkeling', 'Stone Town tour', 'Airport transfers'],
      requestContact: false,
    };
  }

  if (intent === 'recommend') {
    const recs = recommend(profile || {}, 4);
    if (recs.length > 0) {
      const list = recs.map(function (r) { return '• **' + r.name + '** — ' + r.priceDisplay + ' (' + r.duration + ')'; }).join('\n');
      return {
        message: 'Based on what you\'ve told me, here are my top suggestions:\n\n' + list + '\n\nWould you like a quote for any of these? Our team confirms availability and the final price.' + hoursNote,
        quickReplies: recs.slice(0, 3).map(function (r) { return r.name; }).concat(['Something else']),
        requestContact: false,
      };
    }
    return {
      message: 'Tell me a bit about your trip — when are you coming, how many travellers, and what interests you most? I\'ll suggest the best experiences.' + hoursNote,
      quickReplies: ['Beach & ocean', 'Culture & history', 'Wildlife & nature', 'Adventure', 'Romantic getaway'],
      requestContact: false,
    };
  }

  if (intent === 'book') {
    let targetSvc = null;
    const slugs = matchServices(text);
    if (slugs.length > 0) {
      targetSvc = getService(slugs[0]);
    } else if (profile.activeSlug && profile.activeSlug !== 'general') {
      targetSvc = getService(profile.activeSlug);
    } else if (Array.isArray(profile.serviceSlugs) && profile.serviceSlugs.length > 0) {
      targetSvc = getService(profile.serviceSlugs[0]);
    }

    const svcName = targetSvc ? targetSvc.name : 'a Zanzibar experience';
    const waMsg = 'Jambo Spice & Sail! I would like to reserve ' + svcName + (profile.adults ? ' for ' + profile.adults + (profile.children ? ' adults + ' + profile.children + ' children' : ' guests') : '') + (profile.dates ? ' on ' + profile.dates : '') + (profile.name ? '. My name is ' + profile.name : '') + '.';
    const waUrl = 'https://wa.me/255672450934?text=' + encodeURIComponent(waMsg);
    
    return {
      message: '**Reserve Your Zanzibar Experience**\n\n' +
        'Our transparent booking process:\n' +
        '1. **Airport & Hotel Transfers**: Zero advance deposit — reserve with peace of mind and pay your driver on arrival.\n' +
        '2. **Sea Tours & Boat Charters (Safari Blue, Mnemba, Nakupenda, Catamaran)**: 20% confirmation deposit via a DPO or Pesapal payment link sent on WhatsApp (Visa/Mastercard) to secure your boat captain, fuel, and morning fresh seafood procurement. Balance paid on tour day.\n' +
        '3. **Fly-in Safaris**: 30% advance deposit to lock domestic flights and TANAPA national park permits.\n' +
        '4. **Captain\'s Weather Guarantee**: 100% full refund or priority reschedule if weather/sea conditions prevent sailing.\n\n' +
        '[💬 Open WhatsApp to Reserve (' + svcName + ')](' + waUrl + ')',
      quickReplies: ['💬 Open WhatsApp', 'View all tours', 'Airport transfers', 'Travel info'],
      requestContact: false,
      whatsapp_url: waUrl
    };
  }

  if (intent === 'travel_time') {
    return {
      message: '**Typical Zanzibar Transfer Drive Times (from ZNZ Airport / Stone Town):**\n\n' +
        '• **Stone Town / Ferry Terminal**: 10–15 minutes\n' +
        '• **Nungwi & Kendwa (North)**: 60–75 minutes (~65 km)\n' +
        '• **Paje & Jambiani (South East)**: 50–60 minutes (~50 km)\n' +
        '• **Matemwe & Kiwengwa (North East)**: 50–60 minutes (~45 km)\n' +
        '• **Kizimkazi (South)**: 55–65 minutes (~55 km)\n\n' +
        'All transfers are in air-conditioned private vehicles with dedicated drivers and flight delay tracking.' + hoursNote,
      quickReplies: ['Request a transfer', 'Get a quote', 'Book an experience'],
      requestContact: false,
    };
  }

  if (intent === 'group_luggage') {
    return {
      message: '**Vehicles, Luggage & Group Sizes:**\n\n' +
        '• **Standard Sedan / Small SUV**: Up to 3 passengers with 2 large bags or 4 with hand luggage.\n' +
        '• **Toyota Alphard / Noah / Minivan**: Up to 6 passengers with standard luggage.\n' +
        '• **Toyota HiAce / Coaster Minibus**: 7 to 20+ passengers — ideal for weddings, retreats, and safari groups.\n\n' +
        'Let us know your party size and luggage count, and our team will allocate the perfect vehicle.' + hoursNote,
      quickReplies: ['Request a transfer', 'Get a quote', 'Book an experience'],
      requestContact: false,
    };
  }

  if (intent === 'transfer') {
    const transfers = catalogue.services.filter(function (s) { return s.type === 'transfer'; });
    const list = transfers.map(function (t) { return '• **' + t.name + '** — ' + t.pricing.display + ' ' + unitLabel(t); }).join('\n');
    return {
      message: '**Airport Transfers**\n\n' + list + '\n\nAll transfers include meet & greet, flight tracking, and private vehicle (up to 4 guests). Zero advance deposit — pay on arrival. Our team confirms your booking.' + hoursNote,
      quickReplies: ['ZNZ to Stone Town ($35–$40)', 'ZNZ to Paje / Jambiani ($45–$55)', 'ZNZ to Nungwi / Kendwa ($50–$60)', 'Larger group?'],
      requestContact: false,
    };
  }

  if (intent === 'info') {
    return {
      message: '**Zanzibar Entry & Travel Information:**\n\n' +
        '• **Tourist Visa**: Standard tourist visa is $50 USD on arrival (US passport holders require $100 multiple-entry; referral nationalities require advance online clearance via visa.immigration.go.tz).\n' +
        '• **Mandatory Zanzibar Travel Insurance**: Mandatory for foreign visitors entering Zanzibar ($44 adult / $22 child via visitzanzibar.go.tz).\n' +
        '• **Currency & Cash**: US Dollars (clean, crisp notes printed post-2013 per Tanzanian banking rules) and Tanzanian Shillings (TZS) are standard. Cards are widely accepted for tours.\n' +
        '• **Health & Vaccines**: Yellow fever certificate is only required if arriving from or transiting through an endemic transmission country (>12h). Malaria prophylaxis is recommended.\n' +
        '• **Cultural Dress Code**: Modest clothing (covering shoulders and knees) is respectful when walking through Stone Town, local fishing villages, and spice farms.' + hoursNote,
      quickReplies: ['Airport transfers', 'Get a quote', 'Show all tours'],
      requestContact: false,
    };
  }

  if (intent === 'hours') {
    return {
      message: 'Our team is available **Monday to Saturday, 08:00–18:00** (East Africa Time). ' + (afterHours ? 'We\'re currently offline — messages will be answered the next business morning.' : 'We\'re online right now and reply ' + replyWindow + '.') + '\n\nYou can also reach us on WhatsApp: +255 672 450 934',
      quickReplies: ['Plan my trip', 'Get a quote'],
      requestContact: false,
    };
  }

  if (intent === 'language') {
    return {
      message: 'All standard Spice & Sail tours and private transfers are guided in fluent English and Swahili.\n\nWe also offer certified multilingual Zanzibari drivers and tour guides fluent in **Italian, German, French, and Polish** upon advance request for an additional fee.\n\nPlease let our team know your language preference when requesting your quote so we can reserve your dedicated guide in advance.' + hoursNote,
      quickReplies: ['Book on WhatsApp', 'Request a transfer', 'Recommend tours'],
      requestContact: false,
    };
  }

  // General / greeting
  if (turnCount && turnCount > 1) {
    return {
      message: 'I\'m here to help with your Zanzibar plans! Would you like a price quote for a tour, transfer details, or recommendations for your stay?' + hoursNote,
      quickReplies: ['Plan my Zanzibar trip', 'Get a quote', 'Book an experience', 'Visas & travel info'],
      requestContact: false,
    };
  }

  return {
    message: '**Karibu!** I\'m the Spice & Sail Island Concierge — your Zanzibar travel consultant. I recommend from our real tour catalogue, quote from verified prices, and pass requests to our human team who confirm every detail.\n\nOur team replies ' + replyWindow + '.\n\n_We only use what you share here to answer and handle your request. See our [privacy notice](/privacy/) for details._\n\nWhat would you like to do?' + hoursNote,
    quickReplies: ['Plan my Zanzibar trip', 'Get a quote', 'Book an experience', 'Visas & travel info'],
    requestContact: false,
  };
}

exports.handler = async function (event) {
  const origin = event.headers && event.headers.origin;
  const headers = corsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (origin && !isAllowedOrigin(origin)) {
    return { statusCode: 403, headers: headers, body: JSON.stringify({ error: 'Origin not allowed' }) };
  }

  ensureStore();
  const store = getGlobalStore();

  // Rate limits
  const ip = getClientIP(event);
  // Per-IP daily cap: 100 messages
  const dailyRL = await checkRateLimit(ip, 'chat-daily', 100, 86400000, store);
  if (!dailyRL.allowed) {
    return { statusCode: 429, headers: headers, body: JSON.stringify({ error: 'Daily message limit reached. Please contact us directly on WhatsApp.' }) };
  }

  let body;
  try { body = JSON.parse(event.body); } catch (e) {
    return { statusCode: 400, headers: headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const profile = body.profile || {};
  const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
  const userMessage = (body.message || '').trim();
  if (!userMessage) {
    return { statusCode: 400, headers: headers, body: JSON.stringify({ error: 'Message is required' }) };
  }

  if (userMessage.length > 2000) {
    return { statusCode: 400, headers: headers, body: JSON.stringify({ error: 'Message too long' }) };
  }

  // Per-session cap: 50 messages
  const sessionId = body.session_id || ip;
  const sessionRL = await checkRateLimit(sessionId, 'chat-session', 50, 86400000, store);
  if (!sessionRL.allowed) {
    return { statusCode: 429, headers: headers, body: JSON.stringify({ error: 'Session message limit reached. Please contact us on WhatsApp for extended help.' }) };
  }

  // Extract entities from user message and merge into profile
  const extracted = extractEntities(userMessage, profile);
  const mergedProfile = mergeProfile(profile, extracted);

  // Track matched services across conversation:
  // - discussed_services: records all unique services touched in conversation
  // - activeSlug / serviceSlugs: focused target service for the current turn (prevents stale accumulation)
  const matchedSlugs = matchServices(userMessage);
  const existingDiscussed = Array.isArray(profile.discussed_services)
    ? profile.discussed_services
    : (Array.isArray(profile.serviceSlugs) ? profile.serviceSlugs : []);
  if (matchedSlugs.length > 0 || existingDiscussed.length > 0) {
    mergedProfile.discussed_services = [...new Set([...existingDiscussed, ...matchedSlugs])].slice(0, 10);
  }
  if (matchedSlugs.length > 0) {
    mergedProfile.activeSlug = matchedSlugs[0];
    mergedProfile.serviceSlugs = matchedSlugs;
  } else if (profile.activeSlug) {
    mergedProfile.activeSlug = profile.activeSlug;
    mergedProfile.serviceSlugs = [profile.activeSlug];
  } else if (existingDiscussed.length > 0) {
    mergedProfile.activeSlug = existingDiscussed[existingDiscussed.length - 1];
    mergedProfile.serviceSlugs = [mergedProfile.activeSlug];
  } else {
    mergedProfile.serviceSlugs = [];
  }

  // Count conversation turns from history
  const turnCount = Math.floor(history.length / 2) + 1;

  const intent = detectIntent(userMessage);

  // 1. Deterministic engine produces the base reply and data
  const deterministicResult = buildDeterministicReply(intent, userMessage, mergedProfile, turnCount);
  let toolResults = deterministicResult.quote ? [deterministicResult.quote] : [];
  if (intent === 'hotel_stay') {
    const hotelMentions = hotelContracts.matchHotelContracts(userMessage);
    if (hotelMentions.length > 0) toolResults = toolResults.concat(hotelContracts.approvedPriceSheets(hotelMentions));
  }

  // 2. Try LLM enhancement (optional)
  let finalReply = deterministicResult;
  const hasLLMKey = Boolean(process.env.GEMINI_API_KEY || (process.env.OPENAI_COMPAT_BASE_URL && process.env.OPENAI_COMPAT_API_KEY));

  if (hasLLMKey && intent !== 'hours') {
    try {
      const systemPrompt = buildSimpleSystemPrompt(mergedProfile, deterministicResult);
      const llmResult = await tryLLM(systemPrompt, userMessage, toolResults);

      if (llmResult && llmResult.message) {
        // 3. Guardrail check
        const guardrailCheck = checkReply(llmResult.message, toolResults);
        if (guardrailCheck.safe) {
          finalReply = {
            message: llmResult.message,
            quickReplies: llmResult.quickReplies || deterministicResult.quickReplies,
            requestContact: llmResult.requestContact || deterministicResult.requestContact,
          };
        } else {
          // Use cleaned version if only minor violations
          finalReply = {
            message: guardrailCheck.cleaned,
            quickReplies: deterministicResult.quickReplies,
            requestContact: deterministicResult.requestContact,
          };
        }
      }
      // If LLM returned null, we fall through to deterministic (already set)
    } catch (e) {
      // LLM failed — use deterministic reply (already set)
    }
  }

  // Terminal response: explicit booking intent OR booking action (never force handoff prematurely on turn count)
  const isBookingIntent = intent === 'book' || /\b(book|reserve|confirm|hold|whatsapp)\b/i.test(userMessage);
  const isTerminal = isBookingIntent;

  const responseBody = {
    message: finalReply.message,
    quickReplies: finalReply.quickReplies || [],
    requestContact: false,
    quote: deterministicResult.quote || null,
    profile: mergedProfile,
    whatsapp_url: deterministicResult.whatsapp_url || null,
  };

  if (isTerminal) {
    const targetSlugs = matchedSlugs.length > 0
      ? matchedSlugs
      : (mergedProfile.activeSlug ? [mergedProfile.activeSlug] : (mergedProfile.serviceSlugs || []));
    responseBody.whatsapp_url = buildWhatsAppUrl(mergedProfile, targetSlugs);
    // Append a WhatsApp prompt to the message if not already mentioning WhatsApp handoff
    if (!finalReply.message.includes('WhatsApp')) {
      responseBody.message += '\n\nReady to book? Click the WhatsApp button below to send your request directly to our team!';
    }
  }

  return {
    statusCode: 200,
    headers: headers,
    body: JSON.stringify(responseBody),
  };
};

function buildSimpleSystemPrompt(profile, deterministicResult) {
  const replyWindow = CONFIG.replyWindow || 'within a few hours during business hours';
  const afterHours = !isWithinBusinessHours();

  return 'You are the Spice & Sail Island Concierge — a warm Zanzibar travel consultant. ' +
    'Reply concisely in English. Use the DETERMINISTIC DATA provided — never invent prices or availability. ' +
    'Every price must come from the data below. Never say a booking is confirmed, locked, or reserved. ' +
    'Say "pending team confirmation". Our team replies ' + replyWindow + '. ' +
    (afterHours ? 'The team is offline now — mention messages are answered next business morning. ' : '') +
    'Never compare with OTAs. Never claim to be a registered tour operator. ' +
    'For insurance ($44) and hotel tax ($4-$5): say "verify current amounts on the official portal". ' +
    '\n\nDETERMINISTIC DATA:\n' + JSON.stringify({
      suggestedReply: deterministicResult.message,
      quickReplies: deterministicResult.quickReplies,
      quote: deterministicResult.quote || null,
    }) +
    '\n\nRespond with JSON: {"message":"...","quickReplies":["..."],"requestContact":false}';
}
