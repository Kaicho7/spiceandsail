# Spice & Sail — Launch Remediation Tasks

Repo: `/home/efatha/spiceandsail`
Baseline: `master` @ `0d94cf6` (2026-11-11)
Rule: tick a task only after its Check command exits 0. Record the command output in `PROGRESS.md`.

## P0 — must pass before the domain is connected

- [x] **P0-1 Preview reachable.** Remove or guard the `spiceandsail.netlify.app` force redirects in `netlify.toml` so the Netlify preview does not 301 to the unconnected domain. Canonical-domain enforcement moves to Netlify's primary-domain setting. Repo-level verified; live preview test pending a deploy.
  - Check: `grep -n "netlify.app" netlify.toml` returns nothing; `npm run build` exits 0.
- [x] **P0-2 Review capture works or is removed.** Remove unused `node-fetch`; serve `/js/review-capture.js`; remove placeholder GBP/TripAdvisor links; fail clearly when links are not configured; add an origin check; stop logging phone numbers.
  - Check: `node -e "require('./netlify/functions/review-capture.js')"` exits 0; built `dist/js/review-capture.js` exists; `grep -R "CREATE_YOUR" src netlify` returns nothing.
- [x] **P0-3 No broken internal links.** Fix DE/IT nav links, ferry links, package links, and `/site.webmanifest`. Add redirects only for legacy URLs.
  - Check: build then run the internal-link crawl; 0 missing targets (excluding paths covered by `netlify.toml` redirects).
- [x] **P0-4 Manifest served.** Add `public/site.webmanifest` to the Eleventy passthrough copy.
  - Check: `dist/site.webmanifest` exists and parses as JSON.
- [x] **P0-5 Supported AI model.** Change the default in `src/lib/concierge/llm.js` from retired `gemini-2.0-flash` to a supported model; document `GEMINI_MODEL` in `.env.example`.
  - Check: `grep -n "gemini-2.0-flash" src netlify .env.example` returns nothing; `npm test` exits 0.
- [x] **P0-6 Env template tracked.** Add `!.env.example` to `.gitignore`; document `GEMINI_MODEL`, `GBP_REVIEW_LINK`, `TRIPADVISOR_REVIEW_LINK`. Unignored; commit pending.
  - Check: `git check-ignore .env.example` exits 1; `git ls-files .env.example` prints the path after staging.
- [x] **P0-7 Deploy pinned.** Pin `netlify/actions/cli` to commit `3185065f4ab2f6df6f2ef41ee013626e1c02a426`; add `.nvmrc`; set Node 22 in `netlify.toml`.
  - Check: `grep -n "netlify/actions/cli@" .github/workflows/*.yml` shows the SHA; `.nvmrc` contains `22`.
- [x] **P0-8 Lead/payment promises resolved.** The site does not take card details or run a checkout. Copy now says the team sends a DPO or Pesapal payment link on WhatsApp after confirmation. The WhatsApp handoff carries name, service, dates and group size, so the WhatsApp thread is the lead record.
  - Check: `grep -rn "online in advance via secure DPO" src` returns nothing; `npm test` covers the handoff name and payment copy. Owner clarified the WhatsApp-link flow on 2026-11-11.

## P1 — before marketing

- [x] Set `<html lang>` from page front matter; add sitemap hreflang for EN/IT/DE alternates.
  - Check: built pages have 96 `en`, 10 `it`, 9 `de`; `dist/sitemap.xml` parses and 28 URLs carry `xhtml:link` alternates.
- [x] Add a local rate-limit fallback instead of failing open when the shared store is down.
  - Check: failing store allows 2 requests and blocks the 3rd for a 2-request window.
- [x] Replace the `stripPII` name regex with place-safe redaction; test Stone Town, Nungwi Beach, Safari Blue.
  - Check: `npm test` covers place preservation and name/phone/email redaction.
- [x] Fix chat intent gaps: family quote, private/shared tours, availability, WhatsApp handoff name.
  - Check: `tests/concierge-intents.test.js` covers all four intents; `npm test` passes.
- [x] Reduce source image weight and lower CDN quality/size descriptors.
  - Check: source images 181 MB → 137 MB, max side 1600 px, no file >1 MB; Netlify CDN URLs now request `w=1600&q=80`.
- [x] Centralize NAP/email/hours in `site.json`.
  - Check: `src/data/site.json` carries `contact`, `address`, `hours`; templates and SEO JSON-LD read those values.
- [ ] Confirm the GA measurement ID with the owner. (`G-SNSZNZ2026` is still unverified.)
- [x] Move the Gemini key out of the query string into `x-goog-api-key`.
  - Check: `grep -n "generateContent?key=" src` returns nothing.
- [ ] Tighten CSP fully. `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'self'` and `form-action 'self'` are now set; `unsafe-inline` remains until inline scripts/styles are moved out.
- [x] Remove stale `/pricing-plans` page; update `/bookings?activity=` links.
  - Check: source page deleted; marketplace booking links now open WhatsApp with the activity name.
- [x] Remove `availability: InStock` without inventory.
  - Check: `grep -rn "schema.org/InStock" src` returns nothing; all 133 JSON-LD blocks parse.
- [x] Remove tracked `.bak` data backups.
  - Check: `git status` shows the two `src/data/*.bak*` files deleted.
- [x] Resolve FR/PL claim and update stale README/CLAUDE claims.
  - Correction: FR/PL are served by the Google Translate widget, not missing static pages, so the selector stays.
  - Check: README rewritten for the current repo; CLAUDE contact section points at `site.json` and no longer lists personal emails.
- [x] Consolidate displayed tour price rendering on the concierge catalogue and add a consistency test.
  - Check: `tests/pricing-integrity.test.js` passes; `grep -R '{{ tour.price.display }}' src` returns nothing.
- [x] Keep Netlify production deploy manual while still pushing code to GitHub.
  - Check: `.github/workflows/deploy.yml` only runs `deploy-prod` on `workflow_dispatch`; master push runs build/test only.

## P2 — quality

- [ ] Centralize the 252 hardcoded prices.
- [ ] Label static FX rates as indicative.
- [ ] Migrate functions off legacy `exports.handler` before July 2027.
- [ ] Add behavioural tests for links, redirects, and functions.
