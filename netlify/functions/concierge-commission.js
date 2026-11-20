/**
 * Hotel Concierge Commission Tracker
 * Tracks referrals from 198 partner hotels, calculates commissions, manages payouts
 */
'use strict';

const { corsHeaders, isAllowedOrigin, checkRateLimit, getClientIP } = require('../../src/lib/concierge/security');
const { getGlobalStore, createStore, setGlobalStore } = require('../../src/lib/concierge/store');
const { catalogue, CONFIG } = require('../../src/lib/concierge/catalogue');
const crypto = require('node:crypto');

function ensureStore() {
  try { getGlobalStore(); } catch (e) {
    setGlobalStore(createStore(process.env.NETLIFY ? 'blob' : 'memory'));
  }
}

const COMMISSION_RULES = {
  default: 0.125, // 12.5%
  max: 0.15,      // 15% cap
  min: 0.10,      // 10% floor
  paymentTerms: 'post_travel', // paid after guest completes stay
  currency: 'USD',
  fxBuffer: 0.02,
};

const HOTEL_TIERS = {
  platinum: { commission: 0.10, minRooms: 10, description: 'High volume, guaranteed bookings' },
  gold: { commission: 0.125, minRooms: 5, description: 'Regular referrals, good conversion' },
  silver: { commission: 0.15, minRooms: 1, description: 'New partner, standard rate' },
  bronze: { commission: 0.15, minRooms: 0, description: 'Trial period, max commission' },
};

function generateReferralCode(hotelSlug) {
  const prefix = hotelSlug.substring(0, 3).toUpperCase();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `REF-${prefix}-${random}`;
}

function calculateCommission(amount, hotelTier = 'silver') {
  const tier = HOTEL_TIERS[hotelTier] || HOTEL_TIERS.silver;
  const rate = tier.commission;
  const commission = Math.round(amount * rate * 100) / 100;
  return { rate, commission, tier };
}

