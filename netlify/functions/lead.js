/**
 * Lead capture endpoint — Netlify function.
 * Validate → idempotency check → save first → alerts → respond.
 * Response is 201 with { reference } only after save succeeds.
 */
'use strict';

const { validateLead, isPayloadTooLarge, normalizeE164 } = require('../../src/lib/concierge/validate');
const { corsHeaders, checkRateLimit, checkBotSignals, getClientIP, isAllowedOrigin } = require('../../src/lib/concierge/security');
const { generateReference } = require('../../src/lib/concierge/reference');
const { getGlobalStore, createStore, setGlobalStore } = require('../../src/lib/concierge/store');
const { CONFIG } = require('../../src/lib/concierge/catalogue');
const crypto = require('crypto');

// Ensure store is initialized
function ensureStore() {
  try { getGlobalStore(); } catch (e) {
    setGlobalStore(createStore(process.env.NETLIFY ? 'blob' : 'memory'));
  }
}

/** Build reply link server-side: wa.me or mailto */
function buildReplyLink(ref, whatsapp, email) {
  if (whatsapp) {
    const num = normalizeE164(whatsapp).replace('+', '');
    const msg = encodeURIComponent('Hi! My reference is ' + ref + '. I would like to follow up on my enquiry.');
    return 'https://wa.me/' + num + '?text=' + msg;
  }
  if (email) {
    return 'mailto:' + email + '?subject=' + encodeURIComponent('Spice & Sail Enquiry ' + ref);
  }
  return null;
}

/** Hash payload for idempotency */
function payloadHash(body) {
  const key = JSON.stringify({ n: body.name, w: body.whatsapp, e: body.email, s: body.services, d: body.date });
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
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
    (lead.services ? 'Services: ' + lead.services + '\n' : '');

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
  const hash = payloadHash(body);
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
    notes: body.notes ? body.notes.slice(0, 2000) : null,
    consent_contact: true,
    consent_marketing: body.consent_marketing === true || body.consent_marketing === 'true',
    privacy_notice_version: body.privacy_notice_version || CONFIG.privacyNoticeVersion || '1.0',
    status: 'request_received',
    alert_status: 'pending',
    created_at: new Date().toISOString(),
    ip_hash: crypto.createHash('sha256').update(ip).digest('hex').slice(0, 8),
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
