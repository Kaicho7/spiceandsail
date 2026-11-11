/**
 * Review Capture System - Netlify Function
 * Builds a post-service WhatsApp review request with configured GBP/TripAdvisor links.
 */
const HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

function allowedOrigin(value) {
  if (!value) return false;
  try {
    const host = new URL(value).hostname;
    return host === 'spiceandsail.com'
      || host === 'www.spiceandsail.com'
      || host === 'spiceandsail.netlify.app'
      || host.endsWith('--spiceandsail.netlify.app')
      || host === 'localhost'
      || host === '127.0.0.1';
  } catch (e) {
    return false;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const origin = event.headers.origin || event.headers.Origin || event.headers.referer || event.headers.Referer;
  if (!allowedOrigin(origin)) {
    return { statusCode: 403, headers: HEADERS, body: JSON.stringify({ error: 'Origin not allowed' }) };
  }

  try {
    const { phone, serviceType, serviceName, bookingRef, language = 'en' } = JSON.parse(event.body);

    if (!phone || !serviceType) {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Missing required fields: phone, serviceType' }) };
    }

    // Review links are owner-configured; never substitute placeholder URLs.
    const gbpLink = (process.env.GBP_REVIEW_LINK || '').trim();
    const tripadvisorLink = (process.env.TRIPADVISOR_REVIEW_LINK || '').trim();
    const whatsappNumber = '255672450934'; // Spice & Sail WhatsApp

    if (!gbpLink && !tripadvisorLink) {
      return {
        statusCode: 503,
        headers: HEADERS,
        body: JSON.stringify({ error: 'Review links are not configured' })
      };
    }

    // Multilingual templates
    const templates = {
      en: {
        greeting: 'Jambo! Thank you for choosing Spice & Sail Zanzibar.',
        service: `We hope you enjoyed your ${serviceName}.`,
        ask: 'Your feedback helps us improve and helps other travelers choose with confidence.',
        gbp: '📍 Google Review (takes 30 seconds):',
        ta: '⭐ TripAdvisor Review:',
        direct: 'Or simply reply to this WhatsApp with your thoughts — we read every message.',
        thanks: 'Asante sana! The Spice & Sail Team',
        unsubscribe: 'Reply STOP to opt out of review requests.'
      },
      it: {
        greeting: 'Jambo! Grazie per aver scelto Spice & Sail Zanzibar.',
        service: `Speriamo che abbiate apprezzato il vostro ${serviceName}.`,
        ask: 'Il tuo feedback ci aiuta a migliorare e aiuta altri viaggiatori a scegliere con fiducia.',
        gbp: '📍 Recensione Google (30 secondi):',
        ta: '⭐ Recensione TripAdvisor:',
        direct: 'Oppure rispondi semplicemente a questo WhatsApp con i tuoi pensieri — leggiamo tutto.',
        thanks: 'Asante sana! Il Team Spice & Sail',
        unsubscribe: 'Rispondi STOP per non ricevere più richieste di recensioni.'
      },
      de: {
        greeting: 'Jambo! Vielen Dank, dass Sie Spice & Sail Zanzibar gewählt haben.',
        service: `Wir hoffen, Sie haben Ihr ${serviceName} genossen.`,
        ask: 'Ihr Feedback hilft uns, uns zu verbessern, und anderen Reisenden bei der Entscheidung.',
        gbp: '📍 Google Bewertung (30 Sekunden):',
        ta: '⭐ TripAdvisor Bewertung:',
        direct: 'Oder antworten Sie einfach auf diese WhatsApp mit Ihren Gedanken — wir lesen jede Nachricht.',
        thanks: 'Asante sana! Das Spice & Sail Team',
        unsubscribe: 'Antworten Sie STOP, um keine Bewertungsanfragen mehr zu erhalten.'
      },
      fr: {
        greeting: 'Jambo! Merci d\'avoir choisi Spice & Sail Zanzibar.',
        service: `Nous espérons que vous avez apprécié votre ${serviceName}.`,
        ask: 'Votre avis nous aide à nous améliorer et aide les autres voyageurs à choisir en confiance.',
        gbp: '📍 Avis Google (30 secondes) :',
        ta: '⭐ Avis TripAdvisor :',
        direct: 'Ou répondez simplement à ce WhatsApp avec vos impressions — nous lisons tout.',
        thanks: 'Asante sana ! L\'équipe Spice & Sail',
        unsubscribe: 'Répondez STOP pour ne plus recevoir de demandes d\'avis.'
      },
      pl: {
        greeting: 'Jambo! Dziękujemy za wybranie Spice & Sail Zanzibar.',
        service: `Mamy nadzieję, że podobało Ci się Twoje ${serviceName}.`,
        ask: 'Twoja opinia pomaga nam się doskonalić i innym podróżnym w podejmowaniu decyzji.',
        gbp: '📍 Recenzja Google (30 sekund):',
        ta: '⭐ Recenzja TripAdvisor:',
        direct: 'Lub po prostu odpowiedz na ten WhatsApp swoimi myślami — czytaemy wszystko.',
        thanks: 'Asante sana! Zespół Spice & Sail',
        unsubscribe: 'Odpowiedz STOP, aby nie otrzymywać więcej prośb o recenzje.'
      }
    };

    const t = templates[language] || templates.en;
    const reviewLinks = [];
    if (gbpLink) reviewLinks.push(`${t.gbp}\n${gbpLink}`);
    if (tripadvisorLink) reviewLinks.push(`${t.ta}\n${tripadvisorLink}`);

    // Build the WhatsApp message; it is returned for the client to send manually.
    const message = [t.greeting, t.service, t.ask, ...reviewLinks, t.direct, t.thanks, t.unsubscribe].join('\n\n');

    console.log(`[REVIEW REQUEST] Service: ${serviceName || 'n/a'}, Ref: ${bookingRef || 'n/a'}`);

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({
        success: true,
        message: 'Review request prepared',
        whatsappMessage: message,
        gbpLink,
        tripadvisorLink,
        whatsappDirectLink: `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Review for ${serviceName} (Ref: ${bookingRef}): `)}`
      })
    };

  } catch (error) {
    console.error('[REVIEW CAPTURE ERROR]', error.message);
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};