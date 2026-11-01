#!/usr/bin/env python3
"""Vision-scan every image with Qwen VL (DashScope) -- parallel, resumable.

Two workers, one DashScope key each. Each result is appended to the JSONL
immediately, so progress survives interruption and resume just skips files
that already have a non-error record.
"""
import os, re, json, time, base64, hashlib, io, sys
import urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT, "public", "images")
OUT_DIR = os.path.join(ROOT, ".vision")
OUT = os.path.join(OUT_DIR, "image_vision.jsonl")
ENV = os.path.expanduser("~/.config/ai-keys/providers.env")
MODEL = "qwen3-omni-flash"
API = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions"

PROMPT = """You are auditing a real photo library for a Zanzibar tour operator.
Look ONLY at the actual pixels. Do not guess from the filename.

Return STRICT JSON with exactly these keys:
{
  "subject": "what is literally in the photo, 5-12 words",
  "place_guess": "specific Zanzibar/Tanzania place if clearly recognisable (e.g. 'Nungwi beach', 'Stone Town', 'Jozani Forest', 'Pemba'), else null",
  "place_confidence": "high|medium|low|none",
  "activity": "one of: beach, snorkeling, diving, dhow_sail, sunset, walking_tour, spice_farm, wildlife, village, hotel_room, hotel_exterior, food, transfer_vehicle, market, landscape, other",
  "category": "one of: cultural, marine, beach, nature, wildlife, hotel, transfer, food, spice, village, stone-town, sunset, family, adventure, safari, landscape",
  "alt_text": "factual alt text, max 120 chars, no marketing words, no keyword stuffing",
  "seo_filename": "8 words max, kebab-case, ascii, describes the pixels + place only if confident",
  "quality_score": 1-5,
  "quality_notes": "sharpness/composition/light issues, max 12 words",
  "is_hotel_interior": true/false,
  "has_people": true/false,
  "is_graphic_or_screenshot": true/false
}
quality_score: 5=excellent sharp well-composed, 4=good, 3=usable, 2=poor (blurry/low-res/awkward), 1=unusable.
If the image is not a photograph (logo, screenshot, graphic), set is_graphic_or_screenshot true and subject accordingly.
Return JSON only."""


def load_dash_keys():
    t = open(ENV).read()
    m = re.search(r"DASHSCOPE_KEYS\s*=\s*(.+)", t, re.S)
    keys = re.findall(r"(sk-ws-[A-Za-z0-9_\-\.]+)", m.group(1))
    # dedupe, keep order
    seen, out = set(), []
    for k in keys:
        if k not in seen:
            seen.add(k); out.append(k)
    return out


def dhash(im, size=8):
    g = im.convert("L").resize((size + 1, size))
    px = list(g.get_flattened_data())
    bits = []
    for row in range(size):
        for col in range(size):
            left = px[row * (size + 1) + col]
            right = px[row * (size + 1) + col + 1]
            bits.append("1" if left > right else "0")
    return "%016x" % int("".join(bits), 2)


def prepare(path, max_side=768):
    im = Image.open(path)
    w, h = im.size
    im = im.convert("RGB")
    dh = dhash(im)
    im2 = im.copy(); im2.thumbnail((max_side, max_side))
    buf = io.BytesIO(); im2.save(buf, "JPEG", quality=82)
    return buf.getvalue(), w, h, dh


def call(key, b64):
    body = json.dumps({
        "model": MODEL,
        "messages": [{"role": "user", "content": [
            {"type": "text", "text": PROMPT},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}}
        ]}],
        "max_tokens": 800,
        "temperature": 0.2,
    }).encode()
    req = urllib.request.Request(API, data=body,
                                 headers={"Authorization": f"Bearer {key}",
                                          "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            d = json.loads(r.read())
        txt = d["choices"][0]["message"]["content"]
        # strip markdown fences if the model wrapped JSON
        txt = txt.strip()
        if txt.startswith("```"):
            txt = re.sub(r"^```[a-zA-Z]*\s*|\s*```$", "", txt).strip()
        return json.loads(txt)
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")
        raise RuntimeError(f"HTTP {e.code}: {detail[:200]}")
    except (KeyError, IndexError, json.JSONDecodeError) as e:
        raise RuntimeError(f"bad response: {e}")


def scan_chunk(key, files, start_i):
    results = []
    for i, f in enumerate(files):
        idx = start_i + i
        path = os.path.join(IMG_DIR, f)
        try:
            raw, w, h, dh = prepare(path)
            b64 = base64.b64encode(raw).decode()
        except Exception as e:
            results.append({"idx": idx, "file": f, "error": f"prep: {e}"}); continue
        md5 = hashlib.md5(open(path, "rb").read()).hexdigest()
        rec = None
        last = ""
        for attempt in range(5):
            try:
                v = call(key, b64)
                rec = {"idx": idx, "file": f, "md5": md5, "dhash": dh,
                       "width": w, "height": h, "bytes": os.path.getsize(path), **v}
                break
            except RuntimeError as e:
                last = str(e)
                if "HTTP 429" in last:
                    time.sleep(4 + attempt * 3)
                elif "HTTP 404" in last or "HTTP 401" in last:
                    break
                else:
                    time.sleep(1 + attempt)
        if rec is None:
            rec = {"idx": idx, "file": f, "md5": md5, "dhash": dh,
                   "width": w, "height": h, "error": last or "failed"}
        results.append(rec)
        # append each result immediately for crash-safe checkpointing
        with open(OUT, "a") as fh:
            fh.write(json.dumps(rec) + "\n")
    return results


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    keys = load_dash_keys()
    if not keys:
        sys.exit("no dashscope keys found")
    print(f"dash keys={len(keys)}", flush=True)
    done_files = set()
    if os.path.exists(OUT):
        for line in open(OUT):
            line = line.strip()
            if not line:
                continue
            try:
                r = json.loads(line)
                if not r.get("error"):
                    done_files.add(r["file"])
            except Exception:
                pass
    files = sorted(f for f in os.listdir(IMG_DIR)
                   if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp")))
    todo = [f for f in files if f not in done_files]
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        todo = todo[:int(sys.argv[1])]
    total = len(files); done = len(done_files); todo_n = len(todo)
    print(f"total={total} done={done} todo={todo_n}", flush=True)
    if not todo:
        print("nothing to do"); return
    # split todo across keys by modulo
    chunks = [[] for _ in range(len(keys))]
    for i, f in enumerate(todo):
        chunks[i % len(keys)].append(f)
    with ThreadPoolExecutor(max_workers=len(keys)) as executor:
        futures = [executor.submit(scan_chunk, keys[i], chunks[i], 0)
                   for i in range(len(keys)) if chunks[i]]
        for future in as_completed(futures):
            future.result()
    print(f"done. combined {done + len(todo)} target; file now has records", flush=True)


if __name__ == "__main__":
    main()