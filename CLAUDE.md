# CLAUDE.md — Project Rules for Spice & Sail (formerly Dhow Coast Travels)

## 1. Git Write Operations — EXPLICIT PERMISSION REQUIRED
No coder or AI assistant shall commit, amend, push, force-push, or otherwise modify git history in this repository **without explicit, direct permission from the user**.
- PROHIBITED without explicit user command: `git commit`, `git push`, `git amend`, `git rebase`, `git reset --hard`.
- PERMITTED without approval: Reading files, running builds (`npm run build`), running local verification scripts, editing working tree files, inspect git status/diff.
- To push, the user must explicitly name the remote, branch, and give direct permission. Until then: **DO NOT COMMIT. DO NOT PUSH.**

## 2. Primary Core Pillar & Single Source of Truth Invariant (NON-NEGOTIABLE)
The **tourism empirical research archive and photo vault** located at:
`/home/efatha/Desktop/CODERS/CODING AGENTS UNIQUE PRODUCT/SUPA APP LEADSCOUT KAZI/tourism/`
is the **Alpha and Omega / Primary Core Pillar** for the entire `spiceandsail.com` website.

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

## 3. Strict Image & Photography Invariant (ZERO HALLUCINATIONS)
Under NO circumstances may any coder substitute stock photos or make code mappings that contradict physical, geographic, or cultural reality in Zanzibar.
- **No Geographic Mismatches:**
  - Never pair Kiwengwa Beach with an aerial private island pier (`island-pier-boat-turquoise-water.jpg`).
  - Never pair Pemba Island / Chake Chake with a macro photo of pineapples (`pineapples-growing-in-tropical-plantation.jpg`).
  - Never pair Nakupenda Sandbank with concrete beach stairs (`beach-stairs-people-boats-cloudy-sky.jpg`).
  - Never pair subterranean Kuza Cave with mud flats / children on tidal flats (`children-walking-tidal-flats-zanzibar.jpg`).
  - Never pair Mangapwani Slave Chambers with an Anglican cathedral (`stone-town-church-palm-tree-statues.jpg`).
  - Never pair marine turtle sanctuaries (Baraka Natural Aquarium, Mnarani Marine Turtle Pond) with monkeys (`josephine-monkey-jozani-forest-zanzibar-1.jpg`).
  - Never pair Mrembo Traditional Spa with a generic restaurant patio (`zanzibar-restaurant-patio-with-palm-trees.jpg`).
- **No Destructive Semantic Renaming:** Never rename a location-specific image to a generic pixel description if that file is linked to a destination card.
- **One-Image-One-Alt Invariant:** Every image rendered across the site must have an accurate, descriptive, and consistent alt text.
- **Valid Fallbacks Only:** Never reference non-existent fallback images (e.g. `/images/excursions.png`).

## 4. Canonical Public Contact Details (NON-NEGOTIABLE)
- **Canonical source:** `src/data/site.json` (`contact`, `address`, `hours`). Templates must read from that file, not hardcode a second copy.
- **Primary WhatsApp & Telephone:** `+255 672 450 934`
- **Public email:** use the value in `src/data/site.json` (`contact.email`); do not hardcode a separate address.
- **Location:** Mbuzini, Mjini Magharibi, Zanzibar, Tanzania — Postcode 71208 (use `src/data/site.json` as source)
- **Strict Prohibition on Fake Numbers:** Under NO circumstances should fake sequential dummy numbers (`+255770000000990`, etc.) ever appear in data files, templates, or WhatsApp links. Hotel inquiry buttons must link to the operator's verified WhatsApp (`+255 672 450 934`) with a prefilled message.

## 5. Verification & Zero Speculation Invariant
- **Zero Unverified "Fix" Claims:** Never claim a bug or issue is fixed until verified locally via `npm run build` AND in the rendered HTML output.
- **Production Truth Invariant:** Never claim changes are live on `https://spiceandsail.com` unless verified by inspecting live HTTP headers and deploy state via Netlify Production API. Git push does NOT deploy this site automatically (CI is unlinked; production requires direct CLI deploy: `npx netlify deploy --prod --dir=dist`).
