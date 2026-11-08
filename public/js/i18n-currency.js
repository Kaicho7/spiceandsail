/**
 * Spice & Sail Zanzibar — Multilingual & Multi-Currency Engine
 * Primary Language: English (en) | Secondary: Italian (it), German (de), French (fr), Polish (pl)
 * Supported Currencies: USD ($), EUR (€), GBP (£), PLN (zł), TZS (TSh)
 */
(function() {
  'use strict';

  var RATES = {
    USD: { code: 'USD', symbol: '$', pos: 'before', rate: 1.0, name: 'USD ($)', flag: '🇺🇸' },
    EUR: { code: 'EUR', symbol: '€', pos: 'before', rate: 0.92, name: 'EUR (€)', flag: '🇪🇺' },
    GBP: { code: 'GBP', symbol: '£', pos: 'before', rate: 0.79, name: 'GBP (£)', flag: '🇬🇧' },
    PLN: { code: 'PLN', symbol: 'zł', pos: 'after', rate: 4.02, name: 'PLN (zł)', flag: '🇵🇱' },
    TZS: { code: 'TZS', symbol: 'TSh', pos: 'after', rate: 2650.0, name: 'TZS (TSh)', flag: '🇹🇿' }
  };

  var LANGS = {
    en: { code: 'en', name: 'English', flag: '🇬🇧' },
    it: { code: 'it', name: 'Italiano', flag: '🇮🇹' },
    de: { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    fr: { code: 'fr', name: 'Français', flag: '🇫🇷' },
    pl: { code: 'pl', name: 'Polski', flag: '🇵🇱' }
  };

  var DICT = {
    nav_home: { en: 'Home', it: 'Home', de: 'Startseite', fr: 'Accueil', pl: 'Strona główna' },
    nav_tours: { en: 'Tours & Experiences', it: 'Tour & Escursioni', de: 'Touren & Ausflüge', fr: 'Excursions & Visites', pl: 'Wycieczki i Atrakcje' },
    nav_all_tours: { en: 'All Tours & Day Trips', it: 'Tutti i Tour Giornalieri', de: 'Alle Tagestouren', fr: 'Toutes les Excursions', pl: 'Wszystkie Wycieczki' },
    nav_rare_experiences: { en: 'Rare Hidden Gems', it: 'Esperienze Esclusive', de: 'Exklusive Erlebnisse', fr: 'Expériences Uniques', pl: 'Wyjątkowe Doświadczenia' },
    nav_spice_farm: { en: 'Spice Farm Tour', it: 'Tour delle Spezie', de: 'Gewürzfarm-Tour', fr: 'Visite Ferme aux Épices', pl: 'Farma Przypraw' },
    nav_attractions: { en: 'Island Attractions', it: 'Attrazioni dell’Isola', de: 'Insel-Attraktionen', fr: 'Attractions de l’Île', pl: 'Atrakcje Wyspy' },
    nav_transfers: { en: 'Transfers', it: 'Transfer', de: 'Transfers', fr: 'Transferts', pl: 'Transfery' },
    nav_airport_transfers: { en: 'Airport & Hotel Transfers', it: 'Transfer Aeroporto & Hotel', de: 'Flughafen & Hotel Transfers', fr: 'Transferts Aéroport & Hôtel', pl: 'Transfery Lotniskowe i Hotelowe' },
    nav_nungwi_transfer: { en: 'Airport to Nungwi & Kendwa', it: 'Aeroporto a Nungwi & Kendwa', de: 'Flughafen nach Nungwi & Kendwa', fr: 'Aéroport vers Nungwi & Kendwa', pl: 'Lotnisko do Nungwi i Kendwa' },
    nav_self_drive: { en: 'Self-Drive & 4x4 Rental', it: 'Noleggio Auto & Fuoristrada', de: 'Mietwagen & 4x4', fr: 'Location de Voiture & 4x4', pl: 'Wynajem Samochodów 4x4' },
    nav_safaris_packages: { en: 'Safaris & Packages', it: 'Safari & Pacchetti', de: 'Safaris & Pauschalen', fr: 'Safaris & Forfaits', pl: 'Safari i Pakiety' },
    nav_safaris: { en: 'Mainland Safaris', it: 'Safari Tanzania', de: 'Tansania Safaris', fr: 'Safaris Tanzanie', pl: 'Safari w Tanzanii' },
    nav_mikumi: { en: 'Mikumi 1-Day Fly-in Safari', it: 'Mikumi Safari in Volo (1 Giorno)', de: 'Mikumi Flugsafari (1 Tag)', fr: 'Safari Mikumi en Avion (1 Jour)', pl: '1-Dniowe Safari Lotnicze Mikumi' },
    nav_packages: { en: 'Multi-Day Packages', it: 'Pacchetti Multi-Giorno', de: 'Mehrtages-Pauschalen', fr: 'Forfaits Multi-Jours', pl: 'Pakiety Wielodniowe' },
    nav_honeymoon: { en: 'Honeymoon Packages', it: 'Viaggi di Nozze', de: 'Flitterwochen-Pakete', fr: 'Lune de Miel', pl: 'Pakiety dla Nowożeńców' },
    nav_family: { en: 'Family Travel', it: 'Viaggi per Famiglie', de: 'Familienreisen', fr: 'Voyages en Famille', pl: 'Podróże Rodzinne' },
    nav_hotels_areas: { en: 'Hotels & Areas', it: 'Hotel & Zone', de: 'Hotels & Regionen', fr: 'Hôtels & Régions', pl: 'Hotele i Regiony' },
    nav_hotels: { en: 'Zanzibar Hotels & Resorts', it: 'Hotel & Resort', de: 'Hotels & Strandresorts', fr: 'Hôtels & Complexes Hôteliers', pl: 'Hotele i Ośrodki' },
    nav_areas: { en: 'Coastlines & Areas', it: 'Zone & Spiagge', de: 'Küstengebiete & Strände', fr: 'Côtes & Régions', pl: 'Regiony i Plaże' },
    nav_travel_guide: { en: 'Travel Guide', it: 'Guida di Viaggio', de: 'Reiseführer', fr: 'Guide de Voyage', pl: 'Przewodnik' },
    nav_visas_levies: { en: 'Visas & Travel Info', it: 'Visti & Info Viaggio', de: 'Visa & Reiseinfos', fr: 'Visas & Infos Voyage', pl: 'Wizy i Informacje' },
    nav_health_safety: { en: 'Health & Safety Guide', it: 'Salute & Sicurezza', de: 'Gesundheit & Sicherheit', fr: 'Santé & Sécurité', pl: 'Zdrowie i Bezpieczeństwo' },
    nav_migration: { en: 'Migration Calendar', it: 'Calendario Migrazione', de: 'Migrationskalender', fr: 'Calendrier de la Migration', pl: 'Kalendarz Migracji' },
    nav_about: { en: 'About', it: 'Chi Siamo', de: 'Über Uns', fr: 'À Propos', pl: 'O Nas' },
    nav_contact: { en: 'Contact', it: 'Contatti', de: 'Kontakt', fr: 'Contact', pl: 'Kontakt' },
    btn_whatsapp_book: { en: 'Book on WhatsApp', it: 'Prenota su WhatsApp', de: 'Auf WhatsApp buchen', fr: 'Réserver sur WhatsApp', pl: 'Rezerwuj przez WhatsApp' },
    btn_check_rates: { en: 'Check Rates', it: 'Verifica Tariffe', de: 'Preise prüfen', fr: 'Voir les tarifs', pl: 'Sprawdź ceny' },
    btn_book_transfer: { en: 'Book Transfer', it: 'Prenota Transfer', de: 'Transfer buchen', fr: 'Réserver transfert', pl: 'Zarezerwuj transfer' }
  };

  var WA_GREETINGS = {
    en: "Hi Spice and Sail, I am inquiring about",
    it: "Ciao Spice and Sail, vorrei richiedere informazioni e preventivo per",
    de: "Hallo Spice and Sail, ich interessiere mich für ein Angebot für",
    fr: "Bonjour Spice and Sail, je souhaite demander des informations et un devis pour",
    pl: "Dzień dobry Spice and Sail, chciałbym zapytać o wycenę i rezerwację dla"
  };

  // State
  var currentCurrency = localStorage.getItem('sns_currency') || 'USD';
  if (!RATES[currentCurrency]) currentCurrency = 'USD';

  var currentLang = localStorage.getItem('sns_lang') || 'en';
  if (!LANGS[currentLang]) currentLang = 'en';

  function formatConverted(usdVal, currCode) {
    var c = RATES[currCode] || RATES.USD;
    var val = usdVal * c.rate;
    // Rounding rules: TZS to nearest 500/1000, others to nearest integer
    var formattedVal;
    if (c.code === 'TZS') {
      formattedVal = (Math.round(val / 500) * 500).toLocaleString();
    } else {
      formattedVal = Math.round(val).toLocaleString();
    }

    if (c.pos === 'before') {
      return c.symbol + formattedVal;
    } else {
      return formattedVal + ' ' + c.symbol;
    }
  }

  function formatRangeConverted(usdMin, usdMax, currCode) {
    var c = RATES[currCode] || RATES.USD;
    var minVal = usdMin * c.rate;
    var maxVal = usdMax * c.rate;

    var fMin, fMax;
    if (c.code === 'TZS') {
      fMin = (Math.round(minVal / 500) * 500).toLocaleString();
      fMax = (Math.round(maxVal / 500) * 500).toLocaleString();
    } else {
      fMin = Math.round(minVal).toLocaleString();
      fMax = Math.round(maxVal).toLocaleString();
    }

    if (c.pos === 'before') {
      return c.symbol + fMin + '–' + c.symbol + fMax;
    } else {
      return fMin + '–' + fMax + ' ' + c.symbol;
    }
  }

  function scanAndTagUsdPrices() {
    // Scan common price container elements to attach base USD values for all prices
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    var node;
    // Matches: $50–$60, $50-$60, $50–60, $44, $5.00, $50–$60 USD, etc.
    var priceTokenRe = /\$([0-9]{1,4}(?:\.[0-9]{2})?)(?:\s*[–-]\s*\$?([0-9]{1,4}(?:\.[0-9]{2})?))?(?:\s*USD)?/g;
    var nodesToProcess = [];

    while ((node = walker.nextNode())) {
      var txt = node.nodeValue;
      if (!txt || txt.indexOf('$') === -1) continue;
      // Skip script/style/option and elements marked to ignore
      var parent = node.parentElement;
      if (!parent || parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE' || parent.tagName === 'OPTION') continue;
      if (parent.classList.contains('sns-price-tag') || (parent.closest && parent.closest('.sns-price-tag'))) continue;
      if (parent.classList.contains('sns-no-convert') || (parent.closest && parent.closest('.sns-no-convert'))) continue;

      nodesToProcess.push(node);
    }

    nodesToProcess.forEach(function(n) {
      var text = n.nodeValue;
      if (!text || text.indexOf('$') === -1) return;
      priceTokenRe.lastIndex = 0;
      var match;
      var lastIndex = 0;
      var frag = document.createDocumentFragment();
      var found = false;

      while ((match = priceTokenRe.exec(text)) !== null) {
        found = true;
        var matchIndex = match.index;
        if (matchIndex > lastIndex) {
          frag.appendChild(document.createTextNode(text.substring(lastIndex, matchIndex)));
        }
        var min = parseFloat(match[1]);
        var isRange = match[2] !== undefined && match[2] !== '';
        var max = isRange ? parseFloat(match[2]) : null;

        var span = document.createElement('span');
        span.className = 'sns-price-tag';
        if (isRange) {
          span.setAttribute('data-usd-min', min);
          span.setAttribute('data-usd-max', max);
          span.textContent = formatRangeConverted(min, max, currentCurrency);
        } else {
          span.setAttribute('data-usd-val', min);
          span.textContent = formatConverted(min, currentCurrency);
        }
        frag.appendChild(span);
        lastIndex = priceTokenRe.lastIndex;
      }

      if (found) {
        if (lastIndex < text.length) {
          frag.appendChild(document.createTextNode(text.substring(lastIndex)));
        }
        if (n.parentNode) {
          n.parentNode.replaceChild(frag, n);
        }
      }
    });
  }

  function updatePricesOnPage() {
    var currency = currentCurrency;

    // Convert tagged price elements
    var priceEls = document.querySelectorAll('[data-usd-val]');
    priceEls.forEach(function(el) {
      var usd = parseFloat(el.getAttribute('data-usd-val'));
      if (!isNaN(usd)) {
        el.textContent = formatConverted(usd, currency);
      }
    });

    var rangeEls = document.querySelectorAll('[data-usd-min][data-usd-max]');
    rangeEls.forEach(function(el) {
      var min = parseFloat(el.getAttribute('data-usd-min'));
      var max = parseFloat(el.getAttribute('data-usd-max'));
      if (!isNaN(min) && !isNaN(max)) {
        el.textContent = formatRangeConverted(min, max, currency);
      }
    });

    // Update destination dropdown options on /transfers/
    var calcDest = document.getElementById('calc-dest');
    if (calcDest) {
      for (var i = 0; i < calcDest.options.length; i++) {
        var opt = calcDest.options[i];
        if (opt.value === 'stone-town') {
          opt.textContent = 'Stone Town Hotels — ' + formatRangeConverted(35, 40, currency) + '/vehicle';
        } else if (opt.value === 'paje-jambiani' || opt.value === 'matemwe' || opt.value === 'kiwengwa-pongwe') {
          var zName = opt.getAttribute('data-zone') || 'Beach';
          opt.textContent = zName + ' Resorts — ' + formatRangeConverted(45, 55, currency) + '/vehicle';
        } else if (opt.value === 'nungwi-kendwa') {
          opt.textContent = 'Nungwi & Kendwa Resorts — ' + formatRangeConverted(50, 60, currency) + '/vehicle';
        }
      }
    }

    // Update currency code displays if any
    var currCodeEls = document.querySelectorAll('.sns-curr-code, #calc-curr-code');
    currCodeEls.forEach(function(el) {
      el.textContent = currency;
    });

    // Dispatch event for any interactive widget
    window.dispatchEvent(new CustomEvent('spice:currency-changed', {
      detail: { currency: currency, info: RATES[currency] }
    }));
  }

  function updateTranslations() {
    var lang = currentLang;

    // Update document language
    document.documentElement.lang = lang;

    // Update dictionary-bound elements
    var transEls = document.querySelectorAll('[data-i18n]');
    transEls.forEach(function(el) {
      var key = el.getAttribute('data-i18n');
      if (DICT[key] && DICT[key][lang]) {
        el.textContent = DICT[key][lang];
      }
    });

    // Update WhatsApp links to use the visitor's preferred language and currency
    var waLinks = document.querySelectorAll('a[href*="wa.me/255672450934"]');
    waLinks.forEach(function(a) {
      var href = a.getAttribute('href');
      var greeting = WA_GREETINGS[lang] || WA_GREETINGS.en;
      // If href contains text parameter
      if (href.indexOf('text=') !== -1) {
        var baseHref = href.split('text=')[0];
        var textParam = decodeURIComponent(href.split('text=')[1] || '');
        // Replace English greetings with target language greeting
        var cleaned = textParam
          .replace(/^(Hi|Hello|Jambo) Spice and Sail,?\s*/i, '')
          .replace(/^(Hi|Hello|Jambo) Spice & Sail,?\s*/i, '');
        
        var newText = greeting + ' ' + cleaned;
        if (currentCurrency !== 'USD') {
          newText += ' (Please quote in ' + currentCurrency + ')';
        }
        a.setAttribute('href', baseHref + 'text=' + encodeURIComponent(newText));
      }
    });

    // Trigger full-page Google Translate adapter if not English
    if (window.googleTranslateElementInit && lang !== 'en') {
      applyGoogleTranslate(lang);
    } else if (lang === 'en') {
      resetGoogleTranslate();
    }
  }

  function applyGoogleTranslate(targetLang) {
    var combo = document.querySelector('.goog-te-combo');
    if (combo) {
      combo.value = targetLang;
      combo.dispatchEvent(new Event('change'));
    } else {
      // If Google translate script isn't loaded yet, initialize it
      loadGoogleTranslateScript(targetLang);
    }
  }

  function resetGoogleTranslate() {
    var combo = document.querySelector('.goog-te-combo');
    if (combo) {
      combo.value = 'en';
      combo.dispatchEvent(new Event('change'));
    }
  }

  function loadGoogleTranslateScript(initialLang) {
    if (document.getElementById('google-translate-script')) return;
    
    window.googleTranslateElementInit = function() {
      new window.google.translate.TranslateElement({
        pageLanguage: 'en',
        includedLanguages: 'en,it,de,fr,pl',
        autoDisplay: false
      }, 'google_translate_element');

      if (initialLang && initialLang !== 'en') {
        setTimeout(function() {
          var combo = document.querySelector('.goog-te-combo');
          if (combo) {
            combo.value = initialLang;
            combo.dispatchEvent(new Event('change'));
          }
        }, 500);
      }
    };

    var s = document.createElement('script');
    s.id = 'google-translate-script';
    s.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    s.async = true;
    document.head.appendChild(s);
  }

  // Set Currency API
  function setCurrency(code) {
    if (!RATES[code]) return;
    currentCurrency = code;
    localStorage.setItem('sns_currency', code);
    var sel = document.getElementById('currencySelect');
    if (sel) sel.value = code;
    updatePricesOnPage();
  }

  // Set Language API
  function setLanguage(lang) {
    if (!LANGS[lang]) return;
    currentLang = lang;
    localStorage.setItem('sns_lang', lang);
    var sel = document.getElementById('langSelect');
    if (sel) sel.value = lang;
    updateTranslations();
    window.dispatchEvent(new CustomEvent('spice:language-changed', {
      detail: { lang: lang, info: LANGS[lang] }
    }));
  }

  // Expose global controller
  window.SpiceInternational = {
    setCurrency: setCurrency,
    setLanguage: setLanguage,
    getCurrency: function() { return currentCurrency; },
    getLanguage: function() { return currentLang; },
    formatConverted: formatConverted,
    formatRangeConverted: formatRangeConverted,
    rates: RATES,
    languages: LANGS
  };

  // Initialize on DOM load
  document.addEventListener('DOMContentLoaded', function() {
    scanAndTagUsdPrices();

    var cSel = document.getElementById('currencySelect');
    if (cSel) {
      cSel.value = currentCurrency;
      cSel.addEventListener('change', function(e) {
        setCurrency(e.target.value);
      });
    }

    var lSel = document.getElementById('langSelect');
    if (lSel) {
      lSel.value = currentLang;
      lSel.addEventListener('change', function(e) {
        setLanguage(e.target.value);
      });
    }

    // Auto-load translation engine if user previously chose non-English
    if (currentLang !== 'en') {
      loadGoogleTranslateScript(currentLang);
    }

    updatePricesOnPage();
    updateTranslations();
  });
})();
