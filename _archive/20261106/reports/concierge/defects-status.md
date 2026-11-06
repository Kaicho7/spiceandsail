# Defects & status — concierge branch, 2026-11-05

| Defect | Status | Evidence |
|---|---|---|
| Stale dist/js/concierge.js containing banned phrases (old gate-5 failure) | FIXED — rebuilt dist, gate 5 + privacy dist scan pass | npm test: `gate 5: no banned phrase in dist/` PASS |
| Old widget price map / client-side pricing (SRP violation: client invents totals) | FIXED — widget uses server /quote only; planning range from POST /quote | public/js/concierge.js (fetch of /.netlify/functions/quote), gate 3 |
| "Instant Fare Calculator"/"Instant Trip Concierge" implications (immediate confirmed fare/booking) | FIXED — renamed "Fare Calculator (Planning Range)"/"Trip Concierge"; added "our team confirms" wording | grep across src/, dist/: 0 hits |
| Hard-coded page prices drifting from catalogue ($55, $75, $100, $440–$650 on transfer/safari pages) | FIXED — pages render through catPrice/catMin/catMax from concierge-catalogue.json (single source) | grep '\$[0-9]' on edited pages: only 3rd-party/government figures remain |
| JSON-LD offers with stale absolute prices | FIXED — AggregateOffer renders catalogue lowPrice/highPrice via catMin/catMax | dist/transfers/airport-to-nungwi/index.html |
| Widget consent ids not matching validate.js field names | FIXED — ids `consent_contact`/`consent_marketing`, hidden input `privacy_notice_version` value v1.0 | gate 9 + privacy tests |
| OTA-strikethrough dead CSS (.sns-ota-*, .sns-savings-pill, .sns-metasearch-callout, .sns-fee-*) retained after logic removal | FIXED — removed from public/css/concierge.css; grep dist/: no sns-ota | grep returned 0 |
| netlify dev hangs locally (no [dev] block, full build gate) | NOT FIXED (dev-only) — documented in OWNER_ACTIONS.md item 11; function flow proven by live-e2e.txt | live-e2e.txt E2E_OK |
| Real-browser UI walkthrough + screenshots | NOT DONE — no browser automation available in this environment; recorded in gate-checklist.md "Not verified" | — |
