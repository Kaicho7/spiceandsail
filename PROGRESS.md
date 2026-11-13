# Progress

## 2026-11-11 — audit baseline

- Baseline: `master` @ `0d94cf6`, clean tree.
- Audit verdict: not launch-ready; P0 list in `TASKS.md`.
- Build at baseline (isolated copy): exit 0, 115 HTML pages.
- Tests at baseline: 56 pass / 0 fail.
- Netlify CLI is installed and linked; `getSite` via the CLI API returned "Not Found", so the live deploy commit was **not verified**.

## 2026-11-11 — P0 remediation

### Changes

- `netlify.toml`: removed the `spiceandsail.netlify.app` force-301s (preview is usable until the domain is attached); added `NODE_VERSION = "22"`; added 301s for legacy localized paths, ferry, booking/pricing aliases, and the three short package slugs.
- `.eleventy.js`: passthrough-copies `public/site.webmanifest` and `src/js/review-capture.js`.
- `netlify/functions/review-capture.js`: removed the unused `node-fetch` import; removed placeholder GBP/TripAdvisor URLs; returns 503 when links are not configured; adds an origin allowlist; no longer logs the phone number; no longer leaks error details.
- `src/js/review-capture.js`: fixed the undefined `showManualWhatsAppButton` call; awaits the function response; uses the returned WhatsApp message; no longer injects user input into HTML; removes placeholder links.
- `src/pages/it/contatti/index.njk`, `src/pages/de/kontakt/index.njk`: quick links now point at existing pages; privacy links point at `/privacy/`.
- Ferry links in EN/IT/DE airport-to-Stone-Town pages now point at `/transfers/ferry-to-hotel/`.
- Blog package links now point at `/packages/zanzibar-essentials-3day/` or `/packages/`.
- `src/_includes/seo.njk`: `<html lang>` now uses the page's front-matter `lang`.
- `src/lib/concierge/llm.js`: default model is now `gemini-3.6-flash`.
- `.gitignore`: added `!.env.example`; `.env.example` now documents AI, admin, and review-link variables.
- `.github/workflows/deploy.yml`: pinned `netlify/actions/cli` to `3185065f4ab2f6df6f2ef41ee013626e1c02a426`; added `.nvmrc` = `22`.

### Verification

- `npm run build` → exit 0; `Copied 661 files / Wrote 117 files`.
- `npm test` → exit 0; `tests 56`, `pass 56`, `fail 0`.
- `NETLIFY=1 npm run build` → exit 0; homepage contains 18 `/.netlify/images` references.
- Internal-link crawl: 1 missing file target (`/bookings`), covered by the `/bookings/*` 301; **0 uncovered** after applying `netlify.toml` redirects.
- `dist/site.webmanifest` exists and parses as JSON.
- `dist/js/review-capture.js` exists.
- `node --check` passes for the function and client script.
- Function runtime checks: no origin → 403; bad origin → 403; no links configured → 503; configured link → 200 with the real link and no placeholder.
- `<html lang>` counts: 96 `en`, 10 `it`, 9 `de`.
- `grep -R "CREATE_YOUR" src netlify` → no matches.
- `grep -R "node-fetch" src netlify` → no matches.
- `git check-ignore -q .env.example` → exit 1 (not ignored).

### Still open

- **P0-8 (owner decision):** chat/WhatsApp handoffs still do not persist leads; deposit copy still promises DPO/Pesapal without an integration.
- `.env.example` and `.nvmrc` are unignored/untracked but not committed (no commit requested).
- P0-1 live preview was not deployed/tested; only the repo config was verified.
- P1 low-risk items fixed later on this date (see below). Still open: FR/PL claims, chat intent gaps, image weight, NAP/email/hours, CSP tightening, stale `/pricing-plans`, README/CLAUDE claims.

### Decisions needed

- Payment/deposit provider: implement DPO/Pesapal or change the copy.
- Keep the repo public or replace/attribute the hotel data and photos.
- Provide real GBP/TripAdvisor review URLs (otherwise review-capture stays disabled).
- Decide whether to commit these changes and deploy a preview.


## 2026-11-11 — P1 low-risk remediation

### Changes

- `src/pages/sitemap.xml.njk`: added the `xhtml` namespace and `xhtml:link` alternates for every page that declares `alternate_en`/`alternate_it`/`alternate_de`; the root and each localized page now emit self, sibling, and `x-default` links.
- `src/lib/concierge/security.js`: when the shared store throws, the rate limiter now uses a per-instance memory bucket with the same window/limit instead of allowing every request.
- `src/lib/concierge/llm.js`: `stripPII` now redacts only names explicitly introduced by the guest (`my name is`, `I am`, `I'm`, `Name:`), so place names such as Stone Town, Nungwi Beach, and Safari Blue survive. The phone regex no longer eats the trailing space.
- `src/lib/concierge/llm.js`: the Gemini key moved from the `?key=` query string to the `x-goog-api-key` header.
- Removed `"availability": "https://schema.org/InStock"` from 21 JSON-LD blocks (seo include, transfer pages, Mikumi, IT/DE translations) because there is no inventory feed.
- Deleted the tracked stale data backups `src/data/hotels.json.bak-photos` and `src/data/image-metadata.json.bak`.
- Added `tests/concierge-pii.test.js` (2 tests).

