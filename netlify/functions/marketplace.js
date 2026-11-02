/**
 * Spice and Sail Zanzibar — Marketplace API Relay
 * Netlify Serverless Function: /.netlify/functions/marketplace
 *
 * Provides backend API for the Local Activities Marketplace feature.
 * Wraps src/api/marketplace.js Node.js operations to make them available
 * via static site deployment (Eleventy + Netlify).
 */

const path = require('path');
const fs = require('fs');

// Load the marketplace API module (Node.js environment).
// This function lives at netlify/functions/marketplace.js; the API module
// lives at <root>/src/api/marketplace.js, so go up two levels.
const marketplaceApiPath = path.join(__dirname, '..', '..', 'src', 'api', 'marketplace.js');
let marketplaceApi;

try {
  // Use require to load the CommonJS module
  marketplaceApi = require(marketplaceApiPath);
} catch (error) {
  console.error('[MARKETPLACE_INIT_ERROR]:', error);
  throw new Error('Failed to load marketplace API module');
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
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

  try {
    let response;

    switch (event.httpMethod) {
      case 'GET':
        response = await handleGetRequest(event);
        break;
      case 'POST':
        response = await handlePostRequest(event);
        break;
      default:
        return {
          statusCode: 405,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            success: false,
            error: 'Method Not Allowed'
          })
        };
    }

    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('[MARKETPLACE_HANDLER_ERROR]:', error);
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

  // Get approved activities with filters
  const filters = {};

  // Map query parameters to filters expected by getApprovedActivities
  if (query.category) filters.category = query.category;
  if (query.location) filters.location = query.location;
  if (query.priceRange) filters.priceRange = query.priceRange;
  if (query.search) filters.search = query.search;
  if (query.priceMin && query.priceMax) {
    filters.priceRange = `${query.priceMin}-${query.priceMax}`;
  } else if (query.priceMin) {
    filters.priceRange = `0-${query.priceMin}`;
  }

  try {
    const result = await marketplaceApi.getApprovedActivities(filters);
    return result;
  } catch (error) {
    console.error('[GET_APPROVED_ACTIVITIES_ERROR]:', error);
    return {
      success: false,
      error: 'Failed to load approved activities',
      details: error.message
    };
  }
}

async function handlePostRequest(event) {
  let payload = {};

  try {
    // Parse request body
    if (event.body) {
      payload = JSON.parse(event.body);
    }

    // For backward compatibility, support both direct activity data and object with activityData
    const activityData = payload.activityData || payload;

    // Get user info from payload or use defaults
    const userInfo = payload.userInfo || {
      id: 'guest-' + Date.now(),
      name: 'Anonymous User',
      email: 'anonymous@example.com',
      phone: ''
    };

    // Create the marketplace activity via API
    const result = await marketplaceApi.createMarketplaceActivity(activityData, userInfo);
    return result;

  } catch (error) {
    console.error('[CREATE_ACTIVITY_ERROR]:', error);
    return {
      success: false,
      error: 'Failed to create activity',
      details: error.message
    };
  }
}