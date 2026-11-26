/**
 * Local Payment Link Generator - Tanzania/Zanzibar
 * Generates payment links for local providers (AzamPay, ClickPesa, Selcom, Pesapal)
 * NO Stripe - not available in Tanzania
 * All payments via WhatsApp payment links per local market standard
 */
'use strict';

const { corsHeaders, isAllowedOrigin, checkRateLimit, getClientIP } = require('../concierge/security');
const { getGlobalStore, createStore, setGlobalStore } = require('../concierge/store');
const { getQuote } = require('../concierge/pricing');
const { catalogue, CONFIG } = require('../concierge/catalogue');
const { sha256Hex, randomBytesHex } = require('../concierge/webcrypto');

function ensureStore() {
  try { getGlobalStore(); } catch (e) {
    setGlobalStore(createStore('memory'));
  }
}

async function payloadHash(body) {
  const key = JSON.stringify({
    serviceSlug: body.serviceSlug,
    adults: body.adults,
    children: body.children,
    date: body.date,
    pickupZone: body.pickupZone,
  });
  return (await sha256Hex(key)).slice(0, 16);
}

function generateReference() {
  return 'PAY-' + Date.now().toString(36).toUpperCase() + '-' + randomBytesHex(4).toUpperCase();
}

/** Determine deposit config from service */
function getDepositConfig(svc) {
  if (!svc) return { percent: 0, label: 'No deposit required' };
  
  const isSeaTour = ['safari-blue', 'mnemba-snorkeling', 'prison-island-nakupenda', 'nakupenda-sandbank', 'kizimkazi-dolphin-tour', 'sunset-dhow-cruise', 'chumbe-island'].includes(svc.slug);
  const isSafari = svc.category === 'SAF' || (svc.slug.includes('safari') && !svc.slug.includes('safari-blue'));
  const isTransfer = svc.type === 'transfer';
  const isExperience = svc.type === 'experience';
  const isPackage = svc.type === 'package';
  
  if (isTransfer) return { percent: 0, label: 'Zero advance deposit — pay driver on arrival (USD, EUR, TZS cash or card)' };
  if (isSafari) return { percent: 30, label: '30% deposit locks domestic flights & TANAPA park permits' };
  if (isSeaTour || isExperience) return { percent: 20, label: '20% deposit locks boat captain, fuel & fresh seafood procurement' };
  if (isPackage) return { percent: 30, label: '30% deposit secures your package — balance before departure' };
  return { percent: 0, label: 'Zero advance deposit — pay on arrival' };
}

