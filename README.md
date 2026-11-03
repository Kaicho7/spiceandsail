# Spice and Sail Zanzibar Site

## Overview
A Jamstack static site built with **Eleventy (11ty)** and deployed to **Netlify**. The site promotes Zanzibar tourism, showcases attractions, hotels, and tours, and includes a direct‑booking form powered by Netlify Functions.

## Features
- SEO‑friendly HTML generated from Nunjucks templates and JSON data files.
- Responsive design using CSS custom properties (`--zanzibar-blue`, `--zanzibar-gold`, …).
- Local‑SEO schema (`LocalBusiness`, `TouristAttraction`, `Hotel`, `TouristTrip`).
- Netlify CMS admin UI for non‑technical content updates.
- Netlify Forms + a simple server‑less function (`booking.js`) for booking requests.
- Open Graph / Twitter Card meta tags for social sharing.

## Getting Started
```bash
# Clone the repo (if not already)
git clone <repo‑url> spiceandsail
cd spiceandsail

# Install dependencies
npm install

# Run the Eleventy development server (live reload)
npm run start

# Build for production
npm run build
```

## Netlify Deployment
1. Push the repository to GitHub (or any Git provider).
2. In Netlify, click **New site from Git** → connect your repo.
3. Set **Build command** to `npm run build` and **Publish directory** to `public`.
4. Enable **Netlify Identity** and **Git‑Gateway** for the CMS.
5. Deploy – Netlify will automatically run `npm install && npm run build`.

## SEO Checklist
| Item | Details |
|------|---------|
| **Primary keywords** | `Zanzibar tourism`, `Zanzibar travel guide`, `Zanzibar hotels`, `Zanzibar tours`, `Zanzibar safari`, `Zanzibar transfers` |
| **Meta tags** | Unique `<title>` and `<meta name="description">` per page (≤60 chars title, ≤155 chars description). |
| **Open Graph** | `og:title`, `og:description`, `og:image` (gradient placeholder). |
| **Twitter Cards** | `summary_large_image` with same title/description. |
| **Structured data** | JSON‑LD for `LocalBusiness`, `TouristAttraction` (each attraction), `Hotel` (each hotel), `TouristTrip` (each tour). |
| **NAP consistency** | Address, phone, email appear in footer, schema, and contact page. |
| **Performance** | Images served via `srcset`, CSS/JS minified, gzip/brotli enabled by Netlify. |
| **Accessibility** | Semantic HTML (`header`, `nav`, `main`, `section`, `footer`), alt text for images, sufficient colour contrast. |
| **Mobile‑first** | Breakpoints at 900 px, 760 px, 560 px – tested with Chrome DevTools. |
| **Rich Results** | Run each page through Google Rich Results Test to verify schema. |

## Content Management (Netlify CMS)
- Admin UI located at `/admin/` (e.g., `https://your‑site.netlify.app/admin`).
- Manage **Attractions**, **Hotels**, and **Tours** via markdown files.
- The CMS writes directly to the `src/` folder and commits to the repo via Git‑Gateway.

## Booking Form
- The contact page uses **Netlify Forms** (`data-netlify="true"`).
- Submissions trigger the server‑less function `netlify/functions/booking.js` which currently logs the request and returns a thank‑you JSON response.
- For production, replace the placeholder with SendGrid email or Google Sheets integration.

## Development Tips
- Run `npm run start` while editing templates – Eleventy watches for changes.
- Use `npm run build` to generate the final static files in `public/`.
- Run Lighthouse (Chrome DevTools) on the built site to ensure > 90 % scores.

## License
MIT – feel free to adapt, extend, or commercialise.

---
*Built by Philip Jumbe*