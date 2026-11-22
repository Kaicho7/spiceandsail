# Full Site Audit — spiceandsail.com

**Audit date:** 22 November 2026
**Scope:** Live production site (Cloudflare) + local source at `/home/efatha/spiceandsail` (Eleventy 2).
**Method:** 355-URL sitemap crawl, per-page HTML/JSON-LD/hreflang parsing, live HTTP/header/TLS/API probes, source inspection, `npm run build`, `npm test`, `npm audit`.
**Limitations:** Lighthouse/Core Web Vitals lab run could not be installed (npm registry socket timeout), so no field or lab CWV score. No visual/pixel review was performed. The ZCT licence claim was not independently verified with the authority.

---

## Executive summary

**Overall: 58 / 100.** Strong technical foundations and security, but ~70% of the site's pages are unbranded and the technical SEO layer is internally contradictory.

The site has **355 URLs in the sitemap and all 355 return HTTP 200**, with self-referencing canonicals, unique titles/descriptions, one H1 per page, and complete image alt/dimension coverage. Security headers, TLS, CORS, and the API are in good shape. The build passes and the image-integrity/sitemap validators pass.

However, this audit found **six P0 defects**, including two that affect the majority of the site:

1. **248 of 355 pages (all 198 hotel + 50 attraction detail pages) load `/css/main.css`, which returns 404.** Those pages have no site CSS, no site navigation, no site JavaScript, no Open Graph/Twitter tags, and no JSON-LD. They are indexable but unbranded.
2. **496 sitemap hreflang alternates point to `/it/…` and `/de/…` hotel/attraction pages that do not exist (404).** The test suite already fails on this.
3. **The site publicly claims a valid ZCT licence (2026-ZCT-001) while `src/data/site.json` says `"status": "application pending"`**, and the “Verify licence status” link has an empty `href`.
4. **The transfer fare calculator never fetches a quote** — it always ends at “price on request”, despite the page carrying verified fares.
5. **The five contracted partner hotel pages show no rates and no concierge booking modal**, even though rate data exists.
6. **The airport-transfer blog publishes price ranges that contradict the canonical rate card** ($25–35 vs $18/$35; $60–80 vs $45/$50; $70–90 vs $45/$50).

The build itself flags 248 thin pages. The test suite is red: **125 pass / 6 fail out of 131**.

### Category scores

| Area | Score | Note |
|---|---:|---|
| Crawlability / indexation | 7/10 | All 355 = 200; but index pages missing from sitemap, 496 broken hreflang |
| On-page SEO | 5/10 | Good canonicals/titles; 248 pages lack schema/OG; length overruns |
| Content quality | 4/10 | 248 thin pages, templated hotel copy, price conflicts |
| Performance | 7/10 | Deferred JS, self-hosted fonts, WebP/srcset, lazy images; heavy JPEG fallbacks, no CWV data |
| Security | 9/10 | CSP, HSTS preload, frame/nosniff/referrer/permissions, CORS 403, TLS valid |
| Accessibility | 6/10 | Alt/dims complete; missing labels, empty link, no consent gate |
| Conversion / trust | 4/10 | Unbranded detail pages, no rates, dead calculator, licence contradiction |

---

## P0 — Critical

### P0-1. 248 pages load a stylesheet that does not exist

Every generated hotel and attraction page uses a standalone template that links `/css/main.css`:

- `scripts/templates/hotel-detail.html:9`
- `scripts/templates/attraction-detail.html:9`

`GET https://spiceandsail.com/css/main.css` → **404** (`text/html`). `public/css/main.css` does not exist in `HEAD` (only `styles.css`, `eco-swahili.css`, `concierge.css`). The compatibility file `public/css/styles.css` already forwards to the real design system:

```css
@import url("/css/eco-swahili.css");
```