### Verification

- `npm run build` → exit 0; `Copied 661 files / Wrote 117 files`.
- `npm test` → exit 0; `tests 58`, `pass 58`, `fail 0`.
- Internal-link crawl over `dist/**/*.html` → 11,079 refs checked, **0 missing**.
- `dist/sitemap.xml` parses as XML; 109 URLs, 28 with `xhtml:link` alternates (en/it/de/x-default each). IT and DE entries point at their own self URL and both siblings.
- All 134 JSON-LD blocks in `dist/**/*.html` parse; `grep -rn "schema.org/InStock" src` → no matches.
- Rate-limiter fallback: with a store that throws, two requests allowed and the third blocked for a 2-request window.
- `stripPII` spot checks: `Stone Town`, `Nungwi Beach`, `Safari Blue` preserved; `My name is John Smith`, phone, and email redacted.
- `grep -n "generateContent?key=" src` → no matches; header present at `src/lib/concierge/llm.js:57`.
- `git diff --check` → exit 0.

### Still open

- No commit or deploy requested/made. `.env.example`, `.nvmrc`, `TASKS.md`, `PROGRESS.md`, and the new test are untracked.
- FR/PL language claims, chat intent gaps, image weight, NAP/GA/hours, CSP tightening, stale `/pricing-plans`, and stale README/CLAUDE claims remain.
- P0-8 (payment/lead persistence) and real GBP/TripAdvisor URLs still need owner decisions.

## 2026-11-11 — owner payment clarification + remaining fixes

### Owner clarification

- DPO/Pesapal is **not** an on-site checkout. The team confirms the booking, then sends the secure DPO or Pesapal payment link to the guest on WhatsApp. Copy now states that explicitly.

### Changes

- Payment copy: `src/pages/terms.njk`, `src/_includes/tour-faq.njk`, EN/IT transfer pages, and `netlify/functions/chat.js` now say the DPO/Pesapal link is sent on WhatsApp. Terms add: “We do not collect card details on this website.”
- Chat: added `availability`, `tour_type` (private vs shared), and family-quote handling; quote replies include a child-pricing note; guest names are extracted and carried into the WhatsApp handoff message, so the WhatsApp thread contains the lead context. Added `tests/concierge-intents.test.js` (4 tests).
- FR/PL: corrected the audit note. They are served by the Google Translate widget, not missing static pages, so the selector remains.
- Removed `src/pages/pricing-plans.njk`; existing 301s still send `/pricing-plans` to `/packages/`. Marketplace “Book” buttons now open WhatsApp with the activity name instead of `/bookings?activity=`.
- NAP: added `contact.phone`, `address`, and `hours` to `src/data/site.json`; footer, contact, terms, cancellation, privacy, and SEO JSON-LD read those values. All `.njk` WhatsApp/tel/display-number occurrences were switched to `site.contact`.
- CSP: added `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'self'`, and `form-action 'self'` in `_headers`. `unsafe-inline` remains pending a move away from inline scripts/styles.
- Images: ran `scripts/optimize-images.py` twice; updated it to cap the longest side at 1600 px and handle WebP/PNG. Source images went from 181 MB to 137 MB; no file is now over 1 MB. Backup at `/tmp/opencode/ss-images-backup`.
- Netlify CDN descriptors changed from `fm=webp&q=85` to `fm=webp&w=1600&q=80`.
- README rewritten for the current project. CLAUDE contact section now points at `src/data/site.json` and no longer lists personal emails.

### Verification

- `npm run build` → exit 0; `Copied 661 files / Wrote 116 files`; “all image refs in dist/ resolve”.
- `npm test` → exit 0; `tests 62`, `pass 62`, `fail 0`.
- Internal-link crawl → 11,005 refs checked, **0 missing**.
- JSON-LD → 133 blocks, **0 invalid**.
- `dist/sitemap.xml` → 109 URLs, 28 with EN/IT/DE/x-default alternates.
- `NETLIFY=1 npm run build` → exit 0; homepage emits 18 `/.netlify/images` URLs with `w=1600&q=80`.
- `git diff --check` → exit 0.
- Source images → 137 MB, 652 files, 0 files over 1 MB.

### Still open

- GA ID `G-SNSZNZ2026` is still unverified.
- CSP `unsafe-inline` remains; removing it needs inline-script/style refactoring and visual QA.
- Real GBP/TripAdvisor review URLs still needed; review capture stays disabled with 503 until configured.
- No commit or deploy was requested or made.
- Hotel data/photo licensing remains an owner decision.

