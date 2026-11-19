# OTA Net-Rate Configuration — Spice & Sail Zanzibar

## Channel Strategy Overview

| Channel | Commission | Net Rate Formula | Pricing Control | Priority |
|---------|------------|------------------|-----------------|----------|
| **Direct (Web/WhatsApp)** | 0% | Retail = Net / (1 - Target Margin) | Full | P0 |
| **Viator / TripAdvisor** | 25% | Net = Retail / 1.33 | OTA sets retail | P1 |
| **GetYourGuide** | 25% | Net = Retail / 1.33 | OTA sets retail | P1 |
| **TourRadar** | 19% | Net = Retail / 1.23 | OTA sets retail | P2 |
| **Booking.com Experiences** | 20-25% | Net = Retail / 1.25-1.33 | OTA sets retail | P2 |
| **Hotel Concierge** | 10-15% | Net = Retail - Commission | We set retail | P1 |
| **B2B / DMC** | 15-25% margin | Net = Our wholesale rate | DMC sets retail | P3 |
| **Corporate / Group** | 5-10% discount | Net = Retail × 0.90-0.95 | We set retail | P3 |

---

## Net-Rate Calculation Engine

### Core Formula
```
Retail Price = (Partner Net Rate + Direct Operating Costs) / (1 - Target Gross Margin)

Where:
- Partner Net Rate = Contracted rate from supplier (driver, boat, guide, hotel)
- Direct Operating Costs = Payment gateway fees (3%), WhatsApp API, dispatch coordination
- Target Gross Margin = 25% (transfers), 35% (tours), 30% (packages), 20% (safaris)
```

### Example: Safari Blue
```
Partner Net Rate: $55 pp (includes $10 marine fee, boat, guide, lunch, gear)
Direct Costs: $3 pp (payment, dispatch)
Target Margin: 35%

Retail = ($55 + $3) / (1 - 0.35) = $58 / 0.65 = $89.23 → Round to $89-95 pp
```

### OTA Net Rates (Commission-Proof)
```
OTA Net Rate = Direct Retail Price / (1 + OTA Commission)

Viator (25%): $89 / 1.25 = $71.20 net to us
GetYourGuide (25%): $89 / 1.25 = $71.20 net to us
TourRadar (19%): $89 / 1.19 = $74.79 net to us
```

**Rule**: Never publish OTA retail price as direct price. OTA retail = our direct retail.

---

## Service-Level Net Rates (Current Catalogue)

| Service | Direct Retail | Target Margin | Max Partner Net | Viator Net (25%) | GYG Net (25%) | TourRadar Net (19%) |
|---------|---------------|---------------|-----------------|------------------|---------------|---------------------|
| ZNZ→Stone Town | $18 | 25% | $13.50 | $14.40 | $14.40 | $15.12 |
| ZNZ→Nungwi | $45 | 25% | $33.75 | $36.00 | $36.00 | $37.80 |
| ZNZ→Paje | $45 | 25% | $33.75 | $36.00 | $36.00 | $37.80 |
| Stone Town Tour | $35-90 | 35% | $22.75-58.50 | $28.00-72.00 | $28.00-72.00 | $29.40-75.60 |
| Spice Farm | $40-75 | 35% | $26.00-48.75 | $32.00-60.00 | $32.00-60.00 | $33.60-63.00 |
| Safari Blue | $85-150 | 35% | $55.25-97.50 | $68.00-120.00 | $68.00-120.00 | $71.40-126.00 |
| Mnemba Snorkel | $45-115 | 35% | $29.25-74.75 | $36.00-92.00 | $36.00-92.00 | $37.80-96.90 |
| Prison Island | $85-95 | 35% | $55.25-61.75 | $68.00-76.00 | $68.00-76.00 | $71.40-79.80 |
| Sunset Dhow | $30-95 | 35% | $19.50-61.75 | $24.00-76.00 | $24.00-76.00 | $25.20-79.80 |
| Jozani Forest | $50-95 | 35% | $32.50-61.75 | $40.00-76.00 | $40.00-76.00 | $42.00-79.80 |
| 3-Day Package | $185-260 | 30% | $129.50-182.00 | $148.00-208.00 | $148.00-208.00 | $155.40-218.40 |

---

## Implementation: Net-Rate Configuration File

Create `/src/data/ota-rates.json`:

