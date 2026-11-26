/**
 * Zanzibar & Tanzania domain knowledge helper — single-sourced from
 * concierge-catalogue.json, travelguide.json, and areas.json.
 * Never invents prices outside verified data files.
 */
'use strict';

const travelguide = require('../../data/travelguide.json');
const areasData = require('../../data/areas.json');
const { catalogue, getService, CONFIG } = require('./catalogue');

const BUSINESS_WHATSAPP = (CONFIG && /^\d{8,15}$/.test(CONFIG.whatsappNumber || ''))
  ? CONFIG.whatsappNumber
  : '255707939265';

function weatherSeasonsReply(text) {
  const lower = (text || '').toLowerCase();
  const bt = travelguide.best_time_to_visit || {};
  const greenSeason = (CONFIG.seasons || []).find((s) => s.slug === 'green');
  const greenDisc = greenSeason ? Math.round((greenSeason.dayTripDiscount || 0) * 100) + '% off day tours & ' + Math.round((greenSeason.safariDiscount || 0) * 100) + '% off safaris (Apr–May)' : 'seasonal discounts Apr–May';

  let monthHighlight = '';
  if (/\b(mar|march|apr|april|may)\b/i.test(lower)) {
    monthHighlight = '\n\n**March–May Note:** Long rains peak in April (warm ~28–30°C with tropical showers). It is quietest and offers **Green Season savings** (' + greenDisc + ').';
  } else if (/\b(jun|june|jul|july|aug|august|sep|sept|september|oct|october)\b/i.test(lower)) {
    monthHighlight = '\n\n**June–October Note:** Zanzibar\'s cool, dry peak season (25–29°C, low humidity, calm seas). **July–October** also aligns with Serengeti Mara River crossings for mainland fly-in safaris.';
  } else if (/\b(nov|november|dec|december|jan|january|feb|february)\b/i.test(lower)) {
    monthHighlight = '\n\n**Nov–February Note:** Short passing showers can appear in Nov–early Dec, followed by hot, sunny beach weather Dec–Feb (28–33°C) and Ndutu Serengeti calving season (Dec–Mar) plus prime Mnemba diving visibility (Feb–Mar).';
  }

  return {
    message: '**Best Time to Visit Zanzibar, Seasons & Tides:**\n\n' +
      '• **Peak Dry Season (' + (bt.peak_season || 'June to October') + '):** Cool trade winds, sunny skies, best overall month is **' + (bt.best_overall_month || 'September') + '**.\n' +
      '• **Hot Beach & Diving Season (December–February):** Warmest ocean, peak visibility (**' + (bt.diving_best || 'Feb–Mar & Jul–Oct') + '**).\n' +
      '• **Shoulder / Value Months (' + (bt.best_value_months || 'June & October') + ', Nov–early Dec):** Great weather with lighter crowds.\n' +
      '• **Green Season (' + (bt.avoid || 'March–May') + '):** Lush island, fewer tourists, and **' + greenDisc + '**.\n' +
      '• **Tide Tip (Important!):** **Nungwi & Kendwa** (North) stay swimmable all day regardless of tide. **Paje, Jambiani, Bwejuu & Matemwe** (East) have dramatic turquoise low-tide flats ideal for kitesurfing and reef walks — we time ocean excursions around daily tides.' +
      monthHighlight,
    quickReplies: ['Compare beach areas', 'Plan my trip', 'Safaris & Great Migration', 'Show all tours'],
    requestContact: false,
  };
}

function areaGuideReply(text) {
  const lower = (text || '').toLowerCase();
  const zones = areasData.zones || [];

  const matchedZone = zones.find((z) => {
    const slugWord = (z.slug || '').replace(/-/g, ' ');
    const nameLower = (z.name || '').toLowerCase();
    return lower.includes(slugWord) || lower.includes(nameLower.split('/')[0].trim());
  });

  if (matchedZone && !/\b(vs|versus|compare|which area|where to stay|best beach|best area)\b/i.test(lower)) {
    return {
      message: '**' + matchedZone.name + ' (' + matchedZone.island + ') — Area Guide:**\n\n' +
        matchedZone.description + '\n\n' +
        'We cover **' + matchedZone.name + '** with private airport transfers and direct tour pickups. Tell me your travel dates or ask for transfer & tour recommendations from ' + matchedZone.name + '!',
      quickReplies: ['Airport transfers', 'Recommend tours for ' + matchedZone.name.split('/')[0].trim(), 'Partner hotels', 'Plan my trip'],
      requestContact: false,
    };
  }

  return {
    message: '**Where to Stay in Zanzibar — Area Comparison:**\n\n' +
      '• **Nungwi & Kendwa (North):** White sand & **all-day swimming** (minimal tide change), vibrant sunset dhow cruises, nightlife, and fast access to Mnemba Atoll.\n' +
      '• **Paje & Jambiani (Southeast):** Famous turquoise lagoon, kitesurfing capital, laid-back village life, Kuza Cave, Maalum Cenote, and Jozani Forest. *(Home to partner stays **Mkeka Spice Lodge** & **Le Paradis Boutique Hotel**.)*\n' +
      '• **Matemwe & Kiwengwa (Northeast):** Peaceful luxury beachfront opposite **Mnemba Atoll** — ideal for snorkeling, diving, and honeymoons.\n' +
      '• **Stone Town (West):** UNESCO World Heritage alleys, carved doors, Forodhani night food market, spice farms, and Prison Island / Nakupenda boats. *(Home to **Stone Town View Hotel** & **The Island Stonetown**.)*\n' +
      '• **Makunduchi & Kizimkazi (South):** Quiet coastal retreats, dolphin coast, and Safari Blue access from Fumba. *(Home to **The One Resort Zanzibar**.)*\n\n' +
      'Ideal split for 5–7 nights: **2 nights in Stone Town + 3–5 nights on the beach**.',
    quickReplies: ['Partner hotels', 'Airport transfers', 'Plan my trip', 'Show all tours'],
    requestContact: false,
  };
}