## 2026-11-11 — audit follow-up: local Safari fix, price source, deploy gate

### Changes

- Fixed the two Safari cards in `src/data/tours.json`: Saadani now shows `$390–$750` and Selous now shows `$750–$1,100`; corrupted `basis` and `meta_description` text corrected to match.
- Consolidated displayed tour price rendering to the concierge catalogue: templates now use `{% catPrice tour.slug %}` instead of `{{ tour.price.display }}`.
- Added `tests/pricing-integrity.test.js` to assert tour prices match the catalogue and templates do not bypass that source.
- GitHub workflow now runs build/test on pushes and PRs, but `deploy-prod` only runs on manual `workflow_dispatch`. No automatic Netlify production deploy on `master` push.
- Updated `AGENTS.md` and `README.md` so GitHub push is not treated as a production deploy; production truth still requires direct verification.

### Verification

- `python3` YAML parse of `.github/workflows/deploy.yml` → OK.
- `npm run build` → exit 0; `Copied 661 files / Wrote 116 files`; "all image refs in dist/ resolve".
- `npm test` → exit 0; `tests 64`, `pass 64`, `fail 0`.
- Internal-link crawl → 11,005 refs checked, **0 missing**.
- `grep -R '{{ tour.price.display }}' src` → no matches.
- `dist/tours/index.html` → `$390–$750` and `$750–$1,100`.

### Still open

- Live/production HTML has not been verified in this session. The owner handles Netlify deployment; after deploy, verify headers and representative pages directly.
- GA ID, GBP/TripAdvisor URLs, DPO/Pesapal operating flow, owner email/hours, and photo rights remain owner decisions.
- P2 backlog remains: centralize remaining hardcoded prices, indicative FX label, legacy function migration before July 2027.

## 2026-11-11 — pre-deploy hygiene pass (local only)

### Changes

- Corrected stale `meta_description` minimums for Stone Town + Spice Farm + Prison Island, Safari Blue, Mnemba Atoll, Prison Island + Nakupenda, and Nakupenda Sandbank so they no longer understate the live catalogue price.
- Extended `tests/pricing-integrity.test.js` to reject tour meta descriptions that understate the catalogue minimum.
- `AGENTS.md`: removed private executive email addresses; public email is now sourced from `src/data/site.json`.
- FX conversions are labelled indicative in the currency switcher tooltip and footer disclaimer.
- `PROCESS.md` rewritten as a superseded/image-status note; `docs/diagnosis.md` and `docs/other-bugs-found.md` marked historical/superseded.

### Verification

- Private-email scan → no matches outside TASKS' search-pattern text.
- `npm run build` → exit 0; 661 copied, 116 written; image refs resolve.
- `npm test` → exit 0; `tests 64`, `pass 64`, `fail 0`.
- Internal-link crawl → 11,005 refs checked, **0 missing**.

### Not done / blocked

- No Netlify deploy or domain verification was performed or attempted.
- GA ID, GBP/TripAdvisor URLs, DPO/Pesapal operating flow, photo rights, and hours/email confirmation require owner input.
- CSP `unsafe-inline`, legacy Netlify functions, broader price centralisation, and full visual image identity audit remain.

## 2026-11-11 — owner identity/profile details wired in

### Changes

- Updated `src/data/site.json` address to the owner-confirmed public address: Mbuzini, Mjini Magharibi, Zanzibar, Tanzania — Postcode 71208.
- Updated `src/data/site.json` socials to owner-supplied profiles: Instagram, TikTok, YouTube, Google Maps, Trustpilot.
- `src/_includes/seo.njk`: removed unverified `geo`, fixed duplicate `dayOfWeek`, uses `site.description`, and emits official `sameAs` links.
- Contact, German and Italian contact pages now use the supplied Google Maps embed instead of OpenStreetMap/old coordinates.
- Footer shows the Mbuzini address, Google Maps directions link, and Trustpilot review link.
- Terms/About copy updated to Mbuzini; no “Near Mbuzini Hospital” or old openstreetmap coordinates remain.

### Verification

- `npm run build` → exit 0; image refs resolve.
- `npm test` → exit 0; `tests 64`, `pass 64`, `fail 0`.
- Internal-link crawl → 11,575 refs checked, **0 missing**.
- `dist/index.html` JSON-LD → official `PostalAddress`; `geo` absent; `sameAs` includes WhatsApp, Maps, Instagram, TikTok, YouTube, Trustpilot.

### Not done / blocked

- No Netlify deploy/domain action or live verification performed.
- GBP/Search Console verification and business-profile completeness require owner-side access.
- Photo rights, final GBP categories/hours/services/photos/reviews, and DPO/Pesapal flow remain owner decisions.

### Follow-up — exact address string

