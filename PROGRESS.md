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
