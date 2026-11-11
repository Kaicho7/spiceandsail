# Other Bugs Found (Out of Scope)

> **Historical note.** Status summary: item 1 is fixed; item 2 is addressed by catalogue-driven price rendering; item 3 returns a WhatsApp handoff; item 4 is implemented; item 5 remains cosmetic. Historical document only.


**Date:** 2026-11-06  
**Branch:** fix-p0-v1  

---

## 1. `matchServices()` over-matching on single common words

**File:** `netlify/functions/chat.js` (original, line 43)  
**Severity:** Low (UX annoyance)  
**Description:** The original `matchServices()` matched services if the user text contained *just the first word* of the service slug. For example, "trip to Zanzibar" would match `zanzibar-essentials-3day`, `zanzibar-hidden-gems-sacred-caves`, all three `airport-transfer-znz-*` slugs, etc. because "zanzibar" is the first word of their slugs.  
**Status:** Fixed in this branch as part of the Phase 2 work (tightened to require full slug or name match, or at least a two-word overlap).

## 2. `tours.json` has duplicate price data

**File:** `src/data/tours.json`  
**Severity:** Medium (data integrity)  
**Description:** Every tour entry has both `price` (object with `min`, `max`, `basis`, `display`) and `price_display` (string). The `price_display` field duplicates `price.display` and `concierge-catalogue.json → services[].pricing.display`. This creates a risk of price inconsistency between the three sources.  
**Status:** Noted for Phase 3 cleanup (not touched in this session per instructions).

## 3. `book` intent opens a form instead of WhatsApp

**File:** `netlify/functions/chat.js` (original, line 106–112)  
**Severity:** Medium (business intent mismatch)  
**Description:** The original `book` intent returned `requestContact: true`, which caused the frontend to close the chat and show a lead-capture form (Step 3). The business model is WhatsApp-first with no payment processing on site. This mismatch means users expecting to book via WhatsApp are redirected to a form.  
**Status:** Fixed in this branch — booking intent now returns a `whatsapp_url` for direct WhatsApp handoff.

## 4. No conversation history sent to backend

**File:** `public/js/concierge.js` (original, line 442)  
**Severity:** High (stateless conversations)  
**Description:** The original `sendChat()` only sent `{ message, session_id }` in the POST body. No `profile` or `history` was included, making every chat turn fully stateless. The backend could never remember dates, group size, or interests from previous messages.  
**Status:** Fixed in this branch.

## 5. `store.js` getGlobalStore() error handling

**File:** `src/lib/concierge/store.js` (line 96–106)  
**Severity:** Low  
**Description:** `getGlobalStore()` silently creates a store on first call, but `chat.js` wraps it with `ensureStore()` which catches and re-creates. The double-init pattern is redundant but not harmful.  
**Status:** Not fixed (out of scope, cosmetic).