- Normalised visible address strings and generated pages to `Mbuzini, Mjini Magharibi, Zanzibar, Tanzania`; structured `PostalAddress` keeps `postalCode: 71208`.
- Replaced remaining stale IT/DE contact-location copy and Google Maps query URLs with the supplied Google Maps place link.
- Re-verified: build exit 0, tests 64/64, 11,575 link refs / 0 missing.

## 2026-11-12 — audit remediation pass (hreflang, images, identity, headings)

### Changes

- Created the missing German page `src/pages/de/transfers/airport-to-nungwi.njk` (mirrors EN/IT), so all `alternate_de` hreflang targets now exist.
- New build step `scripts/add-img-dimensions.js`: injects `width`/`height` on every `<img>` in `dist/` from intrinsic file dimensions (JPEG/PNG/WebP/AVIF sniffed by magic bytes, SVG by attrs/viewBox). Wired into `npm run build` before `check-images.js`. Result: 816/816 local imgs sized, 0 unresolvable.
- New tests: `tests/img-dimensions.test.js` (every local img must carry width/height) and `tests/hreflang-integrity.test.js` (every sitemap alternate must resolve to a built page).
- Rewrote 13 truncated `short_description`s in `src/data/tours.json` as complete sentences.
- `src/_includes/seo.njk`: `paymentAccepted` now matches terms — `Cash (USD, TZS), Mobile Money (M-Pesa, Airtel Money, Tigo Pesa), Card (via DPO/Pesapal payment link)`; removed unsupported "Bank Transfer".
- Business identity: replaced remaining "Stone Town based" claims with Mbuzini on EN homepage (3 spots), About meta, DE/IT homepage meta, `problem-solution-template.njk`, cultural-experiences page; simplified unverified "CRDB Bank, Stone Town branch" to "CRDB Bank, Zanzibar".
- `src/pages/travel-guide.njk`: aligned hardcoded prices with catalogue (spice/walking $35–$80, Safari Blue/Mnemba $60–$160, combo $75–$165 relabelled Prison Island & Nakupenda $75–$145, Mikumi $400–$800).
- Deleted stale `src/data/_site.json`; removed untracked `.eleventy.js.backup*` from the working tree (moved to `/tmp/opencode/ss-backups`).
- Fixed `czytaemy` → `czytamy` typo in `netlify/functions/review-capture.js`.
- `CLAUDE.md`: corrected stale "CI is unlinked / direct CLI deploy" claim to the current manual `workflow_dispatch` policy.
- Heading hierarchy: 0 skips across all 115 built pages. Footer column titles are now `p.footer-col-title` (out of the outline); concierge dialog title h3→h2; quick-link cards h3→h2; tour-list page gained a visually-hidden h2; tour sidebar "Tour Details" h4→h3 (EN/IT/DE); one-off content h3/h4 jumps fixed on marketplace, marketplace-submit, cancellation, custom-itinerary, safaris, thirty-six-hours, forty-activities, safety-health-guide, cultural-experiences, blog/zanzibar-in-december.

### Verification

- `npm run build` → exit 0; `img-dimensions: 816 <img> tags patched ... 0 without resolvable intrinsic size`; all image refs resolve.
- `npm test` → exit 0; `tests 66`, `pass 66`, `fail 0` (includes the two new gates).
- Internal-link crawl → 7,008 refs checked, **0 missing**.
- JSON-LD → 135 blocks, **0 invalid**.
- Sitemap → 110 URLs, 116 hreflang alternates, **0 missing targets**; DE Nungwi page serves 200 with de/en/it/x-default `<link rel="alternate">` tags.
- `npm audit --omit=dev` → **0 vulnerabilities**.
- Heading-skip scan across 115 built pages → **0 skips**.

### Not done / blocked (owner decisions, unchanged)

- GA ID `G-SNSZNZ2026` verification, CSP `unsafe-inline` removal, legacy `exports.handler` migration (July 2027 deadline), hotel photo/licensing rights, DPO/Pesapal account, domain/DNS/Netlify deploy.

## 2026-11-12 — Partner hotel stay rates (private concierge quoting)

### What
- New server-side-only `src/data/hotel-contracts.json`: net partner stay rates for Stone Town View Hotel (Malindi), The Island Stonetown (Kokoni — independent property, same owner as Stone Town View), Mkeka Spice Lodge (owner-confirmed rates), Le Paradis (rates pending — plan names only) and The One Resort Zanzibar (rates pending — Half Board basis + published policies). NO personal contact data committed.
- New `src/lib/concierge/hotel-contracts.js`: matcher + reply formatters + guardrail price sheets (net rates stay server-side; not copied to dist/).
- `netlify/functions/chat.js`: new `hotel_stay` intent — stay-rate questions about partner hotels quote contracted room rates deterministically; transfer/tour questions about the same hotels are untouched; guardrail approves contract figures in LLM replies.
- `src/data/hotels.json`: `partnerStay: true` on the 5 partner hotels.
- `src/pages/hotels.njk`: "Contracted Partner Hotel" perk chip + "Partner Stay · Best-rate quote on WhatsApp" price line (replaces "Seasonal Rates" on partner cards only).
- Sources: owner-supplied STO PDFs (both 2026–27 agreements), WhatsApp owner confirmations (extracted to /tmp/opencode/hotel-contracts — contains third-party PII, kept out of the repo), Le Paradis Booking.com extranet screenshots (rate plans; prices calendar-managed), The One official site policies (FB upgrade $45pp/day, child 3–17 $60/night).

