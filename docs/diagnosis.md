# Concierge Chatbot & Architecture Diagnosis

> **Historical OpenCode diagnosis — superseded.** Current `public/js/concierge.js` sends `profile` and `history`; `netlify/functions/chat.js` extracts/merges entities and returns an updated `profile`. Keep this file for provenance only and rely on the current code and tests.


**Date:** 2026-11-06  
**Repository:** `~/spiceandsail`  
**Branch:** `fix-p0-v1` (created from `master`)  

---

## 1. File Path Clarification: `chat-handler.js` vs `chat.js`
In the prompt, the file was specified as `src/lib/concierge/chat-handler.js`.
* **Investigation Result:** In the current repository, no `chat-handler.js` exists under `src/lib/concierge/`. The backend endpoint handling all chat messages is **`netlify/functions/chat.js`** (supported by modules in `src/lib/concierge/` such as `recommend.js`, `guardrail.js`, `catalogue.js`, `pricing.js`, `store.js`, `llm.js`, `security.js`, `validate.js`).
* For the purposes of this diagnosis, all references to the chat backend handler refer to `netlify/functions/chat.js` (or `src/lib/concierge/chat-handler.js` once created/refactored as requested in Phase 2).

---

## 2. Answers to Specific Diagnostic Questions

### A. How many intents the bot currently handles (count the switch/if branches)
The bot currently handles **7 intents**:
In `detectIntent(text)` inside `netlify/functions/chat.js` (lines 26–34) and `buildDeterministicReply(intent, text, profile)` (lines 68–146):
1. **`quote`** (`if (/\b(price|cost|how much|quote|rate)\b/.test(lower))`)
2. **`book`** (`if (/\b(book|reserve|confirm|hold)\b/.test(lower))`)
3. **`recommend`** (`if (/\b(recommend|suggest|what should|best|popular|must.?do)\b/.test(lower))`)
4. **`transfer`** (`if (/\b(transfer|airport|pickup|drop.?off)\b/.test(lower))`)
5. **`info`** (`if (/\b(visa|insurance|health|safety|malaria|yellow.?fever)\b/.test(lower))`)
6. **`hours`** (`if (/\b(hours|open|close|when|contact)\b/.test(lower))`)
7. **`general`** (default fallback / greeting branch)

---

### B. Every field `chat-handler.js` (chat endpoint) reads from the request body
In `netlify/functions/chat.js`:
- **`body.message`** (line 180: user input message string)
- **`body.session_id`** (line 190: session identifier for rate limiting)
- **`body.profile`** (line 196: `const profile = body.profile || {};`)
  - Inside `buildDeterministicReply`, `profile.adults` is read (line 73)
  - When calling `recommend(profile || {}, 4)`, `recommend.js` reads: `pickupZone`, `interests`, `children`, `childrenAges`, `budgetBand`

*(Note: `history` is currently not read from the body at all).*

---

### C. Every field `concierge.js` sends in the fetch call
In `public/js/concierge.js` (`sendChat`, line 439–443):
- **`message`**: `text`
- **`session_id`**: `sessionId()`

*(Note: `profile` and `history` are currently **omitted** from the `fetch` payload in `public/js/concierge.js`).*

---

### D. Where the "Book" button currently links to (URL or handler name)
- In the chat interface, when an intent triggers `requestContact: true` (e.g. `intent === 'book'` or LLM contact trigger), `public/js/concierge.js` (lines 451–454) executes:
  ```javascript
  if (res.json.requestContact) {
    state.chatOpen = false;
    goToStep(3);
  }
  ```
  This closes the chat window (`state.chatOpen = false`) and navigates the visitor to **Step 3 of the modal form** (`goToStep(3)`), which renders the input fields (`sns-guest-name`, `sns-guest-whatsapp`, `sns-guest-email`, consent checkboxes) and submits via `fetchJSON('/.netlify/functions/lead')`.
- There is currently **no WhatsApp handoff link (`wa.me`)** on booking intent in the chat bubble.

---

### E. Whether profile merge logic exists, and if so, why it isn't working
- **Why it isn't working:**
  1. **Frontend side:** `public/js/concierge.js` never captures or sends `profile` (nor `history`) in the POST request body to `/.netlify/functions/chat`, and does not persist or update `window._conciergeProfile` across conversation turns.
  2. **Backend side:** `netlify/functions/chat.js` has no profile entity extraction or merge logic. It receives `body.profile || {}` but does not extract dates, group size, interests, budget, or pickup area from user messages. It also does not return an updated `profile` object in its response JSON (it only returns `{ message, quickReplies, requestContact, quote }`).
  3. Therefore, state is completely stateless between turns: every incoming message starts with an empty profile.

---

### F. For `tours.json`: list every field whose name contains "price"
Across all 16 entries in `src/data/tours.json`, the fields matching "price" (case-insensitive) are:
1. **`price`** (object containing `min`, `max`, `basis`, `display`)
2. **`price_display`** (string, e.g. `"$45–$80"`)

*(No other field or nested field contains "price").*

#### Sample entries from `src/data/tours.json` showing every price-related field:
```json
[
  {
    "id": "CUL-01",
    "title": "Stone Town walking tour",
    "price": {
      "min": 45,
      "max": 80,
      "basis": "per person; private guide at high end; floor priced from partner rate (Madebe partner rate: $35pp for 2pax)",
      "display": "$45–$80"
    },
    "price_display": "$45–$80"
  },
  {
    "id": "CUL-02",
    "title": "Spice farm tour",
    "price": {
      "min": 35,
      "max": 80,
      "basis": "per person; floor priced from partner rate (Madebe partner rate: $27pp for 2pax)",
      "display": "$35–$80"
    },
    "price_display": "$35–$80"
  },
  {
    "id": "CUL-03",
    "title": "Village / community tour",
    "price": {
      "min": 30,
      "max": 50,
      "basis": "per person; floor priced from partner rate (Animation team partner rate: $41 total small group)",
      "display": "$30–$50"
    },
    "price_display": "$30–$50"
  }
]
```

---

### G. For `concierge-catalogue.json`: list every field whose name contains "price"
- **Top-level keys in `concierge-catalogue.json`:**
  `[ "version", "sourceRepo", "currency", "config", "zones", "services" ]`
- **Fields containing substring "price":**
  - **Strictly contains `"price"` (substring):**
    `config.childPricing` (under `config.childPricing: "on_request"`).
    *(Note: Services use the key name `"pricing"`, which contains `"pricing.basis"`, `"pricing.min"`, `"pricing.max"`, `"pricing.display"`, `"pricing.basisNote"`, `"pricing.sourceQuality"`, `"pricing.sourceFiles"`, `"pricing.verified"`, but does not contain a literal key named `"price"`).*

---

## 3. Summary of Files Examined
1. `public/js/concierge.js` (lines 1–575)
2. `netlify/functions/chat.js` (lines 1–265)
3. `src/lib/concierge/recommend.js` (lines 1–123)
4. `src/lib/concierge/guardrail.js` (lines 1–83)
5. `src/data/concierge-catalogue.json` (6 top-level keys, 17 services)
6. `src/data/tours.json` (16 tour entries)
