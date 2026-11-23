# 24/7 Sales Blockers — Blunt Assessment & Fixes

## Blocker 1: No Real-Time Availability Engine
**Problem**: All 5 partner hotels show "From $X" but **zero live availability**. User sends dates → manual WhatsApp reply (hours/days). At 2am, zero response.
**Fix**: 
- Short-term: Integrate partner PMS/Channel Manager APIs (Cloudbeds, Siteminder, ResNexus) → `src/lib/api/availability.js` returns real-time rooms/rates.
- Medium-term: Build cached availability index (Cloudflare KV, 5-min TTL) for instant "Check dates" modal.
- **Owner action**: Request API credentials from all 5 partners. Without this, "24/7 sales" is marketing fiction.

## Blocker 2: WhatsApp-Only Booking Funnel
**Problem**: 100% of conversions route through WhatsApp (`+255 672 450 934`). No web form, no email confirmation, no payment link, no automated follow-up.
**Fix**:
- Add Stripe Payment Links per package (already in `catalogue.js` pricing) → "Pay 20% deposit now" button.
- `review-capture.js` already posts to `/api/review-capture` — extend to create booking record in KV.
- Automated WhatsApp Business API template messages for: inquiry received, quote sent, deposit paid, voucher issued.
- **Owner action**: Apply for WhatsApp Business API (Meta verification) + Stripe account (TZ-supported via Paystack/Flutterwave bridge).

## Blocker 3: No Multi-Currency / Local Payment Methods
**Problem**: Prices in USD only. Tanzanian guests pay in TZS via M-Pesa/Tigo Pesa/Airtel Money. International guests want EUR/GBP/Card.
**Fix**:
- `i18n-currency.js` already detects locale — add `Intl.NumberFormat` for TZS, EUR, GBP with daily FX rate (free API: exchangerate.host).
- Integrate **Paystack** (NG/GH/KE/TZ) or **Flutterwave** for M-Pesa/Card/Apple Pay.
- Show local currency *and* USD on partner pages.

## Blocker 4: Concierge Bot Has No Sales Skills
**Problem**: Island Concierge answers FAQs but **cannot close a sale** — no "Book now", no upsell, no cart, no commission tracking.
**Fix**:
- Extend `src/lib/api/chat.js` with `intent: "book"` → calls `availability` → returns deep-link to booking modal with pre-filled dates/hotel.
- Add `intent: "upsell"` → "Add Mnemba snorkeling to your Stone Town stay?" with package pricing.
- Track `conversation_id` → `booking_id` in KV for attribution.

## Blocker 5: Zero Retargeting / Abandoned Inquiry Recovery
**Problem**: User checks rates → leaves → never contacted again.
**Fix**:
- Cloudflare KV stores `session_id` + `hotel_slug` + `dates` + `phone` (if entered).
- Daily cron (`functions/api/cron-recovery.js`) → WhatsApp template: "Still thinking about [Hotel] for [dates]? Here's your quote: $X. Reply YES to book."
- Meta Pixel + GA4 events for `booking_modal_opened`, `whatsapp_clicked`, `deposit_started`.

## Blocker 6: Partner Hotels Not Equipped for Direct Digital Bookings
**Problem**: 5 hotels manage bookings via email/phone/OTA extranet. No direct booking engine on their sites.
**Fix**:
- Provide each partner a **white-label booking widget** (iframe from spiceandsail.com) they embed on their site.
- Widget uses same availability API → feeds Spice and Sail CRM.
- **Owner action**: Pitch as "Your direct booking channel, powered by us — 0% commission on direct."

## Blocker 7: No SLA on Response Time
**Problem**: WhatsApp replies within "business hours" (unstated). 24/7 claim is false.
**Fix**:
- Publish SLA: "Quote within 15 minutes 06:00–22:00 EAT; next morning outside hours."
- Auto-reply bot outside hours: "We've received your dates. Our team confirms rates by 08:00 EAT. For urgent: +255 655 830 226."
- Track `first_response_time` in KV; alert if >30 min during SLA hours.

## Priority Order (Impact × Effort)
| Blocker | Impact | Effort | Owner Dependency |
|---------|--------|--------|------------------|
| 1. Live Availability | Critical | High | **Partner API creds** |
| 2. Payment Links | Critical | Medium | Stripe/Paystack account |
| 3. Multi-Currency | High | Low | FX API (free) |
| 4. Bot Sales Skills | High | Medium | Dev time |
| 5. Abandoned Recovery | Medium | Low | Cron + KV |
| 6. Partner Widget | Medium | High | Partner buy-in |
| 7. Response SLA | Medium | Low | Staffing / bot |

## 30-Day Sprint to Unblock 1 & 2
1. Week 1: Email all 5 partners requesting PMS API access + Stripe/Paystack onboarding.
2. Week 2: Build `availability.js` mock + Stripe Payment Link generator per package.
3. Week 3: Integrate into booking modal (`data-sns-booking-open` → availability → payment link).
4. Week 4: Test end-to-end: search → dates → availability → deposit → WhatsApp confirmation.
