import os, sys, json, urllib.request, urllib.parse, ssl, io
from PIL import Image

# Read API keys from ~/.config/ai-keys/providers.env
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

def search_tavily_image(query):
    if not TAVILY_KEY:
        return None
    url = "https://api.tavily.com/search"
    payload = {
        "api_key": TAVILY_KEY,
        "query": query,
        "include_images": True,
        "search_depth": "basic",
        "max_results": 5
    }
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'})
    try:
        resp = urllib.request.urlopen(req, timeout=10)
        data = json.loads(resp.read().decode('utf-8'))
        images = data.get('images', [])
        return images
    except Exception as e:
        print(f"Tavily error for {query}: {e}")
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
            # Strict quality check: min width 700, aspect 1.15 to 2.2 (landscape)
            if w < 700 or aspect < 1.15 or aspect > 2.2:
                return False, f"Bad dims ({w}x{h}, aspect {aspect:.2f})"
            if w > 1600:
                new_w = 1600
                new_h = int(1600 / aspect)
                im = im.resize((new_w, new_h), Image.Resampling.LANCZOS)
            im.save(dest_path, "JPEG", quality=82, progressive=True, optimize=True)
            return True, f"Saved ({im.size})"
    except Exception as e:
        return False, str(e)

hotels_to_fetch = [
    ('Park Hyatt Zanzibar', 'park-hyatt-zanzibar'),
    ('Marijani Beach Resort Zanzibar', 'marijani-beach-resort-spa'),
    ('Africa House Hotel Zanzibar', 'africa-house-hotel'),
    ('Aluna Nungwi Hotel', 'aluna-nungwi'),
    ('Blue Moon Resort Zanzibar', 'blue-moon-resort'),
    ('Blue Oyster Hotel Jambiani', 'blue-oyster-hotel'),
    ('Diamonds Mapenzi Beach Zanzibar', 'diamonds-mapenzi-beach'),
    ('House of Spices Stone Town', 'house-of-spices'),
    ('Kholle House Stone Town Zanzibar', 'kholle-house'),
    ('Kibanda Lodge Nungwi', 'kibanda-lodge'),
    ('Shaba Boutique Hotel Stone Town', 'shaba-boutique-hotel'),
    ('Zanzibar Pearl Boutique Hotel', 'zanzibar-pearl-boutique'),
    ('Al-Minar Hotel Stone Town', 'al-minar-hotel'),
    ('Surfescape Zanzibar Kiwengwa', 'surfescape-zanzibar'),
    ('Unguja Lodge Kizimkazi', 'unguja-lodge'),
    ('Verani Beach Lodge Pemba', 'verani-beach-lodge'),
    ('Ebb & Flow Zanzibar Paje', 'ebb-flow'),
    ('Villa Stecchini Zanzibar', 'villa-stecchini'),
    ('The One Resort Zanzibar', 'the-one-resort-zanzibar'),
    ('Le Paradis Boutique Hotel Zanzibar', 'le-paradis-boutique-hotel-zanzibar')
]

for name, slug in hotels_to_fetch:
    dest = os.path.join(TARGET_DIR, f"{slug}.jpg")
    if os.path.exists(dest):
        print(f"Already exists: {slug}")
        continue
    print(f"\nSearching for {name} ({slug})...")
    candidates = search_tavily_image(f"{name} official exterior beach resort")
    success = False
    for cand in candidates:
        # Avoid generic icons/logos
        if any(bad in cand.lower() for bad in ['logo', 'icon', 'map', 'flag', 'avatar']):
            continue
        ok, msg = download_and_validate(cand, dest)
        if ok:
            print(f"  --> [SUCCESS] {slug}.jpg: {msg} from {cand}")
            success = True
            break
        else:
            print(f"  --> [SKIP] {cand}: {msg}")
    if not success:
        print(f"  --> [FAILED] No candidate met pixel/aspect criteria for {name}")

print("\nBatch fetch complete.")
