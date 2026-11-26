/**
 * Chat endpoint — hybrid zero-cost concierge.
 * 1. Deterministic engine first (recommendations, quotes)
 * 2. Optional LLM layer (Gemini or OpenAI-compatible)
 * 3. Guardrail check on any LLM output
 * 4. Fallback to deterministic on any failure
 */
'use strict';

const { corsHeaders, checkRateLimit, getClientIP, isAllowedOrigin } = require('../concierge/security');
const { getGlobalStore, createStore, setGlobalStore } = require('../concierge/store');
const { recommend } = require('../concierge/recommend');
const { getQuote } = require('../concierge/pricing');
const { checkReply } = require('../concierge/guardrail');
const { tryLLM } = require('../concierge/llm');
const { catalogue, CONFIG, isWithinBusinessHours, getService, getBusinessHoursLabel } = require('../concierge/catalogue');
const hotelContracts = require('../concierge/hotel-contracts');
const knowledge = require('../concierge/knowledge');

const BUSINESS_WHATSAPP = (CONFIG && /^\d{8,15}$/.test(CONFIG.whatsappNumber || ''))
  ? CONFIG.whatsappNumber
  : '255707939265';
const BUSINESS_WHATSAPP_DISPLAY = '+' + BUSINESS_WHATSAPP;

function ensureStore() {
  try { getGlobalStore(); } catch (e) {
    setGlobalStore(createStore('memory'));
  }
}

