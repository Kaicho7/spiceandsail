#!/usr/bin/env python3
"""
site_audit.py - read-only audit of a live website. Standard library only.

Usage:
    python3 site_audit.py https://spiceandsail.com/
    python3 site_audit.py https://spiceandsail.com/ --external
    python3 site_audit.py URL --out reports --max-pages 300

What it does:
  * Crawls every page it can reach on the site (plus /sitemap.xml if present).
  * Checks titles, descriptions, canonicals, headings, image alt text, image
    file names, image reuse, broken pages/images/links, placeholder text,
    text glitches, and WhatsApp numbers that repeat across different listings.
  * Writes SITE_AUDIT_REPORT.md (readable) and site_audit_findings.csv (full list).

It only makes GET/HEAD requests. It never changes the site, never submits
forms, and never uses any API key.

Exit code: 0 = no ERROR findings, 1 = ERROR findings, 2 = could not run.
"""
import argparse
import csv
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser

UA = "Mozilla/5.0 (compatible; SiteAudit/1.0)"
# The business's own WhatsApp numbers (digits only). Other numbers are treated
# as third-party (e.g. hotel contacts) and checked for repeats.
OWN_NUMBERS = {"255672450934", "255774600924"}

ERROR, WARN = "ERROR", "WARN"


# --------------------------------------------------------------------------
# Fetching
# --------------------------------------------------------------------------
def fetch(url, method="GET", timeout=20, read_html=True, max_bytes=8_000_000):
    req = urllib.request.Request(
        url, method=method, headers={"User-Agent": UA, "Accept": "*/*"}
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            ctype = r.headers.get("Content-Type", "") or ""
            clen = r.headers.get("Content-Length")
            body = b""
            is_text = "text/html" in ctype or "xml" in ctype
            if method == "GET" and read_html and is_text:
                body = r.read(max_bytes)
            size = int(clen) if clen and clen.isdigit() else len(body)
            charset = r.headers.get_content_charset() or "utf-8"
            return {"status": r.status, "url": r.geturl(), "ctype": ctype,
                    "size": size, "body": body, "charset": charset, "error": None}
    except urllib.error.HTTPError as e:
        return {"status": e.code, "url": url, "ctype": "", "size": 0,
                "body": b"", "charset": "utf-8", "error": None}
    except Exception as e:  # DNS failure, timeout, TLS error ...
        return {"status": 0, "url": url, "ctype": "", "size": 0,
                "body": b"", "charset": "utf-8", "error": str(e)[:120]}


def check_url(url, timeout=12):
    """HEAD first; fall back to GET when the server dislikes HEAD."""
    r = fetch(url, method="HEAD", timeout=timeout)
    if r["status"] in (0, 400, 403, 405, 501):
        r2 = fetch(url, method="GET", timeout=timeout, read_html=False)
        if r2["status"] != 0 or r["status"] == 0:
            r = r2
    return r


# --------------------------------------------------------------------------
# HTML parsing
# --------------------------------------------------------------------------
class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = ""
        self.meta = {}
        self.canonical = None
        self.links = []        # (href, nearest_heading)
        self.images = []       # dicts
        self.h1 = []
        self.chunks = []
        self.last_heading = ""
        self._in_title = False
        self._skip = 0
        self._head_tag = None
        self._head_buf = ""

    def handle_starttag(self, tag, attrs):
        a = {k.lower(): (v if v is not None else "") for k, v in attrs}
        has_alt = any(k.lower() == "alt" for k, _ in attrs)
        if tag == "title":
            self._in_title = True
        elif tag in ("script", "style", "noscript"):
            self._skip += 1
        elif tag == "meta":
            key = (a.get("name") or a.get("property") or "").lower()
            if key:
                self.meta[key] = a.get("content", "")
        elif tag == "link" and "canonical" in a.get("rel", "").lower():
            self.canonical = a.get("href")
        elif tag == "a" and a.get("href"):
            self.links.append((a["href"], self.last_heading))
        elif tag == "img":
            src = a.get("src") or a.get("data-src") or ""
            self.images.append({"src": src, "alt": a.get("alt", ""),
                                "has_alt": has_alt,
                                "heading": self.last_heading})
        elif tag in ("h1", "h2", "h3", "h4"):
            self._head_tag = tag
            self._head_buf = ""

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        elif tag in ("script", "style", "noscript") and self._skip:
            self._skip -= 1
        elif tag == self._head_tag:
            txt = re.sub(r"\s+", " ", self._head_buf).strip()
            if txt:
                self.last_heading = txt
                if tag == "h1":
                    self.h1.append(txt)
            self._head_tag = None

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        if self._skip:
            return
        if self._head_tag:
            self._head_buf += data
        s = data.strip()
        if s:
            self.chunks.append(s)


# --------------------------------------------------------------------------
# Rules
# --------------------------------------------------------------------------
PLACEHOLDERS = [
    (r"\b7XX\b|\bX{3,}\b", "number placeholder (7XX / XXX)"),
    (r"P\.?\s?O\.?\s?Box\s+123\b", "placeholder 'P.O. Box 123'"),
    (r"lorem ipsum", "lorem ipsum"),
    (r"\bTODO\b|\bTBD\b|\bFIXME\b", "TODO / TBD text"),
    (r"\[[A-Z _]*(?:PASTE|INSERT|YOUR)[A-Z _]*\]", "bracket placeholder"),
    (r"\b(?:null|undefined|NaN)\b", "null / undefined printed on page"),
    (r"example\.(?:com|org)", "example.com address"),
    (r"\{\{|\}\}|\{%|%\}", "unrendered template tag"),
]
GLITCHES = [
    (r"\b\d-Star star\b|\bUngraded star\b", "'star' printed twice / 'Ungraded star'"),
    (r"\b([A-Z]{2,4})(?:\s+\1)+\b", "repeated label (e.g. CUL CUL CUL)"),
    (r"\b[a-z]{3,}_[a-z]{3,}\b", "underscore word (template leak?)"),
    (r"(?m)^,\s*\w", "location text starts with a comma"),
    (r"\b1 (?:attractions|hotels|tours)\b", "'1 attractions' grammar"),
]
ALT_FILLER = re.compile(
    r"stock collection|authentic travel photography|as typical of|lorem|"
    r"tropical scenery, marine life", re.I)
ALT_FORMULAIC = re.compile(r"^.{1,90} \u2014 Zanzibar(?: (?:hotel|tour))?$")
FILE_CAMERA = re.compile(
    r"(?:^|[/_-])(?:IMG|DSC|DSCN|DSCF|PXL|MVIMG)[_-]?\d{3,}|"
    r"\bP\d{7}\b|\d{8}[_-]\d{6}|WhatsApp[ _-]?Image|Screenshot", re.I)
FILE_STOCK = re.compile(r"-[A-Za-z0-9_-]{11}-unsplash|pexels-|shutterstock|istock", re.I)
FILE_GENERIC = re.compile(
    r"/(?:image|img|photo|picture|untitled|excursions|packing-beach|banner|hero)"
    r"[-_]?\d*\.(?:jpe?g|png|webp)$", re.I)
CLAIM = re.compile(
    r"\b(\d[\d,]*)\s+(?:hand-picked\s+|partner\s+)?"
    r"(hotels?|tours?|attractions?|zones?|areas?|properties|packages?)\b", re.I)


def norm(u, base):
    try:
        u = urllib.parse.urljoin(base, u.strip())
        p = urllib.parse.urlparse(u)
    except Exception:
        return None
    if p.scheme not in ("http", "https"):
        return None
    return urllib.parse.urlunparse(
        (p.scheme, p.netloc.lower(), p.path or "/", "", p.query, ""))


def looks_like_page(url):
    path = urllib.parse.urlparse(url).path
    last = path.rsplit("/", 1)[-1]
    return "." not in last or last.lower().endswith((".html", ".htm"))


# --------------------------------------------------------------------------
# Main audit
# --------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("start")
    ap.add_argument("--external", action="store_true",
                    help="also check links that point to other websites")
    ap.add_argument("--out", default=".", help="folder for the reports")
    ap.add_argument("--max-pages", type=int, default=400)
    ap.add_argument("--delay", type=float, default=0.2)
    args = ap.parse_args()

    start = norm(args.start, args.start)
    if not start:
        print("Give a full address such as https://example.com/")
        return 2
    host = urllib.parse.urlparse(start).netloc
    os.makedirs(args.out, exist_ok=True)
    findings = []  # (severity, code, page, detail)

    def add(sev, code, page, detail):
        findings.append((sev, code, page, detail))

    # ---- crawl --------------------------------------------------------
    queue, seen, pages = [start], {start}, {}
    sm = fetch(urllib.parse.urljoin(start, "/sitemap.xml"))
    if sm["status"] == 200:
        for loc in re.findall(r"<loc>\s*(.*?)\s*</loc>",
                              sm["body"].decode(sm["charset"], "replace")):
            u = norm(loc, start)
            if u and urllib.parse.urlparse(u).netloc == host and u not in seen:
                seen.add(u)
                queue.append(u)

    while queue and len(pages) < args.max_pages:
        url = queue.pop(0)
        r = fetch(url)
        time.sleep(args.delay)
        info = {"url": url, "final": r["url"], "status": r["status"],
                "size": r["size"], "error": r["error"], "parser": None}
        if r["status"] == 200 and "text/html" in r["ctype"]:
            p = PageParser()
            try:
                p.feed(r["body"].decode(r["charset"], "replace"))
            except Exception as e:  # malformed HTML
                add(WARN, "PARSE", url, "HTML could not be fully parsed: %s" % e)
            info["parser"] = p
            for href, _ in p.links:
                u = norm(href, r["url"])
                if (u and urllib.parse.urlparse(u).netloc == host
                        and u not in seen and looks_like_page(u)):
                    seen.add(u)
                    queue.append(u)
        pages[url] = info
        print("  crawled %-3d %s -> %s" % (len(pages), url, r["status"]))

    html_pages = {u: i for u, i in pages.items() if i["parser"]}
    if not html_pages:
        print("Could not read any page from %s" % start)
        return 2

    # ---- per-page checks ---------------------------------------------
    titles, descs, ogts, h1s = (defaultdict(list) for _ in range(4))
    img_uses = defaultdict(list)       # src -> [(page, alt)]
    alt_to_srcs = defaultdict(set)
    wa_numbers = defaultdict(set)      # number -> {heading,...}
    wa_pages = defaultdict(set)
    claims = []
    file_flagged = set()
    int_links = defaultdict(set)       # internal url -> {pages}
    ext_links = defaultdict(set)       # external url -> {pages}

    for url, info in pages.items():
        if info["status"] != 200:
            add(ERROR, "HTTP_ERROR", url,
                "status %s %s" % (info["status"], info["error"] or ""))
    for url, info in html_pages.items():
        p = info["parser"]
        title = re.sub(r"\s+", " ", p.title).strip()
        desc = p.meta.get("description", "").strip()
        ogt = p.meta.get("og:title", "").strip()
        robots = p.meta.get("robots", "").lower()
        if "noindex" in robots:
            add(ERROR, "NOINDEX", url, "page tells Google not to index it: %s" % robots)
        if not title:
            add(ERROR, "TITLE_MISSING", url, "no <title>")
        else:
            titles[title].append(url)
            if len(title) < 15 or len(title) > 65:
                add(WARN, "TITLE_LENGTH", url, "%d chars: %s" % (len(title), title))
        if not desc:
            add(ERROR, "DESC_MISSING", url, "no meta description")
        else:
            descs[desc].append(url)
            if len(desc) < 70 or len(desc) > 165:
                add(WARN, "DESC_LENGTH", url, "%d chars" % len(desc))
        if ogt:
            ogts[ogt].append(url)
        if not p.canonical:
            add(ERROR, "CANONICAL_MISSING", url, "no canonical link")
        elif norm(p.canonical, url) != url:
            add(WARN, "CANONICAL_DIFFERS", url, "canonical is %s" % p.canonical)
        if len(p.h1) != 1:
            add(WARN, "H1_COUNT", url, "%d <h1> tags" % len(p.h1))
        for h in p.h1:
            h1s[h].append(url)
        if info["size"] > 600_000:
            add(WARN, "PAGE_HEAVY", url, "HTML is %d KB" % (info["size"] // 1024))

        text = "\n".join(p.chunks)
        for rx, label in PLACEHOLDERS:
            m = re.search(rx, text)
            if m:
                ctx = text[max(0, m.start() - 30): m.end() + 30].replace("\n", " ")
                add(ERROR, "PLACEHOLDER", url, "%s: \u2026%s\u2026" % (label, ctx))
        for rx, label in GLITCHES:
            hits = re.findall(rx, text)
            if hits:
                m = re.search(rx, text)
                ctx = text[max(0, m.start() - 20): m.end() + 20].replace("\n", " ")
                add(WARN, "TEXT_GLITCH", url, "%s (x%d): \u2026%s\u2026" % (label, len(hits), ctx))
        for m in CLAIM.finditer(text):
            claims.append((url, m.group(0)))

        for img in p.images:
            src = norm(img["src"], url) if img["src"] else None
            if not src:
                add(ERROR, "IMG_NO_SRC", url, "image without a source")
                continue
            alt = re.sub(r"\s+", " ", img["alt"]).strip()
            img_uses[src].append((url, alt))
            if alt:
                alt_to_srcs[alt].add(src)
            if not img["has_alt"]:
                add(ERROR, "ALT_MISSING", url, src)
            elif not alt:
                add(WARN, "ALT_EMPTY", url, "%s (fine only if purely decorative)" % src)
            else:
                if ALT_FILLER.search(alt) or len(alt) > 160:
                    add(ERROR, "ALT_FILLER", url, "%s | alt: %s" % (src, alt[:140]))
                elif ALT_FORMULAIC.match(alt):
                    add(WARN, "ALT_FORMULAIC", url, "%s | alt: %s" % (src, alt))
            fn = urllib.parse.unquote(urllib.parse.urlparse(src).path)
            if fn not in file_flagged:  # report each bad file name once
                if FILE_CAMERA.search(fn):
                    add(ERROR, "FILE_CAMERA", url, fn)
                    file_flagged.add(fn)
                elif FILE_STOCK.search(fn):
                    add(WARN, "FILE_STOCK", url, fn)
                    file_flagged.add(fn)
                elif FILE_GENERIC.search(fn):
                    add(WARN, "FILE_GENERIC", url, fn)
                    file_flagged.add(fn)

        for href, heading in p.links:
            u = norm(href, info["final"])
            m = re.search(r"wa\.me/\+?(\d{8,15})", href)
            if m:
                num = m.group(1)
                wa_pages[num].add(url)
                if num not in OWN_NUMBERS:
                    wa_numbers[num].add(heading or "(no heading)")
                continue
            if href.lower().startswith("mailto:"):
                continue
            if not u:
                continue
            if urllib.parse.urlparse(u).netloc == host:
                if looks_like_page(u):
                    int_links[u].add(url)
            else:
                ext_links[u].add(url)

    for title, urls in titles.items():
        if len(urls) > 1:
            add(ERROR, "DUP_TITLE", urls[0], "same title on %d pages: %s" % (len(urls), title))
    for desc, urls in descs.items():
        if len(urls) > 1:
            add(ERROR, "DUP_DESC", urls[0], "same description on %d pages: %s" % (len(urls), desc[:110]))
    for ogt, urls in ogts.items():
        if len(urls) > 1:
            add(WARN, "DUP_OG_TITLE", urls[0], "same social-share title on %d pages" % len(urls))
    for h, urls in h1s.items():
        if len(urls) > 1:
            add(WARN, "DUP_H1", urls[0], "same <h1> '%s' on: %s" % (h, ", ".join(urls[:4])))

    for u, srcs in int_links.items():
        st = pages.get(u, {}).get("status")
        if st and st >= 400:
            add(ERROR, "LINK_BROKEN", sorted(srcs)[0], "%s -> %s (linked from %d pages)" % (u, st, len(srcs)))
    for u, info in pages.items():
        if info["status"] == 200 and info["final"] != u:
            add(WARN, "REDIRECT", u, "redirects to %s" % info["final"])

    # ---- images -------------------------------------------------------
    internal_imgs = [s for s in img_uses if urllib.parse.urlparse(s).netloc == host]
    with ThreadPoolExecutor(max_workers=6) as ex:
        results = list(ex.map(check_url, internal_imgs))
    for src, r in zip(internal_imgs, results):
        first = img_uses[src][0][0]
        if r["status"] == 0 or r["status"] >= 400:
            add(ERROR, "IMG_BROKEN", first, "%s -> %s %s" % (src, r["status"], r["error"] or ""))
        elif r["size"] > 400_000:
            add(WARN, "IMG_BIG", first, "%s is %d KB" % (src, r["size"] // 1024))
    for src, uses in img_uses.items():
        if len(uses) >= 6:
            add(WARN, "IMG_REUSE", uses[0][0],
                "%s used %d times across %d page(s)" % (src, len(uses), len({u for u, _ in uses})))
        alts = {a for _, a in uses if a}
        if len(alts) > 1:
            add(WARN, "ALT_VARIES_SAME_IMG", uses[0][0], "%s has %d different alts" % (src, len(alts)))
    for alt, srcs in alt_to_srcs.items():
        if len(srcs) > 1:
            add(WARN, "ALT_SHARED", sorted(srcs)[0], "alt '%s' used on %d different images" % (alt[:80], len(srcs)))

    # ---- WhatsApp numbers on third-party listings ----------------------
    for num, heads in wa_numbers.items():
        if len(heads) > 1:
            add(WARN, "WA_REPEATED", ", ".join(sorted(wa_pages[num]))[:100],
                "+%s is listed for %d different headings: %s" % (num, len(heads), "; ".join(sorted(heads)[:5])))
    seq = [n for n in wa_numbers if re.fullmatch(r"2557774133\d\d", n)]
    if len(seq) >= 5:
        add(WARN, "WA_SEQUENTIAL", "(site-wide)",
            "%d numbers follow the pattern 255777413 3xx (looks generated, e.g. %s)" % (len(seq), ", ".join(sorted(seq)[:3])))

    # ---- external links (optional) --------------------------------------
    if args.external:
        targets = [u for u in ext_links if "wa.me" not in u and "maps.google" not in u]
        print("  checking %d external links ..." % len(targets))
        with ThreadPoolExecutor(max_workers=8) as ex:
            res = list(ex.map(check_url, targets))
        for u, r in zip(targets, res):
            where = sorted(ext_links[u])[0]
            if r["status"] in (404, 410) or r["status"] >= 500 or r["status"] == 0:
                add(WARN, "EXT_BROKEN", where, "%s -> %s %s" % (u, r["status"], r["error"] or ""))
            elif r["status"] in (401, 403, 429, 999):
                add(WARN, "EXT_BLOCKED", where, "%s -> %s (site may block bots; check by hand)" % (u, r["status"]))

    # ---- reports ------------------------------------------------------
    by_code = defaultdict(list)
    for f in findings:
        by_code[(f[0], f[1])].append(f)
    n_err = sum(1 for f in findings if f[0] == ERROR)
    n_warn = sum(1 for f in findings if f[0] == WARN)

    csv_path = os.path.join(args.out, "site_audit_findings.csv")
    with open(csv_path, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["severity", "code", "page", "detail"])
        w.writerows(sorted(findings, key=lambda f: (f[0] != ERROR, f[1], f[2])))

    md = []
    md.append("# Site audit report\n")
    md.append("Site: %s  \nPages crawled: %d  \nImages seen: %d  \nStamp: %s\n" % (
        start, len(pages), len(img_uses), time.strftime("%Y-%m-%d %H:%M")))
    md.append("**%d ERROR findings, %d WARN findings.** Exit code is %s.\n" % (
        n_err, n_warn, "1 (not ready)" if n_err else "0 (passed)"))
    md.append("## Summary by check\n")
    md.append("| Severity | Check | Count |\n|---|---|---|")
    for (sev, code), items in sorted(by_code.items(), key=lambda kv: (kv[0][0] != ERROR, kv[0][1])):
        md.append("| %s | %s | %d |" % (sev, code, len(items)))
    md.append("")
    md.append("## Details (first 10 of each check; everything is in site_audit_findings.csv)\n")
    for (sev, code), items in sorted(by_code.items(), key=lambda kv: (kv[0][0] != ERROR, kv[0][1])):
        md.append("### %s %s (%d)\n" % (sev, code, len(items)))
        for _, _, page, detail in items[:10]:
            md.append("- `%s` \u2014 %s" % (page, detail))
        if len(items) > 10:
            md.append("- \u2026 and %d more" % (len(items) - 10))
        md.append("")
    md.append("## Numbers the site claims (compare by eye)\n")
    shown = set()
    for page, claim in claims:
        key = (page, claim.lower())
        if key not in shown and len(shown) < 60:
            shown.add(key)
            md.append("- `%s`: %s" % (page, claim))
    md.append("\n## Pages\n")
    md.append("| Status | Page | Title | Images |\n|---|---|---|---|")
    for url, info in pages.items():
        p = info["parser"]
        t = re.sub(r"\s+", " ", p.title).strip()[:60] if p else ""
        md.append("| %s | %s | %s | %d |" % (info["status"], url, t, len(p.images) if p else 0))
    md_path = os.path.join(args.out, "SITE_AUDIT_REPORT.md")
    with open(md_path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(md) + "\n")

    print("\n%d ERROR, %d WARN. Reports: %s and %s" % (n_err, n_warn, md_path, csv_path))
    return 1 if n_err else 0


if __name__ == "__main__":
    sys.exit(main())