/** Build payment links for ALL local providers */
function buildPaymentLinks(quote, svc, depositConfig, adults, children, bookingRef) {
  const depositAmount = depositConfig.percent > 0 ? Math.round(quote.totalLow * (depositConfig.percent / 100)) : 0;
  const totalAmount = quote.totalLow;
  const currency = 'USD';
  
  // Base metadata for all providers
  const metadata = {
    service_slug: svc.slug,
    service_name: svc.name,
    booking_ref: bookingRef,
    adults: adults.toString(),
    children: children.toString(),
    deposit_percent: depositConfig.percent.toString(),
    total_amount: totalAmount.toString(),
    currency: currency,
  };
  
  // USD to TZS conversion rate (configurable via env, fallback to approximate rate)
  const USD_TO_TZS = parseFloat(process.env.USD_TO_TZS_RATE) || 2600;
  const toTZS = (usd) => Math.round(usd * USD_TO_TZS);
  
  const paymentLinks = [];
  
  // 1. AzamPay - Lipia Link (No-code payment link)
  // Supports: AzamPesa, Tigo Pesa, HaloPesa, Airtel Money, Halotel, M-Pesa, Cards, Bank Transfer
  if (process.env.AZAMPAY_CLIENT_ID && process.env.AZAMPAY_CLIENT_SECRET) {
    paymentLinks.push({
      provider: 'azampay',
      name: 'AzamPay Lipia Link',
      description: 'Pay via M-Pesa, Airtel Money, Tigo Pesa, HaloPesa, Halotel, AzamPesa, Visa/Mastercard, or Bank Transfer',
      icon: '🇹🇿',
      primary: true, // Recommended - supports ALL wallets
      generateUrl: async () => {
        // In production, call AzamPay API to create Lipia Link
        // For now, return the manual link format
        const amountTZS = toTZS(depositAmount > 0 ? depositAmount : totalAmount);
        const params = new URLSearchParams({
          amount: amountTZS,
          currency: 'TZS', // AzamPay uses TZS
          reference: bookingRef,
          description: `Spice & Sail: ${svc.name} - ${depositConfig.percent}% deposit`,
          callback_url: `${process.env.URL || 'https://spiceandsail.com'}/payment/callback?provider=azampay&ref=${bookingRef}`,
          cancel_url: `${process.env.URL || 'https://spiceandsail.com'}/payment/cancelled?ref=${bookingRef}`,
        });
        return `https://lipia.azampay.com/pay?${params.toString()}`;
      },
      supports: ['M-Pesa', 'Airtel Money', 'Tigo Pesa', 'HaloPesa', 'Halotel', 'AzamPesa', 'Visa', 'Mastercard', 'Bank Transfer'],
    });
  }
  
  // 2. ClickPesa - BillPay / Payment Links
  // Licensed by BoT (NBPSL No. 0000-31), operates in Zanzibar
  if (process.env.CLICKPESA_API_KEY) {
    paymentLinks.push({
      provider: 'clickpesa',
      name: 'ClickPesa BillPay',
      description: 'Pay via M-Pesa, Airtel Money, Tigo Pesa, Halotel, Bank, Card, or TanQR',
      icon: '💳',
      primary: false,
      generateUrl: async () => {
        // ClickPesa payment link format
        return `https://pay.clickpesa.com/${bookingRef}?amount=${depositAmount > 0 ? depositAmount : totalAmount}&currency=USD&description=${encodeURIComponent(`Spice & Sail: ${svc.name}`)}`;
      },
      supports: ['M-Pesa', 'Airtel Money', 'Tigo Pesa', 'Halotel', 'Bank Transfer', 'Visa', 'Mastercard', 'TanQR'],
    });
  }
  
  // 3. Selcom - Lipa Payment Links
  // Major Tanzanian fintech, Principal Mastercard Member
  if (process.env.SELCOM_MERCHANT_ID) {
    paymentLinks.push({
      provider: 'selcom',
      name: 'Selcom Lipa Link',
      description: 'Pay via M-Pesa, Airtel Money, Tigo Pesa, Halotel, Visa, Mastercard, Amex, or QR Code',
      icon: '🏦',
      primary: false,
      generateUrl: async () => {
        return `https://lipa.selcom.co.tz/pay/${bookingRef}?amount=${depositAmount > 0 ? depositAmount : totalAmount}&currency=USD`;
      },
      supports: ['M-Pesa', 'Airtel Money', 'Tigo Pesa', 'Halotel', 'Visa', 'Mastercard', 'Amex', 'QR Code', 'USSD'],
    });
  }
  
  // 4. Pesapal - Payment Links
  // Active in Tanzania, supports M-Pesa + Cards
  if (process.env.PESAPAL_CONSUMER_KEY && process.env.PESAPAL_CONSUMER_SECRET) {
    paymentLinks.push({
      provider: 'pesapal',
      name: 'Pesapal Payment Link',
      description: 'Pay via M-Pesa or Visa/Mastercard',
      icon: '💙',
      primary: false,
      generateUrl: async () => {
        // Pesapal Payment Page format
        return `https://pay.pesapal.com/v3/api/Transactions/SubmitOrderRequest?amount=${depositAmount > 0 ? depositAmount : totalAmount}&currency=USD&description=${encodeURIComponent(`Spice & Sail: ${svc.name}`)}&callback_url=${encodeURIComponent(`${process.env.URL || 'https://spiceandsail.com'}/payment/callback?provider=pesapal&ref=${bookingRef}`)}&reference=${bookingRef}`;
      },
      supports: ['M-Pesa', 'Visa', 'Mastercard'],
    });
  }
  
  // 5. DPO/Network International (existing in codebase)
  if (process.env.DPO_COMPANY_TOKEN && process.env.DPO_SERVICE_TYPE) {
    paymentLinks.push({
      provider: 'dpo',
      name: 'DPO Pay / Network International',
      description: 'Pay via M-Pesa, Airtel Money, Tigo Pesa, Visa, Mastercard',
      icon: '🌐',
      primary: false,
      generateUrl: async () => {
        return `https://secure.3gdirectpay.com/pay?v=2&merchant_id=${process.env.DPO_COMPANY_TOKEN}&service_type=${process.env.DPO_SERVICE_TYPE}&amount=${depositAmount > 0 ? depositAmount : totalAmount}&currency=USD&description=${encodeURIComponent(`Spice & Sail: ${svc.name}`)}&order_id=${bookingRef}`;
      },
      supports: ['M-Pesa', 'Airtel Money', 'Tigo Pesa', 'Visa', 'Mastercard'],
    });
  }
  
  // If no providers configured, return manual WhatsApp fallback
  if (paymentLinks.length === 0) {
    paymentLinks.push({
      provider: 'whatsapp',
      name: 'WhatsApp Payment Instructions',
      description: 'Our team will send a secure payment link via WhatsApp (AzamPay, ClickPesa, Selcom, or Pesapal)',
      icon: '💬',
      primary: true,
      generateUrl: async () => {
        return `https://wa.me/${CONFIG.whatsappNumber || '255707939265'}?text=${encodeURIComponent(`Jambo Spice & Sail! Please send me the payment link for my ${svc.name} booking (Ref: ${bookingRef}). I'm ready to pay the ${depositConfig.percent}% deposit.`)}`;
      },
      supports: ['M-Pesa', 'Airtel Money', 'Tigo Pesa', 'Halotel', 'HaloPesa', 'AzamPesa', 'Visa', 'Mastercard', 'Cash (USD/TZS)', 'Bank Transfer'],
      manual: true,
    });
  }
  
  return paymentLinks;
}

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

  ensureStore();
  const store = getGlobalStore();

  // Rate limit
  const ip = getClientIP(event);
  const rl = await checkRateLimit(ip, 'payment-link', 20, 3600000, store);
  if (!rl.allowed) {
    return { statusCode: 429, headers: headers, body: JSON.stringify({ error: 'Too many requests. Please try again later.' }) };
  }

  let body;
  try { body = JSON.parse(event.body); } catch (e) {
    return { statusCode: 400, headers: headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  // Validate required fields
  if (!body.serviceSlug || typeof body.serviceSlug !== 'string') {
    return { statusCode: 400, headers: headers, body: JSON.stringify({ error: 'serviceSlug is required' }) };
  }

  // Get quote from catalogue (server-side, never trust client)
  const quote = getQuote({
    serviceSlug: body.serviceSlug,
    adults: body.adults || 2,
    children: body.children || 0,
    date: body.date || null,
    pickupZone: body.pickupZone || null,
  });

  const svc = catalogue.services?.find(s => s.slug === body.serviceSlug);
  
  if (!svc) {
    return { statusCode: 404, headers: headers, body: JSON.stringify({ error: 'Service not found' }) };
  }

  if (quote.status !== 'quoted' || quote.totalLow == null) {
    return { statusCode: 400, headers: headers, body: JSON.stringify({ 
      error: 'Service price not available for instant payment. Our team will send a payment link via WhatsApp.',
      whatsapp_url: `https://wa.me/${CONFIG.whatsappNumber || '255707939265'}?text=${encodeURIComponent('Jambo Spice & Sail! I would like to book ' + svc.name + ' for ' + (body.adults || 2) + ' guests.')}`
    }) };
  }

  const depositConfig = getDepositConfig(svc);
  const depositAmount = depositConfig.percent > 0 ? Math.round(quote.totalLow * (depositConfig.percent / 100)) : 0;
  
  // Idempotency key
  const hash = await payloadHash(body);
  const idempotencyKey = `payment_link:${hash}:${depositAmount}`;

  try {
    // Check for existing payment links FIRST (before generating new reference)
    const existing = await store.getJSON(idempotencyKey);
    if (existing && existing.paymentLinks) {
      const originalBookingRef = existing.bookingRef || generateReference();
      return { 
        statusCode: 200, 
        headers: headers, 
        body: JSON.stringify({ 
          bookingRef: originalBookingRef,
          depositAmount,
          depositPercent: depositConfig.percent,
          totalAmount: quote.totalLow,
          serviceName: svc.name,
          paymentLinks: existing.paymentLinks,
          wasExisting: true,
          message: depositConfig.percent > 0 
            ? `Pay ${depositConfig.percent}% deposit (${depositAmount} USD) to confirm your booking`
            : 'Zero deposit required — pay driver on arrival'
        }) 
      };
    }

    // Only generate new reference if no existing record
    const bookingRef = generateReference();

    // Build payment links for all configured providers
    const paymentLinks = await buildPaymentLinks(quote, svc, depositConfig, body.adults || 2, body.children || 0, bookingRef);
    
    // Resolve async generateUrl functions
    const resolvedLinks = [];
    for (const link of paymentLinks) {
      const url = link.generateUrl ? await link.generateUrl() : link.url;
      resolvedLinks.push({
        provider: link.provider,
        name: link.name,
        description: link.description,
        icon: link.icon,
        primary: link.primary,
        url,
        supports: link.supports,
        manual: link.manual || false,
      });
    }

    // Store idempotency record
    await store.setJSON(idempotencyKey, { 
      bookingRef,
      paymentLinks: resolvedLinks,
      createdAt: new Date().toISOString(),
      serviceSlug: body.serviceSlug,
      depositAmount,
      depositPercent: depositConfig.percent,
      totalAmount: quote.totalLow,
    });

    // Also save as a payment record for tracking
    await store.setJSON('payment:' + bookingRef, {
      bookingRef,
      serviceSlug: body.serviceSlug,
      serviceName: svc.name,
      adults: body.adults || 2,
      children: body.children || 0,
      date: body.date || null,
      pickupZone: body.pickupZone || null,
      depositAmount,
      depositPercent: depositConfig.percent,
      totalAmount: quote.totalLow,
      currency: 'USD',
      status: 'pending',
      paymentLinks: resolvedLinks.map(l => l.provider),
      createdAt: new Date().toISOString(),
      ipHash: (await sha256Hex(ip)).slice(0, 8),
    });

    return { 
      statusCode: 200, 
      headers: headers, 
      body: JSON.stringify({ 
        bookingRef,
        depositAmount,
        depositPercent: depositConfig.percent,
        totalAmount: quote.totalLow,
        serviceName: svc.name,
        paymentLinks: resolvedLinks,
        wasExisting: false,
        message: depositConfig.percent > 0 
          ? `Pay ${depositConfig.percent}% deposit (${depositAmount} USD) to confirm your booking`
          : 'Zero deposit required — pay driver on arrival'
      }) 
    };

  } catch (error) {
    console.error('Payment link error:', error);
    return { 
      statusCode: 500, 
      headers: headers, 
      body: JSON.stringify({ 
        error: 'Unable to generate payment links. Our team will send a secure link via WhatsApp.',
        whatsapp_url: `https://wa.me/${CONFIG.whatsappNumber || '255707939265'}?text=${encodeURIComponent('Jambo Spice & Sail! I would like to book ' + svc.name + ' for ' + (body.adults || 2) + ' guests.')}`,
        bookingRef,
      }) 
    };
  }
};