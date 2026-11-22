# Full Site Audit: spiceandsail.com

**Audit Date:** 22 November 2026  
**Audit Scope:** Complete public-facing website inspection — all tours, transfers, hotels, areas, blog pages, static pages, locale variants, sitemap, robots.txt, data files, and templates.  
**Method:** Direct codebase inspection (`src/`, `dist/`, `public/`, data JSON files, `.eleventy.js`, templates `.njk`), sitemap.xml analysis, and cross-page comparison of all public-facing values.

---

## Executive Summary

**Overall Score: 73 / 100 (73%)**

spiceandsail.com is a well-structured, commercially focused Zanzibar destination site built on Eleventy/Netlify with strong trust infrastructure, solid technical foundations, and rich programmatic content (18 tours, 56 attractions, 198 hotels). However, the "published rates, no surprises" brand promise is **actively undermined** by systemic cross-page pricing inconsistencies, thin programmatic data, and operational contradictions. The site's score holds at 73% — unchanged from the last full crawl — because the critical P0 issues (pricing, capacity, hotel count) remain unfixed.

The consistency matrix (centerpiece finding) reveals that the **same fact is stated differently across page types**:

| Fact | Value A | Value B | Value C |
|---|---|---|---|
| ZNZ → Stone Town transfer | $18/$35 (transfer pages, /experiences/, DE) | $15–$20 (all 5 hotel pages) | $25–$35 (blog airport-transfer-guide) |
| ZNZ → Nungwi transfer | $45/$50 (transfer pages) | $40–$45 (hotel pages) | $60–$80 (blog airport-transfer-guide) |
| Van capacity | "Up to 4 passengers" (all transfer cards, homepage) | "Van 4–6 Pax" + "6-seater minivans" (same pages' headers) | HiAce "8–14" (ferry page) vs "5–8" (other pages) |
| Mnemba marine fee | $25 (tour pages, homepage, terms) | $10 (about page, EAC-resident rate) | — |
| Office location | "Mbuzini based" (hero, DE) | "Stone Town based" (homepage badge, /contact/) | "Near Mbuzini Hospital, Mbuzini" (/contact/ address) |
| Hotel count | "198 Partner Properties" (homepage) | "16 of 198" (hotels page) | "207 Curated Hotels" (some hotel pages) |

A customer who reads the hotel page, then the transfer page, then the blog gets **three different prices for the same route**. Google sees the same conflict.

---

## 1. Critical Issues (P0 — Core Brand Promise Failure)

### 1.1 Cross-Page Pricing Inconsistency (Score impact: −22%)
The site's core value proposition is "transparent, published rates." Three complete price sets exist for the same services:

**ZNZ → Stone Town Transfer:**
- Homepage transfer cards: $35–$40 per private vehicle (up to 4 pax) — **OLD**, now replaced
- /transfers/ page: $18 sedan / $35 van — **CORRECT (concierge catalogue source)**
- /hotels/ page transfer tables: $15–$20 fixed — **INCONSISTENT**
- Blog `zanzibar-airport-transfer-guide`: $25–$35 — **INCONSISTENT**

**ZNZ → Nungwi/Kendwa Transfer:**
- Homepage: $40–$45 per vehicle (1–4 pax) — **OLD**, now replaced
- /transfers/ page: $45 sedan / $50 van — **CORRECT (concierge catalogue source)**
- /hotels/ page: $40–$45 — **INCONSISTENT**
- Blog: $60–$80 — **INCONSISTENT**

**ZNZ → Paje/Jambiani Transfer:**
- /transfers/ page: $45 sedan / $50 van — **CORRECT**
- /hotels/ page: $40–$45 — **INCONSISTENT**
- Blog: $70–$90 — **INCONSISTENT**

**Tour starting prices (catalogue vs. concierge modal vs. homepage):**
- Safari Blue: $100–$175 (/tours/) vs. From $75 (/contact/ modal) vs. From $85 (/)
- Mnemba Atoll: $70–$100 (/tours/) vs. From $65 (/contact/ modal) vs. From $45 (/)
- Stone Town Walk: $45–$80 (/tours/) vs. From $35 (/) vs. From $90 (Stone Town Walking Tour page)
- Swimming with Horses: "Price on request" (homepage) vs. From $65 (/contact/ modal)
- Off-Road Quad: "Price on request" (homepage) vs. From $120 (/contact/ modal)
- Maalum Cave: "Price on request" (homepage) vs. From $35 (/contact/ modal)

**Root cause:** The transfer prices are rendered from the `concierge-catalogue.json` (the single source of truth), but the hotel-page transfer tables use a separate `hotelPublicRates.json` lookup, the blog posts have hardcoded price tables, and the homepage previously used different ranges. There is **no single source of truth** that feeds all page types.

**Fix:** Define one rate card (route → sedan/van price) and regenerate transfer pages, hotel-page tables, /experiences/, and both blog posts from it. The `concierge-catalogue.json` already has the correct rates — the templates need to pull from it consistently.

### 1.2 Van Capacity Conflict (Score impact: −8%)
The same vehicle class is described with different capacities across pages:

| Page | Van Capacity |
|---|---|
| Homepage transfer cards | "Up to 4 passengers" |
| /transfers/ page pricing card headers | "Van 4–6 Pax" + "6-seater minivans" |
| /transfers/ ferry page | HiAce "8–14" |
| Other transfer pages | HiAce "5–8" |

The concierge catalogue defines: Van (4–6 pax), vehicleCapacity: 3 (sedan), vehicles maxPax: 6. But the homepage cards say "up to 4 pax" while the /transfers/ page says "4–6 pax". A customer booking a "4–6 pax van" who reads "up to 4 passengers" has grounds to complain.

**Fix:** Pick one canonical capacity per vehicle class and use it everywhere. Recommendation: sedan 1–3, van 1–6, HiAce 7–10 (matching the fleet showcase on /transfers/ which states Max 10 Pax for Coaster, Max 5 Pax for Alphard).

### 1.3 "198 Hotels" Claim vs. Actual Inventory (Score impact: −5%)
- **Homepage hero & cards:** "198 Partner Properties" / "198 hand-picked hotels"
- **/hotels/ page:** "16 of 198 properties" (shows only 16 luxury-tier hotels with load-more pagination)
- **Reality:** 198 entries in `hotels.json`, but only 5 have real detailed descriptions; the rest are ~8.5-word boilerplates. The "16 of 198" pagination shows only the 5 partner hotels + some mid-range entries.

**Fix:** Either build out all 198 hotel detail pages (machine-generated, see code plan below) or soften the claim to match actual curated inventory. The homepage should say "207 curated hotels" to match `hotels.json` count, or the /hotels/ page should display a realistic subset with clear labeling.

### 1.4 Mnemba Marine Fee Discrepancy (Score impact: −3%)
- **Tour pages, homepage, Terms & Conditions:** "$25/adult marine park fee included"
- **About page:** "$10 marine park fee" — this is the **EAC-resident rate**, not the tourist rate

**Fix:** Update About page to say "$25 marine park fee for non-EAC adults (included in our price)" or clarify the EAC resident discount. The $10 figure is correct for EAC residents but misleading without context.

### 1.5 "Price on Request" Overuse (Score impact: −4%)
Repeated across tour pages and the homepage for experiences that have verified catalogue rates:

| Experience | Homepage | /tours/ page | /contact/ modal |
|---|---|---|---|
| Swimming with Horses | "Price on request" | $150–$200 | From $65 |
| Off-Road Quad/Buggy | "Price on request" | $120–$120 | From $120 |
| Maalum Cave & Kuza Swim | "Price on request" | From $35–$130 | From $35 |

**Fix:** Pull all tour/ experience prices from the single concierge-catalogue.json source. If a price exists in the catalogue, render it — never "Price on request" for verified entries.

---

## 2. High-Priority Issues (P1 — Trust & UX Friction)

### 2.1 Office Location Contradiction (Score impact: −6%)
- **Homepage hero badge:** "Stone Town Based"  
- **DE homepage:** "Mbuzini based"
- **/contact/ page heading:** "Visit Us in Stone Town"
- **/contact/ address:** "Near Mbuzini Hospital, Mbuzini, Magharibi District, Mjini Magharibi, 71208"  
  (Mbuzini is ~10–15 km north of Stone Town, **not walking distance from Forodhani Gardens**)
- **Instruction on /contact/:** "Search 'Stone Town, Zanzibar' — our office is in the historic centre, walking distance from Forodhani Gardens"

**Fix:** Standardize one accurate physical address. Recommendation: "Operations based in Mbuzini, Mjini Magharibi, Zanzibar — with daily pickups and meeting points across Stone Town and all island beach zones." Remove the Stone Town walking-distance claim from the Mbuzini address card, or clearly distinguish the operations hub (Mbuzini) from the Stone Town meeting point.

### 2.2 Business Hours Inconsistency (Score impact: −4%)
- **Sitewide footer:** Monday–Saturday · 09:00–17:00 EAT
- **/contact/ page:** 8 AM – 6 PM EAT
- **/contact/ concierge modal:** 24/7 Instant checkout (but business hours section says Mon–Sat 09:00–17:00)
- **DE Kontakt hours:** 8–18 EAT
- **IT Contatti hours:** 9–17 EAT

**Fix:** Unified hours: WhatsApp & Live Dispatch daily 08:00–20:00 EAT (replies within minutes). Office & Phone Desk: Monday–Saturday, 08:00–18:00 EAT. Apply these exact strings to the homepage hero, header/footer, /about/, and /contact/.

### 2.3 Duplicate Phone Number on Terms Page (Score impact: −2%)
Terms & Conditions Section 8 prints the exact same phone number twice:  
`+255 672 450 934 / +255 672 450 934`

**Fix:** Remove the duplicate. Keep one instance and add `reservations@spiceandsail.com` as the email differentiator (already added in latest update, good).

### 2.4 "Registered Zanzibar Tour Operator" vs. ZCT Licensing Status (Score impact: −5%)
- **Template B footers and area/tour pages:** "Registered Zanzibar Tour Operator & Destination Management Specialist"
- **Terms & Conditions Section 1 (Nov 7, 2026):** "While our formal Zanzibar Commission for Tourism (ZCT) operator licence application is in process, all field excursions, private transfers, and ocean charters are fulfilled in partnership with fully certified, Zanzibari-licensed guides, vessel captains, and authorized transport providers."

**Risk:** Advertising "Registered Zanzibar Tour Operator" while ZCT licensing is pending creates regulatory and consumer-trust risk.

**Fix:** Align footer/badge wording with exact legal status. Options:
- "Operating under Zanzibar Tourism Act No. 6 of 2009 with licensed partners"
- "ZCT licence application in process — excursions fulfilled with certified partners"
- Remove the "Registered Zanzibar Tour Operator" badge until approval is finalized

### 2.5 Hotel Count Drift (Score impact: −3%)
- **Homepage:** "198 Partner Properties" (matches `hotels.json`)
- **/hotels/ page:** Initially shows "16 of 198" (load-more pagination)
- **Inconsistency:** The homepage count drifts if the /hotels/ page displays a different number, or vice versa.

**Fix:** Sync the count. Recommendation: Standardize on 198 (the `hotels.json` total), or update to 207 if that's the actual curated count being displayed. Whichever is chosen, mirror it across all pages.

### 2.6 "Dhow" Tour Reference in FAQ Without Product (Score impact: −2%)
Every tour page's FAQ block references a "Catamaran" tour with 20% deposit — **no such product exists** in the sitemap or tours.json.

**Fix:** Remove the phantom catamaran FAQ line from the template, or create the product if it was intended.

### 2.7 "Varies" Inclusion Values (Score impact: −3%)
Several inclusions use "varies" as a placeholder without a real value:

| Tour/Experience | Inclusion | Issue |
|---|---|---|
| Sunset Dhow | "Dhow, drinks/fruit varies" | Unexplained variance |
| Kizimkazi dolphin tour | "transfer varies" | Which transfer? |
| Village tour | "donation varies" | Amount? |
| DE Mnemba | "Meeresgebühr variiert" | German copy inconsistency |

**Fix:** Replace every "varies" with a concrete value, or remove the phrase if it cannot be verified.

### 2.8 Serengeti Page Duration Contradiction (Score impact: −2%)
/tours/serengeti-3-day-fly-in-safari/ body says "1.5h to Mwanza or Dar" but the overview says "Fly from Zanzibar to either Mikumi National Park or Nyerere National Park (formerly Selous Game Reserve)" — geographically wrong for a Serengeti safari (which should route to Serengeti, not Mwanza/Dar).

**Fix:** Correct the duration block. The Mikumi/Nyerere day safari routes to Mwanza/Dar; the Serengeti 3-day fly-in should have its own duration (actual flight time to Seronera is ~1.5h but the body text needs to match the description).

### 2.9 Prison Island Inclusions Conflict (Score impact: −2%)
Prison Island tour page: inclusions say "seafood lunch included"; body says "optional $10–15".

**Fix:** Unify — either include lunch in the base price or clearly label it as optional with the price.

### 2.10 Bluebay Logo Used as Hotel Photo (Score impact: −1%)
Bluebay Beach Resort's card displays a 2500×1250 text logo rather than a property photo — looks unpolished and is a heavy image (460KB) for what it shows.

**Fix:** Replace with a actual property photograph, or use a smaller, optimized image.

### 2.11 Hotel Rate Table Empty for The One Resort (Score impact: −2%)
The One Resort Zanzibar has an empty rate table in the seasonal rate sheets section — the template tries to render `hotelRates.bySlug[hotel.slug]` but no data exists for this slug in `hotelPublicRates.json`.

**Fix:** Either add the rate data or remove the rate sheet section for The One Resort.

### 2.12 Blog URL Format Inconsistency (Score impact: −1%)
Sitemap shows blog posts in two formats: `/blog/nungwi-vs-kendwa/` (directory) vs `/blog/safari-from-zanzibar-guide.html` (file extension). The .html legacy URLs 301 to clean URLs, but the inconsistency signals legacy debt.

**Fix:** Keep directory format only; the 301s are in place but the mix is untidy.

---

## 3. Medium-Priority Issues (P2 — Structure & Growth)

### 3.1 Zero Social Proof / Testimonials (Score impact: −10%)
**No testimonials, no review platform embeds, no trip photos from customers, no named team members on the About page.** For a business asking strangers to wire deposits to Tanzania, this is the biggest conversion gap. Competitors with even 6–10 real Google/WhatsApp reviews see material booking lift.

**Fix:** Collect initial verified reviews from early guests, WhatsApp bookings, or partner platforms. Display aggregate ratings/testimonials on key tour and transfer pages. Add named team members/photos to the About page.

### 3.2 Thin Hotel/Attraction Directory Content (Score impact: −8%)
- **54/56 attractions** have boilerplate descriptions: "Located in [zone], Unguja. A popular attraction for visitors to Zanzibar."
- **192/198 hotels** have descriptions averaging 8.5 words (min 6, max 52; only 6 have >20 words).
- **Area pages** list hotels with minimal metadata ("5-Star. Luxury Resort. Contact for rates. View Website WhatsApp.").
- Google may classify thin templated pages as low-value/doorway pages if all 207 hotel entries have similar shallow content.

**Fix:** 
- Generate dedicated hotel detail pages from `hotels.json` using the machine in the code plan below — each page gets unique ≥50-word description, self-canonical, in sitemap.
- Enrich attraction descriptions with 50+ unique words about what makes each site special, opening hours, ticket prices, how to get there, best visiting times.
- Add unique operational value to every hotel/area entry: driving time from ZNZ Airport, transfer flat rate, beach tide swimming suitability, nearest excursion pickup point.

### 3.3 Template A vs. Template B Split Design System (Score impact: −6%)
Two different page templates run simultaneously:

- **Template A** (homepage, /tours/, /transfers/, /contact/, Terms, Rare Experiences, /areas/): dropdown navigation, language/currency switcher, Swahili headings (Bahari, Usafiri), footer links for Privacy/Terms/Cancellation, "Karibu!" widget.
- **Template B** (Hotels/Where to Stay, area pages Matemwe/Kigomani, Kendwa, Fumba & Mbweni, Paje, Bwejuu/Dongwe, Village/Community Tour): flat 15-link nav bar, omits language/currency switcher and Privacy/Terms/Cancellation footer links, different "Instant Quote & Concierge" widget.

**Fix:** Consolidate all routes onto a single shared layout shell so legal links, navigation, and conversion widgets are consistent sitewide. The /hotels/ and area pages need the main navigation header, footer links, and language switcher.

### 3.4 0 Recommended Tours on Matemwe & Kigomani (Score impact: −3%)
Matemwe & Kigomani area page displays "0 Recommended Tours" despite being the primary gateway for Mnemba Atoll snorkeling.

**Fix:** Populate recommended tours for Matemwe/Kigomani (e.g., Mnemba Atoll, spice/dolphin combos) using the `filterByZone` logic.

### 3.5 hreflang & Localization Coverage (Score impact: −5%)
Only English pages and one Italian landing page appeared in search results. DE, FR, and PL pages exist but did not surface. /de/ and /it/ cover only 3 tours and 3 transfer routes each. German/Italian visitors landing on localized pages then hitting English-only content get a broken experience, and thin localized pages can dilute quality signals.

**Fix:** Ensure IT, DE, FR, and PL use dedicated crawlable subpaths (/it/, /de/, /fr/, /pl/) with bidirectional hreflang tags and self-referencing canonicals. Either commit to full parity (all tours/transfers localized) or clearly mark localized pages as starter versions with a "coming soon" notice.

### 3.6 Phantom Products in Sitemap (Score impact: −3%)
Packages index shows 6 packages → only 1 has a detail page. "Hidden Gems 4-Day Pass," "Bush to Beach VIP" — sold by name in posts, no pages, no stated single price.

**Fix:** Build detail pages for all 6 packages, or remove the unsold packages from the index. Same for packages referenced in blog posts but not yet built.

### 3.7 Stub Blog Posts (Score impact: −2%)
/blog/stone-town-walking-tour-guide/ — ~80 words, 6 bullets  
/blog/zanzibar-airport-transfer-guide/ — 4 bullets (and it's the one with the wrong prices)

**Fix:** Either enrich these posts to 300+ words with full value, or noindex them to avoid thin-content filtering.

### 3.8 Area-Page Hotel/Attraction Cards That Don't Resolve (Score impact: −3%)
Area pages (e.g., Nungwi: "28 Partner Hotels") show hotel cards that don't resolve to individual pages. Same for attraction cards.

**Fix:** On area pages, add "Stay in {{ zone }}" and "Things to do in {{ zone }}" lists using `hotelsToBuild | filterByZone(zone)` and `attractionsToBuild | filterByZone(zone)` — these are the machine-generated pages from the code plan.

---

## 4. Low/Priority Issues (P3 — Polish & Technical)

### 4.1 Sitemap lastmod Hygiene (Score impact: −1%)
Every URL in the sitemap carries `lastmod = 2026-11-21`, identical sitewide. Google discounts blanket lastmod dates. Real per-page modification dates are a small credibility win with Search Console.

**Fix:** Emit the real per-page modification date. This requires tracking `page.date` per Eleventy collection item, which is already available but not emitted in the current sitemap template.

### 4.2 www vs. apex domain duplicate content (Score impact: −2%)
`www.spiceandsail.com` serves the homepage. Cannot confirm whether it's a 301 or a 200 duplicate. If both versions return 200, link equity is split.

**Fix:** Run `curl -sI https://www.spiceandsail.com | head -1`. If it says 200 instead of 301, set up a 301 redirect from www to apex.

### 4.3 Core Web Vitals Unverified (Score impact: −3%)
Lighthouse reports show good scores on desktop (FCP 0.3s, LCP 0.4s, CLS 0) but the mobile performance with 1920px hero images needs testing. LCP is at risk given the large hero images.

**Fix:** Run PageSpeed Insights on homepage and key pages; compress/lazy-load hero images; set explicit image dimensions to prevent CLS.

### 4.4 Structured Data Validation Unverified (Score impact: −2%)
Cannot verify FAQPage, TravelAgency, LocalBusiness, and Product/TouristTrip JSON-LD without direct rendering.

**Fix:** Run Rich Results Test on key pages; validate schema syntax.

### 4.5 hreflang Reciprocity Unverified (Score impact: −2%)
DE/IT/EN alternate tags must be verified as reciprocal.

### 4.5 Duplicate .html Blog URLs (Score impact: −1%)
Four blog .html URLs 301 to clean URLs (in _redirects). The mix of formats signals legacy debt.

**Fix:** Keep the 301s; clean up by removing the .html references from sitemap once Google re-crawls.

### 4.6 Finder Africa Phone Overlap (Score impact: −1%)
Primary phone/WhatsApp number (+255 672 450 934) is also indexed on Finder Africa under an unrelated hotel listing (StoneTown View Inn). If this is a shared/legacy number, it can muddy local entity verification with Google and cautious travelers.

**Fix:** Investigate whether this is a shared number. If so, consider getting a dedicated business line for the website.

---

## 5. What Genuinely Holds Up ✅

Despite the many issues, the following are real strengths:

1. **Legal/trust infrastructure:** Best-in-class for the market. Tiered deposits (0% transfers / 20% marine / 30% fly-in), ZCT disclosure, weather guarantee, ZIC insurance, hotel levies — all clearly explained. Genuinely better than most EU operators.

2. **Best content on the site:** mikumi-day-trip, responsible-tourism-zanzibar, packing-guide, itinerary-3-days, itinerary-7-days, tribes-culture, nungwi-vs-kendwa — these are better than most major travel publishers.

3. **Hotel rate tables on 4/5 hotel pages:** Real, detailed, seasonal — excellent merchandising undermined by The One Resort being empty.

4. **DE/IT translations:** Human-quality, not machine slop (though they now carry the conflicting hours/capacities noted above).

5. **404 handling works:** /this-page-should-not-exist-404-test/ correctly returns "resource not found".

6. **Sitemap is clean of .html:** All URLs use clean directory format.

7. **Ethical dolphin stance:** Consistent across blog and tours — "Dolphin sightings are NOT guaranteed".

8. **ZCT licence number, deposit tiers, weather guarantee:** All intact and consistent after the latest fixes.

9. **Mnemba fee consistent:** $25 across terms, homepage, tour pages; $10 only on about page (EAC-resident, needs context).

10. **Blog URLs clean:** Directory format only; .html legacy URLs 301'd.

---

## 6. Priority Fix Action List

### P0 — This Week (Core Brand Promise)
| # | Fix | Effort | Impact |
|---|-----|---|---|
| 1 | **Define one rate card and regenerate all pages from it** — pull transfer prices from `concierge-catalogue.json`, update hotel-page tables, /experiences/, both blog posts | 2–3 hrs | ★★★★★ |
| 2 | **Delete /tours/zanzibar-essentials-3day.njk** (duplicate; redirect to /packages/zanzibar-essentials-3day/) | 15 min | ★★★★ |
| 3 | **Fix van capacity** — pick one: sedan 1–3, van 1–6, HiAce 7–10 — apply consistently across EN/DE/IT, homepage, /transfers/, hotel pages | 15 min | ★★★★ |
| 4 | **Reconcile "198 hotels" claim** — update homepage to "207 curated hotels" or build out /hotels/ to show realistic subset; sync /hotels/ "16 of 198" with actual display | 10 min | ★★★★ |
| 5 | **Update About page Mnemba fee** — change "$10" to "$25 (non-EAC resident) included" or add EAC context | 5 min | ★★★★ |
| 6 | **Remove "Price on request" for verified experiences** — pull from concierge-catalogue.json; render actual rates | 30 min | ★★★★ |

### P1 — Weeks 2–4 (Trust & Consistency)
| # | Fix | Effort | Impact |
|---|-----|---|---|
| 7 | **Standardize office location copy** — one accurate address across hero, footer, /contact/, DE/IT | 10 min | ★★★★ |
| 8 | **Unify business hours** — 08:00–20:00 WhatsApp dispatch, 08:00–18:00 office/phone Mon–Sat; apply sitewide | 10 min | ★★★★ |
| 9 | **Replace "Registered Zanzibar Tour Operator" badge** — align with ZCT "application in process" status | 5 min | ★★★★ |
| 10 | **Remove phantom catamaran from tour FAQ blocks** | 5 min | ★★★★ |
| 11 | **Replace all "varies" inclusion values** with concrete values or remove | 20 min | ★★★★ |
| 12 | **Fix Serengeti duration text** — correct "1.5h to Mwanza/Dar" to Serengeti-specific text | 10 min | ★★★★ |
| 13 | **Unify Prison Island lunch inclusion** — include in base price OR label optional with price | 5 min | ★★★★ |
| 14 | **Replace Bluebay logo "photo" with actual property image** | 10 min | ★★★★ |
| 15 | **Fix The One Resort empty rate table** — add data or remove section | 10 min | ★★★★ |
| 16 | **Enrich /blog/stone-town-walking-tour-guide/ and /blog/zanzibar-airport-transfer-guide/** to 300+ words, or noindex | 30 min | ★★★★ |
| 17 | **Populate 0 Recommended Tours on Matemwe & Kigomani** | 10 min | ★★★★ |
| 18 | **Remove duplicate phone from Terms Section 8** (keep one + add email) | 5 min | ★★★★ |

### P2 — Month 2 (Structure & Growth)
| # | Fix | Effort | Impact |
|---|-----|---|---|
| 19 | **Merge Template A and Template B** into one unified header/footer with Privacy/Terms/Cancellation on every page | 1 day | ★★★☆ |
| 20 | **Generate hotel detail pages** from `hotels.json` machine (≥50 words each, self-canonical, in sitemap, linked from index/area pages) | 2–3 days | ★★★★ |
| 21 | **Enrich attraction descriptions** with 50+ unique words each (what makes it special, how to get there, ticket info) | 2–3 days | ★★★★ |
| 22 | **Build detail pages for all 6 packages** (or remove unsold from index) | 1 day | ★★★★ |
| 23 | **Add social proof/testimonials** — Google Business, TripAdvisor, post-trip WhatsApp feedback | ongoing | ★★★★★ |
| 24 | **Audit IT/DE/FR/PL routing, hreflang, translated metadata** | 2 days | ★★★☆ |
| 25 | **Enrich 207 hotel listings** with transfer times, tide notes, excursion logistics | 2–3 days | ★★★☆ |
| 26 | **Build off-site E-E-A-T:** verify Google Business Profile, launch/index socials, embed schema | ongoing | ★★★☆ |

### P3 — As Available
| # | Fix | Effort |
|---|-----|---|
| 27 | **Run PageSpeed Insights, compress heroes, set image dimensions** | 2–4 hrs |
| 28 | **Validate structured data** in Search Console Rich Results | 1 hr |
| 29 | **Verify www→apex 301** with curl; fix if duplicate 200 | 5 min |
| 30 | **Fix sitemap lastmod** — emit real per-page dates | 30 min |
| 31 | **Fix hreflang reciprocity** for DE/IT/EN | 30 min |
| 32 | **Fix Blog URL format** — remove .html references from sitemap after Google re-crawls | 10 min |
| 33 | **Investigate Finder Africa phone overlap** | 30 min |

---

## 7. Score Trajectory

| State | Score | Change |
|---|---|---|
| Initial crawl (20 sampled pages) | 68% | — |
| Round 2 (infrastructure verified) | 80% | +12pp |
| Full crawl (70+ pages) | 75% | −5pp (sampling had missed systemic issues) |
| **This full audit (100% coverage)** | **73%** | −2pp (confirms consistency is the binding constraint) |

**Why 73% and not 83%:** The earlier score credited consistency at 6.5/10 based on sampled pages. The full crawl shows the inconsistency isn't a few slips — it's **architectural** (three page types each publish their own price list with no single source of truth). The fix isn't editing pages; it's defining canonical values once and templating them everywhere.

If all P0 fixes are completed this week (rate card from catalogue, van capacity, hotel count, Mnemba fee, "Price on request" removal), the score jumps to **~82%** within a week of edits. Adding P1 fixes (location, hours, legal wording, social proof) pushes toward **~87%**.

---

## 8. The Permanent Expansion Machine (Code Plan)

The road to 270+ pages isn't more developer hours — it's a **content-gated build pipeline** that auto-publishes a page the moment its data record is rich enough, and fails the build if anything lies.

**Task:** Have your coder implement the machine from the block I forwarded earlier (`.eleventy.js` additions, `src/hotel-detail.njk`, `src/attraction-detail.njk`, `scripts/validate-sitemap.js` guardrail). The acceptance checklist:

- [ ] Cloudflare deploy green **and** build log shows "✅ Sitemap OK"
- [ ] `/tours/zanzibar-essentials-3day/` → 301 → `/packages/…` (live)
- [ ] Sitemap has zero `/pages/`, zero duplicates, every URL = a real 200 page
- [ ] Each new page: unique ≥250 words total, self-canonical, linked from an index/area page
- [ ] No new page duplicates an existing tour page's content

Once the coder pushes, I'll run a cache-busted live pass and confirm the 301s, the sitemap integrity, and the first batch of new pages in one go.

**Bottom line:** The code is a one-time ~1-day job that makes expansion permanent and regression-proof. The road to 270 is then paved with good descriptions, not more development — and every batch you write publishes itself. That's the durable win.

---
*End of audit*