Impact: **198 hotel + 50 attraction pages = 248 of 355 sitemap URLs (70%)** render with browser-default styling. They also have no site header/footer/nav, no site JS, no analytics, no concierge, no Open Graph/Twitter tags, and no JSON-LD. Evidence: `grep -rl '/css/main.css' dist/hotels dist/attractions` → 248; live sample `https://spiceandsail.com/hotels/the-one-resort-zanzibar/` → 3.4 KB, one `<header>` with a single home link, one `<img>`, no `og:*`, no `application/ld+json`.

Fix: point both templates at `/css/styles.css` (or `/css/eco-swahili.css`) and, preferably, render these pages through the shared `base.njk`/`seo.njk` layout so nav, footer, consent, OG, JSON-LD, and analytics are inherited. Regenerate with `npm run build`.

### P0-2. Licence claim contradicts its own data source

- `src/data/site.json:40-45` → `"number": "2026-ZCT-001"`, **`"status": "application pending"`**, no `verified_url`.
- `src/pages/terms.njk:19` → “We operate under a **valid** … (ZCT) operator licence (Licence No: 2026-ZCT-001)”.
- `src/pages/about.njk:52` → “holding a **valid** … licence …” with `<a href="{{ site.licence.verified_url }}">Verify licence status →</a>`.
- `src/pages/privacy.njk:12` → “operated by Spice & Sail SRL under … licence 2026-ZCT-001”.

Live `/about/` renders `href=""` on “Verify licence status →” because `verified_url` is undefined. This is a consumer-trust and regulatory risk: the site asserts a licence while its own data says the application is pending, and the verification link is dead. The legal entity is also inconsistent (`Spice & Sail SRL` vs `Spice and Sail Zanzibar`).

Fix: make the public copy match `site.json` exactly. Either set `status` and a real `verified_url`, or change the copy to “ZCT licence application in process — excursions fulfilled with licensed partners” and remove the empty link. Confirm the legal entity name.

### P0-3. 496 sitemap hreflang alternates resolve to 404

`src/pages/sitemap.xml.njk:34-35` and `:43-44` unconditionally emit Italian and German alternates for every hotel and attraction:

```xml
<xhtml:link rel="alternate" hreflang="it" href="{{ site.url }}/it/hotels/{{ hotel.slug }}/"/>
<xhtml:link rel="alternate" hreflang="de" href="{{ site.url }}/de/hotels/{{ hotel.slug }}/"/>
```

No such pages are built. Measured:

- 277 URL blocks declare hreflang, 831 non-`x-default` alternates.
- **496 alternates have no target in the sitemap.**
- Live probes: `/it/hotels/abuso-inn/`, `/de/hotels/abuso-inn/`, `/it/hotels/the-one-resort-zanzibar/`, `/de/hotels/the-one-resort-zanzibar/` → **404**.

The test `tests/hreflang-integrity.test.js:26` fails with exactly `496 sitemap alternate(s) have no built page`.

Fix: only emit `it`/`de` alternates for pages that are actually built (the 20 localized URLs), or build localized hotel/attraction pages. Re-run the hreflang test as the gate.

### P0-4. Transfer fare calculator never quotes

`src/pages/transfers.njk:573-609` — `updateCalculator()` has no `fetch()` at all. On every change it executes:

```js
lastQuote = null;
lastFareLabel = 'price on request';
lastQuoteReasons = ['Our team will confirm this route and vehicle rate.'];
updateSummary(route, lastFareLabel, lastQuoteReasons);
```

The page comment still says “every range comes from the server /quote endpoint”, and each option carries a `data-fare` value, but the values are never used. Result: the calculator always displays “price on request”, even for verified routes ($18/$35 Stone Town, $45/$50 Nungwi, etc.).

This is the regression caught by `tests/eco-redesign.test.js:228` (expects a quote fetch and `window.snsConcierge.openBooking`). Commit `77dd444` (“remove Netlify function dependencies from transfers page, restore WhatsApp fallback”) removed the fetch without restoring the published-fare display.

