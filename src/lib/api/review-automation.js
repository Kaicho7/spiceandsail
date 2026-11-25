/**
 * Post-Trip Review Automation
 * Triggered after service completion to request Google/TripAdvisor reviews
 * Can be called via cron, webhook, or manual admin action
 */
'use strict';

const { corsHeaders, isAllowedOrigin } = require('../concierge/security');
const { getGlobalStore, createStore, setGlobalStore } = require('../concierge/store');
const { catalogue, CONFIG } = require('../concierge/catalogue');

// Use Web Crypto API (available in Cloudflare Workers) instead of node:crypto
function randomHex(bytes = 8) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

function ensureStore() {
  try { getGlobalStore(); } catch (e) {
    setGlobalStore(createStore('memory'));
  }
}

// Review request templates (multilingual)
const REVIEW_TEMPLATES = {
  en: {
    subject: 'How was your {serviceName}? 🌊',
    greeting: 'Jambo {name}! Thank you for choosing Spice & Sail Zanzibar.',
    body: 'We hope you had an amazing time on your {serviceName}. Your feedback helps us improve and helps other travelers choose with confidence.',
    gbp: '📍 Google Review (takes 30 seconds): {gbpLink}',
    ta: '⭐ TripAdvisor Review: {taLink}',
    direct: 'Or simply reply to this message with your thoughts — we read every message.',
    thanks: 'Asante sana! The Spice & Sail Team',
    unsubscribe: 'Reply STOP to opt out of review requests.',
  },
  it: {
    subject: 'Com\'è andato il tuo {serviceName}? 🌊',
    greeting: 'Jambo {name}! Grazie per aver scelto Spice & Sail Zanzibar.',
    body: 'Speriamo che abbiate apprezzato il vostro {serviceName}. Il tuo feedback ci aiuta a migliorare e aiuta altri viaggiatori a scegliere con fiducia.',
    gbp: '📍 Recensione Google (30 secondi): {gbpLink}',
    ta: '⭐ Recensione TripAdvisor: {taLink}',
    direct: 'Oppure rispondi semplicemente a questo messaggio con i tuoi pensieri — leggiamo tutto.',
    thanks: 'Asante sana! Il Team Spice & Sail',
    unsubscribe: 'Rispondi STOP per non ricevere più richieste di recensioni.',
  },
  de: {
    subject: 'Wie war dein {serviceName}? 🌊',
    greeting: 'Jambo {name}! Vielen Dank, dass Sie Spice & Sail Zanzibar gewählt haben.',
    body: 'Wir hoffen, Sie haben Ihr {serviceName} genossen. Ihr Feedback hilft uns, uns zu verbessern, und anderen Reisenden bei der Entscheidung.',
    gbp: '📍 Google Bewertung (30 Sekunden): {gbpLink}',
    ta: '⭐ TripAdvisor Bewertung: {taLink}',
    direct: 'Oder antworten Sie einfach auf diese Nachricht mit Ihren Gedanken — wir lesen jede Nachricht.',
    thanks: 'Asante sana! Das Spice & Sail Team',
    unsubscribe: 'Antworten Sie STOP, um keine Bewertungsanfragen mehr zu erhalten.',
  },
  fr: {
    subject: 'Comment s\'est passé votre {serviceName}? 🌊',
    greeting: 'Jambo {name}! Merci d\'avoir choisi Spice & Sail Zanzibar.',
    body: 'Nous espérons que vous avez apprécié votre {serviceName}. Votre avis nous aide à nous améliorer et aide les autres voyageurs à choisir en confiance.',
    gbp: '📍 Avis Google (30 secondes) : {gbpLink}',
    ta: '⭐ Avis TripAdvisor : {taLink}',
    direct: 'Ou répondez simplement à ce message avec vos impressions — nous lisons tout.',
    thanks: 'Asante sana ! L\'équipe Spice & Sail',
    unsubscribe: 'Répondez STOP pour ne plus recevoir de demandes d\'avis.',
  },
  pl: {
    subject: 'Jak przebiegło Twoje {serviceName}? 🌊',
    greeting: 'Jambo {name}! Dziękujemy za wybranie Spice & Sail Zanzibar.',
    body: 'Mamy nadzieję, że podobało Ci się Twoje {serviceName}. Twoja opinia pomaga nam się doskonalić i innym podróżnym w podejmowaniu decyzji.',
    gbp: '📍 Recenzja Google (30 sekund): {gbpLink}',
    ta: '⭐ Recenzja TripAdvisor: {taLink}',
    direct: 'Lub po prostu odpowiedz na tę wiadomość swoimi myślami — czytamy wszystko.',
    thanks: 'Asante sana! Zespół Spice & Sail',
    unsubscribe: 'Odpowiedz STOP, aby nie otrzymywać więcej prośb o recenzje.',
  }
};

