/**
 * Spice and Sail Zanzibar — Trip Concierge widget (chat-first).
 * No prices are computed in the browser: every range comes from the
 * server /quote endpoint (catalogue-backed), and every lead goes through
 * /.netlify/functions/lead. A SP-YYYY-NNNNNN reference is shown only when
 * the server returns one. On any failure the visitor sees an error message
 * with a WhatsApp fallback link — never a success message.
 * No innerHTML is used anywhere: all content is text nodes + createElement.
 */
(function () {
  'use strict';

  var WHATSAPP_URL = 'https://wa.me/255672450934';

  var state = {
    services: null,          // catalogue list from GET /quote
    selectedSlug: null,      // single service preselected from the page
    contextService: null,    // service the user asked about on this page
    chatFlow: null,          // greeting | dates | travellers | interests | recommend | lead | done
    selectedServices: [],    // services the user added to their plan
    travellers: null,
    date: null,
    location: null,
    lastReference: null,     // only ever set from a server response
    chatLoaded: false,
    teaserShown: false,
    replyWindow: null        // business-hours wording from the server catalogue
  };

  // Backwards-compatible aliases for old keys used by pages/buttons.
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

  // Photo from the site's existing images, mapped to catalogue slugs.
  // Falls back to a general hero image when no direct match exists.
  var PHOTO_MAP = {
    'stone-town-walking-tour': 'stone-town-walking-tour-people-photograph.jpg',
    'spice-farm': 'pineapples-growing-in-tropical-plantation.jpg',
    'mnemba-snorkeling': 'sea-turtle-snorkeling-coral-reef.jpg',
    'safari-blue': 'aerial-beach-dhow-people-turquoise-water.jpg',
    'sunset-dhow-cruise': 'dhow-sail-sunset-zanzibar-water.jpg',
    'jozani-forest': 'josephine-monkey-jozani-forest-zanzibar.jpg',
    'mikumi-nyerere-day-safari': 'lion-standing-tall-grass-bushes.jpg',
    'prison-island-nakupenda': 'boats-pier-under-cloudy-sky-water.jpg',
    'nakupenda-sandbank': 'turquoise-water-sandbar-lone-boat.jpg',
    'airport-transfer-znz-to-stone-town': 'white-minivan-parked-under-canopy.jpg',
    'airport-transfer-znz-to-nungwikendwa': 'white-minivan-zanzibar-transfer-vehicle.jpg',
    'airport-transfer-znz-to-pajejambiani': 'white-minivan-zanzibar-transfer-vehicle.jpg',
    'zanzibar-essentials-3day': 'aerial-beach-dhow-people-turquoise-water.jpg'
  };
  var DEFAULT_PHOTO = 'beach-front-hotel-palm-trees-people.jpg';

  function el(id) { return document.getElementById(id); }

  function normaliseSlug(key) {
    if (!key) return null;
    if (state.services && state.services.some(function (s) { return s.slug === key; })) return key;
    return SLUG_ALIASES[key] || null;
  }

  function pageServiceFromUrl() {
    var path = window.location.pathname || '';
    var parts = path.split('/').filter(Boolean);
    var slug = parts[parts.length - 1] || '';
    // Strip common trailing noise.
    slug = slug.replace(/^tour-/, '').replace(/-tour$/, '');
    return normaliseSlug(slug) || null;
  }

  function pageType() {
    var path = window.location.pathname || '';
    if (path.indexOf('/tours/') === 0) return 'tour';
    if (path.indexOf('/safaris/') === 0) return 'safari';
    if (path.indexOf('/transfers/') === 0) return 'transfer';
    return null;
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

  function showChatStatus(kind, text, waMsg) {
    var s = el('sns-chat-status');
    if (!s) return null;
    s.hidden = false;
    s.className = 'sns-chat-status ' + (kind || '');
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
    var cs = el('sns-chat-status');
    if (cs) { cs.hidden = true; cs.textContent = ''; }
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

  /* ---------- catalogue + planning range ---------- */

  function loadCatalogue() {
    return fetchJSON('/.netlify/functions/quote', { method: 'GET' }, 8000)
      .then(function (res) {
        if (res.ok && res.json && Array.isArray(res.json.services)) {
          state.services = res.json.services;
          state.replyWindow = (res.json.replyWindow || '').slice(0, 160) || null;
        }
        return state.services;
      })
      .catch(function () { return state.services; });
  }

  function servicePhoto(slug) {
    var f = PHOTO_MAP[slug];
    return f || DEFAULT_PHOTO;
  }

  function serviceBySlug(slug) {
    if (!state.services) return null;
    return state.services.find(function (s) { return s.slug === slug; }) || null;
  }

  /* ---------- chat rendering ---------- */

  function addBubble(text, who) {
    var list = el('sns-chat-messages');
    if (!list) return;
    var b = document.createElement('div');
    b.className = 'sns-chat-bubble ' + who;
    appendRichText(b, text);
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

  function hintThinking() {
    var t = el('sns-chat-typing');
    if (t) t.hidden = false;
  }
  function clearThinking() {
    var t = el('sns-chat-typing');
    if (t) t.hidden = true;
  }

  function showQuick(replies) {
    var wrap = el('sns-chat-quick');
    if (!wrap) return;
    wrap.textContent = '';
    (replies || []).forEach(function (q) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sns-chat-quick-btn';
      btn.textContent = q;
      btn.addEventListener('click', function () { sendChat(q); });
      wrap.appendChild(btn);
    });
  }

  function clearQuick() {
    var wrap = el('sns-chat-quick');
    if (wrap) wrap.textContent = '';
  }

  function setInput(placeholder) {
    var i = el('sns-chat-input');
    if (i) { i.placeholder = placeholder; i.value = ''; i.disabled = false; i.focus(); }
  }

  function disableInput() {
    var i = el('sns-chat-input');
    if (i) i.disabled = true;
  }

  function showServiceCards(services) {
    var list = el('sns-chat-messages');
    if (!list) return;
    var wrapper = document.createElement('div');
    wrapper.className = 'sns-card-row';
    (services || []).slice(0, 3).forEach(function (svc) {
      if (!svc) return;
      var card = document.createElement('div');
      card.className = 'sns-service-card-suggestion';
      var img = document.createElement('img');
      img.className = 'sns-service-card-img';
      img.src = '/images/' + servicePhoto(svc.slug);
      img.alt = svc.name;
      img.loading = 'lazy';
      var body = document.createElement('div');
      body.className = 'sns-service-card-body';
      var name = document.createElement('div');
      name.className = 'sns-service-card-name';
      name.textContent = svc.name;
      var range = document.createElement('div');
      range.className = 'sns-service-card-range';
      range.textContent = svc.priceDisplay ? ('Planning range: ' + svc.priceDisplay) : 'Our team will confirm the price';
      var basis = document.createElement('div');
      basis.className = 'sns-service-card-basis';
      basis.textContent = 'Our team confirms the final price.';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sns-service-card-add';
      btn.textContent = 'Add to my plan';
      btn.addEventListener('click', function () { addToPlan(svc.slug, svc.name); });
      body.appendChild(name);
      body.appendChild(range);
      body.appendChild(basis);
      body.appendChild(btn);
      card.appendChild(img);
      card.appendChild(body);
      wrapper.appendChild(card);
    });
    var note = document.createElement('div');
    note.className = 'sns-chat-bubble bot';
    note.textContent = 'Here are a few options from our verified catalogue. Tap “Add to my plan” on any you like.';
    list.appendChild(note);
    list.appendChild(wrapper);
    list.scrollTop = list.scrollHeight;
  }

  function addToPlan(slug, name) {
    if (state.selectedServices.some(function (s) { return s.slug === slug; })) return;
    state.selectedServices.push({ slug: slug, name: name });
    addBubble('Added “' + name + '” to your plan.', 'bot');
    showSendToTeam();
  }

  function showSendToTeam() {
    if (state.selectedServices.length === 0) return;
    var list = el('sns-chat-messages');
    if (!list) return;
    // Avoid duplicate buttons.
    if (list.querySelector('.sns-send-to-team')) return;
    var wrapper = document.createElement('div');
    wrapper.className = 'sns-chat-bubble bot sns-send-to-team';
    var text = document.createElement('div');
    text.textContent = 'Ready to send your plan to our team?';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sns-send-to-team-btn';
    btn.textContent = 'Send to the team';
    btn.addEventListener('click', function () { showLeadForm(); });
    wrapper.appendChild(text);
    wrapper.appendChild(btn);
    list.appendChild(wrapper);
    list.scrollTop = list.scrollHeight;
  }

  /* ---------- flow ---------- */

  function showGreeting() {
    clearQuick();
    var intro = el('sns-concierge-subtitle');
    if (intro) intro.textContent = 'Your Zanzibar trip, planned with our team.';
    // Swahili + English greeting.
    addBubble('Jambo! 👋 I’m the Spice & Sail concierge — your Zanzibar travel planner.\n\nI can show you planning ranges from our verified catalogue and send your request to our team, who confirm every detail before you pay.', 'bot');
    showQuick(['Plan a trip', 'Airport transfer', 'Tours and prices', 'Safari', 'Talk to the team']);
    setInput('Tell me what you have in mind…');
    state.chatFlow = 'greeting';
  }

  function startChat() {
    var modal = el('sns-concierge-modal');
    if (modal) modal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    var chat = el('sns-concierge-chat');
    var form = el('sns-concierge-form');
    if (chat) chat.hidden = false;
    if (form) form.hidden = true;
    if (!state.chatLoaded) {
      state.chatLoaded = true;
      loadCatalogue().then(function () {
        if (state.contextService) {
          var svc = serviceBySlug(state.contextService);
          addBubble('I can help with ' + (svc ? svc.name : 'that') + '. Let’s start with your travel date.', 'bot');
          setInput('Preferred date (e.g. 2026-12-20)');
          state.chatFlow = 'dates';
        } else {
          showGreeting();
        }
      });
    } else {
      showGreeting();
    }
  }

  function routeFromGreeting(text) {
    var t = text.toLowerCase();
    if (t.indexOf('airport') !== -1 || t.indexOf('transfer') !== -1) {
      state.contextService = 'airport-transfer-znz-to-nungwikendwa';
      state.chatFlow = 'dates';
      addBubble('Airport transfer — great choice. What’s your travel date?', 'bot');
      setInput('Preferred date (e.g. 2026-12-20)');
      return;
    }
    if (t.indexOf('safari') !== -1) {
      state.contextService = 'mikumi-nyerere-day-safari';
      state.chatFlow = 'dates';
      addBubble('Safari — excellent. What’s your travel date?', 'bot');
      setInput('Preferred date (e.g. 2026-12-20)');
      return;
    }
    if (t.indexOf('tour') !== -1 || t.indexOf('price') !== -1) {
      state.chatFlow = 'interests';
      addBubble('What interests you most?', 'bot');
      showQuick(['Beach & ocean', 'Wildlife & safari', 'Culture & city', 'Airport transfer']);
      setInput('Or tell me what you’d like to do…');
      return;
    }
    if (t.indexOf('talk') !== -1 || t.indexOf('team') !== -1) {
      showLeadForm();
      return;
    }
    // Default: treat as "plan a trip".
    state.chatFlow = 'dates';
    addBubble('Let’s plan your trip. What’s your travel date?', 'bot');
    setInput('Preferred date (e.g. 2026-12-20)');
  }

  function handleUserFlow(text) {
    if (state.chatFlow === 'dates') {
      var d = parseDate(text);
      if (!d) {
        addBubble('I couldn’t read that date. Please use YYYY-MM-DD (e.g. 2026-12-20).', 'bot');
        return;
      }
      state.date = d;
      state.chatFlow = 'travellers';
      addBubble('Got it. How many travellers?', 'bot');
      showQuick(['1', '2', '3', '4', '5+']);
      setInput('Number of travellers');
      return;
    }
    if (state.chatFlow === 'travellers') {
      var n = parseInt(text, 10);
      if (isNaN(n) || n < 1 || n > 50) {
        addBubble('Please enter a number between 1 and 50.', 'bot');
        return;
      }
      state.travellers = n;
      state.chatFlow = 'interests';
      addBubble('What interests you most?', 'bot');
      showQuick(['Beach & ocean', 'Wildlife & safari', 'Culture & city', 'Airport transfer']);
      setInput('Or describe your interests…');
      return;
    }
    if (state.chatFlow === 'interests') {
      recommendByInterest(text);
      return;
    }
    // Default fallback.
    addBubble('I’m not sure I followed. You can tap a button above, or type “Talk to the team” to send your request directly.', 'bot');
  }

  function parseDate(text) {
    var m = text.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    var d = new Date(m[1], m[2] - 1, m[3]);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }

  function recommendByInterest(text) {
    var t = text.toLowerCase();
    var candidates = state.services || [];
    var filtered = candidates.filter(function (s) {
      var name = (s.name || '').toLowerCase();
      var cat = (s.category || '').toLowerCase();
      if (t.indexOf('beach') !== -1 || t.indexOf('ocean') !== -1 || t.indexOf('marine') !== -1) {
        return cat === 'mar' || name.indexOf('snorkel') !== -1 || name.indexOf('dhow') !== -1 || name.indexOf('sandbank') !== -1 || name.indexOf('chumbe') !== -1;
      }
      if (t.indexOf('wildlife') !== -1 || t.indexOf('safari') !== -1) {
        return cat === 'saf' || name.indexOf('mikumi') !== -1 || name.indexOf('serengeti') !== -1 || name.indexOf('jozani') !== -1;
      }
      if (t.indexOf('culture') !== -1 || t.indexOf('city') !== -1 || t.indexOf('stone') !== -1) {
        return cat === 'cul' || name.indexOf('stone town') !== -1 || name.indexOf('spice') !== -1;
      }
      if (t.indexOf('airport') !== -1 || t.indexOf('transfer') !== -1) {
        return cat === 'trf';
      }
      return false;
    });
    if (filtered.length === 0) filtered = candidates;
    state.chatFlow = 'recommend';
    showServiceCards(filtered);
    if (state.selectedServices.length > 0) showSendToTeam();
    setInput('Tap “Add to my plan”, or type “Send to the team”…');
  }

  function showLeadForm() {
    var modal = el('sns-concierge-modal');
    if (modal) modal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    var chat = el('sns-concierge-chat');
    var form = el('sns-concierge-form');
    if (chat) chat.hidden = true;
    if (form) form.hidden = false;
    state.chatFlow = 'lead';
    setInput('');
  }

  function buildChatLeadPayload() {
    var nameEl = el('sns-guest-name');
    var whatsEl = el('sns-guest-whatsapp');
    var emailEl = el('sns-guest-email');
    var notesEl = el('sns-guest-notes');
    var consentEl = el('consent_contact');
    var marketingEl = el('consent_marketing');
    var versionInput = document.querySelector('input[name="privacy_notice_version"]');
    var honeypotEl = document.querySelector('.sns-honeypot');

    var notesParts = [];
    if (state.date) notesParts.push('Travel date: ' + state.date);
    if (state.travellers) notesParts.push('Travellers: ' + state.travellers);
    if (state.location) notesParts.push('Location: ' + state.location);
    if (state.selectedServices.length) {
      notesParts.push('Services: ' + state.selectedServices.map(function (s) { return s.name; }).join(', '));
    }
    if (notesEl && notesEl.value.trim()) notesParts.push(notesEl.value.trim());

    var payload = {
      name: nameEl ? nameEl.value.trim() : '',
      whatsapp: whatsEl ? whatsEl.value.trim() : null,
      email: emailEl ? emailEl.value.trim() : null,
      date: state.date || null,
      travellers: state.travellers || null,
      notes: notesParts.length ? notesParts.join('. ').slice(0, 1900) : null,
      services: state.selectedServices.length ? state.selectedServices.map(function (s) { return s.slug; }) : (state.selectedSlug ? [state.selectedSlug] : null),
      consent_contact: Boolean(consentEl && consentEl.checked),
      consent_marketing: Boolean(marketingEl && marketingEl.checked),
      privacy_notice_version: versionInput ? versionInput.value : 'v1.0',
      session_id: sessionId(),
      honeypot: honeypotEl ? honeypotEl.value : '',
      form_loaded_at: Math.floor(state.formLoadedAt || Date.now())
    };
    return payload;
  }

  function submitLeadFromChat() {
    var pre = clientPreflight();
    if (pre) { showChatStatus('error', pre, 'I would like to plan a Zanzibar trip.'); return; }
    var payload = buildChatLeadPayload();
    showChatStatus('', 'Sending your request…');
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
        var s = showChatStatus('success');
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
              waLink('My reference is ' + ref + ', about my plan.'),
              'message us on WhatsApp instead'));
          }
        }
        state.chatFlow = 'done';
        disableInput();
      } else if (res.ok) {
        throw new Error('2xx without reference');
      } else {
        var detail = (res.json && res.json.error) ? res.json.error :
          (!window.navigator.onLine ? 'You appear to be offline' : 'Sending failed');
        showChatStatus('error', 'We could not save your request (' + detail + ').', 'I would like to plan a Zanzibar trip.');
      }
    }).catch(function () {
      var msg = 'We could not save your request' + (window.navigator.onLine ? '' : ' (you appear to be offline)') +
        (state.lastReference ? '. If you saw a reference earlier, mention it.' : '.');
      showChatStatus('error', msg, 'I would like to plan a Zanzibar trip.');
    });
  }

  /* ---------- lead form helpers (shared with form submit) ---------- */

  function clientPreflight() {
    var whatsEl = el('sns-guest-whatsapp');
    var emailEl = el('sns-guest-email');
    var contactOk = ((whatsEl && whatsEl.value.trim()) || (emailEl && emailEl.value.trim()));
    if (!contactOk) {
      return 'Add a WhatsApp number or an email so our team can reach you.';
    }
    return null;
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

  /* ---------- teaser ---------- */

  function maybeShowTeaser() {
    if (state.teaserShown) return;
    if (sessionStorage.getItem('sns_teaser_dismissed')) return;
    var text = teaserText();
    el('sns-teaser-text').textContent = text;
    var teaser = el('sns-concierge-teaser');
    if (teaser) teaser.hidden = false;
    state.teaserShown = true;
  }

  function teaserText() {
    var type = pageType();
    var svc = state.contextService ? serviceBySlug(state.contextService) : null;
    if (svc) {
      return 'Looking at ' + svc.name + '? I can show you a planning range.';
    }
    if (type === 'tour') return 'Looking at this tour? I can show you a planning range.';
    if (type === 'safari') return 'Planning a safari? I can show you planning ranges.';
    if (type === 'transfer') return 'Need an airport transfer? I can show you planning ranges.';
    return 'Planning a Zanzibar trip? I can show you planning ranges and send your request to our team.';
  }

  function dismissTeaser() {
    var teaser = el('sns-concierge-teaser');
    if (teaser) teaser.hidden = true;
    try { sessionStorage.setItem('sns_teaser_dismissed', '1'); } catch (e) {}
    state.teaserShown = true;
  }

  function openTeaser() {
    dismissTeaser();
    startChat();
  }

  function setLauncherLabel() {
    var label = el('sns-launcher-label');
    if (label) {
      var pt = pageType();
      if (pt === 'transfer') label.textContent = 'Get my transfer price';
      else if (pt === 'tour') label.textContent = 'Ask about this tour';
      else if (pt === 'safari') label.textContent = 'Ask about this safari';
      else label.textContent = 'Plan your trip';
    }
  }

  /* ---------- open / close ---------- */

  function openConcierge(preselectKey) {
    if (preselectKey) {
      state.contextService = normaliseSlug(preselectKey);
    } else if (!state.contextService) {
      state.contextService = pageServiceFromUrl();
    }
    setLauncherLabel();
    // Load catalogue in the background so recommendations are ready.
    if (!state.services && !state._loading) {
      state._loading = loadCatalogue().then(function () { state._loading = null; });
    }
    startChat();
  }

  function closeConcierge() {
    var modal = el('sns-concierge-modal');
    if (modal) {
      modal.setAttribute('hidden', '');
      document.body.style.overflow = '';
    }
  }

  /* ---------- init ---------- */

  document.addEventListener('DOMContentLoaded', function () {
    var trigger = el('sns-concierge-trigger');
    setLauncherLabel();
    var closeBtn = el('sns-concierge-close');
    var backdrop = el('sns-concierge-backdrop');
    var form = el('sns-concierge-form');
    var chatOpenBtn = el('sns-chat-open');
    var chatCloseBtn = el('sns-chat-close');
    var chatSendBtn = el('sns-chat-send');
    var chatBackBtn = el('sns-chat-back-to-form');
    var chatBackFromForm = el('sns-chat-back-from-form');
    var chatInput = el('sns-chat-input');
    var teaserOpen = el('sns-teaser-open');
    var teaserDismiss = el('sns-teaser-dismiss');

    if (trigger) trigger.addEventListener('click', function () { openConcierge(); });
    if (closeBtn) closeBtn.addEventListener('click', closeConcierge);
    if (backdrop) backdrop.addEventListener('click', closeConcierge);
    if (form) form.addEventListener('submit', function (e) { e.preventDefault(); submitLeadFromChat(); });
    if (chatSendBtn) chatSendBtn.addEventListener('click', function () {
      var t = (chatInput ? chatInput.value : '').trim();
      if (!t) return;
      addBubble(t, 'user');
      chatInput.value = '';
      hintThinking();
      setTimeout(function () {
        clearThinking();
        routeFromUser(t);
      }, 600);
    });
    if (chatInput) chatInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); chatSendBtn.click(); }
    });
    if (chatBackBtn) chatBackBtn.addEventListener('click', function () {
      var chat = el('sns-concierge-chat');
      var form = el('sns-concierge-form');
      if (chat) chat.hidden = false;
      if (form) form.hidden = true;
      showGreeting();
    });
    if (chatBackFromForm) chatBackFromForm.addEventListener('click', function () {
      var chat = el('sns-concierge-chat');
      var form = el('sns-concierge-form');
      if (chat) chat.hidden = false;
      if (form) form.hidden = true;
      showGreeting();
    });
    if (teaserOpen) teaserOpen.addEventListener('click', openTeaser);
    if (teaserDismiss) teaserDismiss.addEventListener('click', dismissTeaser);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeConcierge();
    });

    // Launcher pulse only for the first few seconds.
    setTimeout(function () {
      var dot = el('sns-pulse-dot');
      if (dot) dot.style.display = 'none';
    }, 5000);

    // Teaser after ~8s or on first scroll, once per session.
    var teaserShown = false;
    function triggerTeaser() {
      if (teaserShown) return;
      teaserShown = true;
      maybeShowTeaser();
    }
    setTimeout(triggerTeaser, 8000);
    document.addEventListener('scroll', triggerTeaser, { once: true, passive: true });
  });

  /* ---------- route free text based on flow ---------- */

  function routeFromUser(text) {
    if (state.chatFlow === 'greeting') {
      routeFromGreeting(text);
      return;
    }
    if (state.chatFlow === 'lead') return; // form handles submission
    handleUserFlow(text);
  }

  /* ---------- export ---------- */

  window.snsConcierge = {
    open: openConcierge,
    close: closeConcierge,
    _bubbleNodes: bubbleNodes
  };

})();