Fix: read the selected option’s `data-fare` (and capacity) directly, or call the live `/api/quote` endpoint (it returns 200; `/.netlify/functions/quote` is 404). Keep the WhatsApp fallback for unsupported routes.

### P0-5. Contracted partner hotel pages have no rates or booking modal

`src/data/hotelPublicRates.json` contains contracted/confirmed rates for five partner hotels (The One, Le Paradis, Mkeka, The Island Stonetown, and Stone Town View). The generator loads the file (`scripts/generate-detail-pages.py:22`) but **never uses it**; the template has no rate or modal markup.

Live evidence for all five pages (`/hotels/the-one-resort-zanzibar/`, `le-paradis-…`, `mkeka-spice-lodge`, `stone-town-view-hotel`, `the-island-stonetown`):

- `price-amount` occurrences: **0**
- `$` price occurrences: **0**
- `data-sns-booking-open`: **0**
- page size: **3.3–4.0 KB**

`tests/eco-redesign.test.js:308` fails: “the-one-resort-zanzibar must show $ price amount”. Note also `stone-town-view-hotel` is **missing from `hotelPublicRates.json`** entirely.

Fix: render seasonal rates, per-person levies, and the concierge trigger in the partner template; add the missing Stone Town View rate record.

### P0-6. Blog transfer prices contradict the canonical rate card

`src/pages/blog/zanzibar-airport-transfer-guide.njk` still publishes old/other rates:

| Route | Blog (`:25,:30,:35,:40`) | Canonical (`src/data/canonical-rates.json`) |
|---|---|---|
| Stone Town | **$25–35** | $18 sedan / $35 van |
| Nungwi | **$60–80** | $45 / $50 |
| Paje/Jambiani | **$70–90** | $45 / $50 |
| Kendwa | **$55–75** | $45 / $50 |

This is the same “transparent, published rates” promise undermined on a page that ranks for airport-transfer searches. Fix: generate the table from `canonical-rates.json`, or reframe the section explicitly as “typical market range” with a link to the published rates.

---

## P1 — High

### P1-1. 248 thin pages; hotel copy is templated near-duplicate
`npm run build` prints **248** “Thin page” warnings: all 198 hotels (105–136 words) and all 50 attractions (92–130 words). Hotel descriptions are formulaic:

- **198/198** contain “Guest conveniences include…”
- 84/198 contain “Four-star comfort includes…”
- 70/198 contain “Three-star value delivers…”
- 41/198 contain “Five-star service includes…”
- **190/198** contain a double period (`..`)

Examples also contain broken grammar/casing: “access to 50–70 min from znz airport”, “zanzibar's”, “swahili”, “feb–jul”. This is a doorway/thin-content risk at scale.

### P1-2. 248 pages have no JSON-LD and no social tags
All hotel/attraction pages have zero `application/ld+json`, zero `og:*`, zero `twitter:card` (confirmed on live and in `dist/`). The 107 other pages carry a complete `TourOperator`/`TravelAgency`/`LocalBusiness` node (name, phone, address, geo, hours, sameAs) — the detail pages inherit none of it. Add `Hotel` / `TouristAttraction` schema and the shared OG block.

### P1-3. `/hotels/` and `/attractions/` index pages are missing from the sitemap
Both return 200 and are linked sitewide, but neither `<loc>` exists in `sitemap.xml` (only the 198 and 50 detail URLs). Add both index pages.

### P1-4. Title and meta-description lengths overrun
- **275** pages have meta descriptions >160 chars. The 248 detail pages emit the full 350–400-char description because the generator overwrites its own truncation (`scripts/generate-detail-pages.py:136` sets `truncate(desc)`, then `:149` overwrites with the full `desc`).
- **63** titles are >70 chars; **9** titles are <30 chars (e.g. “Nungwi | Spice and Sail”, “Paje | Spice and Sail”).