```json
{
  "version": "2026-11-20.v1",
  "channels": {
    "direct": {
      "commission": 0,
      "marginTarget": { "transfer": 0.25, "tour": 0.35, "package": 0.30, "safari": 0.20 },
      "pricingControl": "full"
    },
    "viator": {
      "commission": 0.25,
      "netRateFormula": "retail / 1.333",
      "pricingControl": "ota",
      "listingFee": 29,
      "netRateModel": true,
      "enabled": true
    },
    "getyourguide": {
      "commission": 0.25,
      "netRateFormula": "retail / 1.333",
      "pricingControl": "ota",
      "enabled": true
    },
    "tourradar": {
      "commission": 0.19,
      "netRateFormula": "retail / 1.235",
      "pricingControl": "ota",
      "enabled": true
    },
    "booking_experiences": {
      "commission": 0.20,
      "netRateFormula": "retail / 1.25",
      "pricingControl": "ota",
      "enabled": false
    },
    "hotel_concierge": {
      "commission": 0.125,
      "netRateFormula": "retail * 0.875",
      "pricingControl": "direct",
      "enabled": true,
      "maxCommission": 0.15,
      "requiresVolume": false
    },
    "b2b_dmc": {
      "commission": 0.20,
      "netRateFormula": "retail * 0.80",
      "pricingControl": "dmc",
      "enabled": true,
      "minVolume": 10
    },
    "corporate": {
      "discount": 0.075,
      "netRateFormula": "retail * 0.925",
      "pricingControl": "direct",
      "enabled": true,
      "requiresApproval": true
    }
  },
  "serviceNetRates": {
    "airport-transfer-znz-to-stone-town": { "directRetail": 18, "maxPartnerNet": 13.50, "category": "transfer" },
    "airport-transfer-znz-to-nungwikendwa": { "directRetail": 45, "maxPartnerNet": 33.75, "category": "transfer" },
    "airport-transfer-znz-to-pajejambiani": { "directRetail": 45, "maxPartnerNet": 33.75, "category": "transfer" },
    "airport-transfer-znz-to-matemwe": { "directRetail": 40, "maxPartnerNet": 30.00, "category": "transfer" },
    "airport-transfer-znz-to-kizimkazi": { "directRetail": 50, "maxPartnerNet": 37.50, "category": "transfer" },
    "stone-town-walking-tour": { "directRetailMin": 35, "directRetailMax": 90, "maxPartnerNetMin": 22.75, "maxPartnerNetMax": 58.50, "category": "tour" },
    "spice-farm": { "directRetailMin": 40, "directRetailMax": 75, "maxPartnerNetMin": 26.00, "maxPartnerNetMax": 48.75, "category": "tour" },
    "safari-blue": { "directRetailMin": 85, "directRetailMax": 150, "maxPartnerNetMin": 55.25, "maxPartnerNetMax": 97.50, "category": "tour" },
    "mnemba-snorkeling": { "directRetailMin": 45, "directRetailMax": 115, "maxPartnerNetMin": 29.25, "maxPartnerNetMax": 74.75, "category": "tour" },
    "prison-island-nakupenda": { "directRetailMin": 85, "directRetailMax": 95, "maxPartnerNetMin": 55.25, "maxPartnerNetMax": 61.75, "category": "tour" },
    "sunset-dhow-cruise": { "directRetailMin": 30, "directRetailMax": 95, "maxPartnerNetMin": 19.50, "maxPartnerNetMax": 61.75, "category": "tour" },
    "jozani-forest": { "directRetailMin": 50, "directRetailMax": 95, "maxPartnerNetMin": 32.50, "maxPartnerNetMax": 61.75, "category": "tour" },
    "zanzibar-essentials-3day": { "directRetailMin": 185, "directRetailMax": 260, "maxPartnerNetMin": 129.50, "maxPartnerNetMax": 182.00, "category": "package" }
  },
  "rules": {
    "minimumMargin": { "transfer": 0.20, "tour": 0.30, "package": 0.25, "safari": 0.15 },
    "otaPriceParity": "OTA retail must equal or exceed direct retail",
    "hotelCommissionCap": 0.15,
    "commissionOnCancelled": false,
    "currency": "USD",
    "fxBuffer": 0.02
  }
}
```

---

## Netlify Function: OTA Rate Calculator

Create `/netlify/functions/ota-rates.js`:

