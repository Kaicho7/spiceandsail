/**
 * Review Request Trigger Component
 * Include on thank-you pages or call after service completion
 */
(function() {
  'use strict';

  // Configuration
  const REVIEW_ENDPOINT = '/.netlify/functions/review-capture';
  const WHATSAPP_NUMBER = '255672450934';
  // TODO: Replace with actual GBP and TripAdvisor review URLs when available
  const GBP_REVIEW_LINK = 'https://g.page/r/CREATE_YOUR_GBP_LINK_HERE/review';
  const TRIPADVISOR_LINK = 'https://www.tripadvisor.com/Review-CREATE_YOUR_TRIPADVISOR_LINK_HERE';

  // Get URL parameters
  function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      phone: params.get('phone') || '',
      serviceType: params.get('serviceType') || '',
      serviceName: params.get('serviceName') || '',
      bookingRef: params.get('bookingRef') || '',
      language: params.get('lang') || 'en'
    };
  }

  // Get language from HTML lang attribute or default
  function getLanguage() {
    return document.documentElement.lang || 'en';
  }

  // Send review request via Netlify function
  async function sendReviewRequest(params) {
    try {
      const response = await fetch('/.netlify/functions/review-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: params.phone,
          serviceType: params.serviceType,
          serviceName: params.serviceName,
          bookingRef: params.bookingRef,
          language: params.language
        })
      });

      const result = await response.json();
      console.log('[Review Capture] Response:', result);
      return result;
    } catch (error) {
      console.error('[Review Capture] Error:', error);
      return { success: false, error: error.message };
    }
  }

  // Generate direct WhatsApp link for manual sending
  function getWhatsAppLink(params) {
    const t = getTemplates()[params.language] || getTemplates().en;
    const message = `${t.greeting}\n\n${t.service.replace('${serviceName}', params.serviceName)}\n\n${t.ask}\n\n${t.gbp}\n${GBP_REVIEW_LINK}\n\n${t.ta}\n${TRIPADVISOR_LINK}\n\n${t.direct}\n\n${t.thanks}\n\n${t.unsubscribe}`;
    return `https://wa.me/255672450934?text=${encodeURIComponent(message)}`;
  }

  // Multilingual templates
  function getTemplates() {
    return {
      en: {
        greeting: 'Jambo! Thank you for choosing Spice & Sail Zanzibar.',
        service: 'We hope you enjoyed your ${serviceName}.',
        ask: 'Your feedback helps us improve and helps other travelers choose with confidence.',
        gbp: '📍 Google Review (takes 30 seconds):',
        ta: '⭐ TripAdvisor Review:',
        direct: 'Or simply reply to this WhatsApp with your thoughts — we read every message.',
        thanks: 'Asante sana! The Spice & Sail Team',
        unsubscribe: 'Reply STOP to opt out of review requests.'
      },
      it: {
        greeting: 'Jambo! Grazie per aver scelto Spice & Sail Zanzibar.',
        service: 'Speriamo che abbiate apprezzato il vostro ${serviceName}.',
        ask: 'Il tuo feedback ci aiuta a migliorare e aiuta altri viaggiatori a scegliere con fiducia.',
        gbp: '📍 Recensione Google (30 secondi):',
        ta: '⭐ Recensione TripAdvisor:',
        direct: 'Oppure rispondi semplicemente a questo WhatsApp con i tuoi pensieri — leggiamo tutto.',
        thanks: 'Asante sana! Il Team Spice & Sail',
        unsubscribe: 'Rispondi STOP per non ricevere più richieste di recensioni.'
      },
      de: {
        greeting: 'Jambo! Vielen Dank, dass Sie Spice & Sail Zanzibar gewählt haben.',
        service: 'Wir hoffen, Sie haben Ihr ${serviceName} genossen.',
        ask: 'Ihr Feedback hilft uns, uns zu verbessern, und anderen Reisenden bei der Entscheidung.',
        gbp: '📍 Google Bewertung (30 Sekunden):',
        ta: '⭐ TripAdvisor Bewertung:',
        direct: 'Oder antworten Sie einfach auf diese WhatsApp mit Ihren Gedanken — wir lesen jede Nachricht.',
        thanks: 'Asante sana! Das Spice & Sail Team',
        unsubscribe: 'Antworten Sie STOP, um keine Bewertungsanfragen mehr zu erhalten.'
      },
      fr: {
        greeting: 'Jambo! Merci d\'avoir choisi Spice & Sail Zanzibar.',
        service: 'Nous espérons que vous avez apprécié votre ${serviceName}.',
        ask: 'Votre avis nous aide à nous améliorer et aide les autres voyageurs à choisir en confiance.',
        gbp: '📍 Avis Google (30 secondes) :',
        ta: '⭐ Avis TripAdvisor :',
        direct: 'Ou répondez simplement à ce WhatsApp avec vos impressions — nous lisons tout.',
        thanks: 'Asante sana ! L\'équipe Spice & Sail',
        unsubscribe: 'Répondez STOP pour ne plus recevoir de demandes d\'avis.'
      },
      pl: {
        greeting: 'Jambo! Dziękujemy za wybranie Spice & Sail Zanzibar.',
        service: 'Mamy nadzieję, że podobało Ci się Twoje ${serviceName}.',
        ask: 'Twoja opinia pomaga nam się doskonalić i innym podróżnym w podejmowaniu decyzji.',
        gbp: '📍 Recenzja Google (30 sekund):',
        ta: '⭐ Recenzja TripAdvisor:',
        direct: 'Lub po prostu odpowiedz na ten WhatsApp swoimi myślami — czytaemy wszystko.',
        thanks: 'Asante sana! Zespół Spice & Sail',
        unsubscribe: 'Odpowiedz STOP, aby nie otrzymywać więcej prośb o recenzje.'
      }
    };

  // Auto-trigger on page load if params present
  function autoTrigger() {
    const params = getUrlParams();
    if (params.phone && params.serviceType) {
      // Add language
      params.language = getLanguage();
      // Send review request
      sendReviewRequest(params);
      
      // Also show manual WhatsApp button as fallback
      showManualWhatsAppButton(params);
    }
  }

  // Show manual WhatsApp button as fallback
  function showManualWhatsApp(params) {
    const container = document.getElementById('review-request-container');
    if (!container) return;

    const whatsappLink = getWhatsAppLink(params);
    const t = getTemplates()[params.language] || getTemplates().en;

    container.innerHTML = `
      <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 1.5rem; margin: 1.5rem 0; text-align: center;">
        <h3 style="color: #065f46; margin-bottom: 1rem;">${t.greeting.replace('Jambo! ', '')}</h3>
        <p style="color: #047857; margin-bottom: 1.5rem;">${t.service.replace('${serviceName}', params.serviceName)}</p>
        <a href="${getWhatsAppLink(params)}" target="_blank" rel="noopener" 
           style="display: inline-block; background: #25D366; color: #fff; font-weight: 700; padding: 1rem 2rem; border-radius: 8px; text-decoration: none; font-size: 1.1rem; margin-bottom: 1rem;">
          💬 ${params.language === 'it' ? 'Lascia una recensione' : params.language === 'de' ? 'Bewertung schreiben' : params.language === 'fr' ? 'Laisser un avis' : params.language === 'pl' ? 'Wystaw opinię' : 'Leave a Review'}
        </a>
        <p style="color: #065f46; font-size: 0.9rem; margin-top: 1rem;">${t.ask}</p>
      </div>
    `;
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoTrigger);
  } else {
    autoTrigger();
  }

  // Expose for manual triggering
  window.SpiceReviewCapture = {
    trigger: function(customParams) {
      const params = Object.assign({}, getUrlParams(), customParams, { language: getLanguage() });
      sendReviewRequest(params);
      showManualWhatsApp(params);
    }
  };
})();