import os, sys, json, urllib.request, urllib.parse, ssl, io
from PIL import Image

providers_path = '/home/efatha/.config/ai-keys/providers.env'
env_keys = {}
if os.path.exists(providers_path):
    with open(providers_path) as f:
        for line in f:
            line = line.strip()
            if line.startswith('export '):
                line = line[7:]
            if '=' in line and not line.startswith('#'):
                k, v = line.split('=', 1)
                env_keys[k.strip()] = v.strip().strip('\"').strip('\'')

TAVILY_KEY = env_keys.get('TAVILY_API_KEY')
TARGET_DIR = "/home/efatha/spiceandsail/public/images/hotels"

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}

def search_tavily(query):
    if not TAVILY_KEY:
        return []
    url = "https://api.tavily.com/search"
    payload = {
        "api_key": TAVILY_KEY,
        "query": query,
        "include_images": True,
        "search_depth": "basic",
        "max_results": 6
    }
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'})
    try:
        resp = urllib.request.urlopen(req, timeout=10)
        data = json.loads(resp.read().decode('utf-8'))
        return data.get('images', [])
    except Exception:
        return []

def download_and_validate(img_url, dest_path):
    try:
        req = urllib.request.Request(img_url, headers=HEADERS)
        data = urllib.request.urlopen(req, context=ctx, timeout=10).read()
        if len(data) < 25000:
            return False, "File too small"
        with Image.open(io.BytesIO(data)) as im:
            im = im.convert("RGB")
            w, h = im.size
            aspect = w / h
            # Strict standard: min width 800, aspect 1.2 to 2.1
            if w < 800 or aspect < 1.2 or aspect > 2.1:
                return False, f"Dims: {w}x{h}, aspect {aspect:.2f}"
            if w > 1600:
                new_w = 1600
                new_h = int(1600 / aspect)
                im = im.resize((new_w, new_h), Image.Resampling.LANCZOS)
            im.save(dest_path, "JPEG", quality=82, progressive=True, optimize=True)
            return True, f"Saved ({im.size})"
    except Exception as e:
        return False, str(e)

# Audit substandard
files = [f for f in os.listdir(TARGET_DIR) if f.endswith(('.jpg', '.jpeg', '.webp', '.png'))]
substandard = []
for f in files:
    p = os.path.join(TARGET_DIR, f)
    try:
        with Image.open(p) as im:
            w, h = im.size
            aspect = w / h
            if w < 750 or aspect < 1.15 or aspect > 2.25:
                stem = os.path.splitext(f)[0]
                hotel_name = stem.replace('-', ' ').title()
                substandard.append((f, stem, hotel_name))
    except Exception:
        pass

print(f"Upgrading {len(substandard)} substandard images to industry standard...")

upgraded = 0
for fname, stem, hotel_name in substandard:
    dest = os.path.join(TARGET_DIR, f"{stem}.jpg")
    print(f"\nSearching for high-res {hotel_name}...")
    candidates = search_tavily(f"{hotel_name} Zanzibar hotel exterior pool luxury")
    success = False
    for cand in candidates:
        if any(bad in cand.lower() for bad in ['logo', 'icon', 'map', 'flag', 'avatar', 'banner']):
            continue
        ok, msg = download_and_validate(cand, dest)
        if ok:
            print(f"  --> [UPGRADED] {dest}: {msg}")
            success = True
            upgraded += 1
            break
        else:
            print(f"  --> [SKIP] {cand}: {msg}")
    if not success:
        print(f"  --> [RETAINED] Kept existing for {hotel_name}")

print(f"\nUpgrade complete: {upgraded}/{len(substandard)} upgraded.")
