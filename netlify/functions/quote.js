/**
 * Quote endpoint — server-computed planning range from the catalogue.
 * Never accepts a client total.
 */
'use strict';

const { corsHeaders, isAllowedOrigin } = require('../../src/lib/concierge/security');
const { getQuote, quotePlan } = require('../../src/lib/concierge/pricing');

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

  // Plan quote (multiple services)
  if (body.serviceSlugs && Array.isArray(body.serviceSlugs)) {
    const result = quotePlan(body.serviceSlugs, body.adults || 2, body.children || 0);
    return { statusCode: 200, headers: headers, body: JSON.stringify(result) };
  }

  // Single service quote
  if (!body.serviceSlug || typeof body.serviceSlug !== 'string') {
    return { statusCode: 400, headers: headers, body: JSON.stringify({ error: 'serviceSlug is required' }) };
  }

  const result = getQuote({
    serviceSlug: body.serviceSlug,
    adults: body.adults || 2,
    children: body.children || 0,
    date: body.date || null,
    pickupZone: body.pickupZone || null,
  });

  return { statusCode: 200, headers: headers, body: JSON.stringify(result) };
};
