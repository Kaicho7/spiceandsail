#!/usr/bin/env python3
"""Resize + recompress JPG/JPEG images. Skips PNG/WebP."""
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DIRS = [ROOT / "public/images", ROOT / "public/images/hotels"]
MIN_SIZE = 300_000
MAX_WIDTH = 1600
QUALITY = 82

total_before = total_after = 0
processed = failed = 0

for d in DIRS:
    if not d.exists():
        continue
    for f in sorted(d.rglob("*")):
        if not f.is_file() or f.suffix.lower() not in (".jpg", ".jpeg"):
            continue
        size = f.stat().st_size
        if size < MIN_SIZE:
            continue
        total_before += size
        try:
            img = Image.open(f).convert("RGB")
            w, h = img.size
            if w > MAX_WIDTH:
                img = img.resize((MAX_WIDTH, int(h * MAX_WIDTH / w)), Image.LANCZOS)
            img.save(f, "JPEG", quality=QUALITY, optimize=True, progressive=True)
            after = f.stat().st_size
            total_after += after
            processed += 1
            print(f"{f.relative_to(ROOT/'public/images')}: {size//1024}K -> {after//1024}K")
        except Exception as e:
            failed += 1
            print(f"FAILED: {f}: {e}", file=sys.stderr)

print(f"\n=== SUMMARY ===")
print(f"Processed: {processed}")
print(f"Failed:    {failed}")
if total_before:
    print(f"Before:    {total_before/1024/1024:.1f} MB")
    print(f"After:     {total_after/1024/1024:.1f} MB")
    print(f"Saved:     {(total_before-total_after)/1024/1024:.1f} MB ({100*(1-total_after/total_before):.1f}%)")