function getTemplate(lang) {
  return REVIEW_TEMPLATES[lang] || REVIEW_TEMPLATES.en;
}

function buildReviewMessage(template, data) {
  let message = template.greeting + '\n\n' + template.body + '\n\n';
  if (data.gbpLink) message += template.gbp.replace('{gbpLink}', data.gbpLink) + '\n\n';
  if (data.taLink) message += template.ta.replace('{taLink}', data.taLink) + '\n\n';
  message += template.direct + '\n\n' + template.thanks + '\n\n' + template.unsubscribe;
  return message
    .replace(/{name}/g, data.name || 'there')
    .replace(/{serviceName}/g, data.serviceName || 'experience');
}

function generateReviewToken() {
  return 'rev_' + randomHex(12);
}

/** Check if review already requested for this booking */
async function checkReviewRequested(store, bookingRef, serviceSlug) {
  const key = 'review_requested:' + bookingRef + ':' + serviceSlug;
  try {
    const existing = await store.getJSON(key);
    return !!existing;
  } catch (e) {
    return false;
  }
}

/** Mark review as requested */
async function markReviewRequested(store, bookingRef, serviceSlug) {
  const key = 'review_requested:' + bookingRef + ':' + serviceSlug;
  await store.setJSON(key, { requestedAt: new Date().toISOString() });
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

  let body;
  try { body = JSON.parse(event.body); } catch (e) {
    return { statusCode: 400, headers: headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const action = body.action || 'send';

  // Admin secret for cron/webhook auth
  const adminSecret = process.env.REVIEW_AUTOMATION_SECRET || 'changeme';
  const providedSecret = event.headers['x-admin-secret'] || body.adminSecret;
  
  if (action !== 'preview' && providedSecret !== adminSecret) {
    return { statusCode: 401, headers: headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  if (action === 'send' || action === 'preview') {
    // Send review request for a completed booking
    const { 
      bookingRef, 
      phone, 
      email, 
      serviceSlug, 
      serviceName, 
      language = 'en', 
      name,
      date 
    } = body;

    if (!bookingRef || !serviceSlug) {
      return { statusCode: 400, headers: headers, body: JSON.stringify({ error: 'Missing required fields: bookingRef, serviceSlug' }) };
    }

    // Check if already requested
    const alreadyRequested = await checkReviewRequested(store, bookingRef, serviceSlug);
    if (alreadyRequested && action === 'send') {
      return { statusCode: 200, headers: headers, body: JSON.stringify({ success: true, message: 'Review already requested for this booking', alreadySent: true }) };
    }

    const svc = catalogue.services?.find(s => s.slug === serviceSlug) || { name: serviceName || serviceSlug };
    const template = getTemplate(language);
    
    const gbpLink = (process.env.GBP_REVIEW_LINK || '').trim();
    const taLink = (process.env.TRIPADVISOR_REVIEW_LINK || '').trim();
    
    const messageData = {
      name: name || 'there',
      serviceName: svc.name || serviceName,
      gbpLink,
      taLink,
    };
    
    const whatsappMessage = buildReviewMessage(template, messageData);
    const whatsappUrl = `https://wa.me/255707939265?text=${encodeURIComponent(whatsappMessage)}`;
    const emailSubject = template.subject.replace('{serviceName}', svc.name || serviceName);
    const emailBody = whatsappMessage.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
    
    // Mark as requested
    if (action === 'send') {
      await markReviewRequested(store, bookingRef, serviceSlug);
      
      // Log the request
      const logKey = 'review_log:' + bookingRef + ':' + serviceSlug;
      await store.setJSON(logKey, {
        bookingRef,
        serviceSlug,
        serviceName: svc.name,
        phone,
        email,
        language,
        name,
        sentAt: new Date().toISOString(),
        channel: phone ? 'whatsapp' : (email ? 'email' : 'unknown'),
        gbpLink: !!gbpLink,
        taLink: !!taLink,
      });
    }

    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify({
        success: true,
        message: action === 'send' ? 'Review request sent' : 'Preview generated',
        whatsappMessage,
        whatsappUrl,
        emailSubject,
        emailBody,
        gbpLink,
        taLink,
        preview: action === 'preview',
      })
    };
  }

  if (action === 'bulk') {
    // Bulk send for multiple completed bookings (cron job)
    const { bookings } = body; // Array of booking objects
    
    if (!Array.isArray(bookings) || bookings.length === 0) {
      return { statusCode: 400, headers: headers, body: JSON.stringify({ error: 'bookings array required' }) };
    }

    const results = [];
    for (const booking of bookings) {
      try {
        const alreadyRequested = await checkReviewRequested(store, booking.bookingRef, booking.serviceSlug);
        if (alreadyRequested) {
          results.push({ bookingRef: booking.bookingRef, status: 'skipped', reason: 'already_requested' });
          continue;
        }

        const svc = catalogue.services?.find(s => s.slug === booking.serviceSlug) || { name: booking.serviceName };
        const template = getTemplate(booking.language || 'en');
        
        const gbpLink = (process.env.GBP_REVIEW_LINK || '').trim();
        const taLink = (process.env.TRIPADVISOR_REVIEW_LINK || '').trim();
        
        const messageData = {
          name: booking.name || 'there',
          serviceName: svc.name || booking.serviceName,
          gbpLink,
          taLink,
        };
        
        const whatsappMessage = buildReviewMessage(template, messageData);
        
        await markReviewRequested(store, booking.bookingRef, booking.serviceSlug);
        
        // Log
        const logKey = 'review_log:' + booking.bookingRef + ':' + booking.serviceSlug;
        await store.setJSON(logKey, {
          bookingRef: booking.bookingRef,
          serviceSlug: booking.serviceSlug,
          serviceName: svc.name,
          phone: booking.phone,
          email: booking.email,
          language: booking.language || 'en',
          name: booking.name,
          sentAt: new Date().toISOString(),
          channel: booking.phone ? 'whatsapp' : (booking.email ? 'email' : 'unknown'),
        });

        results.push({ 
          bookingRef: booking.bookingRef, 
          status: 'sent',
          whatsappMessage,
          whatsappUrl: `https://wa.me/255707939265?text=${encodeURIComponent(whatsappMessage)}`,
        });
      } catch (e) {
        results.push({ bookingRef: booking.bookingRef, status: 'error', error: e.message });
      }
    }

    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify({
        success: true,
        total: bookings.length,
        sent: results.filter(r => r.status === 'sent').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        errors: results.filter(r => r.status === 'error').length,
        results,
      })
    };
  }

  if (action === 'stats') {
    // Get review request stats
    try {
      // This would need a proper index in production
      // For now, return basic stats from known keys
      return {
        statusCode: 200,
        headers: headers,
        body: JSON.stringify({
          success: true,
          message: 'Stats endpoint - implement with proper indexing',
        })
      };
    } catch (e) {
      return { statusCode: 500, headers: headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  return { statusCode: 400, headers: headers, body: JSON.stringify({ error: 'Invalid action' }) };
};