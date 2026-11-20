/* ==========================================================================
   Spice & Sail — Island Concierge chat widget (v3)
   One self-contained file: builds its own DOM and styles, no template markup.

   Talks to the existing Netlify functions:
     GET  /api/quote   -> catalogue list + business config
     POST /api/quote   -> deterministic planning range
     POST /api/chat    -> concierge replies (rules + optional LLM)
     POST /api/lead    -> saves the enquiry, returns SP-xxxx reference

   Principles
   - Facts (prices, names, durations) only ever come from the server.
   - Nothing is ever described as confirmed; the team confirms on WhatsApp.
   - No payment details are collected here.
   - All server text is rendered through an escaping renderer (no raw innerHTML).
   ========================================================================== */
(function () {
  'use strict';
  if (window.__snsChat) return;
  window.__snsChat = true;

  /* ------------------------------------------------------------------ config */
  var CFG = {
    chat: '/api/chat',
    quote: '/api/quote',
    lead: '/api/lead',
    whatsappFallback: '255672450934',
    storeKey: 'sns_chat_v3',
    maxHistory: 10,
    maxMessageLen: 500,
    mobileBreakpoint: 640,
    launcherBottomDesktop: 24,
    launcherBottomMobile: 84 // clears the mobile sticky "Chat WhatsApp / Browse Tours" bar
  };

  /* -------------------------------------------------------------------- i18n */
  var T = {
    en: {
      title: 'Island Concierge', sub: 'Real rates · real people', online: 'Spice & Sail Zanzibar',
      person: 'Talk to a person', close: 'Close chat', open: 'Chat with us', send: 'Send',
      placeholder: 'Ask about tours, transfers, prices…',
      welcome: "**Karibu!** I'm the Spice & Sail Island Concierge. I recommend from our real tour catalogue, show verified planning rates, and pass your request to our local team, who confirm every detail.",
      welcome2: 'No payment is taken in this chat. We only use what you share to answer your request ([privacy notice](/privacy/)).',
      plan: 'Plan my trip', browse: 'Browse tours', transfer: 'Airport transfer', ask: 'Ask a question',
      q_dates: 'When are you travelling?', q_dates_unsure: 'Not sure yet',
      q_who: 'Who is travelling?', adults: 'Adults', children: 'Children (6–14)',
      q_interest: 'What do you enjoy? Pick any.', q_area: 'Where are you staying?',
      area_stone: 'Stone Town', area_north: 'Nungwi / Kendwa', area_east: 'Paje / Jambiani',
      area_ne: 'Kiwengwa / Matemwe', area_unsure: 'Not decided',
      i_beach: 'Beach & sea', i_culture: 'Culture & history', i_wild: 'Wildlife & nature',
      i_adv: 'Adventure', i_rom: 'Romance', i_fam: 'Family-friendly', i_any: 'Surprise me',
      next: 'Continue', skip: 'Skip', thinking: 'Finding the best options…',
      cat_all: 'All', cat_MAR: 'Sea', cat_CUL: 'Culture', cat_NAT: 'Nature', cat_SAF: 'Safari',
      cat_PKG: 'Packages', cat_EXP: 'Experiences', cat_TRF: 'Transfers',
      from: 'From', onreq: 'Price on request', get_quote: 'Get a quote', ask_about: 'Ask about this',
      more: 'Show more', quote_title: 'Planning range', for_who: 'For', date: 'Date',
      recalc: 'Update', team_confirms: 'A planning range, not a booking. Our team confirms availability, the final price and any deposit before you pay.',
      includes: 'Includes', send_enquiry: 'Send my enquiry', wa_btn: 'Continue on WhatsApp',
      lead_title: 'Send your enquiry', name: 'Your name', wa: 'WhatsApp number (with +country code)',
      email: 'Email (optional if WhatsApp given)', consent: 'Contact me about this request',
      consent_hint: 'Required to save your reference.', submit: 'Send request', sending: 'Sending…',
      saved: 'Request received! Your reference is', saved2: 'Our team replies',
      err_name: 'Please enter your name.', err_contact: 'Add a WhatsApp number or an email.',
      err_phone: 'Use international format, e.g. +255 672 450 934.', err_consent: 'Please tick the consent box so we can contact you.',
      err_net: "I couldn't reach the server. You can still message our team directly on WhatsApp.",
      err_limit: 'Message limit reached. Please continue on WhatsApp.',
      err_generic: 'Something went wrong. Please try again, or use WhatsApp.',
      lang_note: 'Replies here are in English. Our team can answer in Italian or German on WhatsApp.',
      wa_hi: "Hi Spice & Sail! I'd like to book", wa_ref: 'Reference', wa_pax: 'Group', wa_date: 'Dates',
      wa_pickup: 'Pickup', wa_name: 'Name', wa_generic: 'a Zanzibar experience',
      adults_l: 'adults', children_l: 'children'
    },
    it: {
      title: 'Island Concierge', sub: 'Tariffe reali · persone reali', online: 'Spice & Sail Zanzibar',
      person: 'Parla con una persona', close: 'Chiudi chat', open: 'Scrivici', send: 'Invia',
      placeholder: 'Chiedi di tour, transfer, prezzi…',
      welcome: "**Karibu!** Sono l'Island Concierge di Spice & Sail. Consiglio dal nostro catalogo reale, mostro tariffe indicative verificate e passo la richiesta al nostro team locale, che conferma ogni dettaglio.",
      welcome2: 'In questa chat non si effettuano pagamenti. Usiamo solo ciò che condividi per rispondere ([informativa privacy](/privacy/)).',
      plan: 'Pianifica il viaggio', browse: 'Vedi i tour', transfer: 'Transfer aeroporto', ask: 'Fai una domanda',
      q_dates: 'Quando viaggi?', q_dates_unsure: 'Non so ancora',
      q_who: 'Chi viaggia?', adults: 'Adulti', children: 'Bambini (6–14)',
      q_interest: 'Cosa ti piace? Scegli pure più opzioni.', q_area: 'Dove alloggi?',
      area_stone: 'Stone Town', area_north: 'Nungwi / Kendwa', area_east: 'Paje / Jambiani',
      area_ne: 'Kiwengwa / Matemwe', area_unsure: 'Non deciso',
      i_beach: 'Mare e spiagge', i_culture: 'Cultura e storia', i_wild: 'Natura e animali',
      i_adv: 'Avventura', i_rom: 'Romantico', i_fam: 'Per famiglie', i_any: 'Sorprendimi',
      next: 'Continua', skip: 'Salta', thinking: 'Cerco le opzioni migliori…',
      cat_all: 'Tutti', cat_MAR: 'Mare', cat_CUL: 'Cultura', cat_NAT: 'Natura', cat_SAF: 'Safari',
      cat_PKG: 'Pacchetti', cat_EXP: 'Esperienze', cat_TRF: 'Transfer',
      from: 'Da', onreq: 'Prezzo su richiesta', get_quote: 'Preventivo', ask_about: 'Chiedi info',
      more: 'Mostra altro', quote_title: 'Tariffa indicativa', for_who: 'Per', date: 'Data',
      recalc: 'Aggiorna', team_confirms: 'Una tariffa indicativa, non una prenotazione. Il team conferma disponibilità, prezzo finale ed eventuale caparra prima del pagamento.',
      includes: 'Include', send_enquiry: 'Invia la richiesta', wa_btn: 'Continua su WhatsApp',
      lead_title: 'Invia la tua richiesta', name: 'Il tuo nome', wa: 'Numero WhatsApp (con prefisso +)',
      email: 'Email (facoltativa se hai indicato WhatsApp)', consent: 'Contattatemi per questa richiesta',
      consent_hint: 'Necessario per salvare il tuo riferimento.', submit: 'Invia richiesta', sending: 'Invio…',
      saved: 'Richiesta ricevuta! Il tuo riferimento è', saved2: 'Il team risponde',
      err_name: 'Inserisci il tuo nome.', err_contact: 'Aggiungi un numero WhatsApp o un’email.',
      err_phone: 'Usa il formato internazionale, es. +255 672 450 934.', err_consent: 'Spunta il consenso per essere contattato.',
      err_net: 'Non riesco a raggiungere il server. Puoi scrivere direttamente al team su WhatsApp.',
      err_limit: 'Limite di messaggi raggiunto. Continua su WhatsApp.',
      err_generic: 'Qualcosa è andato storto. Riprova oppure usa WhatsApp.',
      lang_note: 'Le risposte qui sono in inglese. Il nostro team risponde in italiano su WhatsApp.',
      wa_hi: 'Ciao Spice & Sail! Vorrei prenotare', wa_ref: 'Riferimento', wa_pax: 'Gruppo', wa_date: 'Date',
      wa_pickup: 'Ritiro', wa_name: 'Nome', wa_generic: "un'esperienza a Zanzibar",
      adults_l: 'adulti', children_l: 'bambini'
    },
    de: {
      title: 'Island Concierge', sub: 'Echte Preise · echte Menschen', online: 'Spice & Sail Zanzibar',
      person: 'Mit einem Menschen sprechen', close: 'Chat schließen', open: 'Schreiben Sie uns', send: 'Senden',
      placeholder: 'Fragen zu Touren, Transfers, Preisen…',
      welcome: '**Karibu!** Ich bin der Island Concierge von Spice & Sail. Ich empfehle aus unserem echten Katalog, zeige geprüfte Richtpreise und gebe Ihre Anfrage an unser lokales Team weiter, das jedes Detail bestätigt.',
      welcome2: 'In diesem Chat wird nichts bezahlt. Wir verwenden Ihre Angaben nur zur Bearbeitung Ihrer Anfrage ([Datenschutz](/privacy/)).',
      plan: 'Reise planen', browse: 'Touren ansehen', transfer: 'Flughafentransfer', ask: 'Frage stellen',
      q_dates: 'Wann reisen Sie?', q_dates_unsure: 'Noch unklar',
      q_who: 'Wer reist mit?', adults: 'Erwachsene', children: 'Kinder (6–14)',
      q_interest: 'Was gefällt Ihnen? Mehrfachauswahl möglich.', q_area: 'Wo übernachten Sie?',
      area_stone: 'Stone Town', area_north: 'Nungwi / Kendwa', area_east: 'Paje / Jambiani',
      area_ne: 'Kiwengwa / Matemwe', area_unsure: 'Noch offen',
      i_beach: 'Strand & Meer', i_culture: 'Kultur & Geschichte', i_wild: 'Natur & Tiere',
      i_adv: 'Abenteuer', i_rom: 'Romantik', i_fam: 'Familienfreundlich', i_any: 'Überraschen Sie mich',
      next: 'Weiter', skip: 'Überspringen', thinking: 'Ich suche die besten Optionen…',
      cat_all: 'Alle', cat_MAR: 'Meer', cat_CUL: 'Kultur', cat_NAT: 'Natur', cat_SAF: 'Safari',
      cat_PKG: 'Pakete', cat_EXP: 'Erlebnisse', cat_TRF: 'Transfers',
      from: 'Ab', onreq: 'Preis auf Anfrage', get_quote: 'Preis anfragen', ask_about: 'Mehr erfahren',
      more: 'Mehr anzeigen', quote_title: 'Richtpreis', for_who: 'Für', date: 'Datum',
      recalc: 'Aktualisieren', team_confirms: 'Ein Richtpreis, keine Buchung. Unser Team bestätigt Verfügbarkeit, Endpreis und eine mögliche Anzahlung, bevor Sie zahlen.',
      includes: 'Inklusive', send_enquiry: 'Anfrage senden', wa_btn: 'Weiter auf WhatsApp',
      lead_title: 'Anfrage senden', name: 'Ihr Name', wa: 'WhatsApp-Nummer (mit +Ländervorwahl)',
      email: 'E-Mail (optional, wenn WhatsApp angegeben)', consent: 'Bitte kontaktieren Sie mich zu dieser Anfrage',
      consent_hint: 'Erforderlich, um Ihre Referenz zu speichern.', submit: 'Anfrage senden', sending: 'Wird gesendet…',
      saved: 'Anfrage erhalten! Ihre Referenz lautet', saved2: 'Unser Team antwortet',
      err_name: 'Bitte geben Sie Ihren Namen ein.', err_contact: 'Bitte WhatsApp-Nummer oder E-Mail angeben.',
      err_phone: 'Internationales Format, z. B. +255 672 450 934.', err_consent: 'Bitte stimmen Sie der Kontaktaufnahme zu.',
      err_net: 'Server nicht erreichbar. Sie können unser Team direkt per WhatsApp schreiben.',
      err_limit: 'Nachrichtenlimit erreicht. Bitte weiter per WhatsApp.',
      err_generic: 'Etwas ist schiefgelaufen. Bitte erneut versuchen oder WhatsApp nutzen.',
      lang_note: 'Antworten hier sind auf Englisch. Unser Team antwortet auf WhatsApp gern auf Deutsch.',
      wa_hi: 'Hallo Spice & Sail! Ich möchte gern buchen', wa_ref: 'Referenz', wa_pax: 'Gruppe', wa_date: 'Datum',
      wa_pickup: 'Abholung', wa_name: 'Name', wa_generic: 'ein Erlebnis auf Sansibar',
      adults_l: 'Erwachsene', children_l: 'Kinder'
    }
  };

  function detectLang() {
    var p = (location.pathname || '').toLowerCase();
    if (/^\/it(\/|$)/.test(p)) return 'it';
    if (/^\/de(\/|$)/.test(p)) return 'de';
    var l = ((document.documentElement && document.documentElement.lang) || '').slice(0, 2).toLowerCase();
    return T[l] ? l : 'en';
  }
  var LANG = detectLang();
  function t(k) { return (T[LANG] && T[LANG][k]) || T.en[k] || k; }

  /* ------------------------------------------------------------------- state */
  var state = {
    open: false, busy: false, ready: false,
    session: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    serverProfile: {}, // returned by /chat, sent back verbatim
    guests: { adults: 2, children: 0 },
    dateISO: null, interests: [], pickupLabel: null, name: '',
    selected: [],       // service slugs the guest showed interest in
    lastQuote: null,    // { slug, display }
    leadRef: null,
    history: [],        // [{role, content}] sent to /chat
    transcript: [],     // [{who, text}] persisted for this tab session
    catalogue: [], bySlug: {}, whatsapp: CFG.whatsappFallback, replyWindow: '',
    formOpenedAt: 0
  };

  /* ---------------------------------------------------------------- storage */
  function load() {
    try {
      var raw = sessionStorage.getItem(CFG.storeKey);
      if (!raw) return null;
      var d = JSON.parse(raw);
      return d && typeof d === 'object' ? d : null;
    } catch (e) { return null; }
  }
  function save() {
    try {
      sessionStorage.setItem(CFG.storeKey, JSON.stringify({
        session: state.session, serverProfile: state.serverProfile, guests: state.guests,
        dateISO: state.dateISO, interests: state.interests, pickupLabel: state.pickupLabel,
        name: state.name, selected: state.selected, leadRef: state.leadRef,
        history: state.history.slice(-CFG.maxHistory), transcript: state.transcript.slice(-30)
      }));
    } catch (e) { /* storage may be unavailable; chat still works */ }
  }

  /* --------------------------------------------------------------- analytics */
  function track(name, params) {
    try { if (typeof window.gtag === 'function') window.gtag('event', 'sns_chat_' + name, params || {}); } catch (e) {}
  }

  /* -------------------------------------------------------------------- utils */
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }
  function money(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function todayISO() { var d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
  function prettyDate(iso) {
    if (!iso) return '';
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso); if (!m) return iso;
    try { return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString(LANG === 'en' ? 'en-GB' : LANG, { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch (e) { return iso; }
  }
  function isSafeHref(u) {
    if (/^https:\/\/wa\.me\/\d{8,15}(\?|$)/.test(u)) return true;
    if (/^\/(?!\/)/.test(u)) return true;                 // same-site path
    try { return new URL(u, location.href).origin === location.origin; } catch (e) { return false; }
  }

  /* Escaping markdown-lite renderer: **bold**, _italic_, [text](url), • bullets */
  function inline(text, into) {
    var re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|_([^_]+)_/g, last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) into.appendChild(document.createTextNode(text.slice(last, m.index)));
      if (m[1] != null) {
        if (isSafeHref(m[2])) {
          var ext = /^https?:/.test(m[2]) && new URL(m[2], location.href).origin !== location.origin;
          into.appendChild(h('a', { href: m[2], target: ext ? '_blank' : null, rel: ext ? 'noopener noreferrer' : null, text: m[1] }));
        } else into.appendChild(document.createTextNode(m[1]));
      } else if (m[3] != null) into.appendChild(h('strong', { text: m[3] }));
      else into.appendChild(h('em', { text: m[4] }));
      last = re.lastIndex;
    }
    if (last < text.length) into.appendChild(document.createTextNode(text.slice(last)));
  }
  function rich(text) {
    var frag = document.createDocumentFragment(), ul = null;
    String(text || '').split('\n').forEach(function (line) {
      var bullet = /^\s*(?:•|-|\d+\.)\s+(.*)$/.exec(line);
      if (bullet) {
        if (!ul) { ul = h('ul'); frag.appendChild(ul); }
        var li = h('li'); inline(bullet[1], li); ul.appendChild(li);
      } else {
        ul = null;
        if (!line.trim()) return;
        var p = h('p'); inline(line, p); frag.appendChild(p);
      }
    });
    return frag;
  }

  /* ------------------------------------------------------------------ network */
  function api(url, opts, timeout) {
    var ctl = ('AbortController' in window) ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, timeout || 15000);
    var o = Object.assign({ credentials: 'same-origin' }, opts || {});
    if (ctl) o.signal = ctl.signal;
    return fetch(url, o).then(function (r) {
      clearTimeout(timer);
      return r.json().catch(function () { return null; }).then(function (j) { return { ok: r.ok, status: r.status, json: j }; });
    }).catch(function () { clearTimeout(timer); return { ok: false, status: 0, json: null }; });
  }
  function post(url, body, timeout) {
    return api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, timeout);
  }

  /* --------------------------------------------------------------- DOM: shell */
  var root, panel, log, form, input, sendBtn, launcher, callout, personBtn, styleEl;

  var CSS = [
    ':root{--sns3-teal:#007B6B;--sns3-teal-d:#005f52;--sns3-gold:#D4AF37;--sns3-ink:#12302c;--sns3-bg:#fff;--sns3-soft:#f1f5f4;--sns3-line:#dbe5e2;--sns3-b:' + CFG.launcherBottomDesktop + 'px}',
    '.sns3,.sns3 *{box-sizing:border-box}',
    '.sns3{font-family:"Figtree",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--sns3-ink);font-size:15px;line-height:1.45}',
    '.sns3 [hidden]{display:none!important}',
    '.sns3-launcher{position:fixed;right:20px;bottom:var(--sns3-b);z-index:2147483000;display:flex;align-items:center;gap:10px;border:0;cursor:pointer;background:var(--sns3-teal);color:#fff;font:600 15px/1 inherit;font-family:inherit;padding:14px 18px;border-radius:999px;box-shadow:0 8px 24px rgba(0,60,52,.35);min-height:48px}',
    '.sns3-launcher:hover{background:var(--sns3-teal-d)}',
    '.sns3-launcher:focus-visible,.sns3 button:focus-visible,.sns3 input:focus-visible,.sns3 textarea:focus-visible,.sns3 a:focus-visible{outline:3px solid var(--sns3-gold);outline-offset:2px}',
    '.sns3-launcher svg{width:22px;height:22px;flex:none}',
    '.sns3-callout{position:fixed;right:20px;bottom:calc(var(--sns3-b) + 64px);z-index:2147483000;max-width:260px;background:#fff;border:1px solid var(--sns3-line);border-radius:14px;padding:12px 34px 12px 14px;box-shadow:0 8px 24px rgba(0,0,0,.15);font-size:14px;cursor:pointer}',
    '.sns3-callout button{position:absolute;top:4px;right:4px;border:0;background:none;font-size:20px;line-height:1;width:32px;height:32px;cursor:pointer;color:#5b6f6b}',
    '.sns3-panel{position:fixed;right:20px;bottom:var(--sns3-b);z-index:2147483001;width:390px;max-width:calc(100vw - 24px);height:min(640px,calc(100vh - 40px));background:var(--sns3-bg);border-radius:18px;box-shadow:0 18px 60px rgba(0,0,0,.3);display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--sns3-line)}',
    '.sns3-head{display:flex;align-items:center;gap:10px;padding:12px 12px 12px 16px;background:linear-gradient(135deg,var(--sns3-teal),#00a38c);color:#fff}',
    '.sns3-avatar{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.18);display:grid;place-items:center;font-size:20px;flex:none}',
    '.sns3-ht{flex:1;min-width:0}.sns3-ht b{display:block;font-size:16px}.sns3-ht span{font-size:12.5px;opacity:.9}',
    '.sns3-person{border:1px solid rgba(255,255,255,.55);background:rgba(255,255,255,.12);color:#fff;border-radius:999px;font:600 12.5px/1 inherit;font-family:inherit;padding:9px 12px;cursor:pointer;min-height:36px;white-space:nowrap}',
    '.sns3-person:hover{background:rgba(255,255,255,.25)}',
    '.sns3-x{border:0;background:none;color:#fff;font-size:26px;line-height:1;cursor:pointer;width:40px;height:40px;border-radius:50%}',
    '.sns3-x:hover{background:rgba(255,255,255,.2)}',
    '.sns3-log{flex:1;overflow-y:auto;padding:14px;background:#fbfdfc;scroll-behavior:smooth;overscroll-behavior:contain}',
    '.sns3-row{display:flex;margin:0 0 10px}.sns3-row.user{justify-content:flex-end}',
    '.sns3-b{max-width:88%;padding:10px 13px;border-radius:16px;background:var(--sns3-soft);word-wrap:break-word;overflow-wrap:anywhere}',
    '.sns3-row.user .sns3-b{background:var(--sns3-teal);color:#fff;border-bottom-right-radius:4px}',
    '.sns3-row.bot .sns3-b{border-bottom-left-radius:4px}',
    '.sns3-b p{margin:0 0 6px}.sns3-b p:last-child{margin-bottom:0}.sns3-b ul{margin:4px 0 6px;padding-left:18px}.sns3-b li{margin:2px 0}',
    '.sns3-b a{color:var(--sns3-teal-d);font-weight:600;text-decoration:underline}',
    '.sns3-row.user .sns3-b a{color:#fff}',
    '.sns3-note{font-size:12.5px;color:#4d6560;margin-top:6px}',
    '.sns3-chips{display:flex;flex-wrap:wrap;gap:8px;margin:2px 0 12px}',
    '.sns3-chip{border:1.5px solid var(--sns3-teal);background:#fff;color:var(--sns3-teal-d);border-radius:999px;font:600 14px/1.2 inherit;font-family:inherit;padding:9px 14px;cursor:pointer;min-height:40px}',
    '.sns3-chip:hover{background:#e8f5f2}.sns3-chip[aria-pressed="true"]{background:var(--sns3-teal);color:#fff}',
    '.sns3-chip.wa{border-color:#128c4a;color:#0b6b37}.sns3-chip.wa:hover{background:#e6f6ec}',
    '.sns3-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:12px;background:var(--sns3-teal);color:#fff;font:700 14.5px/1 inherit;font-family:inherit;padding:12px 16px;cursor:pointer;min-height:44px;text-decoration:none}',
    '.sns3-btn:hover{background:var(--sns3-teal-d)}.sns3-btn.ghost{background:#fff;color:var(--sns3-teal-d);border:1.5px solid var(--sns3-teal)}',
    '.sns3-btn.wa{background:#128c4a}.sns3-btn.wa:hover{background:#0b6b37}.sns3-btn[disabled]{opacity:.55;cursor:default}',
    '.sns3-btn.sm{padding:9px 12px;font-size:13.5px;min-height:38px}',
    '.sns3-card{background:#fff;border:1px solid var(--sns3-line);border-radius:14px;padding:12px;margin:0 0 10px;max-width:100%}',
    '.sns3-card h4{margin:0 0 2px;font-size:15.5px}.sns3-card .meta{font-size:13px;color:#4d6560}',
    '.sns3-tag{display:inline-block;font-size:11.5px;font-weight:700;letter-spacing:.02em;color:var(--sns3-teal-d);background:#e8f5f2;border-radius:999px;padding:3px 9px;margin-bottom:6px}',
    '.sns3-price{font-weight:800;font-size:17px;margin:6px 0 8px}',
    '.sns3-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}',
    '.sns3-quote .big{font-size:26px;font-weight:800;color:var(--sns3-teal-d);margin:2px 0}',
    '.sns3-quote ul{margin:6px 0;padding-left:18px;font-size:13.5px}',
    '.sns3-ctrl{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:6px 0}',
    '.sns3-step{display:inline-flex;align-items:center;border:1.5px solid var(--sns3-line);border-radius:12px;overflow:hidden;background:#fff}',
    '.sns3-step button{width:40px;height:40px;border:0;background:#f4f7f6;font-size:20px;cursor:pointer;color:var(--sns3-ink)}',
    '.sns3-step output{min-width:34px;text-align:center;font-weight:700}',
    '.sns3 label{display:block;font-size:13px;font-weight:600;margin:8px 0 3px}',
    '.sns3 input[type=text],.sns3 input[type=tel],.sns3 input[type=email],.sns3 input[type=date]{width:100%;border:1.5px solid var(--sns3-line);border-radius:10px;padding:11px 12px;font:inherit;font-size:16px;background:#fff;color:var(--sns3-ink)}',
    '.sns3-check{display:flex;gap:10px;align-items:flex-start;font-size:13.5px;margin:10px 0 2px}.sns3-check input{width:20px;height:20px;margin-top:1px;flex:none}',
    '.sns3-err{color:#b3261e;font-size:13px;margin:6px 0 0;font-weight:600}',
    '.sns3-hp{position:absolute!important;left:-9999px!important;height:0;width:0;opacity:0}',
    '.sns3-foot{border-top:1px solid var(--sns3-line);background:#fff;padding:10px}',
    '.sns3-form{display:flex;gap:8px}',
    '.sns3-form input{flex:1;min-width:0;border:1.5px solid var(--sns3-line);border-radius:12px;padding:11px 13px;font:inherit;font-size:16px}',
    '.sns3-send{border:0;border-radius:12px;background:var(--sns3-teal);color:#fff;font:700 14px/1 inherit;font-family:inherit;padding:0 16px;cursor:pointer;min-height:44px}',
    '.sns3-send[disabled]{opacity:.5}',
    '.sns3-typing{display:inline-flex;gap:4px;padding:4px 2px}.sns3-typing i{width:7px;height:7px;border-radius:50%;background:#7a918c;animation:sns3b 1s infinite ease-in-out}',
    '.sns3-typing i:nth-child(2){animation-delay:.15s}.sns3-typing i:nth-child(3){animation-delay:.3s}',
    '@keyframes sns3b{0%,80%,100%{transform:translateY(0);opacity:.5}40%{transform:translateY(-4px);opacity:1}}',
    '@media (prefers-reduced-motion:reduce){.sns3-typing i{animation:none}.sns3-log{scroll-behavior:auto}}',
    '@media (max-width:' + CFG.mobileBreakpoint + 'px){:root{--sns3-b:' + CFG.launcherBottomMobile + 'px}',
    '.sns3-panel{right:0;left:0;bottom:0;top:0;width:100%;max-width:100%;height:100%;height:100dvh;border-radius:0;border:0}',
    '.sns3-launcher{right:14px}.sns3-launcher span{display:none}.sns3-launcher{padding:14px}.sns3-callout{right:14px}}'
  ].join('\n');

  function build() {
    styleEl = h('style', { id: 'sns3-style' }); styleEl.textContent = CSS; document.head.appendChild(styleEl);

    launcher = h('button', { class: 'sns3-launcher', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'sns3-panel', 'aria-label': t('open'), onclick: openChat });
    launcher.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.6-.8L3 21l1.9-5.4A8.4 8.4 0 1 1 21 11.5z"/></svg>';
    launcher.appendChild(h('span', { text: t('title') }));

    callout = h('div', { class: 'sns3-callout', hidden: true, onclick: function (e) { if (e.target.tagName !== 'BUTTON') openChat(); } }, [
      h('span', { text: LANG === 'it' ? 'Pianifichi Zanzibar? Ti mostro tariffe reali.' : LANG === 'de' ? 'Sansibar planen? Ich zeige echte Richtpreise.' : 'Planning Zanzibar? I can show real planning rates.' }),
      h('button', { type: 'button', 'aria-label': t('close'), text: '×', onclick: function (e) { e.stopPropagation(); callout.hidden = true; } })
    ]);

    personBtn = h('button', { class: 'sns3-person', type: 'button', text: t('person'), onclick: function () { handoff(); } });
    var closeBtn = h('button', { class: 'sns3-x', type: 'button', 'aria-label': t('close'), text: '×', onclick: closeChat });

    log = h('div', { class: 'sns3-log', role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions' });

    input = h('input', { type: 'text', maxlength: String(CFG.maxMessageLen), placeholder: t('placeholder'), 'aria-label': t('placeholder'), autocomplete: 'off', enterkeyhint: 'send' });
    sendBtn = h('button', { class: 'sns3-send', type: 'submit', text: t('send') });
    form = h('form', { class: 'sns3-form', onsubmit: function (e) { e.preventDefault(); var v = input.value.trim(); if (v) { input.value = ''; userSays(v); } } }, [input, sendBtn]);

    panel = h('section', { class: 'sns3-panel', id: 'sns3-panel', role: 'dialog', 'aria-label': t('title'), hidden: true }, [
      h('div', { class: 'sns3-head' }, [
        h('div', { class: 'sns3-avatar', 'aria-hidden': 'true', text: '🐚' }),
        h('div', { class: 'sns3-ht' }, [h('b', { text: t('title') }), h('span', { text: t('sub') })]),
        personBtn, closeBtn
      ]),
      log,
      h('div', { class: 'sns3-foot' }, [form])
    ]);

    root = h('div', { class: 'sns3' }, [launcher, callout, panel]);
    document.body.appendChild(root);

    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && state.open) closeChat(); });
  }

  /* ---------------------------------------------------------- chat primitives */
  function scrollDown() { log.scrollTop = log.scrollHeight; }

  function bubble(who, nodeOrText, persistText) {
    var b = h('div', { class: 'sns3-b' });
    if (typeof nodeOrText === 'string') b.appendChild(rich(nodeOrText)); else b.appendChild(nodeOrText);
    var row = h('div', { class: 'sns3-row ' + who }, [b]);
    log.appendChild(row); scrollDown();
    if (persistText != null) { state.transcript.push({ who: who, text: persistText }); save(); }
    return row;
  }
  function botSays(text) { return bubble('bot', text, text); }
  function userBubble(text) { return bubble('user', h('p', { text: text }), text); }

  function typing(on) {
    var ex = log.querySelector('.sns3-typingrow');
    if (!on) { if (ex) ex.remove(); return; }
    if (ex) return;
    log.appendChild(h('div', { class: 'sns3-row bot sns3-typingrow' }, [h('div', { class: 'sns3-b', 'aria-label': t('thinking') }, [h('span', { class: 'sns3-typing' }, [h('i'), h('i'), h('i')])])]));
    scrollDown();
  }

  var chipRow = null;
  function clearChips() { if (chipRow) { chipRow.remove(); chipRow = null; } }
  function chips(items) {
    clearChips();
    if (!items || !items.length) return;
    chipRow = h('div', { class: 'sns3-chips' });
    items.forEach(function (it) {
      var wa = /whatsapp/i.test(it.label);
      chipRow.appendChild(h('button', { class: 'sns3-chip' + (wa ? ' wa' : ''), type: 'button', text: it.label, onclick: function () { clearChips(); it.run(); } }));
    });
    log.appendChild(chipRow); scrollDown();
  }
  function homeChips() {
    chips([
      { label: t('plan'), run: planTrip },
      { label: t('browse'), run: function () { userBubble(t('browse')); browse('all'); } },
      { label: t('transfer'), run: function () { userSays(t('transfer'), true); } },
      { label: t('ask'), run: function () { input.focus(); } }
    ]);
  }

  /* ------------------------------------------------------------ catalogue UI */
  var CAT_ICON = { MAR: '🌊', CUL: '🌿', NAT: '🌳', SAF: '🦁', PKG: '📦', EXP: '✨', TRF: '🚗' };

  function serviceCard(s) {
    var price = s.onRequest || !s.priceDisplay ? t('onreq') : t('from') + ' ' + s.priceDisplay;
    return h('div', { class: 'sns3-card' }, [
      h('span', { class: 'sns3-tag', text: (CAT_ICON[s.category] || '📍') + ' ' + (t('cat_' + s.category) || s.category) }),
      h('h4', { text: s.name }),
      h('div', { class: 'meta', text: [s.duration, s.location].filter(Boolean).join(' · ') }),
      h('div', { class: 'sns3-price', text: price }),
      h('div', { class: 'sns3-actions' }, [
        h('button', { class: 'sns3-btn sm', type: 'button', text: t('get_quote'), onclick: function () { userBubble(t('get_quote') + ': ' + s.name); showQuote(s.slug); } }),
        h('button', { class: 'sns3-btn sm ghost', type: 'button', text: t('ask_about'), onclick: function () { userSays(s.name); } })
      ])
    ]);
  }

  function browse(cat) {
    var list = state.catalogue.filter(function (s) { return cat === 'all' || s.category === cat; });
    var cats = []; state.catalogue.forEach(function (s) { if (cats.indexOf(s.category) < 0) cats.push(s.category); });
    var shown = 0, PAGE = 4;
    var wrap = h('div'); var holder = h('div'); wrap.appendChild(holder);
    var more = h('button', { class: 'sns3-btn sm ghost', type: 'button', text: t('more'), onclick: render });
    function render() {
      list.slice(shown, shown + PAGE).forEach(function (s) { holder.appendChild(serviceCard(s)); });
      shown += PAGE; more.hidden = shown >= list.length; scrollDown();
    }
    wrap.appendChild(more); log.appendChild(h('div', { class: 'sns3-row bot' }, [h('div', { class: 'sns3-b', style: 'max-width:100%;width:100%;background:transparent;padding:0' }, [wrap])]));
    render();
    var items = [{ label: t('cat_all'), run: function () { browse('all'); } }];
    cats.forEach(function (c) { items.push({ label: (CAT_ICON[c] || '') + ' ' + (t('cat_' + c) || c), run: function () { userBubble(t('cat_' + c) || c); browse(c); } }); });
    chips(items);
  }

  /* --------------------------------------------------------------- quote card */
  function guestsText() {
    var g = state.guests, s = g.adults + ' ' + t('adults_l');
    if (g.children) s += ' + ' + g.children + ' ' + t('children_l');
    return s;
  }

  function stepper(get, set, lo, hi) {
    var out = h('output', { text: String(get()) });
    return h('span', { class: 'sns3-step' }, [
      h('button', { type: 'button', 'aria-label': '−', text: '−', onclick: function () { set(clamp(get() - 1, lo, hi)); out.textContent = String(get()); } }),
      out,
      h('button', { type: 'button', 'aria-label': '+', text: '+', onclick: function () { set(clamp(get() + 1, lo, hi)); out.textContent = String(get()); } })
    ]);
  }

  function showQuote(slug, replaceRow) {
    var svc = state.bySlug[slug];
    if (state.selected.indexOf(slug) < 0) state.selected.push(slug);
    save(); typing(true); clearChips();
    post(CFG.quote, { serviceSlug: slug, adults: state.guests.adults, children: state.guests.children, date: state.dateISO || null, pickupZone: null }, 12000).then(function (r) {
      typing(false);
      if (!r.ok || !r.json) { botSays(t('err_net')); chips([{ label: 'WhatsApp', run: function () { handoff(); } }]); return; }
      var q = r.json, card = quoteCard(slug, svc, q);
      if (replaceRow && replaceRow.parentNode) replaceRow.parentNode.replaceChild(card, replaceRow); else log.appendChild(card);
      state.lastQuote = { slug: slug, display: q.status === 'quoted' ? q.totalDisplay : null }; save();
      track('quote', { service: slug, status: q.status });
      scrollDown();
      chips([
        { label: t('send_enquiry'), run: function () { leadForm(); } },
        { label: 'WhatsApp', run: function () { handoff(); } },
        { label: t('browse'), run: function () { userBubble(t('browse')); browse('all'); } }
      ]);
    });
  }

  function quoteCard(slug, svc, q) {
    var name = (svc && svc.name) || q.serviceName || slug;
    var quoted = q.status === 'quoted' && q.totalDisplay && q.totalDisplay !== 'price on request';
    var body = h('div', { class: 'sns3-card sns3-quote' });
    body.appendChild(h('span', { class: 'sns3-tag', text: t('quote_title') }));
    body.appendChild(h('h4', { text: name }));
    body.appendChild(h('div', { class: 'meta', text: t('for_who') + ' ' + guestsText() + (state.dateISO ? ' · ' + prettyDate(state.dateISO) : '') }));
    body.appendChild(h('div', { class: 'big', text: quoted ? q.totalDisplay + ' USD' : t('onreq') }));

    var details = [];
    (q.lines || []).forEach(function (l) { if (l && l.label && l.note && quoted) details.push(l.label + ' — ' + l.note); });
    (q.notes || []).forEach(function (n) { details.push(n); });
    (q.reasons || []).forEach(function (n) { details.push(n); });
    if (details.length) { var ul = h('ul'); details.slice(0, 5).forEach(function (d) { ul.appendChild(h('li', { text: d })); }); body.appendChild(ul); }
    if (q.includes && q.includes.length) body.appendChild(h('div', { class: 'meta', text: t('includes') + ': ' + q.includes.slice(0, 5).join(', ') }));

    // edit guests/date and re-quote
    var date = h('input', { type: 'date', min: todayISO(), value: state.dateISO || '', 'aria-label': t('date') });
    body.appendChild(h('div', { class: 'sns3-ctrl' }, [
      h('span', { text: t('adults') + ':' }), stepper(function () { return state.guests.adults; }, function (v) { state.guests.adults = v; }, 1, 50),
      h('span', { text: t('children') + ':' }), stepper(function () { return state.guests.children; }, function (v) { state.guests.children = v; }, 0, 20)
    ]));
    body.appendChild(h('div', { class: 'sns3-ctrl' }, [h('div', { style: 'flex:1;min-width:140px' }, [date]),
      h('button', { class: 'sns3-btn sm ghost', type: 'button', text: t('recalc'), onclick: function () { state.dateISO = date.value || null; showQuote(slug, row); } })]));
    body.appendChild(h('div', { class: 'sns3-note', text: t('team_confirms') }));
    var row = h('div', { class: 'sns3-row bot' }, [h('div', { class: 'sns3-b', style: 'max-width:100%;width:100%;background:transparent;padding:0' }, [body])]);
    return row;
  }

  /* ----------------------------------------------------------------- handoff */
  function serviceNames() {
    return state.selected.map(function (s) { return state.bySlug[s] ? state.bySlug[s].name : null; }).filter(Boolean);
  }
  function waUrl() {
    var parts = [], names = serviceNames();
    parts.push(t('wa_hi') + ' ' + (names.length ? names.join(', ') : t('wa_generic')) + '.');
    if (state.leadRef) parts.push(t('wa_ref') + ': ' + state.leadRef + '.');
    parts.push(t('wa_pax') + ': ' + guestsText() + '.');
    if (state.dateISO) parts.push(t('wa_date') + ': ' + prettyDate(state.dateISO) + '.');
    if (state.pickupLabel) parts.push(t('wa_pickup') + ': ' + state.pickupLabel + '.');
    if (state.name) parts.push(t('wa_name') + ': ' + state.name + '.');
    if (state.lastQuote && state.lastQuote.display) parts.push('Range: ' + state.lastQuote.display + ' USD.');
    return 'https://wa.me/' + state.whatsapp + '?text=' + encodeURIComponent(parts.join(' '));
  }
  function handoff() {
    track('whatsapp', { ref: state.leadRef || '' });
    window.open(waUrl(), '_blank', 'noopener,noreferrer');
  }
  function waButton() { return h('a', { class: 'sns3-btn wa', href: waUrl(), target: '_blank', rel: 'noopener noreferrer', text: '💬 ' + t('wa_btn'), onclick: function () { track('whatsapp', { ref: state.leadRef || '' }); } }); }

  /* ----------------------------------------------------------------- lead form */
  function normPhone(v) {
    var s = String(v || '').trim().replace(/[\s\-().]/g, '');
    if (/^00\d/.test(s)) s = '+' + s.slice(2);
    return s;
  }
  function leadForm() {
    clearChips(); state.formOpenedAt = Date.now();
    var name = h('input', { type: 'text', autocomplete: 'name', value: state.name || '', 'aria-label': t('name') });
    var phone = h('input', { type: 'tel', autocomplete: 'tel', placeholder: '+255 …', inputmode: 'tel', 'aria-label': t('wa') });
    var email = h('input', { type: 'email', autocomplete: 'email', 'aria-label': t('email') });
    var consent = h('input', { type: 'checkbox', id: 'sns3-consent' });
    var hp = h('input', { type: 'text', class: 'sns3-hp', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true', name: 'website' });
    var err = h('div', { class: 'sns3-err', role: 'alert', hidden: true });
    var submit = h('button', { class: 'sns3-btn', type: 'submit', text: t('submit') });
    var f = h('form', { novalidate: true, class: 'sns3-card' }, [
      h('h4', { text: t('lead_title') }),
      h('label', { text: t('name') }), name,
      h('label', { text: t('wa') }), phone,
      h('label', { text: t('email') }), email,
      h('label', { class: 'sns3-check', for: 'sns3-consent' }, [consent, h('span', {}, [t('consent') + '. ', h('small', { text: t('consent_hint') })])]),
      h('div', { class: 'sns3-note' }, [rich('[privacy](/privacy/)').firstChild]),
      hp, err, h('div', { class: 'sns3-actions' }, [submit])
    ]);
    f.addEventListener('submit', function (e) {
      e.preventDefault(); err.hidden = true;
      var n = name.value.trim(), p = normPhone(phone.value), em = email.value.trim();
      var msg = null;
      if (n.length < 2) msg = t('err_name');
      else if (!p && !em) msg = t('err_contact');
      else if (p && !/^\+[1-9]\d{6,14}$/.test(p)) msg = t('err_phone');
      else if (!consent.checked) msg = t('err_consent');
      if (msg) { err.textContent = msg; err.hidden = false; return; }
      submit.disabled = true; submit.textContent = t('sending');
      state.name = n; save();
      post(CFG.lead, buildLead(n, p, em, hp.value), 12000).then(function (r) {
        submit.disabled = false; submit.textContent = t('submit');
        if (r.ok && r.json && /^SP-\d{4}-\d+$/.test(r.json.reference || '')) {
          state.leadRef = r.json.reference; save(); track('lead', { ref: state.leadRef });
          row.remove();
          var done = h('div', {}, [rich('**' + t('saved') + ' ' + state.leadRef + '.** ' + t('saved2') + (state.replyWindow ? ' ' + state.replyWindow : '') + '.'), h('div', { class: 'sns3-actions' }, [waButton()])]);
          bubble('bot', done, t('saved') + ' ' + state.leadRef);
          chips([{ label: t('browse'), run: function () { userBubble(t('browse')); browse('all'); } }]);
        } else if (r.status === 429) { err.textContent = t('err_limit'); err.hidden = false; }
        else if (r.status === 400 && r.json && Array.isArray(r.json.details)) {
          var d = r.json.details.join(' ');
          err.textContent = /international format/i.test(d) ? t('err_phone') : /Consent/i.test(d) ? t('err_consent') : /Name/i.test(d) ? t('err_name') : t('err_generic');
          err.hidden = false;
        } else { err.textContent = r.status === 0 ? t('err_net') : t('err_generic'); err.hidden = false; }
      });
    });
    var row = h('div', { class: 'sns3-row bot' }, [h('div', { class: 'sns3-b', style: 'max-width:100%;width:100%;background:transparent;padding:0' }, [f])]);
    log.appendChild(row); scrollDown(); name.focus();
  }

  /* Field names match the server's allowlist exactly (snake_case, no extras). */
  function buildLead(name, phone, email, honeypot) {
    var bits = [];
    var q = new URLSearchParams(location.search), utm = [];
    ['utm_source', 'utm_medium', 'utm_campaign'].forEach(function (k) { if (q.get(k)) utm.push(k.slice(4) + '=' + q.get(k).slice(0, 40)); });
    bits.push('Source: chat widget on ' + location.pathname);
    if (utm.length) bits.push('UTM: ' + utm.join(', '));
    if (document.referrer) { try { bits.push('Referrer: ' + new URL(document.referrer).hostname); } catch (e) {} }
    bits.push('Group: ' + guestsText());
    if (state.pickupLabel) bits.push('Pickup/area: ' + state.pickupLabel);
    if (state.interests.length) bits.push('Interests: ' + state.interests.join(', '));
    if (state.lastQuote && state.lastQuote.display) bits.push('Quoted range: ' + state.lastQuote.display + ' USD');
    var names = serviceNames(); if (names.length) bits.push('Interested in: ' + names.join(', '));
    bits.push('Language: ' + LANG);
    var body = {
      name: name, consent_contact: true, consent_marketing: false,
      travellers: clamp(state.guests.adults + state.guests.children, 1, 50),
      notes: bits.join(' | ').slice(0, 1900),
      session_id: state.session, form_loaded_at: String(state.formOpenedAt), honeypot: honeypot || ''
    };
    if (phone) body.whatsapp = phone;
    if (email) body.email = email;
    if (state.dateISO) body.date = state.dateISO;
    if (state.selected.length) body.services = state.selected.join(', ').slice(0, 500);
    return body;
  }

  /* ---------------------------------------------------------- discovery flow */
  function ask(title, builder) {
    return new Promise(function (resolve) {
      clearChips();
      var done = function (summary, value) { row.remove(); userBubble(summary); resolve(value); };
      var body = h('div', {}, [h('p', { text: title })]);
      var row = bubble('bot', body, title);
      builder(body, done);
      scrollDown();
    });
  }

  function planTrip() {
    userBubble(t('plan')); track('plan_start');
    var interestMap = {
      i_beach: ['beach', 'snorkeling'], i_culture: ['culture', 'spice'], i_wild: ['safari'],
      i_adv: ['diving', 'kite'], i_rom: ['honeymoon'], i_fam: ['family']
    };
    var areaMap = { area_stone: 'Stone Town', area_north: 'Nungwi / Kendwa', area_east: 'Paje / Jambiani', area_ne: 'Kiwengwa / Matemwe' };

    ask(t('q_dates'), function (body, done) {
      var d = h('input', { type: 'date', min: todayISO(), 'aria-label': t('q_dates') });
      body.appendChild(h('div', { class: 'sns3-ctrl' }, [h('div', { style: 'flex:1;min-width:150px' }, [d]),
        h('button', { class: 'sns3-btn sm', type: 'button', text: t('next'), onclick: function () { if (d.value) done(prettyDate(d.value), d.value); } }),
        h('button', { class: 'sns3-btn sm ghost', type: 'button', text: t('q_dates_unsure'), onclick: function () { done(t('q_dates_unsure'), null); } })]));
    }).then(function (iso) {
      state.dateISO = iso;
      return ask(t('q_who'), function (body, done) {
        body.appendChild(h('div', { class: 'sns3-ctrl' }, [h('span', { text: t('adults') + ':' }), stepper(function () { return state.guests.adults; }, function (v) { state.guests.adults = v; }, 1, 50)]));
        body.appendChild(h('div', { class: 'sns3-ctrl' }, [h('span', { text: t('children') + ':' }), stepper(function () { return state.guests.children; }, function (v) { state.guests.children = v; }, 0, 20)]));
        body.appendChild(h('button', { class: 'sns3-btn sm', type: 'button', text: t('next'), onclick: function () { done(guestsText(), true); } }));
      });
    }).then(function () {
      return ask(t('q_interest'), function (body, done) {
        var picked = {}, wrap = h('div', { class: 'sns3-chips' });
        Object.keys(interestMap).forEach(function (k) {
          var c = h('button', { class: 'sns3-chip', type: 'button', 'aria-pressed': 'false', text: t(k), onclick: function () { picked[k] = !picked[k]; c.setAttribute('aria-pressed', String(!!picked[k])); } });
          wrap.appendChild(c);
        });
        body.appendChild(wrap);
        body.appendChild(h('div', { class: 'sns3-actions' }, [
          h('button', { class: 'sns3-btn sm', type: 'button', text: t('next'), onclick: function () {
            var keys = Object.keys(picked).filter(function (k) { return picked[k]; });
            done(keys.length ? keys.map(t).join(', ') : t('i_any'), keys);
          } })
        ]));
      });
    }).then(function (keys) {
      state.interests = [];
      keys.forEach(function (k) { interestMap[k].forEach(function (w) { if (state.interests.indexOf(w) < 0) state.interests.push(w); }); });
      return ask(t('q_area'), function (body, done) {
        var wrap = h('div', { class: 'sns3-chips' });
        Object.keys(areaMap).concat(['area_unsure']).forEach(function (k) {
          wrap.appendChild(h('button', { class: 'sns3-chip', type: 'button', text: t(k), onclick: function () { done(t(k), k); } }));
        });
        body.appendChild(wrap);
      });
    }).then(function (areaKey) {
      state.pickupLabel = areaMap[areaKey] || null; save();
      var msg = 'Recommend tours for ' + state.guests.adults + ' adults' + (state.guests.children ? ' and ' + state.guests.children + ' children' : '') +
        (state.interests.length ? ', interested in ' + state.interests.join(' and ') : '') +
        (state.pickupLabel ? ', staying near ' + state.pickupLabel : '') + '.';
      return sendToServer(msg);
    });
  }

  /* ----------------------------------------------------------- server dialogue */
  function userSays(text, silentLabel) {
    if (state.busy) return;
    var l = text.toLowerCase();
    userBubble(text); clearChips();
    if (/\b(human|real person|agent|operator|someone)\b/.test(l) || /talk to (a )?person|parla con|mensch/.test(l)) { handoff(); return; }
    sendToServer(text);
  }

  function sendToServer(text) {
    state.busy = true; sendBtn.disabled = true; typing(true);
    state.history.push({ role: 'user', content: text });
    var profile = Object.assign({}, state.serverProfile, {
      adults: state.guests.adults, children: state.guests.children || undefined,
      dates: state.dateISO || state.serverProfile.dates, interests: state.interests.length ? state.interests : state.serverProfile.interests,
      name: state.name || state.serverProfile.name
    });
    return post(CFG.chat, { message: text, profile: profile, history: state.history.slice(-CFG.maxHistory), session_id: state.session }, 20000).then(function (r) {
      typing(false); state.busy = false; sendBtn.disabled = false;
      if (!r.ok || !r.json || typeof r.json.message !== 'string') {
        var m = r.status === 429 ? t('err_limit') : r.status === 0 ? t('err_net') : t('err_generic');
        botSays(m); chips([{ label: 'WhatsApp', run: function () { handoff(); } }]); return;
      }
      var j = r.json;
      if (j.profile && typeof j.profile === 'object') {
        state.serverProfile = j.profile;
        if (j.profile.name && !state.name) state.name = j.profile.name;
        (j.profile.serviceSlugs || []).forEach(function (s) { if (state.bySlug[s] && state.selected.indexOf(s) < 0) state.selected.push(s); });
      }
      state.history.push({ role: 'assistant', content: j.message.slice(0, 600) });
      botSays(j.message);
      track('reply', {});

      // Service cards: only for services the reply names in bold, exactly as in the catalogue.
      var names = {}; (j.message.match(/\*\*([^*]+)\*\*/g) || []).forEach(function (b) { names[b.slice(2, -2).trim().toLowerCase()] = true; });
      var found = state.catalogue.filter(function (s) { return names[s.name.toLowerCase()]; }).slice(0, 4);
      found.forEach(function (s) { log.appendChild(h('div', { class: 'sns3-row bot' }, [h('div', { class: 'sns3-b', style: 'max-width:100%;width:100%;background:transparent;padding:0' }, [serviceCard(s)])])); });
      if (found.length) scrollDown();

      var items = [];
      (j.quickReplies || []).slice(0, 5).forEach(function (label) { items.push({ label: String(label), run: function () { quickReply(String(label)); } }); });
      if (!items.some(function (i) { return /whatsapp/i.test(i.label); })) items.push({ label: '💬 WhatsApp', run: function () { handoff(); } });
      chips(items);
    });
  }

  function quickReply(label) {
    if (/whatsapp/i.test(label)) { userBubble(label); handoff(); return; }
    if (/^(plan (my )?(zanzibar )?trip|plan a (honeymoon|family) trip)$/i.test(label.trim())) { planTrip(); return; }
    if (/^(show all tours|view all tours|check another tour)$/i.test(label.trim())) { userBubble(label); browse('all'); return; }
    // Exact catalogue service names go straight to a quote
    var hit = state.catalogue.filter(function (s) { return s.name.toLowerCase() === label.trim().toLowerCase(); })[0];
    if (hit) { userBubble(label); showQuote(hit.slug); return; }
    userSays(label);
  }

  /* --------------------------------------------------------------- open/close */
  var started = false;
  function openChat() {
    if (state.open) return;
    state.open = true; panel.hidden = false; launcher.hidden = true; callout.hidden = true;
    launcher.setAttribute('aria-expanded', 'true');
    if (window.innerWidth <= CFG.mobileBreakpoint) document.documentElement.style.overflow = 'hidden';
    track('open');
    if (!started) { started = true; start(); }
    setTimeout(function () { input.focus(); }, 50);
  }
  function closeChat() {
    state.open = false; panel.hidden = true; launcher.hidden = false;
    launcher.setAttribute('aria-expanded', 'false'); document.documentElement.style.overflow = '';
    launcher.focus();
  }

  function start() {
    var prior = load();
    if (prior && prior.transcript && prior.transcript.length) {
      state.session = prior.session || state.session; state.serverProfile = prior.serverProfile || {};
      state.guests = prior.guests || state.guests; state.dateISO = prior.dateISO || null;
      state.interests = prior.interests || []; state.pickupLabel = prior.pickupLabel || null; state.name = prior.name || '';
      state.selected = prior.selected || []; state.leadRef = prior.leadRef || null;
      state.history = prior.history || []; state.transcript = prior.transcript;
      state.transcript.forEach(function (m) { bubble(m.who, m.text, null); });
    } else {
      botSays(t('welcome')); botSays(t('welcome2'));
      if (LANG !== 'en') botSays(t('lang_note'));
    }
    homeChips();
    // catalogue + business config (names, prices, durations, WhatsApp number all come from the server)
    api(CFG.quote, { method: 'GET' }, 10000).then(function (r) {
      if (r.ok && r.json && Array.isArray(r.json.services)) {
        state.catalogue = r.json.services.filter(function (s) { return ['tour', 'experience', 'package', 'transfer'].indexOf(s.type) >= 0; });
        state.catalogue.forEach(function (s) { state.bySlug[s.slug] = s; });
        if (r.json.whatsappNumber && /^\d{8,15}$/.test(String(r.json.whatsappNumber))) state.whatsapp = String(r.json.whatsappNumber);
        state.replyWindow = r.json.replyWindow || '';
        state.ready = true;
      }
    });
  }

  /* --------------------------------------------------------------- public API */
  function init() {
    build();
    // Optional triggers: any element with data-sns-chat-open (+ data-sns-service="slug")
    document.addEventListener('click', function (e) {
      var el = e.target.closest && e.target.closest('[data-sns-chat-open]');
      if (!el) return;
      e.preventDefault();
      openChat();
      var slug = el.getAttribute('data-sns-service');
      if (slug) whenReady(function () { quickService(slug); });
    });
    if (/[?&]chat=open\b/.test(location.search) || location.hash === '#concierge') openChat();
    else if (!sessionStorage.getItem('sns3_callout')) {
      setTimeout(function () { if (!state.open) { callout.hidden = false; try { sessionStorage.setItem('sns3_callout', '1'); } catch (e) {} } }, 12000);
    }
  }
  function whenReady(fn, n) { n = n || 0; if (state.ready || n > 40) fn(); else setTimeout(function () { whenReady(fn, n + 1); }, 150); }
  function quickService(slug, opts) {
    var s = state.bySlug[slug]; if (!s) return;
    if (opts) {
      if (opts.date) state.dateISO = opts.date;
      if (opts.adults) state.guests.adults = clamp(+opts.adults || 2, 1, 50);
      if (opts.children != null) state.guests.children = clamp(+opts.children || 0, 0, 20);
    }
    userBubble(t('get_quote') + ': ' + s.name); showQuote(slug);
  }

  // Compatibility shim: pages written for the v2 widget keep working.
  window.snsConciergeV2 = window.snsConcierge = {
    open: openChat, close: closeChat, goToStep: openChat, dismissCallout: function () { callout.hidden = true; },
    selectService: function (slug, opts) { openChat(); whenReady(function () { quickService(slug, opts); }); },
    openDirectWhatsApp: handoff, getQuote: function () { openChat(); },
    openPaymentOptions: function () { openChat(); whenReady(function () { botSays(t('team_confirms')); leadForm(); }); },
    _state: state
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