function ferryFlightsLogisticsReply() {
  const tr = (travelguide.transportation && travelguide.transportation.getting_there) || {};
  const ferry = getService('airport-transfer-znz-to-stone-town');
  const ferryRate = ferry && ferry.pricing ? ferry.pricing.display : '$18 sedan / $35 van';
  return {
    message: '**Getting Between Dar es Salaam, Tanzania Mainland & Zanzibar:**\n\n' +
      '• **Azam Marine / Fast Ferry (Dar es Salaam ↔ Stone Town):** ~90–120 minutes crossing (~$35–$65 pp). **Tip:** Buy tickets only at official Azam Marine booths or portals, not street touts.\n' +
      '• **Ferry Port Pickup:** Our driver meets you right outside the Stone Town Ferry Terminal gate with a nameboard — private transfers to Stone Town (' + ferryRate + ') or straight to your beach resort with **zero advance deposit**.\n' +
      '• **Domestic Flights (Dar / Arusha / Kilimanjaro JRO / Serengeti / Mikumi / Nyerere):** Arrive at **Abeid Amani Karume International Airport (ZNZ)**. We track your flight automatically with 60 minutes complimentary waiting time.\n' +
      '• **Mainland Safari Connections:** Fly directly from ZNZ to **Mikumi**, **Nyerere (Selous)**, **Saadani** (15-min flight/boat), or **Serengeti** with all game drives and TANAPA park fees arranged.',
    quickReplies: ['Airport transfers', 'Safaris & Great Migration', 'Stone Town tour', '💬 WhatsApp'],
    requestContact: false,
  };
}

function packagesReply() {
  const pkgs = (catalogue.services || []).filter((s) => s.type === 'package' && !s.hotelSlug);
  const lines = pkgs.map((p) => '• **' + p.name + '** — ' + (p.pricing ? p.pricing.display : 'price on request') + ' per person (' + p.duration + ')');
  return {
    message: '**Curated Multi-Day Zanzibar Packages:**\n\n' +
      lines.join('\n') +
      '\n\nEvery package includes private airport transfers, licensed local guides, and marine/park entry fees. A **30% deposit** secures your itinerary (balance before departure), and we can pair any package with our contracted partner hotels!',
    quickReplies: pkgs.slice(0, 3).map((p) => p.name).concat(['Partner hotels']),
    recommendedSlugs: pkgs.map((p) => p.slug),
    requestContact: false,
  };
}

function safarisReply() {
  const safs = (catalogue.services || []).filter((s) => s.category === 'SAF');
  const lines = safs.map((s) => '• **' + s.name + '** — ' + (s.pricing ? s.pricing.display : 'price on request') + ' per person (' + s.duration + ')');
  return {
    message: '**Mainland Tanzania Fly-In Safaris from Zanzibar:**\n\n' +
      lines.join('\n') +
      '\n\n**Good to Know:**\n' +
      '• All fly-in safaris include return domestic flights from ZNZ, 4x4 game drives, licensed safari guides, and official **TANAPA park entry fees**.\n' +
      '• **Great Migration Timing:** July–October for Serengeti Mara River crossings; December–March for Ndutu calving season.\n' +
      '• **Booking Policy:** 30% advance deposit locks domestic airline seats and park permits.',
    quickReplies: safs.slice(0, 3).map((s) => s.name).concat(['Bush to Beach VIP']),
    recommendedSlugs: safs.map((s) => s.slug),
    requestContact: false,
  };
}

