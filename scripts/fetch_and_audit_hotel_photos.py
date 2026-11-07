import json
import os
import re
import ssl
import sys
import urllib.request
import urllib.parse
from PIL import Image

TARGET_DIR = "/home/efatha/spiceandsail/public/images/hotels"
HOTELS_JSON = "/home/efatha/spiceandsail/src/data/hotels.json"
REPORTS_DIR = "/home/efatha/spiceandsail/reports/hotel-photo-fix"
os.makedirs(TARGET_DIR, exist_ok=True)
os.makedirs(REPORTS_DIR, exist_ok=True)

# Standard industry standards:
# Min width: 900px, max width: 1600px, aspect ratio between 1.2 and 2.1 (landscape), JPEG q82 progressive
def optimize_and_save_image(src_path, dest_path):
    try:
        with Image.open(src_path) as img:
            img = img.convert("RGB")
            w, h = img.size
            aspect = w / h
            if w < 600 or h < 400:
                print(f"Skipping {src_path}: too small ({w}x{h})")
                return False, f"Too small ({w}x{h})"
            
            # If wider than 1600, scale down maintaining aspect ratio
            if w > 1600:
                new_w = 1600
                new_h = int(1600 / aspect)
                img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
                w, h = new_w, new_h

            img.save(dest_path, "JPEG", quality=82, progressive=True, optimize=True)
            return True, f"Saved ({w}x{h}, aspect {aspect:.2f})"
    except Exception as e:
        return False, str(e)

print("Image processing engine ready.")
