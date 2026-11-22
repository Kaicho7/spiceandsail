/**
 * Review Collection Engine
 * - Stores reviews in the platform KV store
 * - Displays reviews on site
 * - Automates post-trip review requests
 * - Syndicates to Google/TripAdvisor
 */
'use strict';

const { corsHeaders, isAllowedOrigin, checkRateLimit, getClientIP } = require('../concierge/security');
const { getGlobalStore, createStore, setGlobalStore } = require('../concierge/store');
const { catalogue, CONFIG } = require('../concierge/catalogue');
const crypto = require('node:crypto');

function ensureStore() {
  try { getGlobalStore(); } catch (e) {
    setGlobalStore(createStore('memory'));
  }
}

function generateReviewId() {
  return 'rev_' + crypto.randomBytes(8).toString('hex');
}

function payloadHash(body) {
  const key = JSON.stringify({
    bookingRef: body.bookingRef,
    phone: body.phone,
    serviceSlug: body.serviceSlug,
  });
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
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
    subject: 'Comment s\'est passé votre {serviceName} ? 🌊',
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

exports.handler = async function (event) {
  const origin = event.headers && event.headers.origin;
  const headers = corsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: headers, body: '' };
  }

  if (event.httpMethod === 'GET') {
    // GET /review-capture?serviceSlug=... - returns review stats for display
    const url = new URL(event.rawUrl);
    const serviceSlug = url.searchParams.get('serviceSlug');
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);
    
    ensureStore();
    const store = getGlobalStore();
    
    try {
      let reviews = [];
      if (serviceSlug) {
        const key = 'reviews:' + serviceSlug;
        const stored = await store.getJSON(key);
        reviews = stored?.reviews || [];
      } else {
        // Get all reviews for aggregate stats
        // This is a simplified version - in production you'd want an index
        reviews = [];
      }
      
      const approved = reviews.filter(r => r.status === 'approved');
      const avgRating = approved.length ? (approved.reduce((sum, r) => sum + r.rating, 0) / approved.length).toFixed(1) : null;
      
      return {
        statusCode: 200,
        headers: headers,
        body: JSON.stringify({
          total: reviews.length,
          approved: approved.length,
          avgRating,
          reviews: approved.slice(0, limit).map(r => ({
            id: r.id,
            rating: r.rating,
            text: r.text,
            author: r.authorName || 'Anonymous',
            serviceSlug: r.serviceSlug,
            createdAt: r.createdAt,
            source: r.source || 'direct',
          }))
        })
      };
    } catch (e) {
      return { statusCode: 200, headers: headers, body: JSON.stringify({ total: 0, approved: 0, avgRating: null, reviews: [] }) };
    }
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
  const rl = await checkRateLimit(ip, 'review-capture', 30, 3600000, store);
  if (!rl.allowed) {
    return { statusCode: 429, headers: headers, body: JSON.stringify({ error: 'Too many requests' }) };
  }

  let body;
  try { body = JSON.parse(event.body); } catch (e) {
    return { statusCode: 400, headers: headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const action = body.action || 'request';

  if (action === 'request') {
    // Trigger a review request (sent via WhatsApp by the client or via webhook)
    const { bookingRef, phone, serviceSlug, serviceName, language = 'en', name } = body;
    
    if (!bookingRef || !phone || !serviceSlug) {
      return { statusCode: 400, headers: headers, body: JSON.stringify({ error: 'Missing required fields: bookingRef, phone, serviceSlug' }) };
    }

    // Check if review already requested for this booking
    const hash = payloadHash(body);
    const idempotencyKey = 'review_request:' + hash;
    try {
      const existing = await store.getJSON(idempotencyKey);
      if (existing) {
        return { statusCode: 200, headers: headers, body: JSON.stringify({ success: true, message: 'Review already requested', alreadySent: true }) };
      }
    } catch (e) { /* continue */ }

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
    const whatsappUrl = `https://wa.me/255672450934?text=${encodeURIComponent(whatsappMessage)}`;
    
    // Store idempotency record
    await store.setJSON(idempotencyKey, { 
      sentAt: new Date().toISOString(),
      bookingRef,
      phone,
      serviceSlug,
      language,
    });

    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify({
        success: true,
        message: 'Review request prepared',
        whatsappMessage,
        whatsappUrl,
        gbpLink,
        taLink,
      })
    };
  }

  if (action === 'submit') {
    // Submit a review (from customer via WhatsApp reply or website form)
    const { bookingRef, phone, serviceSlug, rating, text, authorName, source = 'direct' } = body;
    
    if (!bookingRef || !phone || !serviceSlug || !rating) {
      return { statusCode: 400, headers: headers, body: JSON.stringify({ error: 'Missing required fields: bookingRef, phone, serviceSlug, rating' }) };
    }

    if (rating < 1 || rating > 5) {
      return { statusCode: 400, headers: headers, body: JSON.stringify({ error: 'Rating must be 1-5' }) };
    }

    // Idempotency check
    const hash = payloadHash({ bookingRef, phone, serviceSlug });
    const idempotencyKey = 'review_submit:' + hash;
    try {
      const existing = await store.getJSON(idempotencyKey);
      if (existing) {
        return { statusCode: 200, headers: headers, body: JSON.stringify({ success: true, message: 'Review already submitted', reviewId: existing.reviewId }) };
      }
    } catch (e) { /* continue */ }

    const reviewId = generateReviewId();
    const review = {
      id: reviewId,
      bookingRef,
      phone,
      serviceSlug,
      serviceName: body.serviceName,
      rating: parseInt(rating, 10),
      text: text || '',
      authorName: authorName || 'Anonymous',
      source,
      status: 'pending', // pending, approved, rejected
      createdAt: new Date().toISOString(),
      language: body.language || 'en',
    };

    // Store review
    const key = 'reviews:' + serviceSlug;
    let stored = { reviews: [] };
    try {
      stored = await store.getJSON(key);
    } catch (e) { /* new */ }
    stored.reviews = stored.reviews || [];
    stored.reviews.unshift(review); // newest first
    await store.setJSON(key, stored);

    // Store idempotency record
    await store.setJSON(idempotencyKey, { reviewId, submittedAt: new Date().toISOString() });

    // If 5-star, trigger Google/TripAdvisor redirect suggestion
    let redirectSuggestion = null;
    if (rating === 5) {
      redirectSuggestion = {
        message: 'Would you also share your experience on Google or TripAdvisor?',
        gbpLink: (process.env.GBP_REVIEW_LINK || '').trim(),
        taLink: (process.env.TRIPADVISOR_REVIEW_LINK || '').trim(),
      };
    }

    return {
      statusCode: 201,
      headers: headers,
      body: JSON.stringify({
        success: true,
        reviewId,
        message: 'Review submitted successfully',
        redirectSuggestion,
      })
    };
  }

  if (action === 'moderate') {
    // Moderate a review (admin only - would need auth in production)
    const { reviewId, serviceSlug, status } = body;
    
    if (!reviewId || !serviceSlug || !status) {
      return { statusCode: 400, headers: headers, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    const key = 'reviews:' + serviceSlug;
    try {
      const stored = await store.getJSON(key);
      if (stored && stored.reviews) {
        const review = stored.reviews.find(r => r.id === reviewId);
        if (review) {
          review.status = status; // approved, rejected
          review.moderatedAt = new Date().toISOString();
          await store.setJSON(key, stored);
          return { statusCode: 200, headers: headers, body: JSON.stringify({ success: true, message: 'Review moderated' }) };
        }
      }
    } catch (e) { /* not found */ }
    
    return { statusCode: 404, headers: headers, body: JSON.stringify({ error: 'Review not found' }) };
  }

  return { statusCode: 400, headers: headers, body: JSON.stringify({ error: 'Invalid action' }) };
};