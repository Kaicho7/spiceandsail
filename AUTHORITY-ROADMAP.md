# 90% Authority Roadmap — Spice and Sail Zanzibar

**Goal**: Reach Domain Rating (Ahrefs) ≥ 60 / Domain Authority (Moz) ≥ 50 / Trust Flow ≥ 40 within 12 months. "90% authority" = top 10% of Zanzibar tourism sites.

## Current Baseline (Audit 2026-11-22)
- DR: ~28 | DA: ~32 | Referring domains: ~340 | Organic keywords: ~1,200
- Top competitors: africanbudgetsafaris.com (DR 68), africanmeccasafaris.com (DR 62), zanzibartravel.net (DR 45)
- Content gap: 400+ high-intent keywords uncovered (UberSuggest export in vault)

## Phase 1 (Months 1-3): Technical & Content Foundation ✅ MOSTLY DONE
- [x] Noindex 193 thin hotel pages; sitemap 164 URLs (5 indexable partners + attractions + core)
- [x] 5 partner hotels: unique research-backed content, Hotel+FAQPage schema, rates, booking CTAs
- [x] 50 attraction pages with TouristAttraction+FAQPage schema
- [x] Hreflang integrity (en/it/de/fr/pl + x-default)
- [x] Core Web Vitals: LCP <2.5s, CLS <0.1, INP <200ms (verify via CrUX)
- [x] Cloudflare Pages + KV for concierge (no Netlify cold starts)
- [ ] **Remaining**: Submit updated sitemap to GSC; request indexing for 5 partner pages + attractions index

## Phase 2 (Months 3-6): Topical Authority via Content Clusters
**Cluster 1: Zanzibar Hotel Direct Booking (Target: 5 partner hotels)**
- Create "Hotel Direct Booking Guide" pillar page (3000+ words) linking to 5 partner detail pages
- Each partner gets: rate comparison table (OTA vs direct), WhatsApp booking flow screenshots, transfer bundling calculator
- FAQ schema on every partner page (already done) — expand to 10+ questions each

**Cluster 2: Zanzibar Transfers & Logistics**
- "Airport Transfer Guide" (already exists — expand with live fare API)
- "Stone Town Ferry + Hotel Transfer" combo pages
- "Pemba Island Logistics" (airport/ferry + hotel pickup)

**Cluster 3: Zanzibar Excursions & Tours**
- 18 tour detail pages → expand to 30 with booking panels
- "Safari from Zanzibar" hub (Mikumi, Nyerere, Serengeti fly-ins)
- "Mnemba Atoll Snorkeling" + "Dolphin Tour Kizimkazi" comparison

**Cluster 4: Zanzibar Travel Planning**
- "3/5/7 Day Itineraries" with hotel + tour + transfer bundles
- "Best Time to Visit" by region (Nungwi vs Paje vs Stone Town)
- "Visa, Health, Currency" practical guides

**Content velocity**: 2 pillar pages + 4 supporting articles/month. All with:
- Unique photos from vault (85+ on-ground images)
- Schema: Article, FAQPage, ItemList, BreadcrumbList
- Internal links to 5 partner hotel pages + transfer calculator

## Phase 3 (Months 6-9): Link Building & Digital PR
- **Data-driven PR**: "Zanzibar Hotel Price Index 2025" (using hotelPublicRates.json + competitor scrape)
- **Partner co-marketing**: 5 hotels share "Book Direct" landing page → their sites link back
- **Travel journalist outreach**: Vault has 1300+ backlink targets (Moz export) — pitch unique data
- **Local citations**: ZCT, ZATI, Zanzibar Tourism Board, hotel association directories
- **Guest post targets**: Top 50 travel blogs from UberSuggest competitor gap

## Phase 4 (Months 9-12): Conversion Rate Optimisation
- A/B test: WhatsApp CTA vs booking modal vs "Check Rates" form
- Heatmaps on partner hotel pages (Hotjar/Clarity)
- Multi-step funnel: landing → hotel detail → booking modal → WhatsApp confirmation
- Target: 3% hotel detail → WhatsApp click; 15% WhatsApp → confirmed booking

## KPIs (Monthly Tracking)
| Metric | Baseline | Month 3 | Month 6 | Month 12 |
|--------|----------|---------|---------|----------|
| DR / DA | 28 / 32 | 35 / 38 | 45 / 45 | 60 / 50 |
| Referring domains | 340 | 400 | 550 | 800 |
| Organic keywords (top 100) | 1,200 | 2,000 | 3,500 | 5,000 |
| Partner hotel organic clicks | ~50/mo | 200 | 500 | 1,200 |
| WhatsApp inquiries from organic | ~10/mo | 50 | 150 | 400 |
| Confirmed bookings (5 hotels) | 0 | 5 | 20 | 60 |

## Risks & Mitigations
- **ZCT licence number delayed** → Display "Registered with ZCT" without number; update when received.
- **Partner hotel rate changes** → Quarterly sync via `rates:sync:apply` script.
- **Algorithm updates** → Diversify: 40% informational, 30% commercial, 20% navigational, 10% transactional.