/** Deterministic intent detection (EN + IT/DE/FR signals + conversation context) */
function detectIntent(text, profile) {
  const lower = (text || '').toLowerCase();
  const prof = profile || {};

  if (/\b(how long to|how long does it take|travel time|drive time|distance to|how far|quanto tempo|wie lange|combien de temps)\b/i.test(lower)) return 'travel_time';
  if (/\b(larger group|large group|big group|more than 4|minivan|coaster|luggage|valigie|gepäck)\b/i.test(lower)) return 'group_luggage';
  if (/\b(what('?s| is) included|what to bring|inclusions?|what do i bring|bring along|what is in it|cosa include|was ist inklusive|que comprend)\b/i.test(lower)) return 'inclusions';
  if (/\b(cancel|cancellation|refund|reschedule|weather policy|bad weather|cancellazione|stornierung|annulation)\b/i.test(lower)) return 'cancellation';
  if (/\b(how do i pay|payment|pay for|payment method|pay by|mpesa|m-pesa|cash|card|deposit|prepayment|down.?payment|pagamento|anzahlung|acompte)\b/i.test(lower)) return 'payments';
  if (/\b(honeymoon|romantic|anniversary|couples?\s+trip|luna di miele|flitterwochen|lune de miel)\b/i.test(lower)) return 'honeymoon';
  if (/\b(availab(?:le|ility)|spots? left|seats? left|sold out|booked out|open on|disponibilit[àa]|verfügbarkeit|disponibilit[ée])\b/i.test(lower)) return 'availability';
  if (/\b(private|shared|join (?:a )?group|group tours?|small group|semi.?private|privato|condiviso|privat|geteilt)\b/i.test(lower) && /\b(tours?|trips?|excursions?|dhow|safari|boat|snorkel|escursion|ausflug)\b/i.test(lower)) return 'tour_type';

  const hasMoveWords = /\b(transfer|transfers|airport|pickup|drop.?off|taxi|cab|drive|ride|trasferiment|flughafen|transfert)\b/i.test(lower);
  const hasTourWords = /\b(tour|tours|safari|excursion|snorkel|dhow|cruise)\b/i.test(lower);
  const hotelMentions = hotelContracts.matchHotelContracts(text);
  if (hotelMentions.length > 0 && !hasMoveWords && !hasTourWords) {
    if (hotelContracts.isStayRateQuestion(text)) return 'hotel_stay';
    if (hotelContracts.isPropertyFactQuestion(text)) return 'hotel_facts';
    if (!/\b(book|reserve|confirm|whatsapp)\b/i.test(lower)) return 'hotel_mention';
  }

  // Area / weather / ferry logistics take precedence over accidental town-name service matches
  if (/\b(where should i stay|where to stay|which beach|which area|best beach|compare.*beach|stone town vs|nungwi vs|paje vs|tell me about (?:nungwi|kendwa|paje|jambiani|stone town|matemwe|kiwengwa|kizimkazi|michamvi|bwejuu|fumba|pemba))\b/i.test(lower) && !hasMoveWords) return 'area_guide';
  if (/\b(best time|weather|rain|rainy|season|seasons|tides?|low tide|high tide|climate|temperature|monsoon|when to visit|when should i go|stagione|wetter|meteo)\b/i.test(lower) && !/\b(price|cost|quote|how much|book)\b/i.test(lower)) return 'weather_seasons';
  if (/\b(ferry|azam|dar es salaam|kilimanjaro|jro|arusha|domestic flight|how do i get to zanzibar|arriving by boat|traghetto|fähre)\b/i.test(lower)) return 'ferry_flights';

  // Specific service mentions take priority over generic price/book/family intents
  const matched = matchServices(text);
  if (matched.length === 1) return 'quote';
  if (matched.length > 1 && !/^\s*(transfers?|airport transfers?|trasferimenti|flughafentransfers?)\s*$/i.test(lower.trim())) return 'quote';

  if (/\b(partner hotels?|contracted hotels?|which hotels?|recommend.*hotels?|hotel options?|accommodation options?|list hotels?|do you have hotels?|alberghi|unterkünfte)\b/i.test(lower)) return 'hotels_list';
  if (/\b(packages?|multi.?day|itineraries|pacchetti|pakete|forfaits?)\b/i.test(lower)) return 'packages_list';
  if (/\b(safaris?|mainland|great migration|tanapa|national parks?)\b/i.test(lower)) return 'safaris_list';
  if (/\b(self.?drive|rent a car|car rental|car hire|scooter|moped|motorbike|noleggio|mietwagen)\b/i.test(lower)) return 'rentals_list';
  if (/\b(marine (?:park )?fees?|conservation fees?|infrastructure tax|tourist tax|park fees?|hidden fees?|levy|tasse marine)\b/i.test(lower)) return 'fees_overview';

  if (/\b(get a quote|price|cost|how much|quote|rate|quanto costa|prezzo|preventivo|was kostet|preis|combien|prix|tarif)\b/i.test(lower)) {
    if (prof.activeSlug && prof.activeSlug !== 'general') return 'quote';
    return 'quote';
  }
  if (/\b(family|kids|children|child|toddler|teenager|famiglia|kinder|famille)\b/i.test(lower)) {
    // Follow-up guest/child update on an already-active service recalculates the quote
    if (prof.activeSlug && prof.activeSlug !== 'general' && /\b(\d+|actually|also|plus|with)\b/i.test(lower)) return 'quote';
    return 'family';
  }

  // Context-aware follow-up for party size / date / duration updates on active service
  if (prof.activeSlug && prof.activeSlug !== 'general' && /\b(\d+\s*(?:adults?|guests?|people|persons?|pax|days?|nights?)|actually\b|instead\b|what about\b)\b/i.test(lower) && !/\b(book|reserve|confirm|hold)\b/i.test(lower)) {
    return 'quote';
  }

  if (/\b(book|reserve|confirm|hold|how do i book|book an experience|book this|prenotare|buchen|réserver)\b/i.test(lower)) return 'book';
  if (/\b(show all tours|view all tours|all tours|list tours|see all tours|browse tours|tutti i tour|alle touren)\b/i.test(lower)) return 'all_tours';
  if (/\b(recommend|suggest|what should|best|popular|must.?do|plan my (zanzibar )?trip|help me plan|itinerary|consigli|empfehlen|recommander)\b/i.test(lower)) return 'recommend';

  if (/\b(transfer|transfers|airport|pickup|drop.?off|trasferiment|flughafen|aeroporto|transfert)\b/i.test(lower)) return 'transfer';
  if (/\b(visas?|insurance|health|safety|malaria|yellow.?fever|travel info|travel advice|entry requirements|dress code|currency|cash|atm|tzs|sim|esim|airalo|ramadan|tipping|visto|assicurazione|versicherung|visum)\b/i.test(lower)) return 'info';
  if (/\b(hours|open|close|when|contact|orari|öffnungszeiten)\b/i.test(lower)) return 'hours';
  if (/\b(languages?|italian|italiano|german|deutsch|french|fran[cç]ais|polish|polski|arabic|russian|driver language|guide language|multilingual|speak english|speak italian|speak german|speak french|speak polish)\b/i.test(lower)) return 'language';
  if (matched.length > 0) return 'quote';
  return 'general';
}

/** Match service slugs from text with scoring & route disambiguation across all 43 catalogue services */
function matchServices(text) {
  const raw = (text || '').trim();
  if (!raw) return [];
  const lower = raw.toLowerCase().replace(/[—–-]/g, ' ');

  const STOP_WORDS = new Set(['zanzibar', 'hotel', 'hotels', 'trip', 'day', 'the', 'and', 'with', 'from', 'per', 'vehicle', 'person', 'tour', 'tours']);

  const isAskingTransfer = /\b(transfer|airport|drive|ride|taxi|cab|pickup|drop.?off|trasferiment|aeroporto|flughafen|transfert|znz)\b/i.test(lower);
  const isAskingTour = /\b(tour|trip|excursion|walk|safari|cruise|snorkel|escursion|ausflug)\b/i.test(lower);
  const hasAirportWord = /\b(airport|znz|aeroporto|flughafen|aéroport|ferry|port)\b/i.test(lower);

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

    if (svc.type === 'transfer' && isAskingTransfer) score += 50;
    if (svc.type === 'tour' && isAskingTour) score += 50;

    // All 8 transfer routes
    if (svc.slug === 'stone-town-to-nungwi' && isAskingTransfer && !hasAirportWord && lower.includes('stone town') && (lower.includes('nungwi') || lower.includes('kendwa'))) {
      score += 550;
    }
    if (svc.slug === 'airport-transfer-znz-to-stone-town' && isAskingTransfer && (lower.includes('stone town') || lower.includes('ferry')) && !lower.includes('nungwi') && !lower.includes('kendwa')) {
      score += 450;
    }
    if (svc.slug === 'airport-transfer-znz-to-fumba' && isAskingTransfer && (lower.includes('fumba') || lower.includes('mbweni'))) {
      score += 450;
    }
    if (svc.slug === 'airport-transfer-znz-to-nungwikendwa' && isAskingTransfer && (lower.includes('nungwi') || lower.includes('kendwa')) && (hasAirportWord || !lower.includes('stone town'))) {
      score += 450;
    }
    if (svc.slug === 'airport-transfer-znz-to-pajejambiani' && isAskingTransfer && (lower.includes('paje') || lower.includes('jambiani') || lower.includes('bwejuu') || lower.includes('dongwe'))) {
      score += 450;
    }
    if (svc.slug === 'airport-transfer-znz-to-matemwe' && isAskingTransfer && (lower.includes('matemwe') || lower.includes('kiwengwa') || lower.includes('pongwe'))) {
      score += 450;
    }
    if (svc.slug === 'airport-transfer-znz-to-kizimkazi' && isAskingTransfer && (lower.includes('kizimkazi') || lower.includes('makunduchi') || lower.includes('michamvi') || lower.includes('pingwe'))) {
      score += 450;
    }
    if (svc.slug === 'full-day-island-hire' && (/\bfull.?day.*(hire|car|driver|taxi|van)\b/i.test(lower) || /\b(hire a driver|private driver for the day|8\s*hours?)\b/i.test(lower))) {
      score += 500;
    }

    // Core tours & marine excursions
    if (svc.slug === 'safari-blue' && (lower.includes('safari blue') || lower.includes('menai'))) score += 520;
    if (svc.slug === 'mnemba-snorkeling' && (lower.includes('mnemba') || lower.includes('atoll'))) score += 520;
    if (svc.slug === 'stone-town-walking-tour' && (lower.includes('stone town') || lower.includes('walking')) && !isAskingTransfer && !lower.includes('combo')) score += 450;
    if (svc.slug === 'stone-town-spice-prison-combo' && (lower.includes('combo') || (lower.includes('stone town') && lower.includes('spice') && lower.includes('prison')))) score += 550;
    if (svc.slug === 'prison-island-nakupenda' && (lower.includes('prison island') || lower.includes('changuu') || lower.includes('tortoise'))) score += 480;
    if (svc.slug === 'nakupenda-sandbank' && lower.includes('nakupenda') && !lower.includes('prison')) score += 480;
    if (svc.slug === 'chumbe-island' && lower.includes('chumbe')) score += 500;
    if (svc.slug === 'kizimkazi-dolphin-tour' && (lower.includes('kizimkazi') || (lower.includes('dolphin') && !lower.includes('mnemba')))) score += 450;
    if (svc.slug === 'spice-farm' && (lower.includes('spice farm') || lower.includes('spice tour') || lower.includes('spices') || lower.includes('vanilla') || lower.includes('gewürz') || lower.includes('spezie')) && !lower.includes('combo')) score += 450;
    if (svc.slug === 'jozani-forest' && (lower.includes('jozani') || lower.includes('colobus') || lower.includes('monkeys'))) score += 480;
    if (svc.slug === 'kuza-cave-seaweed' && ((lower.includes('kuza') && !lower.includes('maalum')) || lower.includes('seaweed'))) score += 480;
    if (svc.slug === 'village-community-tour' && (lower.includes('village tour') || lower.includes('community tour') || lower.includes('jambiani village'))) score += 450;
    if (svc.slug === 'sunset-dhow-cruise' && (lower.includes('sunset') || lower.includes('dhow cruise'))) score += 480;

    // Mainland Safaris (fixed slug: mikumi-nyerere-day-safari!)
    if (svc.slug === 'mikumi-nyerere-day-safari' && (lower.includes('mikumi') || lower.includes('day safari')) && !lower.includes('bush to beach')) score += 500;
    if (svc.slug === 'serengeti-3day-flyin' && (lower.includes('serengeti') || lower.includes('ngorongoro'))) score += 500;
    if (svc.slug === 'saadani-national-park-safari' && (lower.includes('saadani') || lower.includes('wami'))) score += 500;
    if (svc.slug === 'selous-nyerere-fly-in-safari' && (lower.includes('selous') || lower.includes('nyerere') || lower.includes('rufiji')) && !lower.includes('mikumi')) score += 500;

    // Multi-day packages & partner packages
    if (svc.slug === 'zanzibar-essentials-3day' && (lower.includes('essentials') || lower.includes('3 day package') || lower.includes('3-day package'))) score += 500;
    if (svc.slug === 'zanzibar-hidden-gems-sacred-caves' && (lower.includes('hidden gems') || lower.includes('sacred caves'))) score += 500;
    if (svc.slug === 'adrenaline-and-ocean-safari' && (lower.includes('adrenaline') || lower.includes('ocean safari'))) score += 500;
    if (svc.slug === 'bush-to-beach-vip-luxury' && (lower.includes('bush to beach') || lower.includes('vip yacht'))) score += 500;
    if (svc.slug === 'stone-town-starter' && lower.includes('stone town starter')) score += 500;
    if (svc.slug === 'spice-beach-escape' && lower.includes('spice beach escape')) score += 500;
    if (svc.slug === 'jambiani-rooftop-romance' && lower.includes('jambiani rooftop')) score += 500;
    if (svc.slug === 'south-coast-family' && lower.includes('south coast family')) score += 500;
    if (svc.slug === 'kokoni-city-sea' && lower.includes('kokoni city')) score += 500;

    // Rare Experiences
    if (svc.slug === 'horse-swimming' && (lower.includes('horse') || lower.includes('equestrian'))) score += 500;
    if (svc.slug === 'quad-buggy-safari' && (lower.includes('quad') || lower.includes('buggy') || lower.includes('atv'))) score += 500;
    if (svc.slug === 'maalum-kuza-caves' && (lower.includes('maalum') || lower.includes('cenote'))) score += 500;
    if (svc.slug === 'uzi-island-moses-road' && (lower.includes('uzi') || lower.includes('moses road'))) score += 500;
    if (svc.slug === 'cheetahs-rock' && lower.includes('cheetah')) score += 500;
    if (svc.slug === 'private-catamaran-charter' && (lower.includes('catamaran') || lower.includes('yacht charter'))) score += 500;

    // Self-drive & scooter rentals
    if (svc.slug === 'self-drive-compact' && (lower.includes('compact') || lower.includes('yaris') || lower.includes('passo') || /\b(rent a car|car rental|car hire|self drive)\b/i.test(lower)) && !lower.includes('4x4') && !lower.includes('suv') && !lower.includes('prado')) score += 450;
    if (svc.slug === 'self-drive-suv-4x4' && (lower.includes('4x4') || lower.includes('suv') || lower.includes('rav4') || lower.includes('prado') || lower.includes('escudo'))) score += 480;
    if (svc.slug === 'scooter-moped-rental' && (lower.includes('scooter') || lower.includes('moped') || lower.includes('vespa') || lower.includes('motorbike'))) score += 500;

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
  if (z.name) {
    ZONE_ALIASES[z.name.toLowerCase()] = z.slug;
    const primary = z.name.split('/')[0].trim().toLowerCase();
    if (primary) ZONE_ALIASES[primary] = z.slug;
  }
});
Object.assign(ZONE_ALIASES, {
  makunduchi: 'kizimkazi',
  pingwe: 'michamvi',
  dongwe: 'bwejuu',
  mbweni: 'fumba',
  malindi: 'stone-town',
  kokoni: 'stone-town',
  ferry: 'stone-town',
});

/* ---- Profile entity extraction from free text ---- */
const INTEREST_KEYWORDS = [
  'snorkeling', 'spice', 'safari', 'culture', 'beach', 'honeymoon', 'family',
  'diving', 'kite', 'wildlife', 'adventure', 'ocean', 'romance', 'caves',
  'horses', 'quad', 'sunset', 'history', 'nature', 'package',
];

const MONTH_MAP = {
  jan: '01', january: '01', feb: '02', february: '02', mar: '03', march: '03',
  apr: '04', april: '04', may: '05', jun: '06', june: '06', jul: '07', july: '07',
  aug: '08', august: '08', sep: '09', sept: '09', september: '09',
  oct: '10', october: '10', nov: '11', november: '11', dec: '12', december: '12',
};

function toISODateHint(text) {
  if (!text) return null;
  const iso = String(text).match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];
  const dmy = String(text).toLowerCase().match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(\d{4}))?\b/);
  if (dmy) {
    const yr = dmy[3] || String(new Date().getFullYear());
    return yr + '-' + MONTH_MAP[dmy[2]] + '-' + String(dmy[1]).padStart(2, '0');
  }
  const mdy = String(text).toLowerCase().match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?\b/);
  if (mdy) {
    const yr = mdy[3] || String(new Date().getFullYear());
    return yr + '-' + MONTH_MAP[mdy[1]] + '-' + String(mdy[2]).padStart(2, '0');
  }
  const inMonth = String(text).toLowerCase().match(/\b(?:in|for|during|on)\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/);
  if (inMonth) return String(new Date().getFullYear()) + '-' + MONTH_MAP[inMonth[1]] + '-15';
  return null;
}

