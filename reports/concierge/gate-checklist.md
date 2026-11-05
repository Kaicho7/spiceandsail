# Concierge Gate Checklist — branch concierge-p0, 2026-11-05

Legend: PASS = automated test proves it. NEEDS-OWNER = behaviour proven but owner decision/ruling required. NOT VERIFIED = no automated or live check ran.

| Gate | Claim | Status | Proof |
|---|---|---|---|
| 1a | Lead POST with a working store returns success | PASS | `gate 1a (control)` + live-e2e.txt POST /lead → 201 |
| 1b | Store failure never fakes success to the guest | PASS | `gate 1b: forced store failure never returns success` |
| 2 | Reference shown equals stored lead equals staff alert reference | PASS (server/storage scope) | `gate 2` round-trips reference through the real lead handler → store → staff alert; it tests the **handler/storage path**, not the rendered widget UI |
| 3 | Client-supplied totals/deposit ignored | PASS | `gate 3: client-supplied total or deposit is ignored` |
| 4a | Foreign origin rejected | PASS | `gate 4: foreign origin rejected` |
| 4b | Oversized payload rejected | PASS | `gate 4: oversized payload rejected` |
| 4c | Flood handled by rate limit | PASS | `gate 4: one-IP flood handled by rate limit` |
| 5 | No banned phrases anywhere in dist/ | PASS | `gate 5: no banned phrase in dist/` + `privacy: no banned phrases in dist/` + manual grep (0 hits) |
| 6 | Duplicate submit creates exactly one lead | PASS | `gate 6: duplicate submit creates exactly one lead` |
| 7 | All alert channels failing still saves the lead | PASS | `gate 7: with all alert channels failing the lead is still saved and retrievable by reference` |
| 8 | Email-only / WhatsApp-only reply links work; bad numbers rejected | PASS | `gate 8: email-only and WhatsApp-only leads give working reply links and invalid numbers rejected` |
| 9 | Consent fields + notice version stored | PASS | `gate 9: consent fields and notice version stored` (+ widget carries v1.0 hidden field) |
| 10 | Exactly one concierge launcher in rendered HTML | PASS (source scope) | `gate 10` counts `id="sns-concierge-trigger"` in the widget **include source**; it does not crawl rendered pages |
| 11 | Price floors enforced from real catalogue | PASS (priced slugs) / NEEDS-OWNER (on-request slugs) | `gate 11: floors, using real catalogue slugs` proves priced ranges; 7 catalogue slugs are `on_request` — their "price on request" wording is an **owner ruling** (see defects-status.md / OWNER_ACTIONS.md item 3) |
| 12 | Chat works with no LLM key | PASS | `gate 12: chat gives a useful reply with no LLM key` |
| 13 | Guardrail rejects invented prices | PASS | `gate 13: guardrail rejects an invented price` |
| 14a | GET /quote lists real slugs with range/basis/replyWindow | PASS | `gate 14a: GET /quote lists catalogue slugs, pricing basis, reply window` |
| 14b | dist/ renders intact: sitemap, robots, valid JSON-LD, no legacy hard-coded prices | PASS | `gate 14: sitemap.xml and robots.txt are served intact` + `key pages render valid JSON-LD` + `no legacy hard-coded page prices survive render` |

Other owner items (not gated by tests): widget business-hours text comes from CONFIG (`replyWindow`/`businessHours` in concierge-catalogue.json — owner to ratify); turtle sanctuary & PADI scuba on-request pages; "captains are certified" claim; group-van & round-trip rates — see reports/concierge/OWNER_ACTIONS.md and defects-status.md.

Hygiene: `hygiene: BUILD_TOKEN and local artifacts are not tracked` — PASS.
Privacy: all 8 privacy tests — PASS (see test-output.txt).
XSS: `concierge-xss.test.js` — PASS (no innerHTML; `<img onerror>` renders as literal text; links via createElement).

## Not verified
- Production Netlify deploy behaviour (ALLOWED_ORIGINS/URL env, BlobStore-backed store, netlify dev CLI).
- The `npx netlify dev` CLI path itself (hung unattended twice); equivalent flow verified via local dev server (see screenshots 01–05).

## Items pending owner review
- Item 4: `[dev]` block added to netlify.toml (done). `npx netlify dev` itself could not run unattended (hung during extension install, no listener, twice) — verified the equivalent flow instead via a local dev server serving `dist/` with the real `/.netlify/functions/*` handlers (`ALLOWED_ORIGINS=http://localhost:8888`): real browser submitted a lead, got `SP-2026-000001`; offline resubmit showed an error, never success. Screenshots 01–05 + preview-url.txt in reports/concierge/. Netlify-dev behaviour in production remains NOT VERIFIED here.
