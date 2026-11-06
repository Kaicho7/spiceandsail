# TODAS - site image audit

## Overview
Automate image identity audit of the Spice & Sail Zanzibar tourism website.

## Current local site
  base: http://localhost:8080/
  pages seen: 49 (existing audits)
  images seen: 224 (existing audits)

## Scope
- Enumerate ALL site routes via sitemap + file system (dist/ files and sitemap.xml).
- Extract all images (src, currentSrc, srcset, alt, dims, position, component/h-card, nearest heading).
- Extract CSS background images and inline-base64.
- Identify external hosts vs approved local CDN (/images/, /.netlify/images/).
- Capture request headers, size, HTTP status, natural rendered dimensions.
- Save desktop and mobile viewport screenshots per route.
- Distinguish image types: hero, card, gallery, thumbnail, background.

## Content entity mapping
- Build index of entities: hotels, attractions, tours, areas, experiences, packages.
- Per entity capture primary-use photo field (hotels.photo, tours.featured, area map image).
- Map each image in the site to its entity using:
  * hotelPhoto filter (per-entity photo, exists in public/images/hotels/).
  * zoneImg filter (area/zone image, from .eleventy.js zoneImage).
  * attractionImg filter (mapped via .eleventy.js attractionImage).
  * tour canonical slugMap.
  * For any image not in a dedicated slot, label as pool fallback.

## Evidence rules
- No automatic classification: identify legitimate /images/ hosts and reject only unapproved remote dependencies.
- Use project’s verified catalog (canonical-image-catalog.json) and metadataIndex.
- Verify a photograph against an AUTHORITATIVE original source (official site gallery, verified project assets). Never use filename or visual similarity alone.
- For each image record:
  * entity id, name, category, slug, page url, component context, image role.
  * image url, original source (if any), what the image depicts (caption/title/alt context), verification evidence, verdict (CORRECT/INCORRECT/UNCERTAIN/UNRESOLVED).

## Verdict criteria (multi-factor scoring)
1. Entity match: primary-use photo vs pool fallback (INCORRECT if mismatch).
2. Reusage: >6 uses (IMG_REUSE) pushes to UNCERTAIN.
3. External host: approved /images/ is local; legitimate CDNs (Netlify) are approved; all other remotes are WRONG.
4. Visual mismatch: detected via caption/title vs actual content (human+script logic, not ML).
5. Missing/mislabelled original photograph (catalog has no corresponding visual reference) → UNCERTAIN.
6. Unresolved: image source exists but identity cannot be determined → UNRESOLVED.

## Output formats
- JSON: site-image-audit-manifest-v{version}.json
- CSV: site-image-audit-findings.csv (searchable)
- Evidence contact sheets: per-category PDFs (7 sheets)
- HTML summary report: SITE_IMAGE_AUDIT_REPORT.md (with embedded evidence links)
- All files in the project root: no .git commit, no .netlify push, no deployment.

## Process order
1. Crawl live site + extract screenshot evidence.
2. Build JSON/CSV manifest with image-to-entity mapping.
3. Issue verdicts for each image.
4. Produce 7 labelled contact sheets.
5. Write root-cause evidence report (no technical corrections).
6. Prepare repairs in defined sequence:
   a) Wrong photograph assigned to wrong properties/experiences.
   b) Incorrect image IDs, slugs, database relationships.
   c) Missing original photographs.
   d) Incorrect image resolution/dimensions/cropping.
   e) Responsive loading & performance.
   f) Alt text & accessibility.

## How to run
1. Start local site: eleventy --serve (port 8080).
2. Install python deps: pip install -r requirements.txt (if needed).
3. Run audit script: python3 site-image-audit.py [--output-dir audits] [--threads N] [--mobile]

## Tools used
- Requests + BS4 + Pillow (Python).
- PIL for screenshot / contact sheet generation.
- Standard library CSV/JSON writers.
- Quick classification: python regex, filename to entity mapping.
- Manual verification via browser devtools and open gallery verification (outside automation).

## Constraints
- Localhost only (no Netlify mods, no Git push, no deployment).
- One-shot evidence gathering (do not fix on first run).
- Human-in-the-loop for any verdict of UNCERTAIN.
- Use existing verified catalog assets first, else research via external sources.
- Respect copyright, do not host or redistribute images.