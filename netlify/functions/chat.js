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

function ensureStore() {
  try { getGlobalStore(); } catch (e) {
    setGlobalStore(createStore(process.env.NETLIFY ? 'blob' : 'memory'));
  }
}

/** Deterministic intent detection */
function detectIntent(text) {
  const lower = (text || '').toLowerCase();
  if (/\b(what'?s included|what to bring|inclusions?|what do i bring|bring along)\b/.test(lower)) return 'inclusions';
  if (/\b(how do i pay|payment|pay for|payment method|pay by|mpesa|m-pesa|cash|card)\b/.test(lower)) return 'payments';
  if (/\b(honeymoon|romantic|anniversary|couples?\s+trip)\b/.test(lower)) return 'honeymoon';
  if (/\b(family|kids|children|child|toddler|teenager)\b/.test(lower)) return 'family';
  if (/\b(price|cost|how much|quote|rate)\b/.test(lower)) return 'quote';
  if (/\b(book|reserve|confirm|hold|how do i book)\b/.test(lower)) return 'book';
  if (/\b(recommend|suggest|what should|best|popular|must.?do)\b/.test(lower)) return 'recommend';
  if (/\b(transfer|airport|pickup|drop.?off)\b/.test(lower)) return 'transfer';
  if (/\b(visa|insurance|health|safety|malaria|yellow.?fever)\b/.test(lower)) return 'info';
  if (/\b(hours|open|close|when|contact)\b/.test(lower)) return 'hours';
  return 'general';
}

/** Match service slugs from text */
function matchServices(text) {
  const lower = (text || '').toLowerCase();
  const matches = [];
  for (const svc of catalogue.services) {
    const nameLower = svc.name.toLowerCase();
    // Require at least two-word match or exact slug match
    const slugWords = svc.slug.replace(/-/g, ' ');
    if (lower.includes(nameLower) || lower.includes(slugWords)) {
      matches.push(svc.slug);
    } else {
      // Try matching distinctive multi-word fragments (at least 2 words from the name)
      const nameWords = nameLower.split(/\s+/).filter(function (w) { return w.length > 3; });
      if (nameWords.length >= 2) {
        const twoWordMatch = nameWords.some(function (w, i) {
          return i < nameWords.length - 1 && lower.includes(w + ' ' + nameWords[i + 1]);
        });
        if (twoWordMatch) matches.push(svc.slug);
      }
    }
  }
  return [...new Set(matches)];
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
  if (profile.adults) count++;
  if (profile.interests && profile.interests.length > 0) count++;
  if (profile.pickupZone) count++;
  if (profile.budgetBand) count++;
  return count;
}

/** Build WhatsApp handoff URL from profile and matched services */
function buildWhatsAppUrl(profile, serviceSlugs) {
  const tourNames = [];
  for (const slug of (serviceSlugs || [])) {
    const svc = getService(slug);
    if (svc) tourNames.push(svc.name);
  }
  const parts = ['Hi Spice & Sail! I\'d like to book: ' + (tourNames.length > 0 ? tourNames.join(', ') : 'a Zanzibar experience') + '.'];
  if (profile.dates) parts.push('Dates: ' + profile.dates + '.');
  if (profile.adults) parts.push('Group: ' + profile.adults + (profile.children ? ' adults + ' + profile.children + ' children' : ' traveller' + (profile.adults > 1 ? 's' : '')) + '.');
  if (profile.pickupZone) {
    const zoneLbl = (catalogue.zones.find(function (z) { return z.slug === profile.pickupZone; }) || {}).name || profile.pickupZone;
    parts.push('Pickup: ' + zoneLbl + '.');
  }
  return 'https://wa.me/255672450934?text=' + encodeURIComponent(parts.join(' '));
}

/** Build deterministic reply with quick-reply buttons */
function buildDeterministicReply(intent, text, profile) {
  const afterHours = !isWithinBusinessHours();
  const replyWindow = CONFIG.replyWindow || 'within a few hours during business hours';

  function unitLabel(svc) {
    const p = svc.pricing || {};
    if (p.basis === 'per_vehicle') return 'per vehicle';
    if (p.basis === 'per_person') return 'per person';
    return 'per person';
  }

  const hoursNote = afterHours
    ? '\n\nOur team is offline right now — messages are answered the next business morning (Mon–Sat, 08:00–18:00 EAT).'
    : '';

  // ---- inclusions intent ----
  if (intent === 'inclusions') {
    const slugs = matchServices(text);
    if (slugs.length > 0) {
      const svc = getService(slugs[0]);
      if (svc) {
        const inc = (svc.includes || []).join(', ') || 'Our team confirms what is included.';
        const notes = (svc.importantNotes || []).map(function (n) { return '• ' + n; }).join('\n');
        return {
          message: '**' + svc.name + ' — What\'s included:**\n' + inc + (notes ? '\n\n**What to bring / notes:**\n' + notes : '') + hoursNote,
          quickReplies: ['Get a quote for this', 'See other options', 'Book this'],
          requestContact: false,
        };
      }
    }
    return {
      message: 'Which experience would you like to know about? Tell me the tour name and I\'ll list what\'s included and what to bring.' + hoursNote,
      quickReplies: ['Safari Blue', 'Mnemba snorkeling', 'Stone Town tour', 'Sunset dhow cruise'],
      requestContact: false,
    };
  }

  // ---- payments intent ----
  if (intent === 'payments') {
    return {
      message: '**Payment methods:**\n\n• **Cash (USD)**: accepted on the day of the tour — bring clean, post-2013 bills\n• **Mobile money (M-Pesa/Tigo Pesa)**: our team sends you the number after booking\n• **Bank transfer**: for advance bookings, our team provides account details\n\nAll prices are quoted in USD. No online payment processing on the website — our team confirms everything via WhatsApp.' + hoursNote,
      quickReplies: ['Plan my trip', 'Get a quote', 'Book an experience'],
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

  if (intent === 'quote') {
    const slugs = matchServices(text);
    if (slugs.length > 0) {
      const svc = getService(slugs[0]);
      if (svc && svc.pricing && svc.pricing.min != null) {
        const quote = getQuote({ serviceSlug: slugs[0], adults: profile.adults || 2 });
        return {
          message: '**' + svc.name + '**\n\nPlanning range: ' + svc.pricing.display + ' ' + unitLabel(svc) + '.\nThis is a planning range — our team confirms the final price, ' + replyWindow + '.' + hoursNote,
          quickReplies: ['Request to hold this', 'See other options', 'Ask a question'],
          requestContact: false,
          quote: quote,
        };
      }
    }
    return {
      message: 'I can help with pricing! Which experience are you interested in? Here are our most popular options:' + hoursNote,
      quickReplies: ['Safari Blue', 'Mnemba snorkeling', 'Stone Town tour', 'Airport transfer', 'Show all tours'],
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
    return {
      message: 'I\'d love to help you with that! To send your request to our team, I\'ll need a few details. A short form will appear below — fill in your name, contact, and preferred date, and our team will confirm everything, ' + replyWindow + '.' + hoursNote,
      quickReplies: [],
      requestContact: true,
    };
  }

  if (intent === 'transfer') {
    const transfers = catalogue.services.filter(function (s) { return s.type === 'transfer'; });
    const list = transfers.map(function (t) { return '• **' + t.name + '** — ' + t.pricing.display + ' ' + unitLabel(t); }).join('\n');
    return {
      message: '**Airport Transfers**\n\n' + list + '\n\nAll transfers include meet & greet, flight tracking, and private vehicle (up to 4 guests). Our team confirms your booking.' + hoursNote,
      quickReplies: ['Request a transfer', 'How long to Nungwi?', 'Larger group?'],
      requestContact: false,
    };
  }

  if (intent === 'info') {
    return {
      message: 'Here\'s what I can tell you:\n\n• **Visa**: Most nationalities get a visa on arrival at ZNZ airport ($50 USD)\n• **Insurance**: Zanzibar mandatory inbound insurance is approximately $44/person — verify current amounts on the official portal (visitzanzibar.go.tz)\n• **Hotel tax**: Approximately $4–$5/person/night, collected directly by your hotel — verify current amounts on the official portal\n• **Health**: Consult your doctor about malaria prophylaxis. Yellow fever certificate required if arriving from an endemic country.\n\n_For official and up-to-date information, please check the government portals directly._' + hoursNote,
      quickReplies: ['Plan my trip', 'Get a quote', 'Ask something else'],
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

  // General / greeting
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

  // Track matched services across conversation
  const matchedSlugs = matchServices(userMessage);
  if (matchedSlugs.length > 0) {
    mergedProfile.serviceSlugs = [...new Set((mergedProfile.serviceSlugs || []).concat(matchedSlugs))];
  }

  // Count conversation turns from history
  const turnCount = Math.floor(history.length / 2) + 1;

  const intent = detectIntent(userMessage);

  // 1. Deterministic engine produces the base reply and data
  const deterministicResult = buildDeterministicReply(intent, userMessage, mergedProfile);
  const toolResults = deterministicResult.quote ? [deterministicResult.quote] : [];

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

  // Terminal response: booking intent OR explicit "book" / "how do i book" OR 3+ turns with profile populated
  const isBookingIntent = intent === 'book' || /\bhow do i book\b/i.test(userMessage);
  const profilePopulated = profileCompleteness(mergedProfile) >= 2;
  const isTerminal = isBookingIntent || (turnCount >= 3 && profilePopulated);

  const responseBody = {
    message: finalReply.message,
    quickReplies: finalReply.quickReplies || [],
    requestContact: false,
    quote: deterministicResult.quote || null,
    profile: mergedProfile,
  };

  if (isTerminal) {
    responseBody.whatsapp_url = buildWhatsAppUrl(mergedProfile, mergedProfile.serviceSlugs || matchedSlugs);
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
