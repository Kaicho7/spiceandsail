# Spiceandsail Translation Usage Checklist

## Overview
This document tracks which `translations.json` keys are actively used in templates vs. dead storage.

### Active Translations (used via `t()` filter)

| Key | English Meaning | Languages Using `t()` | Template Files |
|-----|----------------|----------------------|----------------|
| `whatsapp_greeting` | "Hi Spice and Sail, I would like to inquire about" | **7/7** | `index.njk` (all lang pages) |

**All 7 non-English languages** now use `{{ 'whatsapp_greeting' | t('lang') }}`:
- `ar` — Arabic, `dir="rtl"` set on `<main>` ✅
- `de` — German ✅
- `fr` — French ✅
- `it` — Italian ✅
- `pl` — Polish ✅
- `ru` — Russian ✅
- `en` — English (default, no filter needed)

### Dead Storage (in translations.json but NOT used in any template)

| Key Count | Description |
|-----------|-------------|
| ~340+ strings | All other translation keys (`nav_*`, `btn_*`, `label_*`, `footer_*`, etc.) are defined in `src/data/translations.json` but **hardcoded** in each language's `.njk` template. These are "dead storage" — they exist in the JSON but are never dynamically loaded. |

**Examples of unused keys:**
- `nav_home`, `nav_tours`, `nav_all_tours`, `nav_rare_experiences`
- `btn_whatsapp_book`, `btn_check_rates`, `btn_book_transfer`
- `label_planning_range`, `label_per_vehicle`, `label_per_person`
- `whatsapp_greeting` (partial — only the WhatsApp link text; the key is now used in all 7 language WhatsApp CTAs, but other copy in those templates is still hardcoded)
- `footer_talk_with_team`, `footer_0_deposit`, `footer_marine_fees`, etc.

### Migration Priority

| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| **P0** | Keep using `whatsapp_greeting | t('lang')` across all 7 languages ✅ | Done | High — centralizes the most visible copy |
| **P1** | Migrate major CTAs & headings to `t()` filter | Medium | Medium — reduces duplication |
| **P2** | Refactor templates to use dynamic `translate()` lookup | High | High — full i18n pipeline |

### How to Add a New Translation Key

1. Add the key to `src/data/translations.json` under `"strings"` with all language values
2. Use in templates: `{{ 'my-key' | t('lang') }}`
3. Fallback behavior: If key or language missing, returns the key string itself + console warning

### How to Add a New Language

1. Add language entry to `translations.json` `"languages"` object
2. Add all translation strings for that language under `"strings"`
3. Create language directory: `src/pages/<lang>/`
4. Create `index.njk` with `lang: <lang>` frontmatter
5. Add `alternate_<lang>` hreflang to root `index.njk`
6. Use `{{ 'key' | t('<lang>') }}` in templates

### Verification

Run `npm run build` to validate Eleventy builds successfully with the new i18n changes. Check for `console.warn` messages about missing translations.