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
  if (/\b(price|cost|how much|quote|rate)\b/.test(lower)) return 'quote';
  if (/\b(book|reserve|confirm|hold)\b/.test(lower)) return 'book';
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
    const terms = [svc.slug.replace(/-/g, ' '), svc.name.toLowerCase()];
    for (const term of terms) {
      if (lower.includes(term) || lower.includes(term.split(' ')[0])) {
        matches.push(svc.slug);
        break;
      }
    }
  }
  return [...new Set(matches)];
}

/** Build deterministic reply with quick-reply buttons */
function buildDeterministicReply(intent, text, profile) {
  const afterHours = !isWithinBusinessHours();
  const replyWindow = CONFIG.replyWindow || 'within a few hours during business hours';

  const hoursNote = afterHours
    ? '\n\nOur team is offline right now — messages are answered the next business morning (Mon–Sat, 08:00–18:00 EAT).'
    : '';

  if (intent === 'quote') {
    const slugs = matchServices(text);
    if (slugs.length > 0) {
      const svc = getService(slugs[0]);
      if (svc && svc.pricing && svc.pricing.min != null) {
        const quote = getQuote({ serviceSlug: slugs[0], adults: profile.adults || 2 });
        return {
          message: '**' + svc.name + '**\n\nPlanning range: ' + svc.pricing.display + ' per person.\nThis is a planning range — our team confirms the final price, ' + replyWindow + '.' + hoursNote,
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
    const list = transfers.map(function (t) { return '• **' + t.name + '** — ' + t.pricing.display; }).join('\n');
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

  const profile = body.profile || {};
  const intent = detectIntent(userMessage);

  // 1. Deterministic engine produces the base reply and data
  const deterministicResult = buildDeterministicReply(intent, userMessage, profile);
  const toolResults = deterministicResult.quote ? [deterministicResult.quote] : [];

  // 2. Try LLM enhancement (optional)
  let finalReply = deterministicResult;
  const hasLLMKey = Boolean(process.env.GEMINI_API_KEY || (process.env.OPENAI_COMPAT_BASE_URL && process.env.OPENAI_COMPAT_API_KEY));

  if (hasLLMKey && intent !== 'hours') {
    try {
      const systemPrompt = buildSimpleSystemPrompt(profile, deterministicResult);
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

  return {
    statusCode: 200,
    headers: headers,
    body: JSON.stringify({
      message: finalReply.message,
      quickReplies: finalReply.quickReplies || [],
      requestContact: finalReply.requestContact || false,
      quote: deterministicResult.quote || null,
    }),
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
