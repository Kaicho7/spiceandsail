#!/usr/bin/env node
/**
 * Hotel rates sync — recalculates public partner rates in src/data/hotelRates.json.
 *
 * Three pricing models (per hotel, declared as `pricingModel` in the data file):
 *   A) net_plus_margin (owner-confirmed net rates, no verified OTA anchor):
 *        ourRate = round(netRate * (1 + marginPct))
 *      Used for Stone Town View (+15%), The Island Stonetown (+15%), Mkeka (+20%).
 *   B) ota_minus_discount (verified OTA anchor):
 *        ourRate = max(round(otaAnchor * (1 - discount)), marginFloor)
 *      Used for Le Paradis (discount 20%).
 *   C) rack_minus_discount (official published rack sheet, seasonal):
 *        ourRate = round(rackRate * (1 - discount)) for every season and board
 *      Used for The One Resort (discount 15%).
 *
 * Usage:
 *   npm run rates:sync            # dry run — prints the diff, writes nothing
 *   npm run rates:sync -- --apply # writes src/data/hotelRates.json
 *
 * To refresh OTA anchors from a hotel's Booking.com extranet, add
 * /tmp/opencode/hotel-rates-override.json shaped like:
 * { "bySlug": { "le-paradis-boutique-hotel-zanzibar": { "rooms": { "Standard Garden Room": 72 } } } }
 * (roomType → current OTA rate). Anchors update, ourRate recomputes.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'src', 'data', 'hotelRates.json');
const APPLY = process.argv.includes('--apply');
const OVERRIDE_ARG = process.argv.find((a) => a.endsWith('.json') && !a.startsWith('--'));
const OVERRIDE = OVERRIDE_ARG || '/tmp/opencode/hotel-rates-override.json';

const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

if (fs.existsSync(OVERRIDE)) {
  const ov = JSON.parse(fs.readFileSync(OVERRIDE, 'utf8'));
  for (const [slug, entry] of Object.entries(ov.bySlug || {})) {
    const hotel = data.bySlug[slug];
    if (!hotel) { console.error('[WARN] unknown slug in override:', slug); continue; }
    for (const [roomType, anchor] of Object.entries(entry.rooms || {})) {
      const room = hotel.rooms.find((r) => r.roomType === roomType);
      if (!room) { console.error(`[WARN] unknown roomType ${roomType} for ${slug}`); continue; }
      if (room.netRate != null) {
        console.error(`[WARN] ${slug} ${roomType} uses net+margin pricing — OTA override ignored (edit netRate/marginPct in hotelRates.json instead)`);
        continue;
      }
      room.otaAnchor = anchor;
      room.anchorSource = 'Booking.com extranet (manual paste)';
    }
    hotel.lastSynced = new Date().toISOString().slice(0, 10);
    console.log(`[SYNC] ${slug}: anchors updated from override`);
  }
} else {
  console.log('[INFO] no override file — recalculating from existing anchors/net rates');
}

let changed = false;
for (const [slug, hotel] of Object.entries(data.bySlug)) {
  const model = hotel.pricingModel || (hotel.rooms.some((r) => r.netRate != null) ? 'net_plus_margin' : 'ota_minus_discount');

  for (const room of hotel.rooms) {
    let calc;
    if (room.netRate != null) {
      calc = Math.round(room.netRate * (1 + (room.marginPct || 0)));
    } else if (room.otaAnchor != null) {
      const discount = hotel.discount != null ? hotel.discount : 0.2;
      calc = Math.max(Math.round(room.otaAnchor * (1 - discount)), room.marginFloor != null ? room.marginFloor : 0);
    } else {
      continue;
    }
    if (calc !== room.ourRate) {
      console.log(`[FIX] ${slug} ${room.roomType}: ${room.ourRate} -> ${calc}`);
      room.ourRate = calc;
      changed = true;
    }
  }

  // Seasonal rack model: recompute every season and board option.
  if (Array.isArray(hotel.seasons)) {
    const discount = hotel.discount != null ? hotel.discount : 0.15;
    for (const season of hotel.seasons) {
      for (const room of season.rooms) {
        const hb = Math.round(room.rackHalfBoard * (1 - discount));
        const ai = Math.round(room.rackAllInclusive * (1 - discount));
        if (hb !== room.ourHalfBoard) { console.log(`[FIX] ${slug} ${season.id} ${room.roomType} HB: ${room.ourHalfBoard} -> ${hb}`); room.ourHalfBoard = hb; changed = true; }
        if (ai !== room.ourAllInclusive) { console.log(`[FIX] ${slug} ${season.id} ${room.roomType} AI: ${room.ourAllInclusive} -> ${ai}`); room.ourAllInclusive = ai; changed = true; }
      }
    }
    // Flat room list mirrors the reference season so chat/single-rate surfaces stay in sync.
    const ref = hotel.seasons.find((s) => s.id === hotel.currentSeasonId) || hotel.seasons[0];
    if (ref) {
      const flat = ref.rooms.map((r) => ({
        roomType: r.roomType,
        otaAnchor: r.rackHalfBoard,
        anchorSource: `Official rack sheet ${ref.label} Half Board $${r.rackHalfBoard}`,
        marginFloor: null,
        ourRate: r.ourHalfBoard,
      }));
      if (JSON.stringify(flat) !== JSON.stringify(hotel.rooms)) {
        console.log(`[FIX] ${slug}: flat room list refreshed from season "${ref.id}"`);
        hotel.rooms = flat;
        changed = true;
      }
    }
  }

  const fromRate = Array.isArray(hotel.seasons)
    ? Math.min(...hotel.seasons.flatMap((s) => s.rooms.map((r) => r.ourHalfBoard)))
    : Math.min(...hotel.rooms.map((r) => r.ourRate));
  if (hotel.fromRate !== fromRate) {
    console.log(`[FIX] ${slug}: fromRate ${hotel.fromRate} -> ${fromRate}`);
    hotel.fromRate = fromRate;
    changed = true;
  }
}

if (!fs.existsSync(OVERRIDE)) {
  console.log('[NOTE] Booking.com blocks automated fetches — paste extranet rates into the override file for exact anchors (Le Paradis). Net+margin hotels ignore OTA overrides; The One uses its official rack sheet.');
}

if (!changed) {
  console.log('hotelRates.json already up to date — no changes.');
} else if (APPLY) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n');
  console.log('hotelRates.json updated (--apply).');
} else {
  console.log('Dry run — no file written. Re-run with --apply to write changes.');
}
