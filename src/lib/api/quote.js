/**
 * Quote endpoint — server-computed planning range from the catalogue.
 * Never accepts a client total.
 */
'use strict';

const { corsHeaders, isAllowedOrigin } = require('../concierge/security');
const { getQuote, quotePlan } = require('../concierge/pricing');
const { catalogue, CATALOGUE_VERSION, CONFIG } = require('../concierge/catalogue');
const {
  publicHotelRates,
  publicFromRate,
  packageServices,
} = require('../concierge/public-data');

exports.handler = async function (event) {
  const origin = event.headers && event.headers.origin;
  const headers = corsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: headers, body: '' };
  }

  // GET: the service list straight from the catalogue, so the browser never
  // hard-codes slugs or prices.
  if (event.httpMethod === 'GET') {
    const services = (catalogue.services || []).map(function (s) {
      const p = s.pricing || {};
      const onRequest = p.basis === 'on_request' || p.min == null || p.max == null;
      return {
        slug: s.slug,
        name: s.name,
        type: s.type,
        category: s.category,
        location: s.location,
        duration: s.duration || '',
        description: s.description || s.shortDescription || '',
        shortDescription: s.shortDescription || '',
        priceDisplay: onRequest ? null : p.display,
        onRequest: onRequest,
        basis: p.basis || null,
        basisNote: p.basisNote || '',
        tieredDisplay: p.tieredDisplay || null,
        includes: s.includes || [],
      };
    });

    const packages = packageServices().map(function (s) {
      const p = s.pricing || {};
      return {
        slug: s.slug,
        id: s.id || null,
        name: s.name,
        hotelSlug: s.hotelSlug,
        nights: s.nights || null,
        duration: s.duration || '',
        shortDescription: s.shortDescription || '',
        includes: s.includes || [],
        pricing: {
          basis: p.basis || null,
          basisNote: p.basisNote || '',
          min: p.min == null ? null : p.min,
          max: p.max == null ? null : p.max,
          display: p.display || null,
        },
      };
    });

    const catalogueHotels = new Map((catalogue.hotels || []).map(function (h) {
      return [h.slug, h];
    }));
    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify({
        version: CATALOGUE_VERSION,
        currency: 'USD',
        whatsappNumber: CONFIG.whatsappNumber || '255672450934',
        privacyNoticeVersion: CONFIG.privacyNoticeVersion || '1.0',
        replyWindow: CONFIG.replyWindow || 'within business hours',
        services: services,
        packages: packages,
        hotels: (publicHotelRates.hotels || []).map(function (h) {
          const catHotel = catalogueHotels.get(h.slug) || {};
          return {
            slug: 'hotel:' + h.slug,
            hotelSlug: h.slug,
            name: h.name,
            area: h.area,
            board: h.board,
            ratesStatus: h.ratesStatus || catHotel.contractStatus || null,
            fromRate: publicFromRate(h),
            pricingDisplay: (catHotel.pricing && catHotel.pricing.display) || null,
            taxPerPersonPerNight: h.taxPerPersonPerNight,
            roomTypes: (h.rooms || []).map(function (r) { return r.type; })
          };
        }),
      }),
    };
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
    const result = quotePlan(body.serviceSlugs, body.adults || 2, body.children || 0, {
      date: body.date || null,
      pickupZone: body.pickupZone || null,
      nights: body.nights || null,
      rooms: body.rooms || null,
      roomType: body.roomType || null,
    });
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
