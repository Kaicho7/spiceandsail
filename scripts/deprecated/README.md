# Deprecated page generators

These scripts are archived and **not** part of the build. They are kept for reference only.

The site now has a **single page-build architecture**:

1. `python3 scripts/generate-detail-pages.py` writes hotel and attraction `.njk`
   source files into `src/pages/hotels/` and `src/pages/attractions/`.
2. `eleventy` renders everything in `src/` into `dist/`.
3. Post-processing scripts (`generate-local-responsive.js`, `add-responsive-images.js`,
   `normalize_img_alt.js`, `add-img-dimensions.js`, `check-images.js`,
   `validate-sitemap.js`) run after Eleventy.

Tour pages in `src/pages/tours/` are hand-maintained source files and are edited directly.

## Why these were retired

- `generate-detail-pages.js` — wrote hotel/attraction HTML **directly to `dist/`**.
  It was dead: the build runs `rm -rf dist` after `generate-detail-pages.py`, so its
  output was always discarded. Superseded by `generate-detail-pages.py`, which writes
  Eleventy source instead of bypassing the template layer.
- `generate_tour_pages.py` — regenerated `src/pages/tours/*.njk` from a CSV in an
  external research directory. It was not in the build, and running it would overwrite
  hand-edited tour pages (prices, reviews, translations). Retired to prevent accidental
  clobbering.

Note: if run from this folder, `generate-detail-pages.js` will resolve its relative
paths against `scripts/deprecated/` and therefore fail; it is archival only.
