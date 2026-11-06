/**
 * Spice and Sail Zanzibar — Trip Concierge widget logic.
 * No prices are computed in the browser: every range comes from the
 * server /quote endpoint (catalogue-backed), and every lead goes through
 * /.netlify/functions/lead. A SP-YYYY-NNNNNN reference is shown only when
 * the server returns one. On any failure the visitor sees an error message
 * with a WhatsApp fallback link — never a success message.
 */
(function () {
  'use strict';

  var WHATSAPP_URL = 'https://wa.me/255672450934';
  var FALLBACK_MSG = 'Something went wrong sending your request. ';

  var state = {
    currentStep: 1,
    services: null,          // catalogue list from GET /quote
    selectedSlug: null,
    formLoadedAt: Date.now(),
    formTouched: false,
    lastReference: null,     // only ever set from a server response
    chatOpen: false,
    chatLoaded: false,
    replyWindow: null        // business-hours wording from the server catalogue
  };

  // Backwards-compatible aliases for old keys used by pages/buttons; each
  // maps to a real catalogue slug (kept in sync with the server catalogue).
  var SLUG_ALIASES = {
    'transfer-stone-town': 'airport-transfer-znz-to-stone-town',
    'transfer-paje': 'airport-transfer-znz-to-pajejambiani',
    'transfer-nungwi': 'airport-transfer-znz-to-nungwikendwa',
    'mnemba-snorkel': 'mnemba-snorkeling',
    'stone-town-spice': 'stone-town-spice-prison-combo',
    'quad-safari': 'quad-buggy-safari',
    'cenote-caves': 'maalum-kuza-caves',
    'uzi-island': 'uzi-island-moses-road',
    'cheetahs-rock': 'cheetahs-rock',
    'luxury-catamaran': 'private-catamaran-charter',
    'mikumi-safari': 'mikumi-nyerere-day-safari'
  };

  function el(id) { return document.getElementById(id); }

  function normaliseSlug(key) {
    if (!key) return null;
    if (state.services && state.services.some(function (s) { return s.slug === key; })) return key;
    return SLUG_ALIASES[key] || null;
  }

  function waLink(text) {
    return WHATSAPP_URL + (text ? '?text=' + encodeURIComponent(text) : '');
  }

  function getStatusEl() { return el('sns-submit-status'); }

  /* All status/chat content is built with createElement/textContent — never
     innerHTML — so server text, user text and error details can never mount. */
  function safeLink(href, label) {
    var a = document.createElement('a');
    a.setAttribute('href', href);
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener');
    a.textContent = label;
    return a;
  }

  /* Render plain text + optional [label](/path|https://url) links.
     Everything else (tags, attributes) is inserted as literal text. */
  function appendRichText(target, text) {
    var cleaned = String(text)
      .replace(/\*\*/g, '')
      .replace(/(^|\s)_(?=\S)([^_]{1,200}?\S)_(?=\s|$|[.,!?])/g, '$1$2');
    var re = /\[([^\]\n]{1,120})\]\(((?:\/|https:\/\/|mailto:)[^)\s]{1,200})\)/g;
    var last = 0, m = re.exec(cleaned);
    while (m) {
      if (m.index > last) target.appendChild(document.createTextNode(cleaned.slice(last, m.index)));
      if (m[2].startsWith('mailto:')) {
        var addr = m[2].slice(7);
        /* A mailto: address becomes a link only when percent-encoded
           (no raw '@', spaces, or other unreserved characters). */
        if (addr.includes('%') && !addr.includes('@') && addr.indexOf(' ') === -1) {
          target.appendChild(safeLink(m[2], m[1]));
        } else {
          target.appendChild(document.createTextNode(m[0]));
        }
      } else {
        target.appendChild(safeLink(m[2], m[1]));
      }
      last = m.index + m[0].length;
      m = re.exec(cleaned);
    }
    if (last < cleaned.length) target.appendChild(document.createTextNode(cleaned.slice(last)));
  }

  function showStatus(kind, text, waMsg) {
    var s = getStatusEl();
    if (!s) return null;
    s.hidden = false;
    s.className = 'sns-submit-status ' + (kind || '');
    s.textContent = '';
    if (text) s.appendChild(document.createTextNode(text));
    if (waMsg) {
      s.appendChild(document.createTextNode(' '));
      s.appendChild(safeLink(waLink(waMsg), 'message us on WhatsApp instead'));
    }
    return s;
  }

  function hideStatus() {
    var s = getStatusEl();
    if (s) { s.hidden = true; s.textContent = ''; }
  }

  function fetchJSON(url, opts, timeoutMs) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, timeoutMs || 12000);
    var p = fetch(url, opts).then(function (r) {
      clearTimeout(timer);
      return r.json().then(function (j) { return { ok: r.ok, status: r.statusCode || r.status, json: j }; });
    });
    p.catch(function () { clearTimeout(timer); });
    return p;
  }

  /* ---------- catalogue + service grid ---------- */

  function loadCatalogue() {
    return fetchJSON('/.netlify/functions/quote', { method: 'GET' }, 8000)
      .then(function (res) {
        if (res.ok && res.json && Array.isArray(res.json.services)) {
          state.services = res.json.services;
          state.replyWindow = (res.json.replyWindow || '').slice(0, 160) || null;
          renderServiceGrid();
        }
        return state.services;
      })
      .catch(function () { /* offline: grid shows fallback */ });
  }

  function renderServiceGrid() {
    var grid = document.querySelector('.sns-service-grid');
    if (!grid) return;
    grid.textContent = '';
    if (!state.services || state.services.length === 0) {
      var p = document.createElement('p');
      p.textContent = 'The service list is temporarily unavailable. Please use WhatsApp or try again shortly.';
      grid.appendChild(p);
      if (state.selectedSlug) calculateRange();
      return;
    }
    state.services.forEach(function (svc) {
      var card = document.createElement('label');
      card.className = 'sns-service-card';
      var input = document.createElement('input');
      input.type = 'radio';
      input.name = 'service';
      input.value = svc.slug;
      if (svc.slug === state.selectedSlug) { input.checked = true; card.classList.add('selected'); }
      var box = document.createElement('div');
      var name = document.createElement('strong');
      name.textContent = svc.name;
      box.appendChild(name);
      if (svc.duration) {
        var dur = document.createElement('span');
        dur.textContent = ' · ' + svc.duration;
        box.appendChild(dur);
      }
      var price = document.createElement('div');
      price.className = 'sns-service-price';
      price.textContent = svc.priceDisplay || 'Our team will confirm the price';
      card.appendChild(input);
      card.appendChild(box);
      card.appendChild(price);
      grid.appendChild(card);
    });

    grid.querySelectorAll('input[name="service"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        state.selectedSlug = radio.value;
        grid.querySelectorAll('.sns-service-card').forEach(function (c) { c.classList.remove('selected'); });
        var parent = radio.closest('.sns-service-card');
        if (parent) parent.classList.add('selected');
      });
    });
  }

  /* ---------- planning range (from /quote, never client-computed) ---------- */

  function calculateRange() {
    var amountEl = el('sns-quote-amount');
    var summaryEl = el('sns-quote-summary');
    if (!summaryEl) return null;

    if (!state.selectedSlug) {
      if (amountEl) amountEl.textContent = '';
      summaryEl.textContent = 'Select a service above to see the planning range.';
      return null;
    }
    var travellers = getTravelersCount();
    if (amountEl) amountEl.textContent = 'loading…';
    summaryEl.textContent = 'Checking the verified catalogue range…';

    return fetchJSON('/.netlify/functions/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceSlug: state.selectedSlug,
        adults: travellers,
        children: 0,
        date: getDateValue()
      })
    }, 12000).then(function (res) {
      if (res.ok && res.json && res.json.totalDisplay) {
        if (amountEl) amountEl.textContent = res.json.totalDisplay + ' USD';
        var bits = [];
        (res.json.lines || []).forEach(function (l) { if (l && l.label) bits.push(l.label); });
        (res.json.notes || (res.json.perService ? [] : [])).forEach(function (n) { bits.push(n); });
        // for plan-style responses
        (res.json.perService || []).forEach(function (q) {
          (q.notes || []).forEach(function (n) { bits.push(n); });
        });
        (res.json.reasons || []).forEach(function (r) { bits.push(r); });
        summaryEl.textContent = bits.join(' ') || 'Planning range — our team confirms the final price, dates and pickup window.';
        // stash for the WhatsApp fallback message / staff-side reuse
        state.lastQuoteDisplay = res.json.totalDisplay;
        return res.json;
      }
      throw new Error('bad quote response');
    }).catch(function () {
      if (amountEl) amountEl.textContent = '';
      summaryEl.textContent = 'The planning range is unavailable right now — no price is shown rather than a guess. Our team will confirm the price.';
      return null;
    });
  }

  /* ---------- steps ---------- */

  function goToStep(step) {
    if (step < 1 || step > 3) return;
    state.currentStep = step;
    document.querySelectorAll('.sns-form-step').forEach(function (e) { e.classList.remove('active'); });
    var targetStep = el('sns-step-' + step);
    if (targetStep) targetStep.classList.add('active');
    document.querySelectorAll('.sns-step-indicator').forEach(function (ind) {
      var stepNum = parseInt(ind.getAttribute('data-step'), 10);
      ind.classList.remove('active', 'completed');
      if (stepNum === state.currentStep) ind.classList.add('active');
      else if (stepNum < state.currentStep) ind.classList.add('completed');
    });
    if (step === 3) calculateRange();
    if (state.chatOpen) closeChat();
  }

  /* ---------- helpers for the lead payload ---------- */

  function getTravelersCount() {
    var sel = el('sns-travelers');
    if (!sel) return 2;
    var n = parseInt(sel.value, 10);
    if (isNaN(n) || n < 1) return 2;
    return n > 50 ? 50 : n;
  }

  function getDateValue() {
    var d = el('sns-date');
    if (!d || !d.value) return null;
    var parsed = new Date(d.value);
    return isNaN(parsed.getTime()) ? null : d.value;
  }

  function sessionId() {
    try {
      var sid = null;
      try { sid = sessionStorage.getItem('sns_session_id'); } catch (e) { /* blocked */ }
      if (!sid) {
        sid = 's-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
        try { sessionStorage.setItem('sns_session_id', sid); } catch (e) { /* blocked */ }
      }
      return sid;
    } catch (e) { return 'anon'; }
  }

  /* Open: only validates browser-required inputs; the server re-validates everything. */
  function clientPreflight() {
    var whatsEl = el('sns-guest-whatsapp');
    var emailEl = el('sns-guest-email');
    var contactOk = ((whatsEl && whatsEl.value.trim()) || (emailEl && emailEl.value.trim()));
    if (!contactOk) {
      return 'Add a WhatsApp number or an email so our team can reach you.';
    }
    return null;
  }

  function buildLeadPayload() {
    var nameEl = el('sns-guest-name');
    var whatsEl = el('sns-guest-whatsapp');
    var emailEl = el('sns-guest-email');
    var notesEl = el('sns-guest-notes');
    var locEl = el('sns-location');
    var consentEl = el('consent_contact');
    var marketingEl = el('consent_marketing');
    var honeypotEl = document.querySelector('.sns-honeypot');
    var versionInput = document.querySelector('input[name="privacy_notice_version"]');

    var notesParts = [];
    if (locEl && locEl.value.trim()) notesParts.push('Pickup / hotel: ' + locEl.value.trim());
    if (notesEl && notesEl.value.trim()) notesParts.push(notesEl.value.trim());

    /* Field names exactly match the validate.js allowlist. */
    var payload = {
      name: nameEl ? nameEl.value.trim() : '',
      whatsapp: whatsEl ? whatsEl.value.trim() : null,
      email: emailEl ? emailEl.value.trim() : null,
      date: getDateValue(),
      travellers: getTravelersCount(),
      notes: notesParts.length ? notesParts.join('. ').slice(0, 1900) : null,
      services: state.selectedSlug ? [state.selectedSlug] : null,
      consent_contact: Boolean(consentEl && consentEl.checked),
      consent_marketing: Boolean(marketingEl && marketingEl.checked),
      privacy_notice_version: versionInput ? versionInput.value : 'v1.0',
      session_id: sessionId(),
      honeypot: honeypotEl ? honeypotEl.value : '',
      form_loaded_at: Math.floor(state.formLoadedAt)
    };
    return payload;
  }

  /* ---------- submit: POST /lead, reference only from a server 2xx ---------- */

  function submitHandler(event) {
    if (event) event.preventDefault();
    $submit();
    return false;
  }
  function $submit() {
    var pre = clientPreflight();
    if (pre) { showStatus('error', pre, 'I would like to plan a Zanzibar trip.'); return; }
    if (!state.selectedSlug) {
      showStatus('error', 'Please go back and pick a service first.', 'I would like to plan a Zanzibar trip.');
      return;
    }
    var payload = buildLeadPayload();
    showStatus('', 'Sending your request…');

    fetchJSON('/.netlify/functions/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, 15000).then(function (res) {
      var ref = res.ok && res.json && typeof res.json.reference === 'string' && /^SP-\d{4}-\d+$/.test(res.json.reference)
        ? res.json.reference : null;
      if (ref) {
        state.lastReference = ref;
        var reply = res.json.reply_link || null;
        var s = showStatus('success');
        if (s) {
          s.appendChild(document.createTextNode('Request received. Your reference is '));
          var strong = document.createElement('strong');
          var code = document.createElement('code');
          code.textContent = ref;
          strong.appendChild(code);
          s.appendChild(strong);
          s.appendChild(document.createTextNode('. Our team confirms every detail with you directly, usually ' +
            (state.replyWindow || 'within business hours') + '.'));
          if (reply && /^https:\/\//.test(reply)) {
            s.appendChild(document.createTextNode(' '));
            s.appendChild(safeLink(reply, 'reach us with this reference'));
          } else {
            s.appendChild(document.createTextNode(' '));
            s.appendChild(safeLink(
              waLink('My reference is ' + ref + ', about my ' + serviceName() + '.'),
              'message us on WhatsApp instead'));
          }
        }
      } else if (res.ok) {
        throw new Error('2xx without reference');
      } else {
        var detail = (res.json && res.json.error) ? res.json.error :
          (!window.navigator.onLine ? 'You appear to be offline' : 'Sending failed');
        showStatus('error', 'We could not save your request (' + detail + ').', 'I would like to plan a Zanzibar trip.');
      }
    }).catch(function () {
      var msg = 'We could not save your request' + (window.navigator.onLine ? '' : ' (you appear to be offline)') +
        (state.lastReference ? '. If you saw a reference earlier, mention it.' : '.');
      showStatus('error', msg, 'I would like to plan a Zanzibar trip.');
    });
  }

  function serviceName() {
    if (state.services) {
      var s = state.services.find(function (x) { return x.slug === state.selectedSlug; });
      if (s) return s.name;
    }
    return 'trip';
  }

  /* ---------- chat ---------- */

  function addBubble(text, who) {
    var list = el('sns-chat-messages');
    if (!list) return;
    var b = document.createElement('div');
    b.className = 'sns-chat-bubble ' + who;
    appendRichText(b, text); // text nodes + createElement links only, never innerHTML
    list.appendChild(b);
    list.scrollTop = list.scrollHeight;
  }

  /* Exposed for tests: what DOM nodes a chat reply renders into (no innerHTML). */
  function bubbleNodes(text, who) {
    var b = document.createElement('div');
    b.className = 'sns-chat-bubble ' + (who || 'bot');
    appendRichText(b, text);
    return b;
  }

  function renderQuickReplies(quickReplies) {
    var wrap = el('sns-chat-quick');
    if (!wrap) return;
    wrap.textContent = '';
    (quickReplies || []).forEach(function (q) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sns-chat-quick-btn';
      btn.textContent = q;
      btn.addEventListener('click', function () { sendChat(q); });
      wrap.appendChild(btn);
    });
  }

  function sendChat(text) {
    var statusEl = el('sns-chat-messages');
    if (!text) return;
    addBubble(text, 'user');
    var q = el('sns-chat-input');
    if (q) { q.value = ''; hintThinking(); }

    return fetchJSON('/.netlify/functions/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        session_id: sessionId(),
        profile: window._conciergeProfile || {},
        history: window._conciergeHistory || []
      })
    }, 15000).then(function (res) {
      clearThinking();
      if (res.ok && res.json && res.json.message) {
        // Update profile and history from response
        window._conciergeProfile = res.json.profile || window._conciergeProfile || {};
        window._conciergeHistory = [].concat(window._conciergeHistory || [])
          .concat([
            { role: 'user', content: text },
            { role: 'assistant', content: res.json.message }
          ]).slice(-10);

        addBubble(res.json.message, 'bot');
        renderQuickReplies(res.json.quickReplies);
        if (res.json.quote && res.json.quote.totalDisplay) {
          addBubble('Planning range from our verified catalogue: ' + res.json.quote.totalDisplay + ' USD. Our team confirms any final price.', 'bot');
        }
        // WhatsApp handoff: open wa.me link in a new tab
        if (res.json.whatsapp_url) {
          addBubble('[Send booking request on WhatsApp](' + res.json.whatsapp_url + ')', 'bot');
        } else if (res.json.requestContact) {
          state.chatOpen = false;
          goToStep(3);
        }
      } else {
        addBubble('The concierge chat is unavailable right now. [message us on WhatsApp](' + WHATSAPP_URL + ')', 'bot');
      }
      return;
    }).catch(function () {
      clearThinking();
      addBubble('The concierge chat is unavailable right now. [message us on WhatsApp](' + WHATSAPP_URL + ')', 'bot');
    });
  }

  function hintThinking() {
    var t = el('sns-chat-typing');
    if (t) t.hidden = false;
  }
  function clearThinking() {
    var t = el('sns-chat-typing');
    if (t) t.hidden = true;
  }

  function openChat() {
    state.chatOpen = true;
    var panel = el('sns-concierge-chat');
    if (panel) panel.hidden = false;
    document.querySelectorAll('.sns-form-step, .sns-led-form').forEach(function (e) { e.style.display = 'none'; });
    if (!state.chatLoaded) {
      state.chatLoaded = true;
      // The first bot message comes from the chat endpoint and includes the privacy notice link.
      var intro = el('sns-chat-intro');
      if (intro) intro.hidden = false;
      sendChat('Hi, I would like to plan a Zanzibar trip.');
    }
  }

  function closeChat() {
    state.chatOpen = false;
    var panel = el('sns-concierge-chat');
    if (panel) panel.hidden = true;
    document.querySelectorAll('.sns-form-step, .sns-led-form').forEach(function (e) { e.style.display = ''; });
  }

  /* ---------- open / close ---------- */

  function openConcierge(preselectKey) {
    if (!state.services && !state._loading) {
      state._loading = loadCatalogue().then(function () { state._loading = null; });
    }
    var slug = normaliseSlug(preselectKey);
    if (slug) state.selectedSlug = slug;
    var modal = el('sns-concierge-modal');
    if (modal) {
      modal.removeAttribute('hidden');
      document.body.style.overflow = 'hidden';
      var dateInput = el('sns-date');
      if (dateInput && !dateInput.value) {
        var t = new Date(); t.setDate(t.getDate() + 1);
        dateInput.value = t.toISOString().split('T')[0];
      }
      if (state.selectedSlug) {
        var radio = document.querySelector('input[name="service"][value="' + state.selectedSlug + '"]');
        if (radio) {
          radio.checked = true;
          document.querySelectorAll('.sns-service-card').forEach(function (c) { c.classList.remove('selected'); });
          var parent = radio.closest('.sns-service-card');
          if (parent) parent.classList.add('selected');
        }
      }
      goToStep(1);
    }
  }

  function closeConcierge() {
    var modal = el('sns-concierge-modal');
    if (modal) {
      modal.setAttribute('hidden', '');
      document.body.style.overflow = '';
      hideStatus();
      closeChat();
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var trigger = el('sns-concierge-trigger');
    var closeBtn = el('sns-concierge-close');
    var backdrop = el('sns-concierge-backdrop');
    var form = el('sns-concierge-form');
    var chatOpenBtn = el('sns-chat-open');
    var chatCloseBtn = el('sns-chat-close');
    var chatSendBtn = el('sns-chat-send');
    var chatInput = el('sns-chat-input');

    if (trigger) trigger.addEventListener('click', function () { openConcierge(); });
    if (closeBtn) closeBtn.addEventListener('click', closeConcierge);
    if (backdrop) backdrop.addEventListener('click', closeConcierge);
    if (form) form.addEventListener('submit', submitHandler);
    if (chatOpenBtn) chatOpenBtn.addEventListener('click', openChat);
    if (chatCloseBtn) chatCloseBtn.addEventListener('click', closeChat);
    if (chatSendBtn) chatSendBtn.addEventListener('click', function () { sendChat((chatInput ? chatInput.value : '').trim()); });
    if (chatInput) chatInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); sendChat(chatInput.value.trim()); }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeConcierge();
    });

    var travellersEl = el('sns-travelers');
    var dateEl = el('sns-date');
    if (travellersEl) travellersEl.addEventListener('change', function () { if (state.currentStep === 3) calculateRange(); });
    if (dateEl) dateEl.addEventListener('change', function () { if (state.currentStep === 3) calculateRange(); });
  });

  /* Export to global scope */
  window.snsConcierge = {
    open: openConcierge,
    close: closeConcierge,
    goToStep: goToStep,
    openChat: openChat,
    submitHandler: submitHandler,
    _bubbleNodes: bubbleNodes
  };
})();