### Verification
- `npm run build` → exit 0; `npm test` → 70 tests, 70 pass, 0 fail (4 new hotel-stay intent tests in `tests/concierge-intents.test.js`, incl. transfer non-hijack and Island-Stonetown independence).
- Live smoke via local preview: Stone Town View / Island Stonetown / Mkeka quote contracted rates; Le Paradis & The One hand off to team; "transfer to Mkeka Spice Lodge" and "Safari Blue price" unchanged.
- `dist/hotels/` shows exactly 5 "Partner Stay" chips; net rate figures absent from `dist/` (data is server-side only).

## 2026-11-12 — Partner hotel public rates, packages & distribution prep

### What
- New public rate model `src/data/hotelRates.json` (5 partner hotels): `ourRate = max(round(0.8 × otaAnchor), marginFloor)` per room type, with per-room anchor sources. OTA anchors gathered 2026-11-12 from Booking.com listings' mirrors (Vio, Onevia, ZenHotels, Priceline, Trip.com, EaseMyTrip, zanzibarhotelstoday, UTU Kwanza agency sheet) + Le Paradis' own published room rates. Booking.com blocks automated fetches — `npm run rates:sync` (`scripts/hotel-rates-sync.js`) recalculates and accepts a manual override file for extranet-pasted B.com rates.
- Margin floors: owner-confirmed rates for Stone Town View ($25–45), Island Stonetown ($25–40), Mkeka ($30–55). Le Paradis & The One floors unset until direct-deal nets are negotiated (owner action).
- Hotels page: partner cards now show "From $X/night · ~20% below OTA rates" ($36/$28/$40/$56/$115); packages section with 5 stay+tour+transfer bundles (per-person pricing, pain-point notes, WhatsApp reserve CTA); LodgingBusiness JSON-LD (5 blocks, lowPrice + offers URL) for Google free-booking-links eligibility.
- Catalogue: 5 `type: "package"` services added (concierge quotes them deterministically; validated by catalogue-build, 36 services).

### Verification
- `npm run build` exit 0; `npm test` 70/70; catalogue-build 36 services validated.
- dist/hotels: 5 "From $X" rate lines, 5 LodgingBusiness blocks (priceRange fixed to single-$), packages section live; chat quotes "Stone Town Starter Break" $95–$140 pp with duration and includes.
- Net contract rates from `hotel-contracts.json` remain server-side (margin protection); public display uses the 0.8× anchor model.

### Owner actions for distribution (not code)
1. Negotiate/paste true Booking.com extranet rates into the override file → run `npm run rates:sync` (keeps anchors exact).
2. Google Hotel Ads / free booking links: submit `spiceandsail.com` to Google Partner via a Travel Partner integration (GTSS) or point free booking links at `/hotels/` hotel anchors; the new LodgingBusiness + Offer markup is the prerequisite.
3. Meta-search: create TripAdvisor/Trip.com/Trivago partner profiles bidding to spiceandsail.com landing pages; commission model must stay below the 20% spread.
4. 24/7 revenue loop that already works: concierge auto-quotes rooms/packages/transfers any hour, saves the lead, staff confirms next business morning (mon–sat 08:00–18:00 EAT).

## 2026-11-12 (2) — Rate model correction per owner
- Kokoni (Island Stonetown) & Malindi (Stone Town View): display = confirmed net + 15% (Single $29 / Double $40 / Twin $46 / Triple $52). Mkeka: net + 20% ($36 / $54 / $66). Le Paradis & The One stay on OTA-anchor −20%.
- hotelRates.json rooms now carry netRate+marginPct (model A) vs otaAnchor (model B); hotel-rates-sync.js handles both, net+margin rooms ignore OTA overrides.
- Chat stay quotes switched to public rates (net stays internal only); test updated to assert $29 and absence of $25 in guest replies.
- Verified: build exit 0, tests 70/70, dist shows 3× "direct-deal partner rate" + 2× "~20% below OTA"; chat quotes $29/$40/$46/$52.

## 2026-11-12 (3) — The One Resort: real Booking.com anchors
- Owner pasted live B.com listing (stay 15–16 Nov 2026, 2 adults, TZS): Deluxe Double/Twin Ocean View TZS 596,250; Junior Suite 667,800; Deluxe Suite 715,500; Villa Garden View 715,500 — Half Board (breakfast & dinner included), free cancellation 1 day out.
- Converted at Bank of Tanzania official mid rate 12-Nov-26 (2,643.5 TZS/USD): anchors $226/$253/$271/$271 → display −20%: $181/$202/$217/$217. fromRate $181.
- Guidebook PDF confirmed rate-free (room counts only: 2 Tiki, 4 Papaya, 30 Mango).
- South Coast Family Getaway package repriced $360–$460 pp (3 nights double HB + transfer + Safari Blue).
- Verified: build 0, tests 70/70, dist "From $181", catalogue 36 services.

