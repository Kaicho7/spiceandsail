/**
 * Spice and Sail Zanzibar — Automated Booking & Lead Dispatch Relay
 * Netlify Serverless Function: /.netlify/functions/booking
 *
 * Captures concierge triage and direct booking inquiries, formats an operational
 * dispatch alert, and relays it into internal operations channels (WhatsApp Group,
 * Webhooks, and Netlify Functions logs).
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
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

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    let payload = {};
    if (event.body) {
      payload = JSON.parse(event.body);
    }

    const timestamp = new Date().toISOString();
    const leadId = `SNS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Extract lead fields with fallbacks
    const service = payload.service || payload.tour || payload.tripType || 'General Zanzibar Inquiry';
    const travelers = payload.travelers || payload.pax || payload.guests || '1-2 Guests';
    const travelDate = payload.date || payload.travelDate || 'Flexible / Pending Confirmation';
    const location = payload.location || payload.pickup || payload.hotel || 'Zanzibar Island';
    const estimatedPrice = payload.estimatedPrice || payload.quote || 'Standard Planning Range';
    const notes = payload.notes || payload.specialRequests || 'None provided';
    const guestName = payload.name || payload.guestName || 'Website Traveler';
    const guestPhone = payload.phone || payload.whatsapp || '';
    const guestEmail = payload.email || '';
    const depositAmount = payload.depositAmount || null;
    const isDepositCheckout = payload.action === 'deposit_checkout';
    const sourcePage = payload.sourceUrl || payload.page || event.headers.referer || '/';

    // Format Internal WhatsApp Operations Dispatch Message
    const headerTitle = isDepositCheckout 
      ? '⚡ *NEW PRIORITY DEPOSIT CHECKOUT — SPICE & SAIL*' 
      : '🚨 *NEW INQUIRY — SPICE & SAIL ZANZIBAR*';

    const opsMessageLines = [
      headerTitle,
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      `📋 *Lead Ref:* ${leadId}`,
      `📍 *Service:* ${service}`,
      `👥 *Travelers:* ${travelers}`,
      `📅 *Date:* ${travelDate}`,
      `🏨 *Pickup / Destination:* ${location}`,
      `💰 *Estimated Quote:* ${estimatedPrice}`,
      depositAmount ? `⚡ *Required Deposit:* $${depositAmount} USD` : null,
      `📝 *Special Requests:* ${notes}`,
      `👤 *Guest Name:* ${guestName}`,
      guestPhone ? `📱 *Phone / WhatsApp:* ${guestPhone}` : null,
      guestEmail ? `✉️ *Email:* ${guestEmail}` : null,
      `🌐 *Source Page:* ${sourcePage}`,
      `⏰ *Logged:* ${timestamp.replace('T', ' ').substring(0, 19)} UTC`,
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    ].filter(Boolean);

    if (guestPhone) {
      const cleanPhone = guestPhone.replace(/[^0-9]/g, '');
      opsMessageLines.push(`👉 *Reply to Guest:* https://wa.me/${cleanPhone}`);
    }

    const formattedOpsMessage = opsMessageLines.join('\n');

    // Always log formatted dispatch for Netlify Function operational stream
    console.log(`[DISPATCH][${leadId}] New Lead Captured:`, JSON.stringify({
      leadId,
      service,
      travelers,
      travelDate,
      location,
      estimatedPrice,
      guestName,
      guestPhone,
      guestEmail,
      sourcePage,
      timestamp
    }));
    console.log(`[DISPATCH_TEXT][${leadId}]:\n${formattedOpsMessage}`);

    // Multi-channel Webhook Relay Dispatch
    const webhookUrls = [
      process.env.WHATSAPP_OPS_WEBHOOK_URL,
      process.env.OPS_WEBHOOK_URL,
      process.env.DISCORD_WEBHOOK_URL,
      process.env.SLACK_WEBHOOK_URL
    ].filter(Boolean);

    const relayResults = [];

    for (const url of webhookUrls) {
      try {
        if (typeof fetch === 'function') {
          const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: formattedOpsMessage,
              content: formattedOpsMessage,
              lead_id: leadId,
              lead_data: payload
            })
          });
          relayResults.push({ url: url.substring(0, 20) + '...', status: resp.status });
        }
      } catch (err) {
        console.error(`[RELAY_ERROR] Failed to post to webhook:`, err.message);
        relayResults.push({ url: url.substring(0, 20) + '...', error: err.message });
      }
    }

    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        lead_id: leadId,
        message: 'Lead captured successfully and queued for operations dispatch.',
        formatted_message: formattedOpsMessage,
        relays_triggered: relayResults.length,
        timestamp
      })
    };
  } catch (error) {
    console.error('[BOOKING_HANDLER_ERROR]:', error);
    return {
      statusCode: 500,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: 'Failed to process inquiry',
        details: error.message
      })
    };
  }
};
