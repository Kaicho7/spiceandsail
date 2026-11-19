/* ==========================================================================
   Spice and Sail Zanzibar — Interactive AI Concierge Widget v2
   Chat-style interface with quick replies, real-time pricing, payment links
   ========================================================================== */
(function() {
  'use strict';

  /* ==========================================================================
     State Management
     ========================================================================== */
  var state = {
    currentStep: 1,
    selectedSlug: null,
    selectedSlugs: [],
    selectedHotel: null,
    services: [],
    hotels: [],
    zones: [],
    config: {},
    lastQuoteData: null,
    lastQuoteDisplay: null,
    lastReference: null,
    lastPaymentRef: null,
    lastPaymentLinks: null,
    profile: {},
    isOpen: false,
    calloutDismissed: false
  };

  /* ==========================================================================
     DOM Helpers
     ========================================================================== */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }
  function el(id) { return document.getElementById(id); }
  function hide(el) { if (el) el.hidden = true; }
  function show(el) { if (el) el.hidden = false; }
  function toggle(el, force) { if (el) el.hidden = (force !== undefined ? !force : el.hidden); }

  function getStatusEl() { return el('sns-status'); }
  function showStatus(type, msg, actionLabel, actionFn) {
    var s = getStatusEl();
    if (!s) return;
    s.textContent = msg;
    s.className = 'sns-submit-status ' + (type || '');
    s.hidden = false;
    if (actionLabel && actionFn && !s.querySelector('.sns-status-action')) {
      var btn = document.createElement('button');
      btn.className = 'sns-status-action';
      btn.type = 'button';
      btn.style.marginLeft = '0.75rem';
      btn.style.padding = '0.25rem 0.75rem';
      btn.style.fontSize = '0.8rem';
      btn.style.fontWeight = '600';
      btn.style.border = 'none';
      btn.style.borderRadius = '9999px';
      btn.style.cursor = 'pointer';
      btn.style.background = type === 'success' ? '#007B6B' : '#D4AF37';
      btn.style.color = '#fff';
      btn.textContent = actionLabel;
      btn.onclick = actionFn;
      s.appendChild(btn);
    }
  }

  /* ==========================================================================
     Data Loading
     ========================================================================== */
  function loadCatalogue() {
    // Load from inline data attribute or fetch
    var dataEl = document.getElementById('sns-catalogue-data');
    if (dataEl) {
      try {
        var data = JSON.parse(dataEl.textContent);
        state.services = data.services || [];
        state.hotels = data.hotels || [];
        state.zones = data.zones || [];
        state.config = data.config || {};
        return Promise.resolve();
      } catch (e) { console.warn('Inline catalogue parse failed', e); }
    }
    // Fallback: fetch from API
    return fetch('/.netlify/functions/catalogue', { credentials: 'same-origin' })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        state.services = data.services || [];
        state.hotels = data.hotels || [];
        state.zones = data.zones || [];
        state.config = data.config || {};
      })
      .catch(function() { console.warn('Catalogue fetch failed'); });
  }

  /* ==========================================================================
     UI Rendering
     ========================================================================== */
  function renderServiceGrid() {
    var grid = el('sns-service-grid');
    if (!grid) return;
    
    // Filter to show main services (tours, experiences, packages, transfers)
    var displayServices = state.services.filter(function(s) {
      return ['tour', 'experience', 'package', 'transfer'].includes(s.type);
    });

    grid.innerHTML = displayServices.map(function(svc) {
      var pricing = svc.pricing || {};
      var displayPrice = pricing.display || 'Price on request';
      var categoryLabels = { MAR: '🌊 Marine', CUL: '🌿 Culture', NAT: '🌳 Nature', SAF: '🦁 Safari', PKG: '📦 Package', EXP: '✨ Experience', TRF: '🚗 Transfer' };
      var cat = categoryLabels[svc.category] || svc.category;
      
      return '<label class="sns-service-card" data-slug="' + svc.slug + '">' +
        '<input type="radio" name="sns-service" value="' + svc.slug + '" aria-label="Select ' + svc.name + '">' +
        '<div class="sns-service-content">' +
          '<span class="sns-service-category">' + cat + '</span>' +
          '<span class="sns-service-title">' + svc.name + '</span>' +
          '<span class="sns-service-desc">' + (svc.duration || '') + '</span>' +
          '<span class="sns-service-price">' + displayPrice + '</span>' +
        '</div>' +
      '</label>';
    }).join('');

    // Add click handlers
    $$('.sns-service-card', grid).forEach(function(card) {
      card.addEventListener('click', function() {
        var slug = this.getAttribute('data-slug');
        selectService(slug);
      });
    });
  }

  function renderHotelGrid() {
    var grid = el('sns-hotel-grid');
    if (!grid) return;
    
    // 5 contracted hotels from hotel-contracts.json
    var displayHotels = state.hotels.filter(function(h) { return h.contractStatus === 'confirmed'; });
    
    grid.innerHTML = displayHotels.map(function(hotel) {
      var pricing = hotel.pricing || {};
      var displayPrice = pricing.display || 'Rate on request';
      return '<label class="sns-service-card" data-hotel="' + hotel.slug + '">' +
        '<input type="radio" name="sns-hotel" value="' + hotel.slug + '" aria-label="Select ' + hotel.name + '">' +
        '<div class="sns-service-content">' +
          '<span class="sns-service-category">🏨 Hotel</span>' +
          '<span class="sns-service-title">' + hotel.name + '</span>' +
          '<span class="sns-service-desc">' + hotel.location + '</span>' +
          '<span class="sns-service-price">' + displayPrice + '</span>' +
        '</div>' +
      '</label>';
    }).join('');

    $$('.sns-service-card', grid).forEach(function(card) {
      card.addEventListener('click', function() {
        var slug = this.getAttribute('data-hotel');
        selectHotel(slug);
      });
    });
  }

  function renderQuickReplies(replies) {
    var container = el('sns-quick-replies');
    if (!container) return;
    container.innerHTML = (replies || []).map(function(label) {
      var isWA = label.toLowerCase().includes('whatsapp') || label.toLowerCase().includes('chat');
      return '<button type="button" class="sns-chat-quick-btn' + (isWA ? ' sns-quick-wa' : '') + '" data-action="' + (isWA ? 'whatsapp' : 'reply') + '">' + label + '</button>';
    }).join('');

    $$('.sns-chat-quick-btn', container).forEach(function(btn) {
      btn.addEventListener('click', function() {
        var action = this.getAttribute('data-action');
        if (action === 'whatsapp') { openDirectWhatsApp(); }
        else { handleUserReply(this.textContent); }
      });
    });
  }

  function addBotMessage(text, quickReplies) {
    var messagesEl = el('sns-messages');
    if (!messagesEl) return;
    var div = document.createElement('div');
    div.className = 'sns-chat-bubble bot';
    div.innerHTML = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    if (quickReplies) renderQuickReplies(quickReplies);
  }

  function addUserMessage(text) {
    var messagesEl = el('sns-messages');
    if (!messagesEl) return;
    var div = document.createElement('div');
    div.className = 'sns-chat-bubble user';
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showTyping() {
    var messagesEl = el('sns-messages');
    if (!messagesEl) return;
    var div = document.createElement('div');
    div.className = 'sns-chat-bubble bot typing';
    div.id = 'sns-typing-indicator';
    div.innerHTML = '<span></span><span></span><span></span>';
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTyping() {
    var t = el('sns-typing-indicator');
    if (t) t.remove();
  }

  /* ==========================================================================
     Step Navigation
     ========================================================================== */
  function goToStep(step) {
    state.currentStep = step;
    
    // Hide all steps
    $$('.sns-form-step').forEach(hide);
    hide(el('sns-service-grid'));
    hide(el('sns-hotel-grid'));
    
    // Show current step
    if (step === 1) {
      show(el('sns-service-grid'));
      renderServiceGrid();
      addBotMessage('Perfect! What kind of experience are you looking for?', [
        '🌊 Marine & Snorkeling', '🌿 Culture & History', '🦁 Safari & Wildlife',
        '🚗 Airport Transfers', '🏨 Book a Hotel', '💬 Chat with Team'
      ]);
    } else if (step === 2) {
      show(el('sns-form-step#sns-step-2'));
      addBotMessage('Great choice! <strong>' + getServiceName(state.selectedSlug) + '</strong>. Now I need a few details to give you an exact quote.', [
        '📅 Flexible dates', '👥 2 adults', '🏨 Pickup from hotel'
      ]);
    } else if (step === 3) {
      show(el('sns-form-step#sns-step-3'));
      // Quote will be loaded after getQuote()
    } else if (step === 'hotel') {
      show(el('sns-hotel-grid'));
      renderHotelGrid();
      addBotMessage('We have 5 contracted hotels with confirmed rates. Which one interests you?', [
        '🏨 The One Resort', '🏨 Le Paradis Boutique', '🏨 Mkeka Spice Lodge',
        '🏨 Stone Town View', '🏨 The Island Stone Town'
      ]);
    }
  }

  function getServiceName(slug) {
    var svc = state.services.find(function(s) { return s.slug === slug; });
    return svc ? svc.name : slug;
  }

  function getHotelName(slug) {
    var h = state.hotels.find(function(h) { return h.slug === slug; });
    return h ? h.name : slug;
  }

  function selectService(slug) {
    state.selectedSlug = slug;
    state.selectedSlugs = [slug];
    state.profile.serviceSlugs = [slug];
    
    // Update UI
    $$('.sns-service-card').forEach(function(c) { c.classList.remove('selected'); });
    var selected = $('.sns-service-card[data-slug="' + slug + '"]');
    if (selected) selected.classList.add('selected');
    
    var svc = state.services.find(function(s) { return s.slug === slug; });
    var msg = 'Excellent choice! <strong>' + (svc ? svc.name : slug) + '</strong>.';
    if (svc && svc.duration) msg += ' Duration: ' + svc.duration + '.';
    if (svc && svc.includes && svc.includes.length) msg += ' Includes: ' + svc.includes.join(', ') + '.';
    
    addUserMessage('I\'d like to book ' + (svc ? svc.name : slug));
    setTimeout(function() { addBotMessage(msg, ['📅 Next: Choose Date', '👥 2 Adults', '🏨 My Hotel']); }, 300);
    
    setTimeout(function() { goToStep(2); }, 600);
  }

  function selectHotel(slug) {
    state.selectedHotel = slug;
    var hotel = state.hotels.find(function(h) { return h.slug === slug; });
    var msg = 'Perfect! <strong>' + (hotel ? hotel.name : slug) + '</strong> in ' + (hotel ? hotel.location : '') + '.';
    if (hotel && hotel.pricing) msg += ' Rates from ' + hotel.pricing.display + ' per night (breakfast included).';
    
    addUserMessage('I\'m interested in ' + (hotel ? hotel.name : slug));
    setTimeout(function() { 
      addBotMessage(msg + ' Our team will confirm availability and send you a WhatsApp link to secure your room with a 10% deposit.', [
        '💬 WhatsApp for Availability', '📅 Check Dates', '🔙 Back to Tours'
      ]); 
    }, 300);
  }

  /* ==========================================================================
     Quote Fetching
     ========================================================================== */
  function getQuote() {
    var btn = el('sns-btn-get-quote');
    if (btn) { btn.disabled = true; btn.textContent = 'Calculating…'; }
    showStatus('', 'Fetching your published rate from the verified catalogue…');

    var payload = {
      serviceSlugs: state.selectedSlugs.slice(),
      adults: parseInt($('#sns-adults').value || '2', 10),
      children: parseInt($('#sns-children').value || '0', 10),
      date: $('#sns-date').value || null,
      pickupZone: $('#sns-pickup').value || null,
      driverLang: $('#sns-driver-lang').value || 'en',
      special: $('#sns-special').value || ''
    };

    fetchJSON('/.netlify/functions/quote', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, 12000).then(function(res) {
      if (btn) { btn.disabled = false; btn.textContent = 'Get My Quote →'; }
      if (res.ok && res.json && res.json.totalDisplay) {
        state.lastQuoteData = res.json;
        state.lastQuoteDisplay = res.json.totalDisplay;
        displayQuote(res.json);
        goToStep(3);
        showStatus('success', 'Your planning range is ready. Add contact details to get a booking reference.', null, null);
      } else {
        throw new Error('Quote unavailable');
      }
    }).catch(function() {
      if (btn) { btn.disabled = false; btn.textContent = 'Get My Quote →'; }
      showStatus('error', 'Could not fetch rate right now. Our team will confirm via WhatsApp.');
    });
  }

  function displayQuote(quote) {
    var preview = el('sns-quote-preview');
    var amount = el('sns-quote-amount');
    var summary = el('sns-quote-summary');
    var perks = el('sns-quote-perks');
    var note = el('sns-quote-note');

    if (amount) amount.textContent = quote.totalDisplay + ' USD';
    
    var bits = [];
    (quote.lines || []).forEach(function(l) { if (l && l.label) bits.push(l.label); });
    (quote.notes || []).forEach(function(n) { bits.push(n); });
    (quote.reasons || []).forEach(function(r) { bits.push(r); });
    if (summary) summary.textContent = bits.join(' ') || 'Planning range — our team confirms the final price, dates and pickup window.';
    
    if (perks) {
      perks.innerHTML = (quote.includes || []).map(function(i) {
        return '<li><span aria-hidden="true">✓</span> ' + i + '</li>';
      }).join('');
    }

    if (quote.flags && quote.flags.includes('pickup_supplement_on_request') && note) {
      note.textContent = 'Pickup supplement from your zone: our team confirms the exact amount.';
      show(note);
    } else if (note) { hide(note); }

    show(preview);
  }

  /* ==========================================================================
     Payment Options
     ========================================================================== */
  function openPaymentOptions() {
    if (!state.selectedSlugs.length) { showStatus('error', 'Please select an experience first.'); return; }
    
    var btn = el('sns-btn-payment');
    if (btn) { btn.disabled = true; btn.textContent = 'Loading payment options…'; }
    showStatus('', 'Loading secure payment options…');

    var payload = {
      serviceSlug: state.selectedSlug,
      adults: parseInt($('#sns-adults').value || '2', 10),
      children: parseInt($('#sns-children').value || '0', 10),
      date: $('#sns-date').value || null,
      pickupZone: $('#sns-pickup').value || null,
      email: $('#sns-email').value || null
    };

    fetchJSON('/.netlify/functions/payment-link', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, 15000).then(function(res) {
      if (btn) { btn.disabled = false; btn.textContent = '💳 Choose Payment Method'; }
      if (res.ok && res.json && res.json.paymentLinks) {
        state.lastPaymentRef = res.json.bookingRef;
        state.lastPaymentLinks = res.json.paymentLinks;
        showPaymentModal(res.json);
        saveLead({ notes: 'Payment initiated. Deposit: ' + (res.json.depositPercent || 0) + '%. Providers: ' + res.json.paymentLinks.map(function(l) { return l.name; }).join(', ') + '.' });
      } else {
        var detail = (res.json && res.json.error) ? res.json.error : 'Payment system unavailable';
        var waUrl = res.json && res.json.whatsapp_url ? res.json.whatsapp_url : null;
        if (waUrl) { showStatus('error', detail); showWhatsAppFallback(waUrl); }
        else { showStatus('error', detail); }
      }
    }).catch(function() {
      if (btn) { btn.disabled = false; btn.textContent = '💳 Choose Payment Method'; }
      showStatus('error', 'Could not connect to payment system. Please try again or contact us via WhatsApp.');
    });
  }

  function showPaymentModal(data) {
    var modal = el('sns-payment-modal');
    var deposit = el('sns-payment-deposit');
    var total = el('sns-payment-total');
    var service = el('sns-payment-service');
    var options = el('sns-payment-options');
    var waLink = el('sns-payment-wa-link');

    var depositText = data.depositPercent > 0 
      ? 'Pay ' + data.depositPercent + '% deposit (' + data.depositAmount + ' USD) to confirm'
      : 'Zero deposit required — pay driver on arrival';
    
    if (deposit) deposit.textContent = depositText;
    if (total) total.textContent = 'Total: ' + data.totalAmount + ' USD';
    if (service) service.textContent = data.serviceName;
    
    if (options) {
      options.innerHTML = data.paymentLinks.map(function(link) {
        var isManual = link.manual || false;
        var primaryClass = link.primary ? ' primary' : '';
        var supports = link.supports ? link.supports.join(', ') : '';
        return '<button type="button" class="sns-payment-option' + primaryClass + '" data-url="' + (link.url || '') + '" data-manual="' + isManual + '" data-provider="' + link.provider + '">' +
          '<span class="sns-payment-icon">' + (link.icon || '💳') + '</span>' +
          '<div class="sns-payment-info">' +
            '<strong class="sns-payment-name">' + link.name + '</strong>' +
            '<span class="sns-payment-desc">' + link.description + '</span>' +
            '<span class="sns-payment-supports">Supports: ' + supports + '</span>' +
          '</div>' +
          '<span class="sns-payment-arrow">→</span>' +
        '</button>';
      }).join('');

      $$('.sns-payment-option', options).forEach(function(btn) {
        btn.addEventListener('click', function() {
          var url = this.getAttribute('data-url');
          var isManual = this.getAttribute('data-manual') === 'true';
          if (isManual) { window.open(url, '_blank', 'noopener,noreferrer'); }
          else { window.location.href = url; }
          modal.hidden = true;
          document.body.style.overflow = '';
        });
      });
    }

    if (waLink) {
      waLink.href = 'https://wa.me/255672450934?text=' + encodeURIComponent('Jambo Spice & Sail! Please send me the payment link for my ' + data.serviceName + ' booking (Ref: ' + data.bookingRef + ').');
    }

    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function showWhatsAppFallback(url) {
    var s = getStatusEl();
    if (s) {
      var waLink = document.createElement('a');
      waLink.href = url; waLink.target = '_blank'; waLink.rel = 'noopener';
      waLink.textContent = '💬 Message us on WhatsApp';
      waLink.style.display = 'inline-block'; waLink.style.marginTop = '0.5rem';
      waLink.style.color = '#25D366'; waLink.style.fontWeight = '600';
      s.appendChild(document.createElement('br')); s.appendChild(waLink);
    }
  }

  /* ==========================================================================
     Direct WhatsApp
     ========================================================================== */
  function openDirectWhatsApp() {
    var svcName = getServiceName(state.selectedSlug) || 'a Zanzibar experience';
    var travellers = parseInt($('#sns-adults').value || '2', 10) + parseInt($('#sns-children').value || '0', 10);
    var dateVal = $('#sns-date').value || '';
    var locationVal = ($('#sns-pickup').value || '').trim();
    var guestName = ($('#sns-name').value || '').trim();
    var guestWhatsapp = ($('#sns-whatsapp').value || '').trim();
    var guestEmail = ($('#sns-email').value || '').trim();
    var consentEl = el('sns-consent');
    var consentContact = Boolean(consentEl && consentEl.checked);

    function dispatchWA(ref) {
      var parts = [];
      if (ref) parts.push('Hi Spice & Sail! Booking Reference: ' + ref + '.');
      parts.push('I\'d like to book: ' + svcName + '.');
      if (dateVal) parts.push('Date: ' + dateVal + '.');
      if (travellers) parts.push('Travelers: ' + travellers + ' pax.');
      if (locationVal) parts.push('Pickup Location: ' + locationVal + '.');
      if (guestName) parts.push('Name: ' + guestName + '.');
      if (state.lastQuoteDisplay) parts.push('Estimated catalogue range: ' + state.lastQuoteDisplay + ' USD.');
      var url = 'https://wa.me/255672450934?text=' + encodeURIComponent(parts.join(' '));
      window.open(url, '_blank', 'noopener,noreferrer');
    }

    if (guestName && (guestWhatsapp || guestEmail) && consentContact) {
      var btn = el('sns-btn-whatsapp-direct');
      var origText = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = 'Saving reference…'; }
      showStatus('', 'Saving your booking enquiry reference before connecting to WhatsApp…');

      var payload = buildLeadPayload();
      payload.notes = (payload.notes ? payload.notes + '. ' : '') + 'Initiated via direct WhatsApp button.';

      fetchJSON('/.netlify/functions/lead', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 10000).then(function(res) {
        if (btn) { btn.disabled = false; btn.textContent = origText; }
        var ref = res.ok && res.json && typeof res.json.reference === 'string' && /^SP-\d{4}-\d+$/.test(res.json.reference) ? res.json.reference : null;
        if (ref) { state.lastReference = ref; showStatus('success', 'Enquiry registered! Reference: ' + ref + '. Connecting to WhatsApp…'); dispatchWA(ref); }
        else { showStatus('error', 'Could not save reference, proceeding to WhatsApp directly…'); dispatchWA(null); }
      }).catch(function() { if (btn) { btn.disabled = false; btn.textContent = origText; } dispatchWA(null); });
      return;
    }

    if (state.currentStep === 3) {
      if (!guestName || (!guestWhatsapp && !guestEmail)) {
        showStatus('error', 'Tip: Fill in your name & contact details above to generate an official booking reference, or message us directly on WhatsApp.');
      } else if (!consentContact) {
        showStatus('error', 'Please check "Contact me about this request" above to save your booking reference, or message us directly on WhatsApp.');
      }
    }

    dispatchWA(state.lastReference || null);
  }

  /* ==========================================================================
     Lead Submission
     ========================================================================== */
  function buildLeadPayload() {
    var name = ($('#sns-name').value || '').trim();
    var email = ($('#sns-email').value || '').trim();
    var whatsapp = ($('#sns-whatsapp').value || '').trim();
    var consent = Boolean(el('sns-consent') && el('sns-consent').checked);
    var adults = parseInt($('#sns-adults').value || '2', 10);
    var children = parseInt($('#sns-children').value || '0', 10);
    var date = $('#sns-date').value || null;
    var pickup = $('#sns-pickup').value || null;
    var driverLang = $('#sns-driver-lang').value || 'en';
    var special = $('#sns-special').value || '';

    var bits = [];
    if (name) bits.push('Name: ' + name);
    if (email) bits.push('Email: ' + email);
    if (whatsapp) bits.push('WhatsApp: ' + whatsapp);
    if (adults) bits.push('Adults: ' + adults);
    if (children) bits.push('Children: ' + children);
    if (date) bits.push('Date: ' + date);
    if (pickup) bits.push('Pickup: ' + pickup);
    if (driverLang !== 'en') bits.push('Driver Language: ' + driverLang.toUpperCase());
    if (special) bits.push('Notes: ' + special);
    if (state.lastQuoteDisplay) bits.push('Quoted Range: ' + state.lastQuoteDisplay + ' USD');
    if (state.selectedSlugs.length) bits.push('Service(s): ' + state.selectedSlugs.map(getServiceName).join(', '));
    if (state.selectedHotel) bits.push('Hotel: ' + getHotelName(state.selectedHotel));

    return {
      name: name, email: email, whatsapp: whatsapp,
      consentContact: consent, consentMarketing: false,
      serviceSlugs: state.selectedSlugs.slice(),
      hotelSlug: state.selectedHotel || null,
      adults: adults, children: children, date: date,
      pickupZone: pickup, driverLang: driverLang,
      notes: bits.join(' | '),
      utmSource: null, utmMedium: null, utmCampaign: null,
      referrer: document.referrer || null,
      userAgent: navigator.userAgent
    };
  }

  function saveLead(extra) {
    var payload = Object.assign(buildLeadPayload(), extra || {});
    return fetchJSON('/.netlify/functions/lead', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, 10000).then(function(res) {
      if (res.ok && res.json && typeof res.json.reference === 'string' && /^SP-\d{4}-\d+$/.test(res.json.reference)) {
        state.lastReference = res.json.reference;
        showStatus('success', 'Enquiry registered! Reference: ' + res.json.reference);
      }
      return res;
    });
  }

  function submitHandler(e) {
    e.preventDefault();
    if (!el('sns-consent') || !el('sns-consent').checked) {
      showStatus('error', 'Please confirm you want us to contact you about this request.');
      return;
    }
    var btn = e.target.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
    showStatus('', 'Submitting your request to our team…');

    saveLead({ notes: (buildLeadPayload().notes || '') + ' | Submitted via concierge form.' }).then(function(res) {
      if (btn) { btn.disabled = false; btn.textContent = 'Send Request'; }
      if (res.ok) {
        showStatus('success', 'Your request has been sent! Our team will reply on WhatsApp within business hours.', null, null);
        e.target.reset();
      } else {
        showStatus('error', 'Could not submit. Please try again or message us on WhatsApp.');
      }
    });
  }

  /* ==========================================================================
     User Reply Handler (for quick replies)
     ========================================================================== */
  function handleUserReply(text) {
    addUserMessage(text);
    showTyping();
    setTimeout(function() {
      hideTyping();
      // Simple keyword-based responses
      var lower = text.toLowerCase();
      if (lower.includes('marine') || lower.includes('snorkel')) {
        addBotMessage('Our marine experiences include Safari Blue, Mnemba Atoll, Prison Island + Nakupenda, Sunset Dhow Cruise, and Chumbe Island. Which one calls to you?', ['Safari Blue', 'Mnemba Snorkeling', 'Prison Island', '🔙 Back']);
      } else if (lower.includes('culture') || lower.includes('history') || lower.includes('spice') || lower.includes('stone town')) {
        addBotMessage('Culture & history tours: Stone Town Walking Tour, Spice Farm Tour, Village Community Tour, or the Stone Town + Spice + Prison Island combo. What fits your vibe?', ['Stone Town Tour', 'Spice Farm', 'Village Tour', 'Combo Tour', '🔙 Back']);
      } else if (lower.includes('safari') || lower.includes('wildlife')) {
        addBotMessage('Safari options: Mikumi/Nyerere Day Safari (fly-in), Serengeti 3-Day Fly-In, or Bush-to-Beach packages. How many days do you have?', ['Mikumi Day Trip', 'Serengeti 3-Day', 'Bush-to-Beach 5-Day', '🔙 Back']);
      } else if (lower.includes('transfer') || lower.includes('airport')) {
        addBotMessage('Zero-deposit private airport transfers to all zones. Sedan (1–3 guests) or Van (4–6 guests). Where are you headed?', ['Stone Town $18', 'Nungwi/Kendwa $45', 'Paje/Jambiani $45', 'Matemwe $40', 'Kizimkazi $50', '🔙 Back']);
      } else if (lower.includes('hotel')) {
        selectHotel('the-one-resort'); goToStep('hotel');
      } else if (lower.includes('whatsapp') || lower.includes('chat') || lower.includes('team') || lower.includes('person') || lower.includes('human')) {
        openDirectWhatsApp();
      } else if (lower.includes('back') || lower.includes('menu')) {
        goToStep(1);
      } else if (lower.includes('date') || lower.includes('flexible')) {
        addBotMessage('No problem! Pick your travel date in the next step and we\'ll check availability.', ['📅 Next Step']);
      } else if (lower.includes('2 adult') || lower.includes('couple') || lower.includes('2 people')) {
        addBotMessage('Perfect, 2 adults noted. What\'s your travel date?', ['📅 Next Step']);
      } else {
        addBotMessage('I\'m still learning! For detailed questions, our human team on WhatsApp has all the answers.', ['💬 Chat on WhatsApp', '🔙 Main Menu']);
      }
    }, 500 + Math.random() * 300);
  }

  /* ==========================================================================
     Modal Open/Close
     ========================================================================== */
  function openConcierge() {
    state.isOpen = true;
    var modal = el('sns-modal');
    var launcher = el('sns-launcher');
    if (modal) { modal.hidden = false; launcher && launcher.setAttribute('aria-expanded', 'true'); }
    if (state.currentStep === 1 && !state.services.length) { loadCatalogue().then(renderServiceGrid); }
    document.body.style.overflow = 'hidden';
  }

  function closeConcierge() {
    state.isOpen = false;
    var modal = el('sns-modal');
    var launcher = el('sns-launcher');
    if (modal) { modal.hidden = true; launcher && launcher.setAttribute('aria-expanded', 'false'); }
    document.body.style.overflow = '';
  }

  function dismissCallout() {
    var callout = el('sns-callout');
    if (callout) { callout.hidden = true; state.calloutDismissed = true; }
  }

  /* ==========================================================================
     Initialization
     ========================================================================== */
  function init() {
    // Set min date for date inputs
    var today = new Date().toISOString().split('T')[0];
    $$('input[type="date"]').forEach(function(input) {
      if (!input.min) input.min = today;
    });

    // Load catalogue
    loadCatalogue().then(function() {
      renderServiceGrid();
      // Show proactive callout after 8s on first visit
      if (!state.calloutDismissed && !localStorage.getItem('sns-callout-seen')) {
        setTimeout(function() {
          var callout = el('sns-callout');
          if (callout) { callout.hidden = false; localStorage.setItem('sns-callout-seen', '1'); }
        }, 8000);
      }
    });

    // Event listeners
    var launcher = el('sns-launcher');
    var callout = el('sns-callout');
    var closeBtn = el('sns-close');
    var calloutClose = callout ? callout.querySelector('.sns-callout-close') : null;
    var form = el('sns-form');

    if (launcher) launcher.addEventListener('click', openConcierge);
    if (closeBtn) closeBtn.addEventListener('click', closeConcierge);
    if (calloutClose) calloutClose.addEventListener('click', dismissCallout);
    if (callout) callout.addEventListener('click', function(e) { if (e.target === callout || e.target === callout.querySelector('.sns-callout-text') || e.target === callout.querySelector('.sns-callout-avatar')) openConcierge(); });
    if (form) form.addEventListener('submit', submitHandler);

    // Close on backdrop click
    var modal = el('sns-modal');
    if (modal) {
      modal.querySelector('.sns-concierge-backdrop').addEventListener('click', closeConcierge);
    }

    // Close payment modal on backdrop
    var payModal = el('sns-payment-modal');
    if (payModal) {
      payModal.querySelector('.sns-payment-backdrop').addEventListener('click', function() {
        payModal.hidden = true; document.body.style.overflow = '';
      });
    }

    // Keyboard: Escape to close
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && state.isOpen) closeConcierge();
    });

    // Expose API
    window.snsConciergeV2 = {
      open: openConcierge,
      close: closeConcierge,
      goToStep: goToStep,
      selectService: selectService,
      selectHotel: selectHotel,
      getQuote: getQuote,
      openPaymentOptions: openPaymentOptions,
      openDirectWhatsApp: openDirectWhatsApp,
      dismissCallout: dismissCallout,
      submitHandler: submitHandler,
      _state: state
    };
  }

  /* ==========================================================================
     Fetch Helper
     ========================================================================== */
  function fetchJSON(url, options, timeout) {
    var controller = new AbortController();
    var id = setTimeout(function() { controller.abort(); }, timeout || 10000);
    return fetch(url, Object.assign({}, options, { signal: controller.signal, credentials: 'same-origin' }))
      .then(function(res) {
        clearTimeout(id);
        return res.json().then(function(json) { return { ok: res.ok, status: res.status, json: json }; });
      })
      .catch(function(err) {
        clearTimeout(id);
        return { ok: false, error: err.message, json: null };
      });
  }

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();