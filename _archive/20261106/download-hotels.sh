#!/usr/bin/env bash
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
OUT="public/images/hotels"
mkdir -p "$OUT"

get() {
  slug="$1"; url="$2"
  printf '→ %-35s %s\n' "$slug" "$url"
  img=$(curl -sL -A "$UA" --max-time 20 "$url" \
      | grep -oiP '<meta[^>]+property="og:image"[^>]+content="[^"]+' \
      | head -1 | sed -E 's/.*content="//')
  if [ -z "$img" ]; then echo "  FAIL: no og:image"; return 1; fi
  echo "  img: $img"
  curl -sL -A "$UA" --max-time 60 -o "$OUT/$slug.jpg" "$img"
  size=$(stat -c %s "$OUT/$slug.jpg" 2>/dev/null || echo 0)
  if [ "$size" -lt 30000 ]; then
    echo "  FAIL: too small (${size} bytes) — likely logo"
    rm -f "$OUT/$slug.jpg"
    return 1
  fi
  echo "  OK: $((size/1024)) KB"
}

get "essque-zalu-zanzibar"       "https://www.essquehotels.com/"
get "bluemoon"                   "https://www.blue-moonresort.com"
get "africa-house"               "http://www.africahousehotel.com/"
get "melia-zanzibar"             "https://www.melia.com/en/hotels/tanzania/zanzibar/melia-zanzibar"
get "lux-marijani-zanzibar"      "https://www.luxresorts.com/en/zanzibar/hotel/luxmarijani"
get "beyond-mnemba-island"       "https://www.andbeyond.com/our-lodges/africa/tanzania/zanzibar-and-the-coast/mnemba-island/"
get "the-one-resort-zanzibar"    "https://www.theoneresortzanzibar.com/"
get "stonetown-view-hotel"       "http://stonetownviewinn.com/"
get "the-island-stonetown"       "https://www.theislandstonetown.com/"
get "mkeka-spice-lodge"          "https://www.mkekaspicelodge.com/"
get "le-paradis-boutique-hotel-zanzibar" "https://leparadiszanzibar.com"
