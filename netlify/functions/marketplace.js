/**
 * Marketplace — DISABLED (A7). Returns 410 Gone.
 */
'use strict';

exports.handler = async function (event) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: headers, body: '' };
  }

  if (event.httpMethod === 'POST') {
    return {
      statusCode: 410,
      headers: headers,
      body: JSON.stringify({
        error: 'The marketplace submission endpoint has been retired. Please use the concierge at spiceandsail.com to submit enquiries.',
      }),
    };
  }

  // GET still works for reading approved activities
  const path = require('path');
  const fs = require('fs');
  try {
    const marketplaceApiPath = path.join(__dirname, '..', '..', 'src', 'api', 'marketplace.js');
    const marketplaceApi = require(marketplaceApiPath);
    const result = await marketplaceApi.getApprovedActivities(event.queryStringParameters || {});
    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify(result),
    };
  } catch (e) {
    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify({ success: true, activities: [] }),
    };
  }
};