function extractEntities(text, profile) {
  const lower = (text || '').toLowerCase();
  const extracted = {};

  // dates — "12 December", "next week", "March 2026", "we arrive on the 5th"
  const isoHint = toISODateHint(text);
  if (isoHint) extracted.dateISO = isoHint;
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

  // days / nights duration for rentals and hotel stays
  const daysMatch = lower.match(/\b(\d{1,2})\s*(?:days?|giorni|tage|jours|nights?|notti|nächte|nuits)\b/i);
  if (daysMatch) {
    const d = parseInt(daysMatch[1], 10);
    if (d > 0 && d <= 60) extracted.days = d;
  }

  // group_size → adults (and optionally children)
  const groupPatterns = [
    { re: /\b(\d+)\s*adults?\b/i, field: 'adults' },
    { re: /\bfamily\s+of\s+(\d+)\b/i, field: 'familyOf' },
    { re: /\bwe\s+are\s+(\d+)\b/i, field: 'adults' },
    { re: /\bjust\s+me\s+and\s+my\s+(?:wife|husband|partner)\b/i, field: 'couple' },
    { re: /\b(\d+)\s+(?:people|persons?|travell?ers?|of\s+us|pax|guests?|ospiti|personen|personnes)\b/i, field: 'adults' },
    { re: /\bcouple\b/i, field: 'couple' },
    { re: /\bjust\s+me\b/i, field: 'solo' },
    { re: /\bsolo\b/i, field: 'solo' },
  ];
  const explicitlyUpdatingAdults = /\b(\d+)\s*(?:adults?|people|persons?|travell?ers?|of\s+us|pax|guests?|ospiti|personen|personnes)\b/i.test(lower) ||
    /\bactually\s+(?:we\s+are|there\s+are|it'?s)\s+(\d+)\b/i.test(lower) ||
    /\b(\d+)\s+not\s+\d+\b/i.test(lower);
  if (!profile.adults || explicitlyUpdatingAdults) {
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
    const actuallyMatch = lower.match(/\bactually\s+(?:we\s+are|there\s+are|it'?s)\s+(\d+)\b/i);
    if (actuallyMatch) {
      const n = parseInt(actuallyMatch[1], 10);
      if (n > 0 && n <= 50) extracted.adults = n;
    }
    const notMatch = lower.match(/\b(\d+)\s+not\s+\d+\b/i);
    if (notMatch) {
      const n = parseInt(notMatch[1], 10);
      if (n > 0 && n <= 50) extracted.adults = n;
    }
  }
  const childMatch = lower.match(/\b(\d+)\s*(?:kids?|children|child|bambini|kinder|enfants)\b/i);
  if (childMatch) {
    const c = parseInt(childMatch[1], 10);
    if (c >= 0 && c <= 20) extracted.children = c;
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
  if (extracted.dateISO) merged.dateISO = extracted.dateISO;
  if (extracted.days != null) merged.days = extracted.days;
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
    else if (slug.indexOf('hotel:') === 0) {
      var stay = hotelContracts.getHotelContract(slug.slice(6));
      if (stay) tourNames.push(stay.name);
    }
  }
  const parts = ['Hi Spice & Sail! I\'d like to book: ' + (tourNames.length > 0 ? tourNames.join(', ') : 'a Zanzibar experience') + '.'];
  if (profile.name) parts.push('Name: ' + profile.name + '.');
  if (profile.dates) parts.push('Dates: ' + profile.dates + '.');
  if (profile.adults) parts.push('Group: ' + profile.adults + (profile.children ? ' adults + ' + profile.children + ' children' : ' traveller' + (profile.adults > 1 ? 's' : '')) + '.');
  if (profile.pickupZone) {
    const zoneLbl = (catalogue.zones.find(function (z) { return z.slug === profile.pickupZone; }) || {}).name || profile.pickupZone;
    parts.push('Pickup: ' + zoneLbl + '.');
  }
  return 'https://wa.me/' + BUSINESS_WHATSAPP + '?text=' + encodeURIComponent(parts.join(' '));
}

/** Build deterministic reply with quick-reply buttons */
function buildDeterministicReply(intent, text, profile, turnCount) {
  const afterHours = !isWithinBusinessHours();
  const replyWindow = CONFIG.replyWindow || 'within a few hours during business hours';
  const businessHoursLabel = getBusinessHoursLabel();

  function unitLabel(svc) {
    const p = svc.pricing || {};
    if (p.basis === 'per_vehicle') return 'per vehicle';
    if (p.basis === 'per_vehicle_per_day') return 'per vehicle/day';
    if (p.basis === 'per_scooter_per_day') return 'per scooter/day';
    if (p.basis === 'per_boat') return 'per boat';
    if (p.basis === 'per_quad') return 'per quad';
    return 'per person';
  }

  const hoursNote = (afterHours && turnCount === 1)
    ? '\n\n*Note: Our human operations desk is offline right now — messages are answered the next business morning (' + businessHoursLabel + ').*'
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

  // ---- partner hotel soft mention ----
  if (intent === 'hotel_mention') {
    const hotelMentions = hotelContracts.matchHotelContracts(text);
    if (hotelMentions.length > 0) {
      const mentionReply = hotelContracts.partnerMentionReply(hotelMentions[0]);
      if (mentionReply) return mentionReply;
    }
  }

  // ---- partner hotels directory ----
  if (intent === 'hotels_list') return hotelContracts.listPartnerHotelsReply();

  // ---- domain knowledge intents (Zanzibar & Tanzania context) ----
  if (intent === 'packages_list') return knowledge.packagesReply();
  if (intent === 'safaris_list') return knowledge.safarisReply();
  if (intent === 'rentals_list') return knowledge.rentalsReply();
  if (intent === 'weather_seasons') return knowledge.weatherSeasonsReply(text);
  if (intent === 'ferry_flights') return knowledge.ferryFlightsLogisticsReply();
  if (intent === 'fees_overview') return knowledge.feesOverviewReply();
  if (intent === 'area_guide') return knowledge.areaGuideReply(text);

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
        '• **Other Experiences (Horse swimming, Quad safari, Cenotes, etc.)**: 20% deposit locks specialist guides and equipment.\n' +
        '• **Multi-Day Packages**: 30% deposit secures your complete itinerary — balance before departure.\n' +
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
        'Our team manages all adjustments swiftly on WhatsApp: ' + BUSINESS_WHATSAPP_DISPLAY + '.' + hoursNote,
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
    const waUrl = 'https://wa.me/' + BUSINESS_WHATSAPP + '?text=' + encodeURIComponent(waMsg);
    return {
      message: '**Live Availability**\n\n' +
        (availabilityService ? 'For **' + availabilityService.name + '**, ' : '') +
        'I can\'t see the live booking calendar from this chat, so I won\'t guess. Send us the date, number of adults/children and pickup area, and our operations team will confirm availability and hold options on WhatsApp (' + BUSINESS_WHATSAPP_DISPLAY + ').\n\n[💬 Check availability on WhatsApp](' + waUrl + ')',
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
        const quote = getQuote({
          serviceSlug: targetSlug,
          adults: profile.adults || 2,
          children: profile.children || 0,
          date: profile.dateISO || null,
          pickupZone: profile.pickupZone || null,
          days: profile.days || null,
        });
        const depositPercent = svc.pricing.depositPercent || 0;
        const depositAmount = depositPercent > 0 && quote.totalLow != null ? Math.round(quote.totalLow * (depositPercent / 100)) : 0;
        
        // Build deposit notice from catalogue's authoritative depositPercent
        let depositNotice;
        if (depositPercent === 0) {
          depositNotice = svc.type === 'transfer' 
            ? '(zero advance deposit — pay your driver on arrival)'
            : '(zero advance deposit — pay on arrival)';
        } else if (depositPercent === 20) {
          if (svc.type === 'experience') {
            depositNotice = '(20% advance deposit via a DPO/Pesapal link sent on WhatsApp locks specialist guides & equipment)';
          } else if (svc.category === 'MAR') {
            depositNotice = '(20% advance deposit via a DPO/Pesapal link sent on WhatsApp locks boat captain & fresh seafood lunch, backed by our 100% Weather Guarantee)';
          } else if (svc.type === 'rental') {
            depositNotice = '(20% advance deposit holds your vehicle & prepares your temporary Zanzibar driving permit)';
          } else {
            depositNotice = '(20% advance deposit to confirm)';
          }
        } else if (depositPercent === 30) {
          if (svc.type === 'package') {
            depositNotice = '(30% advance deposit secures your complete itinerary — balance before departure)';
          } else if (svc.category === 'SAF') {
            depositNotice = '(30% advance deposit locks scheduled domestic flights & TANAPA permits)';
          } else {
            depositNotice = '(30% advance deposit to confirm)';
          }
        } else {
          depositNotice = `(${depositPercent}% advance deposit to confirm)`;
        }

        const waMsg = (svc.type === 'transfer'
          ? 'Jambo Spice & Sail! I would like to book a private transfer: ' + svc.name + (profile.dates ? ' on ' + profile.dates : '') + '.'
          : 'Jambo Spice & Sail! I would like to check availability and book ' + svc.name + ' for ' + (profile.adults || 2) + (profile.children ? ' adults + ' + profile.children + ' children' : ' guests') + (profile.dates ? ' on ' + profile.dates : '') + '.') +
          (profile.name ? ' My name is ' + profile.name + '.' : '');
        const waUrl = 'https://wa.me/' + BUSINESS_WHATSAPP + '?text=' + encodeURIComponent(waMsg);
        const inc = (svc.includes || []).join(', ') || 'Licensed guide, gear & marine fees';

        const quickReplies = svc.type === 'transfer'
          ? ['💬 Open WhatsApp to Reserve', 'Larger group?', 'How long to Nungwi?', 'Show all tours']
          : ['What is included?', '💬 Open WhatsApp', 'Check another tour', 'Airport transfers'];

        const partyLabel = (profile.adults || 2) + ' adult' + ((profile.adults || 2) > 1 ? 's' : '') + (profile.children ? ' + ' + profile.children + ' child' + (profile.children > 1 ? 'ren' : '') : '');
        const calcLine = (quote.status === 'quoted' && quote.totalDisplay)
          ? '• **Estimated Total (' + partyLabel + (profile.days ? ', ' + profile.days + ' days' : '') + '):** ' + quote.totalDisplay + (depositAmount > 0 ? ' (approx. $' + depositAmount + ' deposit)' : '') + '\n'
          : '';
        const heading = svc.type === 'transfer' ? '**Airport Transfers — ' + svc.name + '**' : '**' + svc.name + '**';

        return {
          message: heading + '\n\n' +
            '• **Planning Rate:** ' + svc.pricing.display + ' ' + unitLabel(svc) + (svc.pricing.tieredDisplay ? ' • ' + svc.pricing.tieredDisplay : '') + '\n' +
            calcLine +
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
    // Keep the featured list short, but read every name and rate from the live
    // catalogue so this summary cannot drift away from /quote.
    const featuredSlugs = [
      'safari-blue',
      'mnemba-snorkeling',
      'stone-town-walking-tour',
      'prison-island-nakupenda',
      'spice-farm',
      'jozani-forest',
      'sunset-dhow-cruise',
      'airport-transfer-znz-to-nungwikendwa'
    ];
    const featuredServices = featuredSlugs.map(getService).filter(Boolean);
    const list = featuredServices.map(function (service) {
      const price = service.pricing && service.pricing.display
        ? service.pricing.display + ' ' + unitLabel(service)
        : 'Price on request';
      const duration = service.duration ? ' (' + service.duration + ')' : '';
      return '• **' + service.name + '** — ' + price + duration;
    }).join('\n');
    return {
      message: '**Popular Zanzibar Experiences from Our Catalogue:**\n\n' + list + '\n\nWhich experience would you like to explore or get an exact quote for?' + hoursNote,
      quickReplies: featuredServices.slice(0, 3).map(function (service) { return service.name; }).concat(['Airport transfers']),
      requestContact: false,
    };
  }

  if (intent === 'recommend') {
    const recs = recommend(profile || {}, 4);
    if (recs.length > 0) {
      const list = recs.map(function (r) { return '• **' + r.name + '** — ' + r.priceDisplay + ' (' + r.duration + ')'; }).join('\n');
      return {
        message: 'Based on what you\'ve told me, here are my top suggestions:\n\n' + list + '\n\nWould you like a quote for any of these? Our team confirms availability and the final price.' + hoursNote,
        quickReplies: recs.slice(0, 3).map(function (r) { return r.name; }).concat(['Partner hotels', 'Airport transfers']),
        recommendedSlugs: recs.map(function (r) { return r.slug; }),
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
    const waUrl = 'https://wa.me/' + BUSINESS_WHATSAPP + '?text=' + encodeURIComponent(waMsg);
    
    return {
      message: '**Reserve Your Zanzibar Experience**\n\n' +
        'Our transparent booking process:\n' +
        '1. **Airport & Hotel Transfers**: Zero advance deposit — reserve with peace of mind and pay your driver on arrival.\n' +
        '2. **Sea Tours & Boat Charters (Safari Blue, Mnemba, Nakupenda, Catamaran)**: 20% confirmation deposit via a DPO or Pesapal payment link sent on WhatsApp (Visa/Mastercard) to secure your boat captain, fuel, and morning fresh seafood procurement. Balance paid on tour day.\n' +
        '3. **Fly-in Safaris**: 30% advance deposit to lock domestic flights and TANAPA national park permits.\n' +
        '4. **Other Experiences (Horse swimming, Quad safari, Cenotes, etc.)**: 20% deposit to lock specialist guides and equipment.\n' +
        '5. **Multi-Day Packages**: 30% deposit secures your complete itinerary — balance before departure.\n' +
        '6. **Captain\'s Weather Guarantee**: 100% full refund or priority reschedule if weather/sea conditions prevent sailing.\n\n' +
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
      quickReplies: transfers.slice(0, 3).map(function (service) {
        return service.name + ' (' + ((service.pricing && service.pricing.display) || 'price on request') + ')';
      }).concat(['Larger group?']),
      requestContact: false,
    };
  }

  if (intent === 'info') {
    return knowledge.entryTravelInfoReply(text);
  }

  if (intent === 'hours') {
    return {
      message: 'Our team is available **' + businessHoursLabel + '**. ' + (afterHours ? 'We\'re currently offline — messages will be answered the next business morning.' : 'We\'re online right now and reply ' + replyWindow + '.') + '\n\nYou can also reach us on WhatsApp: ' + BUSINESS_WHATSAPP_DISPLAY,
      quickReplies: ['Plan my trip', 'Get a quote'],
      requestContact: false,
    };
  }

  if (intent === 'language') {
    return {
      message: 'All standard Spice & Sail tours and private transfers are guided in fluent English and Swahili.\n\nWe also offer certified multilingual Zanzibari drivers and tour guides fluent in **Italian, German, French, Polish, Arabic, and Russian** upon advance request for an additional fee.\n\nPlease let our team know your language preference when requesting your quote so we can reserve your dedicated guide in advance.' + hoursNote,
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
  const lang = String(body.lang || profile.lang || 'en').slice(0, 2).toLowerCase();

  const intent = detectIntent(userMessage, mergedProfile);

  // 1. Deterministic engine produces the base reply and data
  const deterministicResult = buildDeterministicReply(intent, userMessage, mergedProfile, turnCount);
  let toolResults = deterministicResult.quote ? [deterministicResult.quote] : [];
  const hotelMentions = hotelContracts.matchHotelContracts(userMessage);
  if (intent === 'hotel_stay' && hotelMentions.length > 0) {
    toolResults = toolResults.concat(hotelContracts.approvedPriceSheets(hotelMentions));
  }

  // 2. Try LLM enhancement (optional)
  let finalReply = deterministicResult;
  const hasLLMKey = Boolean(process.env.GEMINI_API_KEY || (process.env.OPENAI_COMPAT_BASE_URL && process.env.OPENAI_COMPAT_API_KEY));

  if (hasLLMKey && intent !== 'hours') {
    try {
      const systemPrompt = buildSimpleSystemPrompt(mergedProfile, deterministicResult, lang);
      const llmResult = await tryLLM(systemPrompt, userMessage, toolResults, history);

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
          // If LLM invented multiple prices, prefer deterministic reply; otherwise clean
          finalReply = {
            message: guardrailCheck.violations.length > 1 ? deterministicResult.message : guardrailCheck.cleaned,
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
  const isBookingIntent = intent === 'book' || /\b(book|reserve|confirm|hold|whatsapp|prenot|buch|réserv)\b/i.test(userMessage);
  const isTerminal = isBookingIntent;

  const responseBody = {
    message: finalReply.message,
    quickReplies: finalReply.quickReplies || [],
    requestContact: false,
    quote: deterministicResult.quote || null,
    profile: mergedProfile,
    whatsapp_url: deterministicResult.whatsapp_url || null,
    intent: intent,
    matchedSlugs: matchedSlugs,
    recommendedSlugs: deterministicResult.recommendedSlugs || [],
    matchedHotels: deterministicResult.matchedHotels || hotelMentions.map(function (h) { return h.slug; }),
  };

  if (isTerminal) {
    const staySlugs = hotelMentions.map(function (h) { return 'hotel:' + h.slug; });
    const targetSlugs = [...new Set((matchedSlugs.length > 0
      ? matchedSlugs
      : (mergedProfile.activeSlug ? [mergedProfile.activeSlug] : (mergedProfile.serviceSlugs || []))).concat(staySlugs))];
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

function buildSimpleSystemPrompt(profile, deterministicResult, lang) {
  const replyWindow = CONFIG.replyWindow || 'within a few hours during business hours';
  const afterHours = !isWithinBusinessHours();
  const targetLang = ({ it: 'Italian', de: 'German', fr: 'French' })[lang] || 'English';

  return 'You are the Spice & Sail Island Concierge — a warm, expert Zanzibar & Tanzania travel consultant. ' +
    'Reply concisely and helpfully in ' + targetLang + '. Use the DETERMINISTIC DATA and GUEST PROFILE provided — never invent prices, discounts, or availability. ' +
    'Every dollar figure must come from the data below. Never say a booking is confirmed, locked, or reserved. ' +
    'Say "pending team confirmation". Our team replies ' + replyWindow + '. ' +
    (afterHours ? 'The team is offline now — mention messages are answered next business morning. ' : '') +
    'Never compare with OTAs. Never claim to be a registered tour operator. ' +
    'For insurance ($44) and hotel tax ($4-$5): say "verify current amounts on the official portal". ' +
    '\n\nGUEST PROFILE:\n' + JSON.stringify({
      adults: profile.adults || 2,
      children: profile.children || 0,
      dates: profile.dates || null,
      pickupZone: profile.pickupZone || null,
      interests: profile.interests || [],
      activeSlug: profile.activeSlug || null,
      discussed: profile.discussed_services || [],
    }) +
    '\n\nDETERMINISTIC DATA:\n' + JSON.stringify({
      suggestedReply: deterministicResult.message,
      quickReplies: deterministicResult.quickReplies,
      quote: deterministicResult.quote || null,
    }) +
    '\n\nRespond with JSON: {"message":"...","quickReplies":["..."],"requestContact":false}';
}
