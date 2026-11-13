#!/usr/bin/env python3
"""Generate responsive variants for contracted-partner gallery photos and write
srcset/sizes back into src/data/hotels.json.

Gallery cells render at ~394 CSS px at 1440, so we ship 480w and 800w variants
(never upscaled) and keep the original as the largest candidate. The first
gallery image is the full-width hero and keeps its original only.

Usage: python3 scripts/hotel-gallery-variants.py
"""
import json
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT, "public", "images", "hotels")
DATA = os.path.join(ROOT, "src", "data", "hotels.json")
VARIANTS = (480, 800)
HERO_SIZES = "(max-width: 1240px) 100vw, 1240px"
CELL_SIZES = "(min-width: 1240px) 400px, (max-width: 560px) 92vw, (max-width: 900px) 46vw, 31vw"


def make_variant(src, target):
    base, _ = os.path.splitext(src)
    out = f"{base}-{target}.jpg"
    if os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(src):
        return out, False
    with Image.open(src) as im:
        im = im.convert("RGB")
        w, h = im.size
        nh = round(h * target / w)
        im = im.resize((target, nh), Image.LANCZOS)
        im.save(out, "JPEG", quality=82, optimize=True, progressive=True)
    return out, True


def main():
    data = json.load(open(DATA))
    hotels = data["hotels"] if isinstance(data, dict) and "hotels" in data else data
    generated = touched = 0

    for hotel in hotels:
        gallery = hotel.get("gallery") or []
        if not gallery:
            continue

        for index, item in enumerate(gallery):
            src = os.path.join(IMG_DIR, os.path.basename(item["src"]))
            if not os.path.exists(src):
                print(f"[WARN] missing file: {item['src']}")
                continue

            if index == 0:
                item["sizes"] = HERO_SIZES
                item.pop("srcset", None)
                continue

            with Image.open(src) as im:
                width = im.size[0]

            candidates = []
            for target in VARIANTS:
                if width > target * 1.08:
                    out, made = make_variant(src, target)
                    generated += int(made)
                    candidates.append(f"/images/hotels/{os.path.basename(out)} {target}w")

            if not candidates:
                item.pop("srcset", None)
                item.pop("sizes", None)
                continue

            candidates.append(f"/images/{item['src']} {width}w")
            srcset = ", ".join(candidates)
            if item.get("srcset") != srcset:
                touched += 1
            item["srcset"] = srcset
            item["sizes"] = CELL_SIZES

    with open(DATA, "w") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print(f"variants generated: {generated}; srcset entries written: {touched}")


if __name__ == "__main__":
    main()
