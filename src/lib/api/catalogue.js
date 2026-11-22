/**
 * Catalogue API endpoint for concierge widget v2
 * Returns filtered catalogue data for client-side rendering
 */
'use strict';

const { corsHeaders, isAllowedOrigin, checkRateLimit, getClientIP } = require('../concierge/security');
const { getGlobalStore, createStore, setGlobalStore } = require('../concierge/store');
const { catalogue, CONFIG } = require('../concierge/catalogue');
const { publicHotelRates, publicFromRate } = require('../concierge/public-data');

function ensureStore() {
  try { getGlobalStore(); } catch (e) {
    setGlobalStore(createStore('memory'));
  }
}

exports.handler = async function (event) {
  const origin = event.headers && event.headers.origin;
  const headers = corsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (origin && !isAllowedOrigin(origin)) {
    return { statusCode: 403, headers: headers, body: JSON.stringify({ error: 'Origin not allowed' }) };
  }

  ensureStore();
  const store = getGlobalStore();

  const ip = getClientIP(event);
  const rl = await checkRateLimit(ip, 'catalogue', 60, 60000, store);
  if (!rl.allowed) {
    return { statusCode: 429, headers: headers, body: JSON.stringify({ error: 'Too many requests' }) };
  }

  // Filter services for widget display (exclude hotels, internal types)
  const widgetServices = (catalogue.services || []).filter(s => 
    ['tour', 'experience', 'package', 'transfer'].includes(s.type) && s.pricing?.verified !== false
  ).map(s => ({
    slug: s.slug,
    name: s.name,
    type: s.type,
    category: s.category,
    duration: s.duration,
    location: s.location,
    zones: s.zones,
    pricing: s.pricing ? {
      basis: s.pricing.basis,
      min: s.pricing.min,
      max: s.pricing.max,
      display: s.pricing.display,
      tieredDisplay: s.pricing.tieredDisplay,
      basisNote: s.pricing.basisNote,
      childRate: s.pricing.childRate
    } : null,
    includes: s.includes,
    importantNotes: s.importantNotes,
    interests: s.interests,
    timeOfDay: s.timeOfDay
  }));

  // 5 confirmed partner hotels — public display data only (never net rates).
  const publicHotels = new Map((publicHotelRates.hotels || []).map(h => [h.slug, h]));
  const widgetHotels = (catalogue.hotels || [])
    .filter(h => h.contractStatus === 'confirmed')
    .map(h => {
      const pub = publicHotels.get(h.slug) || {};
      const fromRate = publicFromRate(pub);
      return {
        slug: h.slug,
        name: h.name,
        location: pub.area || h.location,
        area: pub.area || h.location,
        contractStatus: h.contractStatus,
        board: pub.board || null,
        taxPerPersonPerNight: pub.taxPerPersonPerNight != null ? pub.taxPerPersonPerNight : null,
        pricing: fromRate != null ? {
          display: 'From $' + fromRate + '/night',
          min: fromRate,
          basis: 'per_night'
        } : null,
        includes: h.includes || [],
        importantNotes: h.importantNotes || []
      };
    });

  const widgetZones = (catalogue.zones || []).map(z => ({
    slug: z.slug,
    name: z.name,
    island: z.island,
    area: z.area,
    hotelCount: z.hotelCount,
    description: z.description
  }));

  return {
    statusCode: 200,
    headers: headers,
    body: JSON.stringify({
      services: widgetServices,
      hotels: widgetHotels,
      zones: widgetZones,
      config: {
        whatsappNumber: CONFIG.whatsappNumber,
        depositPolicy: CONFIG.depositPolicy,
        businessHours: CONFIG.businessHours,
        replyWindow: CONFIG.replyWindow,
        seasons: CONFIG.seasons,
        childPolicy: CONFIG.childPolicy,
        sharedMinGuests: CONFIG.sharedMinGuests
      },
      version: catalogue.version
    })
  };
};