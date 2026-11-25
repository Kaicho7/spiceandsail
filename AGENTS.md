# AGENTS.md — Project Rules (all coders must obey)

## Git Write Operations — VERIFIED FIXES AUTO-PUSH

**Verified working fixes (build passes `npm run build`, tests pass `npm test`) shall be committed and pushed to `origin/master` immediately — no explicit permission needed per fix.**

### What is permitted without approval:
- `git commit` — for verified fixes only (build + tests pass)
- `git push origin master` — for verified fixes only
- Reading files, running builds, running tests
- Editing files in the working tree (unstaged changes)
- Creating scripts, documentation, or analysis in the working tree
- `git status`, `git diff`, `git log` (read-only inspection)

### What still requires explicit approval:
- `git push --force` / `git push --force-with-lease`
- `git amend` / `git commit --amend`
- `git rebase` that rewrites history
- `git reset --hard` that discards committed work
- Any operation on remotes other than `origin` or branches other than `master`

### Verification protocol before auto-push:
1. Run `rm -rf dist && npx eleventy` — must succeed with 0 errors
2. Run `npm test` — must show 0 new failures (pre-existing failures documented in test output are acceptable)
3. Verify the fix in rendered HTML output (`dist/`)
4. **Remember: `git push origin master` deploys to production automatically**

### Why the change:
- Previous strict prohibition was due to a 447 MB blocked push incident
- **Cloudflare Pages is connected to GitHub: push to `master` = automatic production deploy**
- Verified fixes should not stall waiting for permission; the deploy is automatic on merge

---

## 2. Primary Core Pillar & Single Source of Truth Invariant (NON-NEGOTIABLE)

The **tourism empirical research archive and photo vault** located at:
`/home/efatha/Desktop/CODERS/CODING AGENTS UNIQUE PRODUCT/SUPA APP LEADSCOUT KAZI/tourism/`
is the **Alpha and Omega / Primary Core Pillar** for the entire `spiceandsail.com` (formerly Dhow Coast Travels) website.

### What is in the Vault (The Empirical Foundation 2019–2021):
1. **Content & SEO Intelligence:**
   - `ZANZIABR/content_ideas_for_tanzania (6)/` (Subfolders b1–b5 and b6–b10) containing 1,300+ backlink records, Moz keyword explorer datasets, UberSuggest search volumes (28,000–31,000 keywords across Acacia, African Budget Safaris, AfricanMecca, Colors of Zanzibar), and competitor top pages.
   - High-intent verified travel content models: NYT "36 Hours in Zanzibar", African Budget Safaris "African Tribes & Culture", "Top 12 Reasons to Visit Zanzibar", Helen in Wonderlust "40 Amazing Things".
   - `Factsheet stonetown.docx`, `All Articles - ARTICLES ZANZIBAR KWEYWORS.html`, `KEYWORDS TOURS.txt`.
2. **Authentic Operational Excursion & Safari Pricing:**
   - Real operator wholesale B2B price lists: `ZANZIABR/ZANZIBAR EXCURSIONS AND SAFARI TANZANIA PROGRAMMES PRICE LIST (2).pdf`.
   - On-the-ground operational cost/margin sheets: `ZANZIABR/Excursions The One.xlsx`.
   - All tour packages, excursion pricing, and duration schedules must reflect these authentic operational baselines, never hallucinated generic rates.
3. **Authentic Primary Photography & Personal Vault:**
   - `labeled-personal-photos/`: 85+ authentic on-the-ground photos from Zanzibar.
   - `AMAMA/real_farm_photos/`: Authentic agricultural, farm, and spice photos.
   - `ZANZIABR/excursions.png`: Master excursions asset.
   - Authentic personal and on-the-ground photos must ALWAYS take precedence over generic stock imagery.

---

## 3. Strict Image & Photography Invariant (ZERO HALLUCINATIONS)

Under NO circumstances may any coder substitute stock photos or make code mappings that contradict physical, geographic, or cultural reality in Zanzibar.

### Explicit Prohibitions:
- **No Geographic Mismatches:**
  - Never pair Kiwengwa Beach with an aerial private island pier (`island-pier-boat-turquoise-water.jpg`). Kiwengwa is a wide 10km eastern coast beach with sprawling resorts, not an isolated islet.
  - Never pair Pemba Island / Chake Chake with a macro photo of pineapples (`pineapples-growing-in-tropical-plantation.jpg`).
  - Never pair Nakupenda Sandbank with concrete beach stairs (`beach-stairs-people-boats-cloudy-sky.jpg`). Nakupenda is a pure sandbank in the open ocean with no stairs or cliffs.
  - Never pair subterranean Kuza Cave with mud flats / children on tidal flats (`children-walking-tidal-flats-zanzibar.jpg`).
  - Never pair Mangapwani Slave Chambers with an Anglican cathedral (`stone-town-church-palm-tree-statues.jpg`).
  - Never pair marine turtle sanctuaries (Baraka Natural Aquarium, Mnarani Marine Turtle Pond) with monkeys (`josephine-monkey-jozani-forest-zanzibar-1.jpg`).
  - Never pair Mrembo Traditional Spa with a generic restaurant patio (`zanzibar-restaurant-patio-with-palm-trees.jpg`).
- **No Destructive Semantic Renaming:**
  - AI vision models identify literal pixels (e.g. seeing "pineapples" in a field photo taken in Pemba). Never blindly rename a location-specific asset (e.g. `chake-chake-town.jpg`) to a generic object description (`pineapples-growing-in-tropical-plantation.jpg`) if that file is linked to a destination card.
- **One-Image-One-Alt Invariant:**
  - Every image rendered across the site must have an accurate, descriptive, and consistent alt text. Never allow the same image to have contradictory alt tags across different pages.
- **Valid Fallbacks Only:**
  - Never reference non-existent fallback images (e.g. `/images/excursions.png` when the file has not been copied to `public/images/`).

---

## 4. Canonical Executive Contact Details (NON-NEGOTIABLE)

- **Primary WhatsApp & Telephone:** `+255 672 450 934`
- **Public contact email:** use `src/data/site.json` (`site.contact.email`); do not hardcode private or personal inboxes in templates.
- **Alternative Contact Mobile:** `+255 655 830 226`
- **Location:** Zanzibar, Tanzania
- **Strict Prohibition on Fake Numbers:** Under NO circumstances should fake sequential dummy numbers (`+255770000000990`, `+255770000000910`, etc.) ever appear in data files, templates, or WhatsApp links. Hotel inquiry buttons must link to the operator's verified WhatsApp (`+255 672 450 934`) with a prefilled message.

---

## 5. Verification & Zero Speculation Invariant

- **Zero Unverified "Fix" Claims:** Never claim a bug or issue is fixed until it is verified locally via `npm run build` AND in the rendered HTML output.
- **Production Truth Invariant:** Never claim changes are live on `https://spiceandsail.com` unless verified by inspecting live HTTP headers and deploy state via Cloudflare Pages dashboard. **Push to `master` = automatic production deploy via Cloudflare Pages.** Treat every push as a potential production deploy.
