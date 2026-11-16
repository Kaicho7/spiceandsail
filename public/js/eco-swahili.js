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
    document.querySelectorAll('[data-concierge-booking-form]').forEach(function (form) {
      var date = form.querySelector('[name="date"]');
      if (date) date.min = localToday();

      form.addEventListener('submit', function (event) {
        event.preventDefault();
        if (!form.reportValidity()) return;

        var dateEl = form.querySelector('[name="date"]');
        var guestsEl = form.querySelector('[name="guests"]');
        var submit = form.querySelector('button[type="submit"]');
        var options = {
          serviceSlug: form.getAttribute('data-service-slug') || '',
          date: dateEl ? dateEl.value : '',
          guests: guestsEl ? guestsEl.value : ''
        };

        if (!window.snsConcierge || typeof window.snsConcierge.openBooking !== 'function') {
          track('concierge_booking_unavailable', { service_slug: options.serviceSlug });
          return;
        }

        var originalText = submit ? submit.textContent : '';
        if (submit) {
          submit.disabled = true;
          submit.textContent = 'Opening your concierge…';
        }

        Promise.resolve(window.snsConcierge.openBooking(options)).then(function (opened) {
          if (opened) {
            track('concierge_booking_opened', {
              service_slug: options.serviceSlug,
              guest_count: Number(options.guests)
            });
          }
        }).catch(function () {
          // The concierge shows its own safe error and WhatsApp fallback.
        }).then(function () {
          if (submit) {
            submit.disabled = false;
            submit.textContent = originalText;
          }
        });
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

  function initClickToLoadMaps() {
    document.querySelectorAll('[data-map-embed][data-map-src]').forEach(function (wrapper) {
      var button = wrapper.querySelector('.sns-map-load-button');
      if (!button) return;
      button.addEventListener('click', function () {
        if (wrapper.getAttribute('data-map-loaded') === 'true') return;
        var src = wrapper.getAttribute('data-map-src');
        if (!src || !/^https:\/\/www\.google\.com\/maps\/embed\?/.test(src)) return;
        var frame = document.createElement('iframe');
        frame.title = 'Spice and Sail Zanzibar Operations Hub Location';
        frame.width = '100%';
        frame.height = '320';
        frame.loading = 'eager';
        frame.referrerPolicy = 'strict-origin-when-cross-origin';
        frame.allowFullscreen = true;
        frame.setAttribute('frameborder', '0');
        frame.setAttribute('scrolling', 'no');
        frame.src = src;
        wrapper.setAttribute('data-map-loaded', 'true');
        wrapper.replaceChildren(frame);
        track('map_load', { map_provider: 'google_maps' });
      });
    });
  }

  function initDirectBookingButtons() {
    document.querySelectorAll('[data-sns-booking-open]').forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.preventDefault();
        var serviceSlug = button.getAttribute('data-service-slug') || '';
        if (!serviceSlug || !window.snsConcierge || typeof window.snsConcierge.openBooking !== 'function') {
          return;
        }
        var originalText = button.textContent;
        button.disabled = true;
        button.textContent = 'Opening concierge…';
        Promise.resolve(window.snsConcierge.openBooking({ serviceSlug: serviceSlug }))
          .then(function (opened) {
            if (opened) track('concierge_booking_opened', { service_slug: serviceSlug, source: 'hero_cta' });
          })
          .catch(function () {
            // The concierge shows its own safe error and fallback.
          })
          .then(function () {
            button.disabled = false;
            button.textContent = originalText;
          });
      });
    });
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

  function initHeaderScrollHide() {
    var header = document.getElementById('siteHeader');
    if (!header) return;
    var lastScroll = 0;
    var ticking = false;
    var threshold = 100;
    function onScroll() {
      var current = window.scrollY;
      if (current > threshold) {
        if (current > lastScroll) {
          header.classList.add('site-header--hidden');
        } else {
          header.classList.remove('site-header--hidden');
        }
      } else {
        header.classList.remove('site-header--hidden');
      }
      lastScroll = current;
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) {
        window.requestAnimationFrame(onScroll);
        ticking = true;
      }
    }, { passive: true });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initBookingForms();
    initCardWhatsAppLinks();
    initClickToLoadMaps();
    initDirectBookingButtons();
    initContactAndAnalytics();
    initHeaderScrollHide();
  });
})();
