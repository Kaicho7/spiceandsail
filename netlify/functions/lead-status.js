/**
 * Lead status endpoint — reference + matching contact required.
 */
'use strict';

const { corsHeaders, isAllowedOrigin } = require('../../src/lib/concierge/security');
const { getGlobalStore, createStore, setGlobalStore } = require('../../src/lib/concierge/store');

function ensureStore() {
  try { getGlobalStore(); } catch (e) {
    setGlobalStore(createStore(process.env.NETLIFY ? 'blob' : 'memory'));
  }
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

  let body;
  try { body = JSON.parse(event.body); } catch (e) {
    return { statusCode: 400, headers: headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  if (!body.reference || typeof body.reference !== 'string') {
    return { statusCode: 400, headers: headers, body: JSON.stringify({ error: 'Reference is required' }) };
  }

  if (!body.contact || typeof body.contact !== 'string') {
    return { statusCode: 400, headers: headers, body: JSON.stringify({ error: 'Contact detail is required for verification' }) };
  }

  ensureStore();
  const store = getGlobalStore();

  try {
    const lead = await store.getJSON('lead:' + body.reference);
    if (!lead) {
      return { statusCode: 404, headers: headers, body: JSON.stringify({ error: 'Reference not found' }) };
    }

    // Verify contact matches
    const contact = body.contact.trim().toLowerCase();
    const matchesWhatsApp = lead.whatsapp && lead.whatsapp.replace(/[\s\-+]/g, '') === contact.replace(/[\s\-+]/g, '');
    const matchesEmail = lead.email && lead.email.toLowerCase() === contact;

    if (!matchesWhatsApp && !matchesEmail) {
      return { statusCode: 403, headers: headers, body: JSON.stringify({ error: 'Contact does not match this reference' }) };
    }

    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify({ reference: lead.reference, status: lead.status }),
    };
  } catch (e) {
    return { statusCode: 503, headers: headers, body: JSON.stringify({ error: 'Service temporarily unavailable' }) };
  }
};