```javascript
'use strict';

const { corsHeaders, isAllowedOrigin } = require('../../src/lib/concierge/security');
const fs = require('fs');
const path = require('path');

let otaConfig = {};
try {
  otaConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'data', 'ota-rates.json'), 'utf8'));
} catch (e) { otaConfig = {}; }

function calculateNetRate(retailPrice, channel) {
  const ch = otaConfig.channels?.[channel];
  if (!ch) return null;
  
  if (channel === 'direct') return { net: retailPrice, margin: ch.marginTarget };
  
  const formula = ch.netRateFormula;
  let net = retailPrice;
  
  if (formula.includes('/')) {
    const divisor = parseFloat(formula.split('/')[1]);
    net = retailPrice / divisor;
  } else if (formula.includes('*')) {
    const multiplier = parseFloat(formula.split('*')[1]);
    net = retailPrice * multiplier;
  }
  
  return { 
    retail: retailPrice, 
    net: Math.round(net * 100) / 100,
    commission: ch.commission,
    channel 
  };
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST required' }) };
  }
  
  let body;
  try { body = JSON.parse(event.body); } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }
  
  const { serviceSlug, retailPrice, channels = ['viator', 'getyourguide', 'tourradar'] } = body;
  
  if (!serviceSlug || !retailPrice) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'serviceSlug and retailPrice required' }) };
  }
  
  const serviceConfig = otaConfig.serviceNetRates?.[serviceSlug];
  if (!serviceConfig) {
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Service not configured' }) };
  }
  
  // Validate margin
  const minMargin = otaConfig.rules?.minimumMargin?.[serviceConfig.category] || 0.20;
  const actualMargin = (retailPrice - serviceConfig.maxPartnerNet) / retailPrice;
  
  if (actualMargin < minMargin) {
    return { 
      statusCode: 400, 
      headers, 
      body: JSON.stringify({ 
        error: `Margin too low: ${(actualMargin*100).toFixed(1)}% < ${(minMargin*100).toFixed(0)}% minimum`,
        minRetail: Math.round(serviceConfig.maxPartnerNet / (1 - minMargin))
      }) 
    };
  }
  
  const results = {};
  for (const ch of channels) {
    results[ch] = calculateNetRate(retailPrice, ch);
  }
  
  results.direct = calculateNetRate(retailPrice, 'direct');
  results.hotel_concierge = calculateNetRate(retailPrice, 'hotel_concierge');
  
  return { statusCode: 200, headers, body: JSON.stringify({ serviceSlug, retailPrice, netRates: results }) };
};
```

---

## Partner Contract Net-Rate Clauses

Add to partner contracts:

```
NET RATE AGREEMENT — Annex A

1. Net Rate Definition: The Net Rate is the amount payable by Spice & Sail to the Partner 
   for the Contracted Service, exclusive of all commissions, fees, taxes, and markups.

2. Currency: All Net Rates quoted in USD. Settlement in TZS at prevailing bank rate 
   on invoice date + 2% buffer.

3. Rate Validity: Net Rates fixed for 12 months from signing. Partner may request 
   review with 60 days written notice. Fuel surcharge per ZURA diesel cap formula.

4. Inclusions: Each Net Rate must specify inclusion/exclusion of:
   - Driver/captain/guide
   - Fuel
   - Marine/conservation fees
   - Park entry fees
   - Meals/drinks
   - Insurance
   - Taxes (VAT, tourism levy)

5. OTA Distribution: Spice & Sail may distribute Partner services via OTAs (Viator, 
   GetYourGuide, TourRadar) at Net Rates calculated as: Direct Retail / (1 + OTA Commission).
   Partner acknowledges OTA retail prices will equal or exceed Direct Retail.

6. Hotel Concierge Commission: 10-15% of Direct Retail, paid post-travel. 
   Cap: 15% unless guaranteed volume.

7. Payment Terms: 30% deposit on confirmation, balance 7 days before service. 
   Late bookings (<7 days): 100% at confirmation.

8. Cancellation: Per Annex B schedule. Partner may not charge cancellation fees 
   exceeding actual recoverable costs.
```

---

## Monitoring & Alerts

### Weekly Checks
- [ ] All OTA net rates ≥ minimum margin
- [ ] No OTA undercutting direct retail
- [ ] Partner net rates current (no expired contracts)
- [ ] Commission accruals match bookings

### Monthly Reconciliation
- [ ] OTA commission invoices vs. bookings
- [ ] Hotel concierge commission payouts
- [ ] Partner net rate payments
- [ ] Currency gain/loss tracking

---

## Quick Reference Card

```
DIRECT RETAIL PRICE = (PARTNER NET + DIRECT COSTS) / (1 - TARGET MARGIN)

OTA NET RATE = DIRECT RETAIL / (1 + OTA COMMISSION)

VIATOR (25%):     DIRECT RETAIL / 1.333
GETYOURGUIDE:     DIRECT RETAIL / 1.333  
TOURRADAR (19%):  DIRECT RETAIL / 1.235
HOTEL CONCIERGE:  DIRECT RETAIL × 0.875
B2B/DMC:          DIRECT RETAIL × 0.80

MINIMUM MARGINS:
Transfers:  20%
Tours:      30%
Packages:   25%
Safaris:    15%

NEVER: Publish OTA retail < Direct retail
ALWAYS: Validate margin before publishing
```