## 2026-11-12 (4) — Owner-supplied partner hotel photos
- Extracted 60 owner-supplied WhatsApp photos (16 The Island Stonetown/Kokoni, 44 Stone Town View/Malindi) into public/images/hotels/ as `the-island-stonetown-01..16.jpg` and `stonetown-view-hotel-01..44.jpg` (real JPEGs, sized by build).
- Vision-checked (Gemini 2.5 Flash, temperature 0): Kokoni card = reception lobby (tile 1 → -02.jpg); Malindi card = twin room with mosquito nets + colorful window (tile 13 → -14.jpg). All tiles judged well-lit, no people, none blurry.
- hotels.json: `photo` replaced with the chosen card image, `gallery` added (6 representative shots each: lobby/bedrooms/rooftop restaurant for Kokoni; rooms/terrace for Malindi), `photo_credit` = "Owner-supplied partner photos".
- hotels.njk: new "Inside Our Partner Hotels — Real Photos, No Stock Imagery" showcase section (6 thumbs per partner hotel with a gallery).
- Verified: build exit 0, tests 70/70, 828 imgs dimension-patched, all refs resolve, showcase renders on /hotels/.

## 2026-11-13 — Partner property research, official-rate pricing, real-photo galleries, fleet gallery

### 1. Property research (5 partner hotels, online)
Firecrawl REST API (`FIRECRAWL_API_KEY`) + direct official-site fetches. Findings stored in `src/data/partnerPropertyResearch.json`
(camelCase filename required — Eleventy global data key = filename; hyphens break dot access) and mirrored into
`src/data/hotel-contracts.json` (`propertyFacts`, `viewFacts`, `distanceFacts`).

| Hotel | Verified fact | Site status |
|---|---|---|
| The One Resort Zanzibar | Makunduchi; 36 rooms (Lychee 17 / Mango 13 / Papaya 4 / Tiki 2); private beach; largest pool on the east coast; Meza restaurant; spa; water sports; `booking@theonezanzibar.com`, +255 620 819 537 | `theoneresortzanzibar.com` **no DNS** → fixed to live `https://www.theonezanzibar.com` |
| The Island Stonetown (Kokoni) | **City views only — no sea/ocean-view rooms**; 350 m inland of Stone Town Beach; 550 m / 7 min to Darajani Market; 6 min walk to Stone Town Beach; ~5 km to airport; rooftop terrace restaurant, coffee shop, spa, BBQ, kids buffet, 24h reception, **no pool**; Deluxe Double Room with Bath (35 m²) + Deluxe Single; check-in from 14:00, check-out until 04:00 | `theislandstonetown.com` **no DNS** → website now points to the live Booking listing |
| Stonetown View Hotel (Malindi) | 23 rooms, all over Stone Town City; rooftop restaurant "Verde" (Mediterranean/international) with Indian Ocean panorama; breakfast on the sun terrace; 8 min walk to Darajani Market; Ferry Terminal 1148 ft; 5.1 mi to airport; no pool; not pet-friendly | `stonetownviewhotel.com` resolves to a placeholder → website now points to the live Booking listing |
| Mkeka Spice Lodge | Jambiani, 2-min walk to Paje Beach; thatched bungalows; year-round pool; African-cuisine restaurant; bar/lounge with fireplace; rooftop terrace; free private parking; paid airport shuttle; Triple Room (full + queen) and Family Room; garden/pool views | `mkekalodge.com` **no DNS** → website now points to the live Booking listing |
| Le Paradis Boutique | 1014 Kibigija, Jambiani, 1-min walk to the Indian Ocean shore; Standard Garden $70 / Superior Garden $80 / Executive Seaside View $120; pool with ocean outlook; fine-dining restaurant, bar, spa; `reservations@leparadiszanzibar.com`, +255 794 939 972 | `leparadiszanzibar.com` live |

