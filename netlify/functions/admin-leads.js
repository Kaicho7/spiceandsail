/**
 * Admin leads endpoint — staff only.
 * Protected by STAFF_PASSCODE (no default — 503 if unset).
 * Constant-time compare, rate limited.
 */
'use strict';

const crypto = require('crypto');
const { corsHeaders, checkRateLimit, getClientIP, isAllowedOrigin } = require('../../src/lib/concierge/security');
const { getGlobalStore, createStore, setGlobalStore } = require('../../src/lib/concierge/store');
const { normalizeE164 } = require('../../src/lib/concierge/validate');

function ensureStore() {
  try { getGlobalStore(); } catch (e) {
    setGlobalStore(createStore(process.env.NETLIFY ? 'blob' : 'memory'));
  }
}

/** Constant-time string comparison */
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Still do a comparison to avoid timing leaks on length
    crypto.timingSafeEqual(bufA, Buffer.alloc(bufA.length));
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Build a WhatsApp-ready staff brief */
function buildWhatsAppBrief(lead) {
  const lines = ['📋 *Lead ' + lead.reference + '*'];
  lines.push('Name: ' + lead.name);
  if (lead.whatsapp) lines.push('WhatsApp: ' + lead.whatsapp);
  if (lead.email) lines.push('Email: ' + lead.email);
  if (lead.date) lines.push('Date: ' + lead.date);
  if (lead.travellers) lines.push('Travellers: ' + lead.travellers);
  if (lead.services) lines.push('Services: ' + lead.services);
  if (lead.notes) lines.push('Notes: ' + lead.notes);
  lines.push('Status: ' + lead.status);
  lines.push('Created: ' + lead.created_at);
  return lines.join('\n');
}

exports.handler = async function (event) {
  const origin = event.headers && event.headers.origin;
  const headers = corsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: headers, body: '' };
  }

  // Staff passcode check — MUST be set, no default
  const staffPasscode = process.env.STAFF_PASSCODE;
  if (!staffPasscode) {
    return { statusCode: 503, headers: headers, body: JSON.stringify({ error: 'Staff access not configured' }) };
  }

  ensureStore();
  const store = getGlobalStore();

  // Rate limit: 20 requests per IP per hour
  const ip = getClientIP(event);
  const rl = await checkRateLimit(ip, 'admin', 20, 3600000, store);
  if (!rl.allowed) {
    return { statusCode: 429, headers: headers, body: JSON.stringify({ error: 'Too many requests' }) };
  }

  // Auth check
  const authHeader = event.headers && (event.headers.authorization || event.headers.Authorization);
  if (!authHeader) {
    return { statusCode: 401, headers: headers, body: JSON.stringify({ error: 'Authorization required' }) };
  }

  const providedCode = authHeader.replace(/^Bearer\s+/i, '');
  if (!timingSafeEqual(providedCode, staffPasscode)) {
    return { statusCode: 401, headers: headers, body: JSON.stringify({ error: 'Invalid passcode' }) };
  }

  // GET: list leads newest first
  if (event.httpMethod === 'GET') {
    try {
      const allLeads = await store.list('lead:');
      const leads = [];
      for (const item of allLeads) {
        try {
          const lead = await store.getJSON(item.key);
          if (lead && lead.reference) leads.push(lead);
        } catch (e) { /* skip unreadable */ }
      }
      leads.sort(function (a, b) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      return {
        statusCode: 200,
        headers: headers,
        body: JSON.stringify({
          count: leads.length,
          leads: leads.map(function (l) {
            return {
              reference: l.reference,
              name: l.name,
              status: l.status,
              date: l.date,
              travellers: l.travellers,
              services: l.services,
              alert_status: l.alert_status,
              created_at: l.created_at,
              whatsapp_brief: buildWhatsAppBrief(l),
            };
          }),
        }),
      };
    } catch (e) {
      return { statusCode: 503, headers: headers, body: JSON.stringify({ error: 'Unable to list leads' }) };
    }
  }

  // PATCH: update status
  if (event.httpMethod === 'PATCH' || event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body); } catch (e) {
      return { statusCode: 400, headers: headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    if (!body.reference) {
      return { statusCode: 400, headers: headers, body: JSON.stringify({ error: 'Reference required' }) };
    }

    try {
      const lead = await store.getJSON('lead:' + body.reference);
      if (!lead) {
        return { statusCode: 404, headers: headers, body: JSON.stringify({ error: 'Lead not found' }) };
      }

      if (body.status) lead.status = body.status;
      if (body.notes) lead.staff_notes = body.notes;
      lead.updated_at = new Date().toISOString();

      await store.setJSON('lead:' + body.reference, lead);

      return {
        statusCode: 200,
        headers: headers,
        body: JSON.stringify({ reference: lead.reference, status: lead.status, whatsapp_brief: buildWhatsAppBrief(lead) }),
      };
    } catch (e) {
      return { statusCode: 503, headers: headers, body: JSON.stringify({ error: 'Unable to update lead' }) };
    }
  }

  // DELETE: remove lead (for test cleanup)
  if (event.httpMethod === 'DELETE') {
    let body;
    try { body = JSON.parse(event.body); } catch (e) {
      return { statusCode: 400, headers: headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }
    if (body.reference) {
      try {
        await store.delete('lead:' + body.reference);
        return { statusCode: 200, headers: headers, body: JSON.stringify({ deleted: true }) };
      } catch (e) { /* ignore */ }
    }
    return { statusCode: 400, headers: headers, body: JSON.stringify({ error: 'Reference required' }) };
  }

  return { statusCode: 405, headers: headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};
