/**
 * Pricing — DISABLED (A8). Returns 410 Gone.
 */
'use strict';

exports.handler = async function () {
  return {
    statusCode: 410,
    headers: { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' },
    body: JSON.stringify({
      error: 'The pricing plans endpoint has been retired. Please use the concierge at spiceandsail.com for quotes.',
    }),
  };
};
