/**
 * Spice and Sail Zanzibar — Dynamic Pricing API Relay
 * Netlify Serverless Function: /.netlify/functions/pricing
 *
 * Exposes the Phase 6 dynamic pricing engine (src/api/pricing.js) to the
 * static site. Computes real-time/seasonal/demand-adjusted prices for all
 * approved activities and returns them shaped for the pricing-plans page.
 */

const path = require('path');

// The pricing API module lives at <root>/src/api/pricing.js; this function
// lives at netlify/functions/pricing.js, so go up two levels.
const pricingApiPath = path.join(__dirname, '..', '..', 'src', 'api', 'pricing.js');
let pricingApi;

try {
  pricingApi = require(pricingApiPath);
} catch (error) {
  console.error('[PRICING_INIT_ERROR]:', error);
  throw new Error('Failed to load pricing API module');
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, error: 'Method Not Allowed' })
    };
  }

  try {
    const result = await handleGetRequest(event);
    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('[PRICING_HANDLER_ERROR]:', error);
    return {
      statusCode: 500,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: 'Internal Server Error',
        details: error.message
      })
    };
  }
};

async function handleGetRequest(event) {
  const query = event.queryStringParameters || {};

  // Build optional pricing context from query params (all optional)
  const context = {};
  if (query.groupSize) context.groupSize = parseInt(query.groupSize, 10);
  if (query.leadDays) context.leadDays = parseInt(query.leadDays, 10);
  if (query.date) context.date = query.date;
  if (query.timeOfDay) context.timeOfDay = query.timeOfDay;
  if (query.isWeekend === 'true') context.isWeekend = true;
  if (query.demand) context.demand = parseInt(query.demand, 10);

  const data = await pricingApi.loadPricingData();
  const approved = data.activities.filter(a =>
    a.metadata?.isApproved && a.metadata?.isActive
  );

  const pricingPlans = [];

  for (const activity of approved) {
    try {
      const priceResult = await pricingApi.calculateDynamicPrice(activity.id, context);
      const highlights = activity.highlights || [];
      const included = activity.included || [];
      pricingPlans.push({
        activityId: activity.id,
        slug: activity.slug,
        name: activity.title,
        category: activity.category,
        categoryLabel: activity.categoryMetadata?.label || activity.category,
        basePrice: priceResult.basePrice,
        dynamicPrice: priceResult.dynamicPrice,
        currency: activity.pricing?.currency || 'USD',
        priceUnit: activity.pricing?.priceUnit || 'per-person',
        multiplier: priceResult.multiplier,
        factors: priceResult.factors,
        featured: !!activity.metadata?.isFeatured,
        discountBadge:
          priceResult.dynamicPrice < priceResult.basePrice ? 'Smart Price' : null,
        features: highlights.length > 0 ? highlights : included,
        image: activity.images && activity.images[0] ? activity.images[0] : ''
      });
    } catch (priceError) {
      console.error(`[PRICING_ACTIVITY_ERROR] ${activity.id}:`, priceError.message);
    }
  }

  return {
    success: true,
    pricingPlans,
    generatedAt: new Date().toISOString()
  };
}
