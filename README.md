# Spice & Sail Zanzibar

Static marketing site and WhatsApp-first concierge for Spice & Sail Zanzibar.
Built with Eleventy 2, deployed on Netlify.

## Commands

```bash
npm install
npm run build        # build dist/ and verify image references
npm test             # node:test suite
npm start            # Eleventy dev server
npm run preview:local
```

Node 22 is pinned in `.nvmrc` and `netlify.toml`. Environment variables are
documented in `.env.example`.

## Structure

- `src/pages/` — Eleventy pages (EN, `it/`, `de/`)
- `src/_includes/` — layout, SEO/JSON-LD, header, footer, tour FAQ
- `src/data/` — site facts, catalogue, hotels, tours, packages, translations
- `src/lib/concierge/` — deterministic replies, pricing, validation, security
- `netlify/functions/` — chat, lead capture, review capture, admin
- `public/images/` — source images served from `/images/`
- `_headers` / `netlify.toml` — security headers, redirects, caching
- `scripts/optimize-images.py` — resize/recompress oversized source images

## Booking and payments

Booking is WhatsApp-first. The website does not collect card details and does
not run a checkout. After the team confirms availability, it sends a secure
DPO or Pesapal payment link to the guest on WhatsApp. Copy must reflect that
flow; do not imply on-site card processing.

## Contact data

Public contact details and opening hours live in `src/data/site.json`. Templates
should read `site.contact`, `site.address`, and `site.hours` instead of
hardcoding another copy.

## Verification

```bash
npm run build
npm test
```

The build fails if an image reference in `dist/` does not resolve. The tests
cover redirects, international pages, privacy, concierge gates, image integrity,
and the SEO/social bindings.
