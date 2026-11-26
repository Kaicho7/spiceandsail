/**
 * Lead capture endpoint — platform-neutral handler.
 * Normalise widget payload → validate → idempotency check → save first → alerts → respond.
 * Response is 201 with { reference } only after save succeeds.
 *
 * PATCH NOTE: the live widget (public/js/concierge-v2.js) sends camelCase and
 * extra fields (consentContact, serviceSlugs, adults, children, ...). The
 * validator has a strict allowlist, so every submit used to fail with 400.
 * normalizeLeadBody() maps the widget payload onto the allowlisted schema
 * BEFORE validation. Validation rules themselves are unchanged.
 */
'use strict';

const { validateLead, isPayloadTooLarge, normalizeE164, ALLOWED_FIELDS } = require('../concierge/validate');
const { corsHeaders, checkRateLimit, checkBotSignals, getClientIP, isAllowedOrigin } = require('../concierge/security');
const { generateReference } = require('../concierge/reference');
const { getGlobalStore, createStore, setGlobalStore } = require('../concierge/store');
const { CONFIG } = require('../concierge/catalogue');
const { sha256Hex } = require('../concierge/webcrypto');

// Ensure store is initialized
function ensureStore() {
  try { getGlobalStore(); } catch (e) {
    setGlobalStore(createStore('memory'));
  }
}

function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : null;
}

/**
 * Map the widget payload onto the server's allowlisted lead schema.
 * - keeps only allowlisted fields (extra widget fields are dropped, not rejected)
 * - consentContact/consentMarketing -> consent_contact/consent_marketing
 * - adults + children -> travellers
 * - serviceSlugs[] / hotelSlug -> services (comma separated)
 * - 00-prefixed numbers -> +prefixed
 * - over-long notes are truncated instead of rejected
 * Already-correct payloads pass through unchanged.
 */
function normalizeLeadBody(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;

  const out = {};
  for (const key of ALLOWED_FIELDS) {
    if (raw[key] !== undefined) out[key] = raw[key];
  }

  if (out.consent_contact === undefined && raw.consentContact !== undefined) {
    out.consent_contact = raw.consentContact;
  }
  if (out.consent_marketing === undefined && raw.consentMarketing !== undefined) {
    out.consent_marketing = raw.consentMarketing;
  }

  if (out.travellers === undefined && (raw.adults !== undefined || raw.children !== undefined)) {
    const total = (toInt(raw.adults) || 0) + (toInt(raw.children) || 0);
    if (total > 0) out.travellers = total;
  }

  if (out.services === undefined) {
    const slugs = [];
    if (Array.isArray(raw.serviceSlugs)) {
      raw.serviceSlugs.forEach(function (s) {
        if (typeof s === 'string' && s.trim()) slugs.push(s.trim().slice(0, 100));
      });
    }
    if (typeof raw.hotelSlug === 'string' && raw.hotelSlug.trim()) {
      slugs.push('hotel:' + raw.hotelSlug.trim().slice(0, 100));
    }
    if (slugs.length) out.services = slugs.join(', ').slice(0, 500);
  }

  if (typeof out.whatsapp === 'string') {
    let w = out.whatsapp.trim();
    if (/^00\d/.test(w)) w = '+' + w.slice(2);
    out.whatsapp = w;
  }

  if (typeof out.notes === 'string' && out.notes.length > 2000) {
    out.notes = out.notes.slice(0, 2000);
  }

  return out;
}

/** Build reply link server-side: always targets Spice & Sail business channels */
function buildReplyLink(ref, whatsapp, email) {
  const businessNumber = (CONFIG && CONFIG.whatsappNumber) ? CONFIG.whatsappNumber : '255707939265';
  const businessEmail = (CONFIG && CONFIG.businessEmail) ? CONFIG.businessEmail : 'philip.jumbe@spiceandsail.com';
  if (whatsapp) {
    const msg = encodeURIComponent('Hi Spice & Sail! My reference is ' + ref + '. I would like to follow up on my enquiry.');
    return 'https://wa.me/' + businessNumber + '?text=' + msg;
  }
  if (email) {
    return 'mailto:' + businessEmail + '?subject=' + encodeURIComponent('Spice & Sail Enquiry ' + ref);
  }
  return null;
}

/** Hash payload for idempotency — includes passengers & notes to avoid stale duplicate collisions */
async function payloadHash(body) {
  const key = JSON.stringify({
    n: body.name,
    w: body.whatsapp,
    e: body.email,
    s: body.services,
    d: body.date,
    t: body.travellers,
    notes: body.notes
  });
  return (await sha256Hex(key)).slice(0, 16);
}

