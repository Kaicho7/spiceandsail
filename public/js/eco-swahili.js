/* Spice & Sail shared booking and WhatsApp interactions */
(function () {
  'use strict';

  function waUrl(message) {
    var number = document.body.getAttribute('data-whatsapp-number') || '';
    if (!/^\d{8,15}$/.test(number)) return '';
    return 'https://wa.me/' + number + '?text=' + encodeURIComponent(message);
  }

  function localToday() {
    var now = new Date();
    var local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function initBookingForms() {
    document.querySelectorAll('[data-wa-booking-form]').forEach(function (form) {
      var date = form.querySelector('[name="date"]');
      if (date) date.min = localToday();
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var tripEl = form.querySelector('[name="trip"]');
        var dateEl = form.querySelector('[name="date"]');
        var guestsEl = form.querySelector('[name="guests"]');
        var kindEl = form.querySelector('[name="kind"]');
        var trip = (tripEl && tripEl.value || '').trim();
        var dateValue = dateEl && dateEl.value;
        var guests = guestsEl && guestsEl.value;
        var kind = kindEl && kindEl.value || 'enquiry';
        if (!trip || !dateValue || !guests || !form.reportValidity()) return;
        var kindLabel = kind === 'tour' ? 'Tour' : kind === 'transfer' ? 'Transfer' : 'Trip enquiry';
        var message = [
          'Jambo Spice & Sail! I would like to enquire about a ' + kindLabel.toLowerCase() + ': ' + trip + '.',
          'Preferred date: ' + dateValue + '.',
          'Guests: ' + guests + '.',
          'Please confirm availability and the final quote.'
        ].join(' ');
        var url = waUrl(message);
        if (!url) return;
        window.open(url, '_blank', 'noopener,noreferrer');
        track('whatsapp_enquiry', { enquiry_type: kind, item_name: trip, guest_count: Number(guests) });
      });
    });
  }

  function initCardWhatsAppLinks() {
    var cards = document.querySelectorAll('article.card, article.transfer-route-card, .transfer-route-card');
    cards.forEach(function (card) {
      if (card.querySelector('[data-trip-whatsapp]')) return;
      var detail = card.querySelector('a[href^="/tours/"], a[href^="/transfers/"]');
      var heading = card.querySelector('h2, h3, .card-title');
      if (!detail || !heading) return;
      var url;
      try { url = new URL(detail.getAttribute('href'), window.location.origin); } catch (_) { return; }
      if (url.origin !== window.location.origin || !/^\/(tours|transfers)\//.test(url.pathname)) return;
      var itemName = (heading.textContent || '').replace(/\s+/g, ' ').trim();
      if (!itemName) return;
      var category = url.pathname.indexOf('/transfers/') === 0 ? 'transfer' : 'tour';
      var message = 'Jambo Spice & Sail! I would like details and a quote for ' + category + ': ' + itemName + '. Please share availability.';
      var url = waUrl(message);
      if (!url) return;
      var link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.className = 'sns-card-whatsapp';
      link.setAttribute('data-trip-whatsapp', '');
      link.textContent = 'Ask on WhatsApp';
      var footer = card.querySelector('.card-footer, .route-actions, .card-actions, .card-content') || card;
      footer.appendChild(link);
    });
  }

  function track(eventName, params) {
    var id = window.SNS_ANALYTICS_ID;
    if (!id || !/^G-[A-Z0-9]+$/.test(id) || typeof window.gtag !== 'function') return;
    window.gtag('event', eventName, params || {});
  }

  function initContactAndAnalytics() {
    document.querySelectorAll('[data-sns-open]').forEach(function (link) {
      link.addEventListener('click', function (event) {
        if (window.snsConcierge && typeof window.snsConcierge.open === 'function') {
          event.preventDefault();
          window.snsConcierge.open();
        }
      });
    });
    document.addEventListener('click', function (event) {
      if (!event.target || !event.target.closest) return;
      var waLink = event.target.closest('a[href*="wa.me/"]');
      if (waLink) track('whatsapp_click', {
        link_url: waLink.getAttribute('href'),
        link_text: (waLink.textContent || '').trim().slice(0, 80)
      });
      var phoneLink = event.target.closest('a[href^="tel:"]');
      if (phoneLink) track('phone_click', { link_url: phoneLink.getAttribute('href') });
    });
    document.addEventListener('submit', function (event) {
      if (event.target && event.target.matches && event.target.matches('form.contact-form')) {
        track('contact_form_submit', { form_id: event.target.id || 'contact-form' });
      }
    }, true);
  }

  document.addEventListener('DOMContentLoaded', function () {
    initBookingForms();
    initCardWhatsAppLinks();
    initContactAndAnalytics();
  });
})();
