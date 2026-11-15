# Spice & Sail redesign audit notes

## Branch and scope
- Branch: `redesign/eco-swahili-mobile-2026-11-15`
- Base master SHA: `580ab2b22a21a2af320a0bde5a98e26ab56988e5`
- This work is branch-only. No production deployment, DNS, Netlify environment variable, or master-branch change was made.
- The baseline CSV currently covers the homepage, tour listing, Safari Blue detail, transfer listing and Nungwi transfer detail. It is source-derived and is not yet a complete generated-site crawl of every localized URL.

## Owner decisions deliberately left alone
1. **“Original Safari Blue since 1990”** remains in `src/data/tours.json` (description, short description and overview). Confirm operator identity/authorization and evidence before emphasizing this claim.
2. **Redirect conflicts and legacy aliases** in `netlify.toml` were not edited. They need a separate redirect-map review before consolidation.
3. **Long SEO titles** were preserved as required. The transfer listing and Nungwi transfer title likely exceed 60 characters after the shared brand suffix. Decide separately whether to approve shorter title tags.
4. **Meta descriptions** were preserved; the complete generated-site count over 160 characters still needs a rendered inventory.
5. **Unused, duplicate, scraped or risky assets** were not removed, renamed or re-tagged. Existing catalogs and hotel photos remain untouched.

## Verification still required
- No local Eleventy build or browser render was run from this connected session; the repository was accessed through GitHub APIs rather than cloned.
- No baseline or post-change Lighthouse score has been measured here.
- The PR workflow is configured to run mobile Lighthouse against the homepage, Safari Blue and Nungwi airport transfer URLs; inspect its artifact and job results before calling the stated score targets met.
- Local and non-production Netlify build contexts emit `noindex,nofollow`; production Netlify context remains indexable.
- No reviews, ratings, eco certification, insurance, safety, group-size or sustainability claims were invented.
- No inventory image is deleted or rewritten by the new responsive image post-build pass.
