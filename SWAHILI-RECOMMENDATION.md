# Swahili Language Recommendation — Keep or Remove?

## Recommendation: **KEEP — but restrict to high-value, authentic usage only**

## Evidence
**Current state (post-normalisation)**:
- `hotels.json`: 2 occurrences (proper nouns: "Swahili-Arab-Indian fusion", "Swahili gardens")
- `attractions.json`: 2 occurrences ("Swahili culture", "Swahili cuisine")
- `tours.json`: 0
- `packages.json`: 0
- `concierge-catalogue.json`: 0
- **Total: 4 occurrences across all data files** — minimal, authentic, contextually appropriate.

**Search volume (UberSuggest, vault data)**:
- "Swahili culture Zanzibar": 320/mo
- "Swahili food Zanzibar": 210/mo
- "Swahili language basics": 480/mo
- "Kiswahili phrases": 1,100/mo
- **Zero volume** for "Swahili hotel Zanzibar" or "Swahili tour Zanzibar" as commercial intent.

**Competitor usage**:
- African Budget Safaris: "Swahili" in cultural tour descriptions (top-ranking)
- Zanzibar Travel: "Kiswahili" in "Useful Phrases" blog post (ranks #2)
- **No competitor** uses Swahili as a primary SEO keyword for hotel/tour sales.

## Why Keep (Strategic)
1. **EEAT signal**: Authentic cultural terminology demonstrates local expertise — Google's "Experience" criterion.
2. **Long-tail capture**: "Swahili culture tour", "Swahili cooking class" are bookable excursions (not in current catalogue but viable).
3. **Brand differentiation**: "Spice and Sail Zanzibar" + Swahili cultural depth = unique positioning vs generic OTAs.
4. **User experience**: Travellers expect basic Swahili context (Jambo, Asante, Karibu) — omission feels sterile.

## Guardrails (Prevent Keyword Stuffing)
- **Only** in: cultural tour descriptions, attraction pages (Palace Museum, Princess Salme), blog posts about culture/food.
- **Never** in: hotel meta titles, transfer pages, booking CTAs, schema `name` fields.
- **Max 1 occurrence per page** where used.
- Use **"Kiswahili"** for language, **"Swahili"** for culture/people — linguistically accurate.

## Implementation (Already Done)
- Normalisation script capitalised "swahili" → "Swahili" / "Kiswahili" where appropriate.
- Removed all gratuitous occurrences (was 22 across files, now 4).
- No Swahili in `site.json` brand fields, `seo.njk` titles, or schema `Organization.name`.

## Verdict
**Keep 4 authentic occurrences. Do not add more.** The ROI on Swahili as an SEO keyword is near zero for commercial intent; the EEAT/trust value is real but saturates at minimal usage.
