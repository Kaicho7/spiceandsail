#!/usr/bin/env python3
"""Fix the Mkeka room photo — replace courtyard exterior with actual bedroom."""
from PIL import Image, ImageEnhance
import os

SRC = "/home/efatha/curated-media/mkeka-spice-lodge/retained_best/photos/mkeka_AF1QipMCZD43X-yBL6X2.jpg"
OUT_DIR = "/home/efatha/spiceandsail/public/images/hotels"
BASE_NAME = "mkeka-spice-lodge-room-new"
MAX_W = 1200

def landscape_crop(img, vertical_bias=0.65):
    """Smart-crop portrait to 3:2 landscape, biased toward bed area."""
    w, h = img.size
    target_h = int(w * 2 / 3)
    if target_h >= h:
        # Already landscape enough
        return img
    # Calculate vertical offset with bias (0.5=center, higher=lower in image)
    max_offset = h - target_h
    top = int(max_offset * vertical_bias)
    return img.crop((0, top, w, top + target_h))

def process():
    img = Image.open(SRC)
    print(f"Source: {img.size[0]}x{img.size[1]} ({img.mode})")
    
    # Smart-crop to landscape — bias 0.55 to capture the bed (which is in lower-left)
    # but also keep the art on wall
    cropped = landscape_crop(img, vertical_bias=0.55)
    print(f"Cropped: {cropped.size[0]}x{cropped.size[1]}")
    
    # Slight brightness boost — the room looks a bit dim
    enhancer = ImageEnhance.Brightness(cropped)
    cropped = enhancer.enhance(1.15)
    
    # Scale to max 1200px wide
    w, h = cropped.size
    if w > MAX_W:
        ratio = MAX_W / w
        cropped = cropped.resize((MAX_W, int(h * ratio)), Image.LANCZOS)
    
    final_w, final_h = cropped.size
    print(f"Final full: {final_w}x{final_h}")
    
    # Save full size
    full_path = os.path.join(OUT_DIR, f"{BASE_NAME}.jpg")
    cropped.save(full_path, "JPEG", quality=85)
    print(f"Saved: {full_path}")
    
    # Generate responsive variants
    for target_w in [480, 800]:
        if target_w < final_w:
            ratio = target_w / final_w
            variant = cropped.resize((target_w, int(final_h * ratio)), Image.LANCZOS)
        else:
            variant = cropped
        variant_path = os.path.join(OUT_DIR, f"{BASE_NAME}-{target_w}.jpg")
        variant.save(variant_path, "JPEG", quality=85)
        print(f"Saved: {variant_path} ({variant.size[0]}x{variant.size[1]})")

if __name__ == "__main__":
    process()
    print("\n✅ Mkeka room photo fixed!")