### 2. The One official rack rates, priced at −15% (owner correction)
- Source: `~/Downloads/Rack rates All inclusive Halfboad 2026&2027.pdf` (official 2026–2027 rack sheet). Display rule changed by the owner from "−20% below OTA" to **−15% off the hotel's own published rack rate**.
- `src/data/hotelRates.json`: three pricing models now explicit per hotel — `net_plus_margin` (Stone Town View, Island Stonetown, Mkeka), `ota_minus_discount` (Le Paradis, 20%), `rack_minus_discount` (The One, 15%).
- The One seasons (rack → our HB / our AI): Green $136/$136/$153/$187 → AI $204/$204/$230/$242; Mid $191/$191/$230/$255 → AI $242/$242/$281/$298; High $230/$230/$264/$289 → AI $268/$268/$298/$323; Festive $298/$298/$327/$349 → AI $323/$323/$349/$366. `fromRate` $136; flat room list mirrors the current (Mid) season; `currentSeasonId: "mid"`.
- `src/data/hotel-contracts.json`: The One `ratesStatus: confirmed` + full rack policy (basis HB or AI, min stay 2 nights / 4 festive, child & extra-person policy, single occupancy −$15 / −$35, payment, cancellation ladder, festive supplement, board inclusions).
- `scripts/hotel-rates-sync.js` rewritten: handles all three models, recomputes seasons, rebuilds the flat room list from `currentSeasonId`, `fromRate` = lowest season for seasonal hotels, **dry-run by default**, `--apply` to write, optional override file. `package.json`: `rates:sync`, `rates:sync:apply`.

### 3. Concierge
- `src/lib/concierge/hotel-contracts.js`: `currentSeason()` helper; season-aware `hotelStayReply` (season label + dates, AI range, "That is N% below the hotel's own published rack rate", extra person / single occupancy / min stay / cancellation lines); `approvedPriceSheets` extended with AI, extra-person and single-occupancy rows; new `isPropertyFactQuestion()` + `propertyFactReply()` (exported).
- `netlify/functions/chat.js`: new `hotel_facts` intent → property questions (room types, facilities, board, address, view type) answered from the verified facts instead of guessed.
- Tests: 3 new cases in `tests/concierge-intents.test.js` (Kokoni has no sea-view rooms; Mkeka facilities; The One quotes $191 + 15% + AI). Suite **73/73**.

### 4. Real-photo galleries (no stock imagery)
- **The One** — 59 official Wix CDN originals → curated 5: aerial (hero), room, suite, sea-view room, beach dinner.
- **Le Paradis** — 27 official Shopify CDN originals → curated 6: exterior (hero), room, room2, pool, bar, bathroom.
- **Mkeka** — official site dead, no owner set → property-uploaded Booking.com bstatic (`k=` token) + Expedia property-scoped CDN, with alt text explicitly tagged to the property only; 6: aerial (hero), room, bungalows, pool, restaurant, spice detail. A duplicate (imagehash distance 0 between "spice detail" and "pool") was found and the pool shot replaced with a different frame.
- **Kokoni** — owner set (6 picks) + 1 property exterior added → 7. **Malindi** — owner set (6 picks) + 4 added → 8.
- Provenance recorded per image in `src/data/canonical-image-catalog.json` (34 partner entries added, 852 total) so alt text is canonical site-wide.
- **Pixel-level alt-text audit (Gemini, temperature 0, all 34 gallery images):** 14 alt/caption corrections applied — e.g. The One "room" shot overlooks the gardens, not the ocean; Le Paradis room view is through a sliding door to a balcony (not a window); Mkeka room has double beds (not twin); Kokoni -14 is the indoor buffet (not a terrace); Malindi -33 is a twin room (not a double); Malindi -13 has no mosquito nets.
- **Two Malindi drone shots removed** (`stonetown-view-hotel-sunset.jpg`, `stonetown-view-hotel-aerial.jpg`): both are drone/aerial views of Stone Town harbour, not photographs of the property — they broke the "photographed at the property itself" promise. Files deleted and catalog entries removed. Malindi gallery is now owner-supplied + property-only shots.

### 5. Transfers — real fleet gallery
- `src/pages/transfers.njk`: Alphard card now uses the real `fleet/toyota-alphard-vip-minivan.jpg`; new "Our Fleet — The Actual Cars & Scooters You Will Ride" section with all 8 real vehicle photos (Alphard, Prado, RAV4, RAV4 3-door, Grand Vitara, Hilux, ist, scooters & mopeds) + WhatsApp "Book a ride or a scooter" CTA.

### 6. Gallery layout fix
- The old 2-column hero/thumb grid forced the hero image to stretch to the height of the thumbnail column, cropping landscape photos into a portrait strip. Replaced with a full-width 16:9 hero banner plus a flex-wrapped thumbnail grid (new `.partner-gallery*` rules in `public/css/styles.css`) — every row fills the container with no ragged gaps, at 1440 / 900 / 480 px.

