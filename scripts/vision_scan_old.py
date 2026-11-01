#!/usr/bin/env python3
"""Vision-scan every image with Gemini 3 Flash (parallel, resumable).

Each of the 10 keys processes a modulo chunk of images.
Resumes from existing .vision/image_vision.jsonl records without 'error'.
"""
import os, re, json, time, base64, hashlib, io, sys
import urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT, "public", "images")
OUT_DIR = os.path.join(ROOT, ".vision")
OUT = os.path.join(OUT_DIR, "image_vision.jsonl")
MODEL = "gemini-3-flash-preview"
ENV = os.path.expanduser("~/.config/ai-keys/providers.env")

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


def load_keys():
    t = open(ENV).read()
    m = re.search(r"GEMINI_KEYS\s*=\s*(.+)", t, re.S)
    keys = re.findall(r"(AIza[A-Za-z0-9_\-]{20,}|AQ\.Ab8[A-Za-z0-9_\-\.]{20,})", m.group(1))
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
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={key}"
    body = json.dumps({
        "contents": [{"parts": [
            {"text": PROMPT},
            {"inline_data": {"mime_type": "image/jpeg", "data": b64}},
        ]}],
        "generationConfig": {"responseMimeType": "application/json",
                             "temperature": 0.2, "maxOutputTokens": 800,
                             "thinkingConfig": {"thinkingBudget": 0}},
    }).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            d = json.loads(r.read())
        txt = d["candidates"][0]["content"]["parts"][0]["text"]
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
        for attempt in range(6):
            try:
                v = call(key, b64)
                rec = {"idx": idx, "file": f, "md5": md5, "dhash": dh, "width": w, "height": h,
                       "bytes": os.path.getsize(path), **v}
                break
            except RuntimeError as e:
                last = str(e)
                if "HTTP 429" in last:
                    time.sleep(6 + attempt * 4)
                elif "HTTP 404" in last:
                    break
                else:
                    time.sleep(1 + attempt)
        if rec is None:
            rec = {"idx": idx, "file": f, "md5": md5, "dhash": dh, "width": w, "height": h,
                   "error": last or "failed"}
        results.append(rec)
    return results


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    keys = load_keys()
    if not keys:
        sys.exit("no keys")
    done_files = set()
    if os.path.exists(OUT):
        for line in open(OUT):
            line = line.strip()
            if not line: continue
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
    print(f"total={total} done={done} todo={todo_n} keys={len(keys)}", flush=True)
    if not todo:
        print("nothing to do"); return
    # split todo into len(keys) chunks by modulo
    chunks = [[] for _ in range(len(keys))]
    for i, f in enumerate(todo):
        chunks[i % len(keys)].append(f)
    all_results = []
    ki = 0
    for key in keys:
        chunk = chunks[ki]
        # filter chunk to only those not already done (without error)
        chunk = [f for f in chunk if f not in done_files]
        if not chunk:
            ki += 1; continue
        print(f"worker key {ki}: {len(chunk)} images, starting", flush=True)
        chunk_results = scan_chunk(key, chunk, 0)
        all_results.extend(chunk_results)
        ki += 1
    # write all results
    # To resume properly, we need to merge with existing non-error records.
    # For simplicity in this run, just rewrite the file (delete old + write new).
    # But to be safe, keep existing good records and append new ones.
    existing_good = {}
    if os.path.exists(OUT):
        for line in open(OUT):
            line = line.strip()
            if not line: continue
            try:
                r = json.loads(line)
                if not r.get("error") and "file" in r:
                    existing_good[r["file"]] = r
            except Exception:
                pass
    # build final list: keep existing good, add new (overwriting same file)
    final = list(existing_good.values())
    seen = {r["file"] for r in final}
    for r in all_results:
        if r.get("error"):
            final.append(r)
        else:
            if r["file"] in seen:
                # replace existing with new result
                final = [rr if rr["file"] != r["file"] else r for rr in final]
                seen.remove(r["file"]); seen.add(r["file"])
            else:
                final.append(r)
    # sort by idx if present, else file
    final.sort(key=lambda r: r.get("idx", files.index(r["file"]) if r["file"] in files else 0))
    with open(OUT, "w") as fh:
        for r in final:
            fh.write(json.dumps(r) + "\n")
    printed = 0
    for r in final:
        if printed < 5: print(json.dumps(r)[:120]); printed += 1
    print(f"written {len(final)} records to {OUT}", flush=True)


if __name__ == "__main__":
    main()