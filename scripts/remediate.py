#!/usr/bin/env python3
"""Remediate image library: dedupe, rename, canonical catalog, fix Pemba + hotels.

Modes:
  python3 scripts/remediate.py plan      # print what would change, no writes
  python3 scripts/remediate.py apply     # apply changes
"""
import os, re, json, sys, shutil, hashlib
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "public", "images")
VISION = os.path.join(ROOT, ".vision", "image_vision.jsonl")
SRC_DATA = os.path.join(ROOT, "src", "data")
ELEVENTY = os.path.join(ROOT, ".eleventy.js")
NORMALIZE = os.path.join(ROOT, "scripts", "normalize_img_alt.js")

SPECIAL = {"logo.png", "apple-touch-icon.png", "og-image.png",
           "favicon-16x16.svg", "favicon-32x32.png", "site.webmanifest",
           "default-tour-hero.jpg"}


def load_vision():
    recs = {}
    for l in open(VISION):
        l = l.strip()
        if not l:
            continue
        try:
            r = json.loads(l)
        except Exception:
            continue
        if r.get("error"):
            continue
        recs[r["file"]] = r
    return recs


def ham(a, b):
    return bin(int(a, 16) ^ int(b, 16)).count("1")


def new_name(r, used):
    base = (r.get("seo_filename") or r["file"].rsplit(".", 1)[0])
    base = re.sub(r"[^a-z0-9]+", "-", base.lower()).strip("-")[:60] or "image"
    ext = r["file"].rsplit(".", 1)[-1].lower()
    cand = f"{base}.{ext}"
    i = 1
    while cand in used or cand in SPECIAL:
        cand = f"{base}-{i}.{ext}"
        i += 1
    used.add(cand)
    return cand


def build_plan(recs):
    # dedupe exact by md5: keep best (quality, bytes, resolution)
    by_md5 = defaultdict(list)
    for r in recs.values():
        by_md5[r["md5"]].append(r)
    keepers = []
    deleted = []
    for md5, group in by_md5.items():
        group.sort(key=lambda r: (-r.get("quality_score", 0),
                                  -r.get("bytes", 0),
                                  -(r.get("width", 0) * r.get("height", 0))))
        keepers.append(group[0])
        for g in group[1:]:
            deleted.append(g)
    # near-dupes by dhash <= 4 among keepers (skip if subjects differ a lot)
    # (conservative: only exact md5 dedupe applied automatically)
    used = set(SPECIAL)
    mapping = {}
    for r in keepers:
        if r["file"] in SPECIAL:
            mapping[r["file"]] = r["file"]
        else:
            mapping[r["file"]] = new_name(r, used)
    # catalog keyed by NEW filename
    catalog = {}
    for r in keepers:
        new = mapping[r["file"]]
        catalog[new] = {
            "file": new,
            "alt_text": r.get("alt_text", ""),
            "category": r.get("category", "other"),
            "activity": r.get("activity", "other"),
            "place": r.get("place_guess"),
            "subject": r.get("subject", ""),
            "quality_score": r.get("quality_score", 3),
            "width": r.get("width"),
            "height": r.get("height"),
            "bytes": r.get("bytes"),
        }
    return {
        "keepers": keepers,
        "deleted": deleted,
        "mapping": mapping,
        "catalog": catalog,
    }


def print_plan(plan):
    print("=== REMEDIATION PLAN ===")
    print("keepers:", len(plan["keepers"]))
    print("deleted (exact dupes):", len(plan["deleted"]))
    renames = [(o, n) for o, n in plan["mapping"].items() if o != n]
    print("renames:", len(renames))
    for o, n in renames:
        print(f"  {o} -> {n}")
    print("catalog entries:", len(plan["catalog"]))


