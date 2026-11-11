# Image & Audit Status

**Superseded 2026-11-11 — do not use as current instructions.**

This file previously claimed that the full image audit was complete. That was not reliable evidence: the audit log reported 188 CORRECT, 231 UNCERTAIN, and 4 UNRESOLVED image verdicts, and later coder audits identified mismatched image mappings and incomplete re-tagging.

Current status:

- Local build passes; `scripts/check-images.js` verifies that image references resolve.
- `tests/photo-integrity.test.js` passes.
- Semantic/geographic image identity is **not proven** by the automated checks.
- 125 source images are still over 300 KB.
- Any remaining image remediation belongs in a separate, explicitly approved visual-verification pass with owner sign-off.

See `TASKS.md` and `PROGRESS.md` for current work and verification results.