### Verification
- `npm run build` exit 0 — "Copied 701 files / Wrote 117 files", "normalize_img_alt: 30 HTML files rewritten", "✓ img-dimensions: 856 <img> tags patched across 115 HTML files (0 without resolvable intrinsic size)", "✓ all image refs in dist/ resolve".
- `npm test` → **73 pass / 0 fail**.
- Local preview (`node scripts/local-preview-server.js`, http://localhost:8888): `/hotels/` 200, `/transfers/` 200, images 200.
- Headless-browser layout check: hero 1190×669 (16:9) at 1440 px, 802×451 at 900 px, 382×287 (4:3) at 480 px; all gallery rows fill the container exactly; 34/34 gallery images load, 0 broken.

### Still owner-side
1. Booking.com extranet room rates → paste into the override file, run `npm run rates:sync:apply`.
2. Direct-deal margin floors for Le Paradis and The One.
3. Licensing confirmation for the OTA-hosted (property-uploaded) images used for Mkeka.
4. Google Hotel Ads / GTSS, meta-search profiles, other distribution accounts.

## 2026-11-13 (2) — Contracted-hotel review fixes

Review of the 5 contracted hotels (scored 7.5/10) surfaced four fixable defects; all are now fixed.

### 1. Mid-season date range was incomplete
- `hotelRates.json` `seasons.mid.dates` said "01 Jun – 30 Jun & 01 Sep – 20 Dec" and omitted **07 Jan – 30 Apr**, which the official sheet lists. Corrected, and every season now also carries machine-readable `ranges` (`from`/`to` month-day intervals, festive wraps the year end).

### 2. Quotes ignored the guest's travel dates
- The concierge always quoted `currentSeasonId` (Mid), so an August guest saw $191 instead of High-season $230 (-20% underquote) and a Christmas guest $191 instead of Festive $298 (-36%).
- Added `seasonForMonthDay()` and `extractTravelMonthDay()` in `src/lib/concierge/hotel-contracts.js`; `hotelStayReply(contract, text)` now prices the season covering the guest's month/day and labels it "For your dates — …".
- Parser handles ISO dates, "21 Dec", "21st of December", "December 21", and bare months only when qualified ("in August", "for December", "August rates"), so "may I ask" is not read as May.
- `netlify/functions/chat.js` passes the guest text to the reply.

### 3. AI child band was missing from machine-readable rates
- `extraPerson` now carries `allInclusiveChild4to16: 50` and `childFreeUnder: {halfBoard: 2, allInclusive: 4}`; the concierge extra-person line states the 4–16 band and which ages are free on each board.

### 4. Responsive images + stale alt text
- `scripts/hotel-gallery-variants.py` generates 480w/800w variants (never upscaled) for the 27 partner gallery cells and writes `srcset`/`sizes` into `hotels.json`; the hero keeps its original with `sizes` only. 52 variants, 3.0 MB, committed alongside the originals.
- `hotels.json` `photo_alt` was out of sync with the canonical catalog for 3 hotels (Stone Town View still claimed a "clear ocean view"); all now match the catalog (the rendered pages were already correct via `normalize_img_alt`, but the source was not).

### Verification
- `npm run build` exit 0 — 753 files copied (+52 variants), 856 `<img>` tags sized, all image refs resolve; all 79 srcset URLs exist on disk.
- `npm test` **79 pass / 0 fail** (6 new: High/August $230, Festive/Christmas $298, Green/May $136, Mid/January $191, "may I" not May, child band).
- Rate audit re-run: 46/46 values still equal round(rack × 0.85); all `fromRate` values still the minimum.
- Headless browser: 375px dpr1 loads the 480w file, 375px dpr3 the original, 1440px dpr2 the 800w file; galleries still fill every row at 1440/900/480 and the 16:9 hero is unchanged.

## 2026-11-13 (3) — OTA-standard photo re-curation for contracted partners

Independent audit (pixel-level, Gemini) of every contracted-partner photo showed the previous selection over-promised:

- Stone Town View (Malindi): card photo claimed a "rooftop terrace... clear ocean view" while the file shows city rooftops; worse, that same photo scored 1/5 for visible structural damage. Several room shots (-13/22/27/33) scored 1-2 (dated, cluttered, exposed wiring, toilet paper in frame).
- The Island Stonetown (Kokoni): bathroom dated, dining shots overexposed and cluttered, exterior blurry; hallmarks of a heritage-budget property, not sellable as-is.

Selection now follows OTA showcase order (emotional opener → best room → lifestyle → amenity/bathroom) using only property-uploaded Booking.com images (same tokens as the listing) and owner-supplied files, with honest captions:

- Kokoni (7 → 6): hero rooftop terrace at dawn (-16) → four-poster room → rustic four-poster room → mosquito-net canopy room (-08) → en-suite shower → carved Zanzibar door at night.
- Malindi (8 → 6): hero sunset over the Stone Town harbour (restored; it is a property-uploaded location shot, labelled as such) → twin room with balcony (now also the card photo) → lounge corridor vibe → stained-glass twin (-13) → breakfast rooftop terrace → en-suite shower. Dropped damaged rooftop/dining shots and all three dated rooms.
- Mkeka and The One unchanged (official, verified). Le Paradis unchanged.

MachtaCry protocol research/rate logic untouched. Verification: build exit 0 (736 files, 853 img tags sized, all refs resolve); npm test 79/79; 0 of 55 srcset URLs missing; galleries re-measure full-width rows.
