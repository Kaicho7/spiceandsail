#!/usr/bin/env python3
"""Resize + recompress oversized JPG/JPEG, WebP and PNG images.

Only images larger than MIN_SIZE and with a side longer than MAX_DIM are
touched, so repeated runs do not recompress already-optimised assets.
"""
import sys
import tempfile
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DIRS = [ROOT / "public/images"]
MIN_SIZE = 300_000
MAX_DIM = 1600
QUALITY = 82

total_before = total_after = 0
processed = failed = skipped = 0


def save_optimised(img, target, suffix):
    if suffix in (".jpg", ".jpeg"):
        img.convert("RGB").save(target, "JPEG", quality=QUALITY, optimize=True, progressive=True)
    elif suffix == ".webp":
        img.convert("RGB").save(target, "WEBP", quality=QUALITY, method=6)
    elif suffix == ".png":
        img.save(target, "PNG", optimize=True)


for d in DIRS:
    if not d.exists():
        continue
    for f in sorted(d.rglob("*")):
        suffix = f.suffix.lower()
        if not f.is_file() or suffix not in (".jpg", ".jpeg", ".webp", ".png"):
            continue
        size = f.stat().st_size
        if size < MIN_SIZE:
            continue
        try:
            img = Image.open(f)
            w, h = img.size
            if max(w, h) <= MAX_DIM:
                skipped += 1
                continue
            total_before += size
            scale = MAX_DIM / max(w, h)
            new_size = (max(1, round(w * scale)), max(1, round(h * scale)))
            resized = img.resize(new_size, Image.LANCZOS)
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False, dir=f.parent) as tmp:
                tmp_path = Path(tmp.name)
            save_optimised(resized, tmp_path, suffix)
            after = tmp_path.stat().st_size
            if after < size:
                tmp_path.replace(f)
                total_after += after
                print(f"{f.relative_to(ROOT/'public/images')}: {size//1024}K -> {after//1024}K")
            else:
                tmp_path.unlink()
                total_after += size
            processed += 1
        except Exception as e:
            failed += 1
            print(f"FAILED: {f}: {e}", file=sys.stderr)

print(f"\n=== SUMMARY ===")
print(f"Processed: {processed}")
print(f"Skipped (already <= {MAX_DIM}px): {skipped}")
print(f"Failed:    {failed}")
if total_before:
    print(f"Before:    {total_before/1024/1024:.1f} MB")
    print(f"After:     {total_after/1024/1024:.1f} MB")
    print(f"Saved:     {(total_before-total_after)/1024/1024:.1f} MB ({100*(1-total_after/total_before):.1f}%)")
