/**
 * Spice & Sail Zanzibar — Multilingual & Multi-Currency Engine
 * Primary languages: English (en), Italian (it), German (de), French (fr), Polish (pl)
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
    pl: { code: 'pl', name: 'Polski', flag: '🇵🇱' },
    ar: { code: 'ar', name: 'العربية', flag: '🇦🇪', dir: 'rtl' },
    ru: { code: 'ru', name: 'Русский', flag: '🇷🇺' }
  };

  var DICT = {
    nav_home: { en: 'Home', it: 'Home', de: 'Startseite', fr: 'Accueil', pl: 'Strona główna', ar: 'الرئيسية', ru: 'Главная' },
    nav_tours: { en: 'Tours & Experiences', it: 'Tour & Esperienze', de: 'Touren & Erlebnisse', fr: 'Excursions & Expériences', pl: 'Wycieczki i Atrakcje', ar: 'الجولات والأنشطة', ru: 'Экскурсии и впечатления' },
    nav_all_tours: { en: 'All Tours & Day Trips', it: 'Tutti i Tour & Escursioni', de: 'Alle Touren & Tagesausflüge', fr: 'Toutes les Excursions', pl: 'Wszystkie Wycieczki', ar: 'جميع الجولات والرحلات اليومية', ru: 'Все экскурсии и дневные туры' },
    nav_rare_experiences: { en: 'Rare Experiences', it: 'Esperienze Esclusive', de: 'Exklusive Erlebnisse', fr: 'Expériences Uniques', pl: 'Wyjątkowe Doświadczenia', ar: 'تجارب نادرة وحصرية', ru: 'Уникальные впечатления' },
    nav_spice_farm: { en: 'Organic Spice Farm Tour', it: 'Tour Fattoria delle Spezie', de: 'Gewürzfarm-Tour', fr: 'Visite de Ferme aux Épices', pl: 'Farma Przypraw', ar: 'جولة مزرعة التوابل العضوية', ru: 'Тур на ферму специй' },
    nav_transfers: { en: 'Transfers', it: 'Transfer Aeroporto', de: 'Flughafentransfers', fr: 'Transferts Aéroport', pl: 'Transfery Lotniskowe', ar: 'خدمات التوصيل', ru: 'Трансферы' },
    nav_airport_transfers: { en: 'Airport & Inter-Hotel Transfers', it: 'Transfer Aeroporto & Hotel', de: 'Flughafen & Hotel Transfers', fr: 'Transferts Aéroport & Hôtels', pl: 'Transfery Lotniskowe i Hotelowe', ar: 'توصيل المطار والفنادق', ru: 'Трансферы из аэропорта и между отелями' },
    nav_nungwi_transfer: { en: 'Airport to Nungwi & Kendwa', it: 'Aeroporto a Nungwi & Kendwa', de: 'Flughafen nach Nungwi & Kendwa', fr: 'Aéroport vers Nungwi & Kendwa', pl: 'Lotnisko do Nungwi i Kendwa', ar: 'من المطار إلى نونغوي وكيندوا', ru: 'Аэропорт — Нунгви и Кендва' },
    nav_self_drive: { en: 'Self-Drive & 4x4 Rental', it: 'Noleggio Auto & 4x4', de: 'Mietwagen & 4x4', fr: 'Location Voiture & 4x4', pl: 'Wynajem Samochodów i 4x4', ar: 'تأجير سيارات والدفع الرباعي', ru: 'Аренда авто и 4x4' },
    nav_safaris_packages: { en: 'Safaris & Packages', it: 'Safari & Pacchetti', de: 'Safaris & Reisepakete', fr: 'Safaris & Forfaits', pl: 'Safari i Pakiety', ar: 'رحلات السفاري والباقات', ru: 'Сафари и турпакеты' },
    nav_packages: { en: 'Packages', it: 'Pacchetti Vacanza', de: 'Reisepakete', fr: 'Forfaits Séjour', pl: 'Pakiety Pobytowe', ar: 'باقات الإقامة المتعددة', ru: 'Многодневные пакеты' },
    nav_zanzibar_essentials: { en: 'Zanzibar Essentials 3-Day', it: 'Zanzibar Essentials 3 Giorni', de: 'Zanzibar Essentials 3 Tage', fr: 'Zanzibar Essentials 3 Jours', pl: 'Zanzibar Essentials 3 Dni', ar: 'أساسيات زنجبار (3 أيام)', ru: 'Занзибар: классика (3 дня)' },
    nav_safaris: { en: 'Mainland Safaris', it: 'Safari in Tanzania', de: 'Festland-Safaris', fr: 'Safaris en Tanzanie', pl: 'Safari w Tanzanii', ar: 'سفاري تنزانيا القارية', ru: 'Сафари на материке' },
    nav_mikumi: { en: 'Mikumi 1-Day Fly-in Safari', it: 'Safari 1 Giorno Mikumi (Volo)', de: 'Mikumi 1-Tag Flugsafari', fr: 'Safari Mikumi 1 Jour en Vol', pl: '1-Dniowe Safari Mikumi (Lot)', ar: 'سفاري ميكومي ليوم واحد بالطيران', ru: 'Сафари в Микуми на 1 день (перелет)' },
    nav_honeymoon: { en: 'Honeymoon Packages', it: 'Pacchetti Luna di Miele', de: 'Flitterwochen-Pakete', fr: 'Voyages de Noces', pl: 'Pakiety dla Nowożeńców', ar: 'باقات شهر العسل', ru: 'Медовый месяц' },
    nav_family: { en: 'Family Travel', it: 'Viaggi in Famiglia', de: 'Familienreisen', fr: 'Voyages en Famille', pl: 'Podróże Rodzinne', ar: 'رحلات العائلات', ru: 'Семейный отдых' },
    nav_hotels_areas: { en: 'Hotels & Areas', it: 'Hotel & Località', de: 'Hotels & Regionen', fr: 'Hôtels & Régions', pl: 'Hotele i Regiony', ar: 'الفنادق والمناطق', ru: 'Отели и регионы' },
    nav_hotels: { en: 'Hotels', it: 'Hotel & Resort', de: 'Hotels & Resorts', fr: 'Hôtels & Resorts', pl: 'Hotele i Resorty', ar: 'فنادق ومنتجعات زنجبار', ru: 'Отели и курорты Занзибара' },
    nav_attractions: { en: 'Attractions', it: 'Attrazioni', de: 'Sehenswürdigkeiten', fr: 'Attractions', pl: 'Atrakcje', ar: 'معالم الجزيرة', ru: 'Достопримечательности' },
    nav_safari_blue: { en: 'Safari Blue Dhow Day', it: 'Safari Blue - Giornata in Dhow', de: 'Safari Blue Dhow-Tag', fr: 'Safari Blue - Journée en Dhow', pl: 'Safari Blue - Dzień na Dhow', ar: 'رحلة سفاري بلو بالمركب التقليدي', ru: 'Сафари Блю — день на традиционном доу' },
    nav_mnemba_snorkeling: { en: 'Mnemba Atoll Snorkeling', it: 'Schnorcheln am Mnemba-Atoll', de: 'Schnorcheln am Mnemba-Atoll', fr: 'Snorkeling à l\'Atoll Mnemba', pl: 'Nurkowanie na Atolu Mnemba', ar: 'سنوركلينج في جزيرة منيمبا', ru: 'Снорклинг у атолла Мнемба' },
    nav_stone_town_walking_tour: { en: 'Stone Town Walking Tour', it: 'Tour a Piedi di Stone Town', de: 'Stone Town zu Fuß', fr: 'Visite à Pied de Stone Town', pl: 'Spacer po Stone Town', ar: 'جولة مدينة ستون تاون التاريخية', ru: 'Пешеходный тур по Стоун-Тауну' },
    nav_areas: { en: 'Areas', it: 'Località', de: 'Regionen', fr: 'Régions', pl: 'Regiony', ar: 'المناطق والشواطئ', ru: 'Побережья и курорты' },
    nav_stone_town: { en: 'Stone Town', it: 'Stone Town', de: 'Stone Town', fr: 'Stone Town', pl: 'Stone Town', ar: 'مدينة ستون تاون', ru: 'Стоун-Таун' },
    nav_nungwi_kendwa: { en: 'Nungwi & Kendwa', it: 'Nungwi e Kendwa', de: 'Nungwi & Kendwa', fr: 'Nungwi & Kendwa', pl: 'Nungwi i Kendwa', ar: 'نونغوي وكيندوا', ru: 'Нунгви и Кендва' },
    nav_paje_jambiani: { en: 'Paje & Jambiani', it: 'Paje e Jambiani', de: 'Paje & Jambiani', fr: 'Paje & Jambiani', pl: 'Paje i Jambiani', ar: 'باجي وجامبياني', ru: 'Падже и Джамбиани' },
    nav_travel_guide: { en: 'Travel Guide', it: 'Guida di Viaggio', de: 'Reiseführer', fr: 'Guide de Voyage', pl: 'Przewodnik', ar: 'دليل السفر إلى زنجبار', ru: 'Гид по Занзибару' },
    nav_blog: { en: 'Travel Blog', it: 'Blog di Viaggio', de: 'Reiseblog', fr: 'Blog de Voyage', pl: 'Blog Podróży', ar: 'المدونة', ru: 'Блог' },
    nav_visas_levies: { en: 'Cancellation & Weather Policy', it: 'Cancellazione & Meteo', de: 'Stornierungs- & Wetterrichtlinie', fr: 'Politique d\'Annulation & Météo', pl: 'Polityka Odwołań i Pogody', ar: 'التأشيرات والرسوم السياحية', ru: 'Визы и туристические сборы' },
    nav_health_safety: { en: 'Health & Safety Guide', it: 'Guida Salute & Sicurezza', de: 'Gesundheits- & Sicherheitsleitfaden', fr: 'Guide Santé & Sécurité', pl: 'Zdrowie i Bezpieczeństwo', ar: 'الصحة والسلامة', ru: 'Здоровье и безопасность' },
    nav_migration: { en: 'Migration Calendar', it: 'Calendario Migrazione', de: 'Migrationskalender', fr: 'Calendrier de Migration', pl: 'Kalendarz Migracji', ar: 'تقويم هجرة الحيوانات', ru: 'Календарь миграции' },
    nav_packing_guide: { en: 'Packing Guide', it: 'Guida Bagagli', de: 'Packliste', fr: 'Guide Bagages', pl: 'Przewodnik Pakowania', ar: 'دليل تجهيز الحقائب', ru: 'Что взять с собой' },
    btn_whatsapp_book: { en: 'Book on WhatsApp', it: 'Prenota su WhatsApp', de: 'Über WhatsApp buchen', fr: 'Réserver par WhatsApp', pl: 'Zarezerwuj przez WhatsApp', ar: 'احجز عبر واتساب', ru: 'Забронировать в WhatsApp' },
    nav_about: { en: 'About Us', it: 'Chi Siamo', de: 'Über Uns', fr: 'À Propos', pl: 'O Nas', ar: 'من نحن', ru: 'О нас' },
    nav_contact: { en: 'Contact', it: 'Contatti', de: 'Kontakt', fr: 'Contact', pl: 'Kontakt', ar: 'اتصل بنا', ru: 'Контакты' },
    btn_check_rates: { en: 'Check Rates', it: 'Verifica Tariffe', de: 'Preise prüfen', fr: 'Voir les tarifs', pl: 'Sprawdź ceny', ar: 'تحقق من الأسعار', ru: 'Узнать цены' },
    btn_book_transfer: { en: 'Book Transfer', it: 'Prenota Transfer', de: 'Transfer buchen', fr: 'Réserver transfert', pl: 'Zarezerwuj transfer', ar: 'احجز وسيلة التوصيل', ru: 'Заказать трансфер' },
    btn_open_calculator: { en: 'Open Fare Calculator →', it: 'Calcolatore Tariffe →', de: 'Tarifrechner öffnen →', fr: 'Calculateur de tarif →', pl: 'Kalkulator opłat →', ar: 'افتح حاسبة التوصيل', ru: 'Калькулятор трансфера' },
    btn_whatsapp_concierge: { en: 'WhatsApp Concierge', it: 'Concierge WhatsApp', de: 'WhatsApp Concierge', fr: 'Concierge WhatsApp', pl: 'Concierge WhatsApp', ar: 'كونسيرج واتساب', ru: 'Консьерж в WhatsApp' },
    label_planning_range: { en: 'Published rate — our team confirms final rate', it: 'Fascia indicativa — il nostro team confermerà la tariffa finale', de: 'Planungsbereich — unser Team bestätigt den Endpreis', fr: 'Fourchette indicative — notre équipe confirme le tarif final', pl: 'Szacunkowy przedział — nasz zespół potwierdzi ostateczną cenę', ar: 'نطاق سعري استرشادي — سيؤكد فريقنا السعر النهائي', ru: 'Ориентировочная цена — команда подтвердит точную стоимость' },
    label_per_vehicle: { en: 'per vehicle (up to 4 guests)', it: 'per veicolo (fino a 4 persone)', de: 'pro Fahrzeug (bis zu 4 Personen)', fr: 'par véhicule (jusqu\'à 4 personnes)', pl: 'za pojazd (do 4 osób)', ar: 'لكل سيارة (حتى 4 ركاب)', ru: 'за автомобиль (до 4 человек)' },
    label_per_person: { en: 'per person', it: 'a persona', de: 'pro Person', fr: 'par personne', pl: 'za osobę', ar: 'للشخص الواحد', ru: 'за человека' },
    whatsapp_greeting: { en: 'Hi Spice and Sail, I would like to inquire about', it: 'Ciao Spice and Sail, vorrei richiedere informazioni e un preventivo per', de: 'Hallo Spice and Sail, ich interessiere mich für', fr: 'Bonjour Spice and Sail, je souhaite demander des informations et un devis pour', pl: 'Dzień dobry Spice and Sail, chciałbym zapytać o wycenę i szczegóły dotyczące', ar: 'مرحباً Spice and Sail، أود الاستفسار عن', ru: 'Здравствуйте, Spice and Sail! Хочу узнать подробнее о' },
    whatsapp_hotel_text: { en: 'stay and tour packages for', it: 'soggiorno e tour per', de: 'Unterkunft und Ausflugspakete für', fr: 'séjour et forfaits d\'excursion pour', pl: 'pobyt oraz pakiety wycieczek dla', ar: 'باقات الإقامة والجولات لـ', ru: 'проживании и экскурсионных пакетах для' },
    whatsapp_transfer_text: { en: 'private airport transfer to', it: 'transfer privato dall\'aeroporto a', de: 'privaten Flughafentransfer nach', fr: 'transfert privé depuis l\'aéroport vers', pl: 'prywatny transfer z lotniska do', ar: 'توصيل خاص من المطار إلى', ru: 'индивидуальном трансфере из аэропорта в' },
    mobile_whatsapp: { en: 'WhatsApp', it: 'WhatsApp', de: 'WhatsApp', fr: 'WhatsApp', pl: 'WhatsApp', ar: 'واتساب', ru: 'WhatsApp' },
    mobile_call: { en: 'Call', it: 'Chiamare', de: 'Anrufen', fr: 'Appeler', pl: 'Zadzwonić', ar: 'اتصال', ru: 'Позвонить' },
    mobile_enquire: { en: 'Enquire', it: 'Richiedi Info', de: 'Anfragen', fr: 'Demander Info', pl: 'Zapytaj', ar: 'استفسار', ru: 'Запрос' },
    footer_talk_with_team: { en: 'Talk with our team', it: 'Parla con il nostro team', de: 'Sprich mit unserem Team', fr: 'Parlez à notre équipe', pl: 'Porozmawiaj z naszym zespołem', ar: 'تحدث مع فريقنا', ru: 'Связаться с нашей командой' },
    footer_0_deposit: { en: '0% Deposit Transfers', it: 'Transfer 0% Deposito', de: 'Transfers 0% Anzahlung', fr: 'Transferts 0% Acompte', pl: 'Transfery 0% Zaliczka', ar: '0% دفعة مقدمة للتوصيل', ru: 'Трансферы без предоплаты (0%)' },
    footer_marine_fees: { en: 'Marine Fees Included', it: 'Tasse Marine Incluse', de: 'Marinegebühren Inklusive', fr: 'Frais Marins Inclus', pl: 'Opłaty Morskie Wliczone', ar: 'شامل الرسوم البحرية', ru: 'Морские сборы включены' },
    footer_weather_guarantee: { en: 'Weather Guarantee', it: 'Garanzia Meteo', de: 'Wettergarantie', fr: 'Garantie Météo', pl: 'Gwarancja Pogodowa', ar: 'ضمان الأحوال الجوية', ru: 'Гарантия хорошей погоды' },
    footer_multilingual_guides: { en: 'Multilingual Guides (extra fee)', it: 'Guide Multilingue (supplemento)', de: 'Mehrsprachige Guides (Aufpreis)', fr: 'Guides Multilingues (supplément)', pl: 'Wielojęzyczni Przewodnicy (dodatkowa opłata)', ar: 'مرشدون متعددو اللغات', ru: 'Многоязычные гиды' },
    footer_viator_less: { en: 'Direct Local Rates — No OTA Commission', it: 'Tariffe Dirette Locali — Nessuna Commissione OTA', de: 'Direkte Lokalpreise — Keine OTA-Provision', fr: 'Tarifs Locaux Directs — Pas de Commission OTA', pl: 'Bezpośrednie Stawki Lokalne — Brak Prowizji OTA', ar: 'أسعار محلية مباشرة — بدون عمولات وسيط', ru: 'Прямые местные цены без комиссий' },
    footer_chat_whatsapp: { en: 'Chat WhatsApp', it: 'Chatta su WhatsApp', de: 'WhatsApp Chat', fr: 'WhatsApp Chat', pl: 'Czat WhatsApp', ar: 'محادثة واتساب', ru: 'Чат в WhatsApp' },
    footer_browse_tours: { en: 'Browse Tours', it: 'Sfoglia Tour', de: 'Touren Durchsuchen', fr: 'Parcourir Excursions', pl: 'Przeglądaj Wycieczki', ar: 'استعرض الجولات', ru: 'Смотреть туры' },
    footer_find_google_maps: { en: 'Find us on Google Maps ↗', it: 'Trova su Google Maps ↗', de: 'Bei Google Maps finden ↗', fr: 'Trouver sur Google Maps ↗', pl: 'Znajdź na Google Maps ↗', ar: 'موقعنا على خرائط جوجل ↗', ru: 'Мы на Google Maps ↗' },
    footer_privacy: { en: 'Privacy', it: 'Privacy', de: 'Datenschutz', fr: 'Confidentialité', pl: 'Prywatność', ar: 'سياسة الخصوصية', ru: 'Конфиденциальность' },
    footer_terms: { en: 'Terms', it: 'Termini', de: 'AGB', fr: 'Conditions', pl: 'Warunki', ar: 'الشروط والأحكام', ru: 'Условия и правила' },
    footer_cancellation: { en: 'Cancellation', it: 'Cancellazione', de: 'Stornierung', fr: 'Annulation', pl: 'Anulowanie', ar: 'سياسة الإلغاء', ru: 'Правила отмены' }
  };

  var WA_GREETINGS = {
    en: "Hi Spice and Sail, I am inquiring about",
    it: "Ciao Spice and Sail, vorrei richiedere informazioni e preventivo per",
    de: "Hallo Spice and Sail, ich interessiere mich für ein Angebot für",
    fr: "Bonjour Spice and Sail, je souhaite demander des informations et un devis pour",
    pl: "Dzień dobry Spice and Sail, chciałbym zapytać o wycenę i rezerwację dla",
    ar: "مرحباً Spice and Sail، أود الاستفسار عن",
    ru: "Здравствуйте Spice and Sail, меня интересует"
  };

  // State
  var currentCurrency = localStorage.getItem('sns_currency') || 'USD';
  if (!RATES[currentCurrency]) currentCurrency = 'USD';

  var storedLang = localStorage.getItem('sns_lang');
  var pageLang = (document.documentElement.lang || 'en').split('-')[0];
  if (!LANGS[pageLang]) pageLang = 'en';
  var currentLang = (storedLang && LANGS[storedLang]) ? storedLang : pageLang;

  // Tagging every price rewrites text nodes across the whole document, so it is
  // deferred until a visitor explicitly chooses a non-USD currency.
  var pricesTagged = false;

  function ensurePricesTagged() {
    if (pricesTagged) return;
    pricesTagged = true;
    scanAndTagUsdPrices();
  }

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

    // Real localized pages keep their document language; machine-translated
    // pages keep the source language and record the target in data-sns-lang.
    if (!usesGoogleTranslate(lang)) document.documentElement.lang = lang;
    if (lang === 'ar') {
      document.documentElement.setAttribute('dir', 'rtl');
    } else {
      document.documentElement.removeAttribute('dir');
    }

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

    // Real IT/DE pages need no machine translation; FR/PL and untranslated
    // pages use Google Translate.
    if (usesGoogleTranslate(lang)) {
      document.documentElement.setAttribute('data-sns-lang', lang);
      applyGoogleTranslate(lang);
    } else {
      document.documentElement.lang = lang;
      resetGoogleTranslate();
    }
  }

  function applyGoogleTranslate(targetLang) {
    var attempts = 0;
    function tryApply() {
      var combo = document.querySelector('.goog-te-combo');
      if (combo) {
        var translated = document.documentElement.classList.contains('translated-ltr') && combo.value === targetLang;
        if (!translated) {
          combo.value = targetLang;
          combo.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (!translated && attempts < 40) {
          attempts++;
          setTimeout(tryApply, 250);
        }
        return;
      }
      if (attempts === 0) loadGoogleTranslateScript();
      if (attempts < 40) {
        attempts++;
        setTimeout(tryApply, 250);
      }
    }
    tryApply();
  }

  function resetGoogleTranslate() {
    var combo = document.querySelector('.goog-te-combo');
    if (combo) {
      combo.value = 'en';
      combo.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function loadGoogleTranslateScript() {
    if (document.getElementById('google-translate-script')) return;
    
    window.googleTranslateElementInit = function() {
      new window.google.translate.TranslateElement({
        pageLanguage: pageLang,
        includedLanguages: 'en,it,de,fr,pl,ar,ru',
        autoDisplay: false
      }, 'google_translate_element');

      if (usesGoogleTranslate(currentLang)) {
        applyGoogleTranslate(currentLang);
      }
    };

    var s = document.createElement('script');
    s.id = 'google-translate-script';
    s.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    s.async = true;
    document.head.appendChild(s);
  }

  function normalizePath(value) {
    try {
      var p = new URL(value, window.location.origin).pathname.replace(/\/+$/, '');
      return p || '/';
    } catch (e) {
      return '';
    }
  }

  // Real localized page for a language, or '' when the page is not translated.
  function realPageFor(lang) {
    var sel = document.getElementById('langSelect');
    if (!sel) return '';
    var alt = sel.getAttribute('data-alt-' + lang) || '';
    if (!alt) return '';
    var target = normalizePath(alt);
    if (!target || target === normalizePath(window.location.pathname)) return '';
    return alt;
  }

  function usesGoogleTranslate(lang) {
    if (lang === 'fr' || lang === 'pl') return true;
    return !realPageFor(lang) && lang !== pageLang;
  }

  function showLanguageSuggestion(lang) {
    if (sessionStorage.getItem('sns_lang_suggest_dismissed')) return;
    if (document.getElementById('sns-lang-suggest')) return;
    var alt = realPageFor(lang);
    var canTranslate = !alt && (lang === 'fr' || lang === 'pl');
    if (!alt && !canTranslate) return;

    var bar = document.createElement('div');
    bar.id = 'sns-lang-suggest';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Language suggestion');
    bar.style.cssText = 'position:fixed;left:1rem;right:1rem;bottom:1rem;z-index:9999;max-width:620px;margin:0 auto;background:#0C1A24;color:#fff;padding:.9rem 1rem;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.25);display:flex;gap:.75rem;align-items:center;justify-content:space-between;font-size:.92rem;flex-wrap:wrap;';

    var text = document.createElement('span');
    text.textContent = alt
      ? 'This page is available in ' + LANGS[lang].name + '.'
      : 'Translate this page to ' + LANGS[lang].name + '?';

    var actions = document.createElement('span');
    actions.style.cssText = 'display:flex;gap:.5rem;flex-shrink:0;';

    var go;
    if (alt) {
      go = document.createElement('a');
      go.href = alt;
      go.textContent = 'View in ' + LANGS[lang].name;
    } else {
      go = document.createElement('button');
      go.type = 'button';
      go.textContent = 'Translate';
      go.addEventListener('click', function () { bar.remove(); setLanguage(lang); });
    }
    go.style.cssText = 'background:#ffd9a0;color:#0C1A24;padding:.45rem .8rem;border-radius:8px;font-weight:700;text-decoration:none;border:0;cursor:pointer;';

    var stay = document.createElement('button');
    stay.type = 'button';
    stay.textContent = 'Not now';
    stay.style.cssText = 'background:transparent;color:#fff;border:1px solid rgba(255,255,255,.4);padding:.45rem .8rem;border-radius:8px;cursor:pointer;';
    stay.addEventListener('click', function () {
      sessionStorage.setItem('sns_lang_suggest_dismissed', '1');
      bar.remove();
    });

    actions.appendChild(go);
    actions.appendChild(stay);
    bar.appendChild(text);
    bar.appendChild(actions);
    document.body.appendChild(bar);
  }

  // Set Currency API
  function setCurrency(code) {
    if (!RATES[code]) return;
    currentCurrency = code;
    localStorage.setItem('sns_currency', code);
    var sel = document.getElementById('currencySelect');
    if (sel) sel.value = code;
    if (code !== 'USD') ensurePricesTagged();
    updatePricesOnPage();
  }

  // Set Language API
  function setLanguage(lang) {
    if (!LANGS[lang]) return;
    localStorage.setItem('sns_lang', lang);

    // Italian and German have real, indexable pages. Navigate there instead of
    // machine-translating the English page in place.
    var target = realPageFor(lang);
    if (target) {
      window.location.href = target;
      return;
    }

    currentLang = lang;
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
    if (currentCurrency !== 'USD') {
      ensurePricesTagged();
      updatePricesOnPage();
    }

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

    // A saved preference wins: move to the real localized page when one exists.
    if (storedLang && LANGS[storedLang] && storedLang !== pageLang) {
      var persisted = realPageFor(storedLang);
      if (persisted) {
        window.location.href = persisted;
        return;
      }
    }

    if (currentCurrency !== 'USD' || currentLang !== pageLang || usesGoogleTranslate(currentLang)) {
      updateTranslations();
    } else {
      document.documentElement.lang = pageLang;
    }

    // First visit: suggest the browser language, but never force a redirect.
    if (!storedLang) {
      var browserLang = (navigator.language || 'en').split('-')[0].toLowerCase();
      if (LANGS[browserLang] && browserLang !== pageLang &&
          (realPageFor(browserLang) || browserLang === 'fr' || browserLang === 'pl')) {
        setTimeout(function () { showLanguageSuggestion(browserLang); }, 1200);
      }
    }
  });
})();