def apply(plan):
    # 1. delete duplicate copies
    for d in plan["deleted"]:
        p = os.path.join(IMG, d["file"])
        if os.path.exists(p):
            os.remove(p)
            print("deleted:", d["file"])
    # 2. rename keepers
    for old, new in plan["mapping"].items():
        if old == new:
            continue
        src = os.path.join(IMG, old)
        dst = os.path.join(IMG, new)
        if os.path.exists(src) and not os.path.exists(dst):
            os.rename(src, dst)
            print("renamed:", old, "->", new)
    # 3. write canonical catalog
    cat_path = os.path.join(SRC_DATA, "image-catalog.json")
    with open(cat_path, "w") as f:
        json.dump(plan["catalog"], f, indent=2, ensure_ascii=False)
    print("wrote", cat_path)
    return plan


def update_eleventy(plan, mode):
    """Rewrite .eleventy.js metadata loading + maps to use new filenames."""
    s = open(ELEVENTY).read()
    # Replace metadataFiles block with single catalog
    old_meta = '''  // Load all 6 metadata JSON files to build a filename→metadata lookup
  const metadataFiles = [
    "complete-image-metadata.json",
    "image-metadata.json",
    "personal-photo-metadata-updated.json",
    "personal-photo-metadata.json",
    "stock-photo-metadata-updated.json",
    "stock-photo-metadata.json"
  ];
  const metadataIndex = {};
  metadataFiles.forEach(metadataFile => {
    try {
      const metadata = JSON.parse(fs.readFileSync(path.join(__dirname, "src", "data", metadataFile), "utf8"));
      const entries = Array.isArray(metadata) ? metadata : (metadata.images || metadata.metadata || []);
      entries.forEach(entry => {
        if (entry && entry.file) {
          metadataIndex[entry.file] = entry;
        }
      });
    } catch(e) {
      // Skip metadata files that can't be read
    }
  });'''
    new_meta = '''  // Load single canonical image catalog (vision-audited)
  const metadataFiles = ["image-catalog.json"];
  const metadataIndex = {};
  metadataFiles.forEach(metadataFile => {
    try {
      const metadata = JSON.parse(fs.readFileSync(path.join(__dirname, "src", "data", metadataFile), "utf8"));
      const entries = Object.values(metadata);
      entries.forEach(entry => {
        if (entry && entry.file) {
          metadataIndex[entry.file] = entry;
        }
      });
    } catch(e) {
      // Skip metadata files that can't be read
    }
  });'''
    if old_meta not in s:
        print("  [eleventy] metadata block not found (may already be patched)")
    else:
        s = s.replace(old_meta, new_meta)
        print("  [eleventy] metadata block updated")

    # Update slugMap values via mapping
    def repl_map_values(m, mapping):
        out = {}
        for k, v in m.items():
            out[k] = mapping.get(v, v)
        return out

    # For simplicity: do targeted string replacements for known references
    mapping = plan["mapping"]
    changed = 0
    for old, new in mapping.items():
        if old == new:
            continue
        # replace whole-token occurrences of old filename in .eleventy.js
        pat = re.escape(old)
        # only replace if it's a filename token (surrounded by quotes or punctuation)
        new_s, n = re.subn(r'(["\'])' + pat + r'(["\'])', lambda m: m.group(1) + new + m.group(2), s)
        if n:
            s = new_s
            changed += n
    print(f"  [eleventy] filename reference replacements: {changed}")
    if mode == "apply":
        open(ELEVENTY, "w").write(s)
        print("  [eleventy] .eleventy.js written")
    return s


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "plan"
    if mode not in ("plan", "apply"):
        print("usage: remediate.py plan|apply"); sys.exit(1)
    recs = load_vision()
    disk = set(f for f in os.listdir(IMG)
               if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp")))
    recs = {f: r for f, r in recs.items() if f in disk}
    print(f"vision records on disk: {len(recs)}")
    plan = build_plan(recs)
    print_plan(plan)
    if mode == "apply":
        plan = apply(plan)
        update_eleventy(plan, "apply")
        print("\nAPPLY complete. Next: update normalize_img_alt.js, Pemba, hotels, then rebuild.")
    else:
        print("\n(plan only — run with 'apply' to execute)")


if __name__ == "__main__":
    main()