### P1-5. `stone-town-view-hotel` detail page is orphaned by a slug mismatch
`hotels.json` uses `stonetown-view-hotel`; the detail page is built as `stone-town-view-hotel` (`ALIAS` in the generator). `/hotels/` therefore renders `#hotel-stonetown-view-hotel` instead of `/hotels/stone-town-view-hotel/`, making the real detail page the only orphan in the crawl (0 inbound internal links). Fix the index lookup or normalize the slug.

### P1-6. Structured-data gaps and duplication
- Blog posts have only Organization + BreadcrumbList — no `Article`/`BlogPosting`.
- Area pages have only Organization + BreadcrumbList — no `TouristDestination`/`Place`.
- The homepage emits **two separate `FAQPage` nodes** (5 and 7 questions). Prefer one.
- Tour pages are good: `Product` + `TouristTrip` + `FAQPage`, with a valid `AggregateOffer` (`lowPrice` 85, `highPrice` 150).

### P1-7. `/packages/zanzibar-essentials-3day/` has no `<html lang>`
The only page in the crawl with an empty `lang` attribute. Add `lang="en"`.

### P1-8. Legacy `/about.html` returns 404
`/index.html` → 308 → `/`; `/blog/*.html` → 301 → clean URL; `/tours/zanzibar-essentials-3day/` → 301 → `/packages/…`. But `/about.html` returns **404** with no redirect. Add a 301.

### P1-9. Sitemap `lastmod` is a blanket date
All 355 URLs say `2026-11-22`. Google discounts identical lastmod across a whole site. The template has `page.inputPath | fileMtime` available; emit real per-page dates.

### P1-10. Test suite is red (125/131)
`npm test` → exit 1, **6 failing**:

1. `sitemap hreflang alternates resolve to built pages` — **genuine** (496 broken, see P0-3).
2. `partner hotel landing pages render … dollar rates, and concierge triggers` — **genuine** (see P0-5).
3. `transfer calculator only quotes verified destinations …` — **genuine behaviour gap** (see P0-4).
4. `analytics remains disabled until a verified build ID is configured` — **stale test**: GA4 `G-V7XLPED9L3` is now intentionally enabled.
5. `hotel directory loads all 198 properties progressively …` — **stale test**: source says “Showing 16 featured of 198”; 197 hotels use direct `/hotels/<slug>/` links, 1 uses `data-hotel-index-link`.
6. `built hotel directory keeps the full catalogue in deferred batches` — **stale test**: expects 198 `data-hotel-index-link` attributes; implementation uses direct links. Functionally, `dist/data/hotels-more.json` has `total: 198`, `cards: 182`, and all 198 are discoverable.

Fix: repair 1–3, then update 4–6 to the current intended implementation (or restore the implementation the tests describe). CI must be green before the next deploy.

### P1-11. GA4 loads without a consent gate
`sns-ga4-config.js` injects `googletagmanager.com/gtag/js` after `requestIdleCallback`, unconditionally. No cookie banner exists in `src/_includes` or `public/js`; the privacy page relies on “legitimate interest”. With German and Italian pages, this is an EU/UK consent exposure. Add a consent gate (or document the legal basis and disable GA until consent).

### P1-12. Accessibility defects
- Hotel search input `#hotel-search-input` has a placeholder but no `<label>` or `aria-label` (WCAG 2.1 1.3.1/4.1.2).
- One empty-text WhatsApp `<a>` on `/hotels/` (no `aria-label`) — icon-only link with no accessible name.
- The concierge widget’s required consent checkboxes are `class="sns-visually-hidden"` with no label (`src/_includes/concierge-widget.njk:24-25`). Confirm the visible consent UI is generated with proper labels; hidden required checkboxes are a compliance/AT risk.
- A 1×1 base64 tracking pixel on `/hotels/` has no `alt` (use `alt=""`).
- The 248 detail pages have no skip link and no site nav (same root cause as P0-1).

