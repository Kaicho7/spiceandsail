#!/usr/bin/env python3
"""
process_audit.py - Orchestrate the full Project A image-audit run.

Steps:
  1. Run site-image-audit.py -> regenerate manifest + findings CSV + report
  2. Run make_contact_sheets.py -> regenerate 7 contact sheets + inventory CSV
  3. Build repair manifest (UNMAPPED + UNRESOLVED images only)
  4. Build evidence log (incl. bookings-page dead Vue bindings)
  5. Validate classification counts before marking the gate passed
  6. Append to PROCESSED_AUDIT.md and write PROCESS_AUDIT_REPORT.md

Expected verdict counts after reassignment (per audit logic):
  188 CORRECT / 134 UNCERTAIN / 97 UNMAPPED / 4 UNRESOLVED = 423
"""

import json
import re
import subprocess
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

REPO = Path("/home/efatha/spiceandsail")
AUDIT_DIR = REPO / "audits"
CONTACT_DIR = AUDIT_DIR / "contact_sheets"
REPORT_PATH = AUDIT_DIR / "PROCESS_AUDIT_REPORT.md"
PROCESSED_PATH = AUDIT_DIR / "PROCESSED_AUDIT.md"

# The 4 bookings-page images are dead Vue template bindings (`:src`) that never
# hydrate - there is no Vue init script anywhere in the repo, so the browser
# renders them with an empty src. Documented, not fixable in a static audit.
BOOKINGS_UNRESOLVED = [
    "pages/bookings/",
]


def latest_manifest():
    files = sorted(AUDIT_DIR.glob("site-image-audit-manifest-*.json"))
    return files[-1] if files else None


def run(cmd, **kw):
    print(f"> {' '.join(cmd)}")
    res = subprocess.run(cmd, cwd=REPO, capture_output=True, text=True, **kw)
    print(res.stdout)
    if res.stderr:
        sys.stderr.write(res.stderr)
    if res.returncode != 0:
        raise SystemExit(f"command failed ({res.returncode}): {' '.join(cmd)}")
    return res


def build_repair_manifest(manifest):
    repair = {
        "timestamp": datetime.utcnow().isoformat(),
        "note": "Images needing manual entity assignment or data repair.",
        "items": [],
    }
    for img in manifest["images"]:
        v = img.get("verdict")
        if v in ("UNMAPPED", "UNRESOLVED"):
            repair["items"].append({
                "url": img.get("url"),
                "page": img.get("page"),
                "alt": img.get("alt"),
                "heading": img.get("heading"),
                "verdict": v,
                "reasoning": img.get("reasoning", []),
                "catalog_match": img.get("catalog_match", False),
            })
    return repair


def build_evidence_log(manifest):
    log = {
        "timestamp": datetime.utcnow().isoformat(),
        "notes": [
            "A catalog match, filename similarity, or URL path alone never "
            "establishes CORRECT; verdicts require the evidence hierarchy.",
            "Group A (134) = entity-mapped but catalog-unconfirmed -> UNCERTAIN.",
            "Group B (97) = catalog-matched but entity-unmapped -> UNMAPPED.",
        ],
        "bookings_unresolved": [
            {
                "page": "/pages/bookings/",
                "cause": "Dead Vue `:src` template binding - no Vue init script "
                         "exists in the repo, so the browser never hydrates the "
                         "binding and renders an empty src. The audit cannot "
                         "resolve these to real assets.",
                "images": 4,
            }
        ],
        "findings": manifest.get("findings", []),
    }
    return log


def validate_counts(manifest):
    counts = Counter(img.get("verdict", "UNKNOWN") for img in manifest["images"])
    expected = {"CORRECT": 188, "UNCERTAIN": 134, "UNMAPPED": 97, "UNRESOLVED": 4}
    ok = all(counts.get(k, 0) == v for k, v in expected.items()) and sum(counts.values()) == 423
    return counts, expected, ok


def main():
    # Step 1: run the audit engine
    run([sys.executable, "site-image-audit.py", "--output-dir", "audits"])

    # Step 2: regenerate contact sheets
    run([sys.executable, "make_contact_sheets.py"])

    # Step 3-5: derive artifacts from the fresh manifest
    mpath = latest_manifest()
    if not mpath:
        raise SystemExit("no manifest generated")
    with open(mpath, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    repair = build_repair_manifest(manifest)
    repair_path = AUDIT_DIR / f"repair-manifest-{mpath.stem.split('-')[-1]}.json"
    repair_path.write_text(json.dumps(repair, indent=2), encoding="utf-8")
    print(f"wrote {repair_path} ({len(repair['items'])} items)")

    log = build_evidence_log(manifest)
    log_path = AUDIT_DIR / f"evidence-log-{mpath.stem.split('-')[-1]}.json"
    log_path.write_text(json.dumps(log, indent=2), encoding="utf-8")
    print(f"wrote {log_path}")

    counts, expected, ok = validate_counts(manifest)
    verdict_line = ", ".join(f"{k}: {v}" for k, v in sorted(counts.items()))

    report = f"""# PROCESS AUDIT REPORT
Generated: {datetime.utcnow().isoformat()}

## Classification validation
- Manifest: {mpath.name}
- Total images: {sum(counts.values())}
- Verdicts: {verdict_line}
- Expected: {expected}
- **GATE: {'PASS' if ok else 'FAIL'}**

## Repair manifest
- Items: {len(repair['items'])} (UNMAPPED + UNRESOLVED)
- Repair file: {repair_path.name}

## Evidence log
- File: {log_path.name}
- Bookings UNRESOLVED: 4 images (dead Vue `:src` bindings, never hydrate)

## Contact sheets
- {CONTACT_DIR} (7 categories + inventory CSV)
"""
    REPORT_PATH.write_text(report, encoding="utf-8")
    print(f"wrote {REPORT_PATH}")

    with open(PROCESSED_PATH, "a", encoding="utf-8") as f:
        f.write(f"\n## {datetime.utcnow().isoformat()} — audit regenerated\n")
        f.write(f"- Manifest: {mpath.name}\n")
        f.write(f"- Verdicts: {verdict_line}\n")
        f.write(f"- Gate: {'PASS' if ok else 'FAIL'}\n")
    print(f"appended {PROCESSED_PATH}")

    if not ok:
        raise SystemExit("classification gate FAILED - not proceeding to Project B")


if __name__ == "__main__":
    main()
