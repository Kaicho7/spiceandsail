/**
 * Review Request Trigger Component
 * Calls the review-capture function and offers a manual WhatsApp send.
 */
(function () {
  'use strict';

  const REVIEW_ENDPOINT = '/.netlify/functions/review-capture';
  const WHATSAPP_NUMBER = '255672450934';
  const LABELS = {
    en: 'Leave a Review',
    it: 'Lascia una recensione',
    de: 'Bewertung schreiben',
    fr: 'Laisser un avis',
    pl: 'Wystaw opinię'
  };

  let lastTriggerKey = '';

  function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      phone: params.get('phone') || '',
      serviceType: params.get('serviceType') || '',
      serviceName: params.get('serviceName') || '',
      bookingRef: params.get('bookingRef') || params.get('ref') || '',
      language: params.get('lang') || ''
    };
  }

  function getLanguage() {
    return (document.documentElement.lang || 'en').slice(0, 2).toLowerCase();
  }

  async function sendReviewRequest(params) {
    const response = await fetch(REVIEW_ENDPOINT, {
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

    const result = await response.json().catch(function () { return {}; });
    if (!response.ok || result.success === false) {
      throw new Error(result.error || 'Review request failed');
    }
    return result;
  }

  function showManualWhatsApp(params, result) {
    const container = document.getElementById('review-request-container');
    if (!container || !result || !result.whatsappMessage) return;

    const label = LABELS[params.language] || LABELS.en;
    const link = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(result.whatsappMessage);

    container.innerHTML =
      '<div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 1.5rem; margin: 1.5rem 0; text-align: center;">' +
        '<h3 style="color: #065f46; margin-bottom: 1rem;">Thank you for choosing Spice &amp; Sail Zanzibar</h3>' +
        '<p style="color: #047857; margin-bottom: 1.5rem;">Your feedback helps other travelers choose with confidence.</p>' +
        '<a id="review-wa-btn" target="_blank" rel="noopener" ' +
          'style="display: inline-block; background: #25D366; color: #fff; font-weight: 700; padding: 1rem 2rem; border-radius: 8px; text-decoration: none; font-size: 1.1rem;">' +
          label +
        '</a>' +
      '</div>';

    const button = document.getElementById('review-wa-btn');
    if (button) button.href = link;
  }

  async function trigger(customParams) {
    const params = Object.assign({}, getUrlParams(), customParams || {});
    params.language = params.language || getLanguage();

    if (!params.phone || !params.serviceType) return;

    const key = [params.phone, params.serviceType, params.bookingRef].join('|');
    if (key === lastTriggerKey) return;
    lastTriggerKey = key;

    try {
      const result = await sendReviewRequest(params);
      showManualWhatsApp(params, result);
    } catch (error) {
      console.warn('[Review Capture]', error.message);
    }
  }

  function autoTrigger() {
    const params = getUrlParams();
    if (params.phone && params.serviceType) trigger(params);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoTrigger);
  } else {
    autoTrigger();
  }

  window.SpiceReviewCapture = { trigger: trigger };
})();