---

## P2 — Medium

1. **Hero images on all 248 detail pages are `loading="eager"`** (`scripts/templates/hotel-detail.html`), with no `srcset` in the source template (post-processing adds it). Prefer `lazy` for below-the-fold and `eager` only for the true LCP image.
2. **Homepage image fallbacks are heavy**: 22 images totalling ~5.7 MB of source JPEGs (largest 509 KB, 508 KB, 419 KB). The `srcset` WebP variants are small (hero 24 KB at 1200w), so modern browsers are fine — but the full JPEG is the fallback.
3. **hreflang is inconsistent between HTML and sitemap**: only 29 pages have HTML `<link rel="alternate">`; the sitemap declares 277. Two DE/IT transfer pages point to an EN page with no HTML hreflang (non-reciprocal). Fix after P0-3.
4. **Internal linking is otherwise healthy**: 355/355 sitemap URLs return 200; no broken internal links; only 1 orphan (P1-5); top hubs are `/`, `/tours/`, `/transfers/`, `/safaris/`, `/travel-guide/`.
5. **CWV not measured**: no Lighthouse/field data (install blocked by npm network timeout). Single-request TTFB measured 0.13–0.22 s (one 3.3 s outlier); under a 12-way concurrent crawl median 0.59 s, p90 2.54 s.
6. **Performance positives**: all scripts `defer`; CSS 73.6 KB raw / 15.6 KB brotli; Figtree/Fraunces self-hosted WOFF2 with `font-display:swap`; 548/824 images lazy; width/height present on all 824; immutable 1-year cache on `/css` and `/js`.
7. **Legal entity inconsistency**: “Spice & Sail SRL” in privacy vs “Spice and Sail Zanzibar” elsewhere. Confirm the registered entity.
8. **Dead code**: `public/js/concierge.js` and `concierge-v2.js` still call `/.netlify/functions/quote` (404), but neither file is loaded by any page. Remove or archive to avoid future misuse.

---

## What genuinely holds up

