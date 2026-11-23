# Organic Booking Funnel — 5 Contracted Hotels

## Funnel Overview
```
Organic Search (Google)
       │
       ▼
┌─────────────────────────────────────┐
│  Hotel Detail Page (Partner)        │  ← Primary landing page
│  - Rate cards (Half/Full Board)     │
│  - Room type gallery + amenities    │
│  - Hotel + FAQPage schema           │
│  - 2× "Check availability" CTAs     │
│  - WhatsApp "Ask on WhatsApp"       │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Booking Modal (data-sns-booking)   │  ← Micro-conversion
│  - Dates picker                     │
│  - Guests/rooms                     │
│  - Live availability (TBD)          │
│  - Rate breakdown + local tax       │
│  - "Pay 20% deposit" (Stripe)       │
│  - "Continue on WhatsApp" fallback  │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  WhatsApp Conversation              │  ← Macro-conversion
│  - Auto-quote with dates/rate       │
│  - Transfer + tour upsell           │
│  - Payment link / bank details      │
│  - Voucher PDF generation           │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Confirmed Booking                  │  ← Revenue
│  - Partner confirmation             │
│  - Guest voucher + transfer details │
│  - CRM record (KV + sheet)          │
└─────────────────────────────────────┘
```

## Per-Hotel Landing Page Optimisation
| Hotel | Zone | From Rate | Primary Keywords | Schema Focus |
|-------|------|-----------|------------------|--------------|
| The One Resort | Makunduchi | $136 | "luxury resort Zanzibar south coast", "all inclusive Zanzibar" | Hotel, FAQPage, Product (room types) |
| Le Paradis Boutique | Jambiani | $56 | "boutique hotel Jambiani", "Zanzibar east coast hotel" | Hotel, FAQPage, Product |
| Mkeka Spice Lodge | Jambiani | $36 | "affordable lodge Jambiani", "Zanzibar budget beach hotel" | Hotel, FAQPage, Product |
| The Island Stonetown | Stone Town | $29 | "Stone Town hotel rooftop", "Zanzibar city hotel" | Hotel, FAQPage, Product |
| Stone Town View | Stone Town | $29 | "Stone Town view hotel", "Malindi Street hotel" | Hotel, FAQPage, Product |

## Content Assets per Hotel (Already Live)
- Unique description from `partnerPropertyResearch.json` (view facts, room count, airport distance, amenities)
- Room types with guest rates (from `hotelRates.json` + `hotelPublicRates.json`)
- Good-to-Know: contact, board, tax, transfer info
- FAQ: 4 questions (distance, inclusions, transfers+ tours, availability check)
- JSON-LD: Hotel (name, description, image, address, priceRange, starRating, sameAs) + FAQPage

## Traffic Sources (Target Mix)
| Source | % | Tactics |
|--------|---|---------|
| Organic (hotel name + zone) | 45% | Schema, GBP, review markup, partner co-linking |
| Organic (category: "Jambiani hotel") | 25% | Cluster pages, internal links from attractions/tours |
| Direct / Brand | 15% | WhatsApp share, voucher PDF, email signature |
| Referral (partner sites) | 10% | White-label widget on partner sites |
| Social (IG/FB) | 5% | UGC from vault photos, guest reviews |

## Conversion Rate Targets (Monthly)
| Hotel | Organic Sessions | Modal Opens | WhatsApp Chats | Deposits | Confirmed Bookings |
|-------|------------------|-------------|----------------|----------|-------------------|
| The One | 800 | 80 (10%) | 40 (50%) | 8 (20%) | 5 |
| Le Paradis | 600 | 60 (10%) | 30 (50%) | 6 (20%) | 4 |
| Mkeka | 400 | 40 (10%) | 20 (50%) | 4 (20%) | 2 |
| The Island | 500 | 50 (10%) | 25 (50%) | 5 (20%) | 3 |
| Stone Town View | 500 | 50 (10%) | 25 (50%) | 5 (20%) | 3 |
| **TOTAL** | **2,800** | **280** | **140** | **28** | **17** |

## Technical Requirements to Hit Targets
1. **Live availability** (Blocker #1) — without it, modal → WhatsApp conversion drops to <10%.
2. **Stripe deposit** (Blocker #2) — captures intent before WhatsApp; reduces drop-off.
3. **Schema `Product` for room types** — enables rich snippets with price/availability in SERP.
4. **GA4 + Meta Pixel events** — `booking_modal_open`, `deposit_started`, `whatsapp_chat_initiated`.
5. **Automated WhatsApp quote** — `chat.js` intent `book` returns pre-formatted quote in <5s.

## Measurement Dashboard (Build in Cloudflare Workers + KV)
- Daily: sessions, modal_open_rate, whatsapp_click_rate, deposit_conversion, booking_confirmation
- Weekly: per-hotel keyword rankings (top 20), CTR from GSC
- Monthly: revenue per hotel, CAC (organic = $0), LTV (repeat + referrals)
