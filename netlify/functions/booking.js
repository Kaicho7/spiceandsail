/**
 * Booking relay — DISABLED. Returns 410 Gone.
 * Lead capture is now handled by the /lead endpoint.
 */
'use strict';

exports.handler = async function () {
  return {
    statusCode: 410,
    headers: { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' },
    body: JSON.stringify({
      error: 'The booking relay has been retired. Please use the concierge at spiceandsail.com to submit enquiries.',
    }),
  };
};