- **All 355 sitemap URLs return 200**; no broken internal links; 404 page correctly returns 404 and is branded.
- **Self-referencing canonicals on all 355 pages**; unique titles and descriptions (no duplicates).
- **One H1 per page**, and every crawled page has H2s.
- **824 images: 0 missing alt, 0 missing width/height**, 548 lazy.
- **Security is strong**: `Content-Security-Policy`, HSTS `preload`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`; `/.env`, `/.git/*`, `/package.json`, `/_redirects` all 404; foreign-origin POST → 403; empty chat POST → 400; TLS valid to 19 Feb 2027; `www` → apex 301; HTTP → HTTPS 301.
- **Build is healthy**: `npm run build` exit 0; image-reference check passes; sitemap validator passes (“355 URLs, every one maps to a real, self-canonical page”).
- **`npm audit`: 0 vulnerabilities** (including `--omit=dev`).
- **Organization JSON-LD is complete** (name, phone, postal address, geo, opening hours, sameAs to WhatsApp/Maps/Instagram/TikTok/YouTube/Facebook/TripAdvisor).
- **Tour schema is valid** (Product + TouristTrip + FAQPage, AggregateOffer).
- **DE/IT localized pages have correct `lang`, self-canonical, and reciprocal hreflang.**
- **Booking/payments posture is correct**: WhatsApp-first, no card collection, deposit tiers explained, weather guarantee, marine-fee policy.

---

## Verification appendix

| Check | Command | Result |
|---|---|---|
| Sitemap crawl | custom Python over `sitemap.xml` | 355 URLs, **355 × 200** |
| Detail-page CSS | `curl -I /css/main.css` | **404** |
| Detail pages using it | `grep -rl /css/main.css dist/hotels dist/attractions` | **248** |
| Broken hreflang | parse `sitemap.xml` alternates | **496** missing targets |
| Live localized 404s | `curl /it/hotels/abuso-inn/` etc. | **404** |
| Partner pages | live fetch ×5 | **0 prices, 0 booking modal** |
| Canonical rate card | `src/data/canonical-rates.json` | $18/$35, $45/$50 |
| Blog rates | live `/blog/zanzibar-airport-transfer-guide/` | $25–35, $60–80, $70–90 |
| Transfer calculator | `src/pages/transfers.njk:573-609` | no `fetch`, always “price on request” |
| Licence | `src/data/site.json:40-45` | `"status": "application pending"` |
| Build | `npm run build` | **exit 0**, 248 thin-page warnings |
| Tests | `npm test` | **125 pass / 6 fail / 131** |
| Dependencies | `npm audit` | **0 vulnerabilities** |
| Security probes | `/.env`, `/.git/config`, `/package.json` | **404** |
| API CORS | `POST` with `Origin: https://evil.example` | **403** |
| TLS | `openssl s_client` | valid 21 Nov 2026 → 19 Feb 2027 |

Artifacts: `/tmp/opencode/sas-audit/` (`crawl.csv`, `crawl.json`, `sitemap.xml`, `build.log`, `test.log`, `test2.log`).

---

## Prioritized fix plan

### This week (P0)
1. Fix the detail-page template: `/css/main.css` → real CSS, and render through the shared layout (nav, footer, OG, JSON-LD, analytics). Regenerate all 248 pages.
2. Reconcile the ZCT licence copy with `site.json`; remove or populate the “Verify licence status” link; confirm the legal entity.
3. Emit hreflang only for built localized pages; make `tests/hreflang-integrity.test.js` green.
4. Restore the transfer calculator’s published-fare display (data-fare or `/api/quote`).
5. Render partner-hotel rates + concierge modal; add the missing Stone Town View rate record.
6. Regenerate the airport-transfer blog table from `canonical-rates.json`.

### Next (P1)
7. Enrich or consolidate the 248 thin pages (unique 150–300 words each, or noindex until enriched).
8. Add `Hotel`/`TouristAttraction` JSON-LD and OG/Twitter to detail pages; add `Article` to blog and `TouristDestination` to areas; merge the duplicate homepage FAQPage.
9. Add `/hotels/` and `/attractions/` to the sitemap.
10. Fix description truncation (P1-4) and title lengths.
11. Fix the `stonetown-view-hotel` slug/orphan.
12. Add `lang` to the packages page; add a 301 for `/about.html`.
13. Emit real per-page `lastmod`.
14. Repair the 3 genuine failing tests and update the 3 stale ones; require green CI.
15. Add a consent gate for GA4, or disable analytics until consent.
16. Fix the search-input label, icon-link `aria-label`, and confirm visible consent labels.

### Later (P2)
17. Lazy-load detail-page heroes; review the heaviest JPEG fallbacks.
18. Measure CWV with PageSpeed Insights/Lighthouse once install is possible.
19. Remove dead `concierge.js`/`concierge-v2.js` or repoint them to `/api/quote`.
20. Re-check hreflang reciprocity across HTML and sitemap.

---

## Relationship to the existing `AUDIT-REPORT.md`

The prior report (dated 21 Nov, content-focused, score 73/100) is now **partly outdated**:

**Fixed since:** Mnemba fee is $25 on the About page; business hours are unified to 09:00–17:00 EAT; office location is consistently Mbuzini; hotel count is 198 across homepage and `/hotels/`; blog stubs are 600+ words; Bluebay uses a real photo; The One rate-table placeholder is gone; a Catamaran product now exists in the catalogue; the $10 Mnemba figure is gone.

**New or still open:** the 248-page unstyled detail template, 496 broken hreflang alternates, partner-hotel rates/modal removal, the dead transfer calculator, the airport-transfer blog price conflict, the licence-status contradiction, and 6 failing tests. This report supersedes the earlier score.

*End of audit.*
