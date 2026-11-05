# Concierge Gate Checklist — branch concierge-p0, 2026-11-05

Legend: PASS = automated test proves it. NOT VERIFIED = no automated or live check ran.

| Gate | Claim | Status | Proof |
|---|---|---|---|
| 1a | Lead POST with a working store returns success | PASS | `gate 1a (control): lead succeeds with a working store` (tests/concierge-gates-real.test.js) + live-e2e.txt POST /lead → 201 |
| 1b | Store failure never fakes success to the guest | PASS | `gate 1b: forced store failure never returns success` |
| 2 | Reference shown in UI equals stored lead equals staff alert reference | PASS | `gate 2: UI reference equals stored reference equals staff alert reference` + live-e2e.txt (SP-2026-000001 round-trip) |
| 3 | Client-supplied totals/deposit ignored | PASS | `gate 3: client-supplied total or deposit is ignored` |
| 4a | Foreign origin rejected | PASS | `gate 4: foreign origin rejected` |
| 4b | Oversized payload rejected | PASS | `gate 4: oversized payload rejected` |
| 4c | Flood handled by rate limit | PASS | `gate 4: one-IP flood handled by rate limit` |
| 5 | No banned phrases anywhere in dist/ | PASS | `gate 5: no banned phrase in dist/` + `privacy: no banned phrases in dist/` + manual grep (0 hits) |
| 6 | Duplicate submit creates exactly one lead | PASS | `gate 6: duplicate submit creates exactly one lead` |
| 7 | All alert channels failing still saves the lead | PASS | `gate 7: with all alert channels failing the lead is still saved and retrievable by reference` |
| 8 | Email-only / WhatsApp-only reply links work; bad numbers rejected | PASS | `gate 8: email-only and WhatsApp-only leads give working reply links and invalid numbers rejected` |
| 9 | Consent fields + notice version stored | PASS | `gate 9: consent fields and notice version stored` (+ widget carries v1.0 hidden field) |
| 10 | Exactly one concierge launcher in rendered HTML | PASS | `gate 10: exactly one launcher in rendered HTML` |
| 11 | Price floors enforced from real catalogue | PASS | `gate 11: floors, using real catalogue slugs` + `gate 13: guardrail rejects an invented price` |
| 12 | Chat works with no LLM key | PASS | `gate 12: chat gives a useful reply with no LLM key` |
| 13 | Guardrail rejects invented prices | PASS | `gate 13 (see row 11)` |

Hygiene: `hygiene: BUILD_TOKEN and local artifacts are not tracked` — PASS.
Privacy: all 8 privacy tests — PASS (see test-output.txt).

## Not verified
- Real browser load of the widget (screenshots). `npx netlify dev` hung (>3 min, no listener) — likely the missing `[dev]` section forcing the full `npm install && npm run build` before serving. The function-level flow was proven end-to-end by live-e2e.txt via the real handlers instead.
- Production Netlify deploy behaviour (ALLOWED_ORIGINS/URL env, BlobStore-backed store).

## Needs owner
See reports/concierge/OWNER_ACTIONS.md and defects-status.md.