/** Try to send alerts (best-effort, never blocks save) */
async function sendAlerts(lead, reference) {
  const results = [];
  const webhookUrls = [
    process.env.WHATSAPP_OPS_WEBHOOK_URL,
    process.env.OPS_WEBHOOK_URL,
    process.env.DISCORD_WEBHOOK_URL,
    process.env.SLACK_WEBHOOK_URL,
  ].filter(Boolean);

  const brief = '🔔 New Lead: ' + reference + '\n' +
    'Name: ' + lead.name + '\n' +
    (lead.whatsapp ? 'WhatsApp: [redacted]\n' : '') +
    (lead.email ? 'Email: [redacted]\n' : '') +
    (lead.date ? 'Date: ' + lead.date + '\n' : '') +
    (lead.travellers ? 'Travellers: ' + lead.travellers + '\n' : '') +
    (lead.services ? 'Services: ' + lead.services + '\n' : '') +
    (lead.nights ? 'Hotel nights: ' + lead.nights + '\n' : '') +
    (lead.rooms ? 'Hotel rooms: ' + lead.rooms + '\n' : '');

  for (const url of webhookUrls) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: brief, content: brief }),
        signal: AbortSignal.timeout(5000),
      });
      results.push({ url: '[webhook]', status: resp.ok ? 'sent' : 'failed' });
    } catch (e) {
      results.push({ url: '[webhook]', status: 'error' });
    }
  }

  // Email alert via Resend if configured
  if (process.env.RESEND_API_KEY && process.env.ALERT_EMAIL) {
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY },
        body: JSON.stringify({
          from: 'alerts@spiceandsail.com',
          to: process.env.ALERT_EMAIL,
          subject: 'New Lead: ' + reference,
          text: brief,
        }),
        signal: AbortSignal.timeout(5000),
      });
      results.push({ channel: 'email', status: resp.ok ? 'sent' : 'failed' });
    } catch (e) {
      results.push({ channel: 'email', status: 'error' });
    }
  }

  return results.length > 0 ? (results.some(r => r.status === 'sent') ? 'sent' : 'failed') : 'unconfigured';
}

exports.handler = async function (event) {
  const origin = event.headers && event.headers.origin;
  const headers = corsHeaders(origin);

  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Origin check
  if (origin && !isAllowedOrigin(origin)) {
    return { statusCode: 403, headers: headers, body: JSON.stringify({ error: 'Origin not allowed' }) };
  }

  // Payload size check
  if (isPayloadTooLarge(event.body)) {
    return { statusCode: 413, headers: headers, body: JSON.stringify({ error: 'Payload too large' }) };
  }

  ensureStore();
  const store = getGlobalStore();

  // Rate limit: 10 requests per IP per hour
  const ip = getClientIP(event);
  const rl = await checkRateLimit(ip, 'lead', 10, 3600000, store);
  if (!rl.allowed) {
    return { statusCode: 429, headers: headers, body: JSON.stringify({ error: 'Too many requests. Please try again later.' }) };
  }

  // Parse body
  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, headers: headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { statusCode: 400, headers: headers, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  // Map the widget's payload shape onto the allowlisted schema
  body = normalizeLeadBody(body);

  // Bot check
  const botCheck = checkBotSignals(body);
  if (botCheck.isBot) {
    return { statusCode: 422, headers: headers, body: JSON.stringify({ error: 'Submission rejected' }) };
  }

  // Validate
  const validation = validateLead(body);
  if (!validation.valid) {
    return { statusCode: 400, headers: headers, body: JSON.stringify({ error: 'Validation failed', details: validation.errors }) };
  }

  // Idempotency: session_id + payload hash
  const sessionId = body.session_id || 'anon';
  const hash = await payloadHash(body);
  const idempotencyKey = 'idem:' + sessionId + ':' + hash;

  try {
    const existing = await store.getJSON(idempotencyKey);
    if (existing && existing.reference) {
      // Double submit — return same reference, don't create new lead
      return {
        statusCode: 201,
        headers: headers,
        body: JSON.stringify({
          reference: existing.reference,
          reply_link: existing.reply_link,
          status: 'request_received',
        }),
      };
    }
  } catch (e) { /* store read failed, continue with new lead */ }

  // Generate reference
  let reference;
  try {
    reference = await generateReference(store);
  } catch (e) {
    return { statusCode: 503, headers: headers, body: JSON.stringify({ error: 'Unable to generate reference. Please try again.' }) };
  }

  // Build the lead record
  const lead = {
    reference: reference,
    name: body.name.trim(),
    whatsapp: body.whatsapp ? normalizeE164(body.whatsapp) : null,
    email: body.email ? body.email.trim().toLowerCase() : null,
    date: body.date || null,
    travellers: body.travellers ? Number(body.travellers) : null,
    services: body.services || null,
    nights: body.nights ? Number(body.nights) : null,
    rooms: body.rooms ? Number(body.rooms) : null,
    notes: body.notes ? body.notes.slice(0, 2000) : null,
    consent_contact: true,
    consent_marketing: body.consent_marketing === true || body.consent_marketing === 'true',
    privacy_notice_version: body.privacy_notice_version || CONFIG.privacyNoticeVersion || '1.0',
    status: 'request_received',
    alert_status: 'pending',
    created_at: new Date().toISOString(),
    ip_hash: (await sha256Hex(ip)).slice(0, 8),
    session_id: sessionId,
  };

  // SAVE FIRST — lead must be stored before any alert attempt
  try {
    await store.setJSON('lead:' + reference, lead);
  } catch (e) {
    // Save failed — return 503, never show success
    return { statusCode: 503, headers: headers, body: JSON.stringify({ error: 'Unable to save your enquiry. Please try again or contact us via WhatsApp.' }) };
  }

  // Build reply link
  const replyLink = buildReplyLink(reference, lead.whatsapp, lead.email);

  // Store idempotency record
  try {
    await store.setJSON(idempotencyKey, { reference: reference, reply_link: replyLink });
  } catch (e) { /* non-critical */ }

  // ALERTS SECOND — best effort, never blocks
  let alertStatus = 'unconfigured';
  try {
    alertStatus = await sendAlerts(lead, reference);
  } catch (e) {
    alertStatus = 'error';
  }

  // Update lead with alert status
  try {
    lead.alert_status = alertStatus;
    await store.setJSON('lead:' + reference, lead);
  } catch (e) { /* non-critical */ }

  return {
    statusCode: 201,
    headers: headers,
    body: JSON.stringify({
      reference: reference,
      reply_link: replyLink,
      status: 'request_received',
    }),
  };
};

exports.normalizeLeadBody = normalizeLeadBody;