exports.handler = async function (event) {
  const origin = event.headers && event.headers.origin;
  const headers = corsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: headers, body: '' };
  }

  if (origin && !isAllowedOrigin(origin)) {
    return { statusCode: 403, headers: headers, body: JSON.stringify({ error: 'Origin not allowed' }) };
  }

  ensureStore();
  const store = getGlobalStore();

  // Admin auth
  const adminSecret = process.env.CONCIERGE_ADMIN_SECRET || 'changeme';
  const providedSecret = event.headers['x-admin-secret'] || (event.queryStringParameters && event.queryStringParameters.adminSecret);
  
  const isAdmin = providedSecret === adminSecret;

  if (event.httpMethod === 'GET') {
    const url = new URL(event.rawUrl);
    const action = url.searchParams.get('action');
    const hotelSlug = url.searchParams.get('hotelSlug');
    const referralCode = url.searchParams.get('referralCode');
    const status = url.searchParams.get('status');
    const dateFrom = url.searchParams.get('dateFrom');
    const dateTo = url.searchParams.get('dateTo');

    if (action === 'referral' && referralCode) {
      // Public endpoint: track referral click/landing
      const refKey = 'referral:' + referralCode;
      try {
        const ref = await store.getJSON(refKey);
        if (ref) {
          ref.clicks = (ref.clicks || 0) + 1;
          ref.lastClickAt = new Date().toISOString();
          await store.setJSON(refKey, ref);
        }
      } catch (e) { /* ignore */ }
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    if (action === 'stats' && hotelSlug && isAdmin) {
      // Hotel-specific stats
      try {
        const prefix = 'concierge_booking:' + hotelSlug + ':';
        // This would need a proper index in production
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Implement with proper indexing' }) };
      } catch (e) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
      }
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid action' }) };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body); } catch (e) {
    return { statusCode: 400, headers: headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const action = body.action;

  if (action === 'register_hotel') {
    // Admin: register a new hotel concierge partner
    if (!isAdmin) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Admin required' }) };

    const { hotelSlug, hotelName, contactEmail, contactPhone, contactName, tier = 'silver', notes } = body;
    
    if (!hotelSlug || !hotelName) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'hotelSlug and hotelName required' }) };
    }

    const referralCode = generateReferralCode(hotelSlug);
    const tierConfig = HOTEL_TIERS[tier] || HOTEL_TIERS.silver;

    const partner = {
      hotelSlug,
      hotelName,
      contactEmail,
      contactPhone,
      contactName,
      tier,
      commissionRate: tierConfig.commission,
      referralCode,
      status: 'active',
      createdAt: new Date().toISOString(),
      stats: { clicks: 0, bookings: 0, revenue: 0, commissionPaid: 0, commissionPending: 0 },
      notes,
    };

    await store.setJSON('hotel_partner:' + hotelSlug, partner);
    await store.setJSON('referral:' + referralCode, { 
      hotelSlug, 
      referralCode, 
      clicks: 0, 
      bookings: 0,
      createdAt: new Date().toISOString() 
    });

    return { 
      statusCode: 201, 
      headers, 
      body: JSON.stringify({ 
        success: true, 
        partner: { ...partner, referralLink: `https://spiceandsail.com/?ref=${referralCode}` } 
      }) 
    };
  }

  if (action === 'record_booking') {
    // Record a booking attributed to a hotel concierge
    // Can be called by webhook, admin, or automated from lead/booking system
    const { referralCode, bookingRef, serviceSlug, serviceName, amount, guestName, guestPhone, guestEmail, checkInDate, checkOutDate, nights, rooms } = body;

    if (!referralCode || !bookingRef || !amount) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'referralCode, bookingRef, amount required' }) };
    }

    // Verify referral code
    let refData;
    try {
      refData = await store.getJSON('referral:' + referralCode);
    } catch (e) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Invalid referral code' }) };
    }

    if (!refData || !refData.hotelSlug) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Invalid referral code' }) };
    }

    const hotelSlug = refData.hotelSlug;
    let partner;
    try {
      partner = await store.getJSON('hotel_partner:' + hotelSlug);
    } catch (e) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Partner not found' }) };
    }

    if (partner.status !== 'active') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Partner not active' }) };
    }

    const commissionCalc = calculateCommission(amount, partner.tier);
    
    const booking = {
      bookingRef,
      hotelSlug,
      hotelName: partner.hotelName,
      referralCode,
      serviceSlug,
      serviceName,
      amount: parseFloat(amount),
      commissionRate: commissionCalc.rate,
      commissionAmount: commissionCalc.commission,
      guestName,
      guestPhone,
      guestEmail,
      checkInDate,
      checkOutDate,
      nights: parseInt(nights) || 1,
      rooms: parseInt(rooms) || 1,
      status: 'confirmed',
      commissionStatus: 'pending', // pending, approved, paid, cancelled
      createdAt: new Date().toISOString(),
      travelDate: checkInDate,
    };

    // Save booking
    await store.setJSON('concierge_booking:' + bookingRef, booking);

    // Update referral stats
    refData.bookings = (refData.bookings || 0) + 1;
    refData.lastBookingAt = new Date().toISOString();
    await store.setJSON('referral:' + referralCode, refData);

    // Update partner stats
    partner.stats.bookings = (partner.stats.bookings || 0) + 1;
    partner.stats.revenue = (partner.stats.revenue || 0) + amount;
    partner.stats.commissionPending = (partner.stats.commissionPending || 0) + commissionCalc.commission;
    await store.setJSON('hotel_partner:' + hotelSlug, partner);

    return { 
      statusCode: 201, 
      headers, 
      body: JSON.stringify({ 
        success: true, 
        booking,
        commission: commissionCalc,
        message: 'Booking recorded. Commission pending until post-travel verification.'
      }) 
    };
  }

  if (action === 'verify_completion') {
    // Admin: verify guest completed travel, approve commission for payout
    if (!isAdmin) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Admin required' }) };

    const { bookingRef, action: verifyAction } = body; // verifyAction: 'approve' | 'reject'

    let booking;
    try {
      booking = await store.getJSON('concierge_booking:' + bookingRef);
    } catch (e) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Booking not found' }) };
    }

    if (verifyAction === 'approve') {
      booking.commissionStatus = 'approved';
      booking.approvedAt = new Date().toISOString();
      
      // Update partner stats
      let partner = await store.getJSON('hotel_partner:' + booking.hotelSlug);
      partner.stats.commissionPending = (partner.stats.commissionPending || 0) - booking.commissionAmount;
      partner.stats.commissionPaid = (partner.stats.commissionPaid || 0) + booking.commissionAmount;
      await store.setJSON('hotel_partner:' + booking.hotelSlug, partner);
    } else {
      booking.commissionStatus = 'rejected';
      booking.rejectedAt = new Date().toISOString();
      
      // Update partner stats (remove pending)
      let partner = await store.getJSON('hotel_partner:' + booking.hotelSlug);
      partner.stats.commissionPending = (partner.stats.commissionPending || 0) - booking.commissionAmount;
      await store.setJSON('hotel_partner:' + booking.hotelSlug, partner);
    }

    await store.setJSON('concierge_booking:' + bookingRef, booking);

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, booking }) };
  }

  if (action === 'payout') {
    // Admin: record payout to hotel
    if (!isAdmin) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Admin required' }) };

    const { hotelSlug, amount, reference, notes } = body;

    let partner;
    try {
      partner = await store.getJSON('hotel_partner:' + hotelSlug);
    } catch (e) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Partner not found' }) };
    }

    const payout = {
      hotelSlug,
      hotelName: partner.hotelName,
      amount,
      reference,
      notes,
      paidAt: new Date().toISOString(),
      id: 'payout_' + crypto.randomBytes(8).toString('hex'),
    };

    // Update partner
    partner.stats.commissionPaid = (partner.stats.commissionPaid || 0) + amount;
    partner.stats.commissionPending = Math.max(0, (partner.stats.commissionPending || 0) - amount);
    partner.lastPayoutAt = new Date().toISOString();
    await store.setJSON('hotel_partner:' + hotelSlug, partner);

    // Save payout record
    await store.setJSON('payout:' + payout.id, payout);

    return { statusCode: 201, headers, body: JSON.stringify({ success: true, payout }) };
  }

  if (action === 'get_partner') {
    // Get partner details (public info for widget)
    const { hotelSlug, referralCode } = body;

    let partner;
    if (hotelSlug) {
      try { partner = await store.getJSON('hotel_partner:' + hotelSlug); } catch (e) {}
    } else if (referralCode) {
      let ref;
      try { ref = await store.getJSON('referral:' + referralCode); } catch (e) {}
      if (ref && ref.hotelSlug) {
        try { partner = await store.getJSON('hotel_partner:' + ref.hotelSlug); } catch (e) {}
      }
    }

    if (!partner) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Partner not found' }) };
    }

    // Return public-safe info
    return { 
      statusCode: 200, 
      headers, 
      body: JSON.stringify({ 
        hotelSlug: partner.hotelSlug,
        hotelName: partner.hotelName,
        referralCode: partner.referralCode,
        referralLink: `https://spiceandsail.com/?ref=${partner.referralCode}`,
        commissionRate: partner.commissionRate,
        tier: partner.tier,
        status: partner.status,
        stats: { bookings: partner.stats?.bookings || 0, revenue: partner.stats?.revenue || 0 }
      }) 
    };
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid action' }) };
};