function rentalsReply() {
  const rentals = (catalogue.services || []).filter((s) => s.type === 'rental');
  const lines = rentals.map((r) => '• **' + r.name + '** — ' + (r.pricing ? r.pricing.display : 'price on request') + (r.pricing && r.pricing.tieredDisplay ? ' (' + r.pricing.tieredDisplay.split('•')[0].trim() + ')' : ''));
  return {
    message: '**Self-Drive Car & Scooter Rentals in Zanzibar:**\n\n' +
      lines.join('\n') +
      '\n\n• **What\'s Included:** Unlimited mileage, basic insurance, and **temporary Zanzibar driving permit ($10–$15)** arranged on delivery (bring your valid home/international driving license).\n' +
      '• **Driving Note:** Zanzibar drives on the **left**; a 4x4 SUV is recommended for south/east coast sandy tracks and Uzi Island.',
    quickReplies: rentals.map((r) => r.name).concat(['Airport transfers']),
    recommendedSlugs: rentals.map((r) => r.slug),
    requestContact: false,
  };
}

function entryTravelInfoReply(text) {
  const lower = (text || '').toLowerCase();
  const isSim = /\b(sim|esim|internet|wifi|data|airalo|vodacom|halotel)\b/i.test(lower);
  const isMoney = /\b(currency|cash|atm|dollar|usd|shilling|tzs|tipping|tip|bargain|credit card)\b/i.test(lower);
  const isHealth = /\b(malaria|yellow fever|vaccine|hospital|water|safe|safety)\b/i.test(lower);

  const tips = [];
  if (isSim) {
    tips.push('• **eSIM & Mobile Data:** Pre-install an eSIM (e.g., Airalo) or pick up a local **Vodacom / Halotel / Airtel** SIM with passport registration at official desks — avoid unofficial airport touts.');
  }
  if (isMoney || !isSim && !isHealth) {
    tips.push('• **Currency & USD Rules:** Tanzanian Shillings (**TZS**) and **USD** are widely used. **Important:** USD bills must be clean, undamaged, and printed **post-2013** (older or torn notes are rejected by banks/exchanges). Tipping 5–10% is appreciated for guides & drivers.');
  }
  if (!isSim && !isMoney) {
    tips.push('• **Tanzania Visa:** Standard tourist visa is $50 USD on arrival or online via **visa.immigration.go.tz** ($100 multiple-entry for US citizens; passport valid 6+ months).');
    tips.push('• **Mandatory Zanzibar Travel Insurance:** Required for foreign visitors entering Zanzibar ($44 adult / $22 child — please verify current amounts on the official portal **inbound.visitzanzibar.go.tz**).');
  }
  if (isHealth || (!isSim && !isMoney)) {
    tips.push('• **Health & Safety:** Yellow fever certificate is required only when arriving from or transiting >12h through an endemic country. Consult a travel clinic regarding malaria prophylaxis and pack DEET repellent. Zanzibar is generally very welcoming; use registered private drivers at night.');
  }
  if (!isSim && !isMoney && !isHealth) {
    tips.push('• **Culture & Etiquette:** Cover shoulders and knees in Stone Town and local villages (beachwear is great on beaches/resorts). During Ramadan, avoid eating or drinking publicly in town during daylight hours.');
  }

  return {
    message: '**Zanzibar Entry, Practical & Cultural Information:**\n\n' + tips.join('\n') +
      '\n\nWant help planning airport arrival pickup or tours?',
    quickReplies: ['Airport transfers', 'Best time & tides', 'Partner hotels', 'Show all tours'],
    requestContact: false,
  };
}

function feesOverviewReply() {
  return {
    message: '**Transparent Conservation Fees & Local Levies:**\n\n' +
      '• **Menai Bay Marine Park (Safari Blue):** $10 per non-EAC adult — **already included** in our published Safari Blue rates.\n' +
      '• **Mnemba Atoll Conservation Fee:** $25 per non-EAC adult — **already included** in our private Mnemba snorkeling rates.\n' +
      '• **Mainland Safari Park Fees (TANAPA):** Included upfront in our Mikumi, Saadani, Selous & Serengeti fly-in packages.\n' +
      '• **Zanzibar Infrastructure Tax (Hotels):** Typically $4–$5 per person per night payable at hotel check-in (verify current amounts on the official portal or your hotel confirmation).\n' +
      '• **Mandatory Zanzibar Inbound Insurance:** Required before arrival — verify current amounts ($44 adult / $22 child) on the official portal **inbound.visitzanzibar.go.tz**.',
    quickReplies: ['Safari Blue', 'Mnemba snorkeling', 'Partner hotels', 'Plan my trip'],
    requestContact: false,
  };
}

module.exports = {
  weatherSeasonsReply,
  areaGuideReply,
  ferryFlightsLogisticsReply,
  packagesReply,
  safarisReply,
  rentalsReply,
  entryTravelInfoReply,
  feesOverviewReply,
};
