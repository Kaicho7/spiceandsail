/**
 * Review Capture System - Netlify Function
 * Sends post-service WhatsApp review request with GBP/TripAdvisor links
 */
const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { phone, serviceType, serviceName, bookingRef, language = 'en' } = JSON.parse(event.body);

    if (!phone || !serviceType) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields: phone, serviceType' }) };
    }

    // Clean phone number (ensure E.164 format)
    const cleanPhone = phone.replace(/\D/g, '').startsWith('255') 
      ? phone.replace(/\D/g, '') 
      : '255' + phone.replace(/\D/g, '').replace(/^0/, '');

    // Generate review links - REPLACE THESE WITH ACTUAL URLS WHEN AVAILABLE
    const gbpLink = process.env.GBP_REVIEW_LINK || 'https://g.page/r/CREATE_YOUR_GBP_LINK_HERE/review';
    const tripadvisorLink = process.env.TRIPADVISOR_REVIEW_LINK || 'https://www.tripadvisor.com/Review-CREATE_YOUR_TRIPADVISOR_LINK_HERE';
    const whatsappNumber = '255672450934'; // Spice & Sail WhatsApp

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

    // Build WhatsApp message
    const message = `${t.greeting}\n\n${t.service}\n\n${t.ask}\n\n${t.gbp}\n${gbpLink}\n\n${t.ta}\n${tripadvisorLink}\n\n${t.direct}\n\n${t.thanks}\n\n${t.unsubscribe}`;

    // In production, send via WhatsApp Business API (Twilio, 360dialog, etc.)
    // For now, return the message for manual sending or integration
    console.log(`[REVIEW REQUEST] To: ${cleanPhone}, Service: ${serviceName}, Ref: ${bookingRef}`);
    console.log(`[REVIEW MESSAGE]:\n${message}`);

    // Return success with the message for logging/manual sending
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Review request queued',
        phone: cleanPhone,
        whatsappMessage: message,
        gbpLink,
        tripadvisorLink,
        whatsappDirectLink: `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Review for ${serviceName} (Ref: ${bookingRef}): `)}`
      })
    };

  } catch (error) {
    console.error('[REVIEW CAPTURE ERROR]', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error', details: error.message })
    };
  }
};