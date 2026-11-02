# Phase 5: Local Activity Marketplace — Functional Fix Plan

## Summary of Verified Current State

After direct investigation of the repository files, the marketplace feature (Phase 5) is **not functional** as deployed. The code has been scaffolded but contains critical architectural mismatches between client-side browser code and server-side Node.js modules.

## Key Technical Problems

### 1. Browser-Side require() of Node Modules
**Files:**
- `src/pages/marketplace.njk` line 115: `<script type="module">\n  const { getApprovedActivities } = require('/api/marketplace.js');`
- `src/components/activity-submission.vue` line 488: `const marketplaceAPI = require('./marketplace.js');`

**Problem:** `require` is undefined in browsers. `/api/marketplace.js` is a Node CommonJS file that uses `fs.readFileSync()`, `fs.writeFile()`, `path`, and `uuid` modules — it writes JSON files and cannot run in the browser.

### 2. Malformed marketplace-submit.njk
**Problems:**
- Duplicated/concatenated template content (lines 504-542 contain `</body></html>` followed by unclosed template blocks)
- References to non-existent files:
  - `import { createApp } from '/src/components/activity-submission.js';` (file `/src/components/activity-submission.js` does not exist; only `activity-submission.vue` exists)
  - `fetch('/api/marketplace.js/create', { method: 'POST', ...})` (no such Netlify function)
- Unclosed `{% block content %}`/`{% endblock %}` template tags

### 3. Node.js-only Marketplace API
**File:** `src/api/marketplace.js`
- CommonJS exports: `loadMarketplaceData()`, `createMarketplaceActivity()`, `saveMarketplaceData(data)` — all using Node `fs/promises` and `uuid`
- Written for server-side operation (reads/writes JSON files in `src/data/`)
- Cannot run in browser (no file system, no Node modules)

### 4. Missing Client-Side Bundle
- `src/components/activity-submission.vue` is a Vue 3 SFC (`<script>\nimport { ref, reactive, computed } from 'vue'`) requiring a bundler
- Eleventy build configuration (`.eleventy.js`) processes only `["njk","md","html"]` — `.vue` files are ignored
- The marketplace has no server endpoints to serve the `.vue` component or process Vue syntax

### 5. Missing Netlify Functions
- `netlify/functions/` contains only `booking.js` (functional)
- No `marketplace.js` or similar Netlify function exists to serve marketplace API endpoints
- The pages' browser scripts attempt to `require()` modules that don't exist client-side and have no server counterpart

## Functional Fix Recommendation

The only viable path forward is to **implement Netlify Functions** that wrap the existing `src/api/marketplace.js` operations, then modify the marketplace pages to use client-side `fetch()` calls to these endpoints instead of `require()`.

### Fix Implementation

#### 1. Create `netlify/functions/marketplace.js`
- Adapt pattern from `netlify/functions/booking.js`
- Wrap `src/api/marketplace.js` exports with Netlify function handler
- Provide CORS support and proper error handling
- Endpoints:
  - `GET /.netlify/functions/marketplace` → return approved activities
  - `POST /.netlify/functions/marketplace` → create new activity submission

#### 2. Repair `src/pages/marketplace.njk`
- Remove `<script type="module">` with `require('/api/marketplace.js')`
- Replace with client-side code that `fetch('/.netlify/functions/marketplace')`
- Keep all Nunjucks template logic (filters, sidebar, modal) but make activity data come from API

#### 3. Repair `src/pages/marketplace-submit.njk`
- Remove duplicated content and unclosed template blocks
- Fix malformed structure (deduplicate, close all template tags)
- Replace `import { createApp } from '/src/components/activity-submission.js';` with direct form handling or use existing `src/components/activity-submission.vue` if viable
- Update form to `POST /.netlify/functions/marketplace` endpoint

#### 4. Address `src/components/activity-submission.vue`
- Either remove this file (if no bundler planned) and move functionality to JavaScript in the Nunjucks template
- Or convert to plain HTML + vanilla JS + fetch API if componentization is needed

### Implementation Order

1. **Create Netlify Function** (`netlify/functions/marketplace.js`)
2. **Fix marketplace.njk** client-side integration
3. **Fix marketplace-submit.njk** malformed structure
4. **Verify build** and update `PROGRESS.md` Phase 5 status

### Why This Approach

- **Leverages existing work:** Uses the well-tested `booking.js` Netlify function as a pattern
- **Maintains architecture:** Preserves the separation of concerns (server-side JSON persistence vs. static site)
- **Browser-compatible:** All client-side code uses standard web APIs (`fetch`, DOM manipulation)
- **Minimal changes:** Fixes the core functional issues without requiring bundler installation or complex build pipeline changes

### Expected Outcome

After implementing this fix:
- Marketplace pages will load and display activities from JSON data
- Users can submit new activity experiences via form
- Admin/verified experiences will appear to visitors
- Phase 5 will be functional and ready for deployment
- Build will succeed and tests will pass

**Next Step:** Implement the functional fix by creating the Netlify function and repairing the page templates.

## Status: NEEDS FIX