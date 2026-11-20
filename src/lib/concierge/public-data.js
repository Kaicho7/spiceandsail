/**
 * Public hotel/package data helpers — CommonJS, bundled by esbuild.
 *
 * Single source of truth:
 * - package prices and descriptions come from concierge-catalogue.json
 *   (version 2026-11-19.v4-anchor-pricing).
 * - public hotel "from" rates are derived from hotelPublicRates.json.
 *
 * Never expose net contracted rates (hotel-contracts.json) from here.
 */
'use strict';

const catalogue = require('../../data/concierge-catalogue.json');
const publicHotelRates = require('../../data/hotelPublicRates.json');

/**
 * Lowest public room rate for a hotel.
 * Prefers published room rates, then seasonal partner rates, then the
 * hotel's own fromRate. Returns null instead of 0 when nothing is known.
 */
function publicFromRate(hotel) {
  if (!hotel) return null;

  const roomRates = (hotel.rooms || [])
    .map((room) => room && room.guestRatePerRoomPerNight)
    .filter((rate) => Number.isFinite(rate) && rate > 0);
  if (roomRates.length) return Math.min.apply(null, roomRates);

  const seasonRates = [];
  for (const season of hotel.seasons || []) {
    if (!season || typeof season !== 'object') continue;
    for (const key of Object.keys(season)) {
      const entry = season[key];
      if (!entry || typeof entry !== 'object') continue;
      for (const rateKey of ['ourHalfBoard', 'ourAllInclusive']) {
        const rate = entry[rateKey];
        if (Number.isFinite(rate) && rate > 0) seasonRates.push(rate);
      }
    }
  }
  if (seasonRates.length) return Math.min.apply(null, seasonRates);

  if (Number.isFinite(hotel.fromRate) && hotel.fromRate > 0) return hotel.fromRate;
  return null;
}

/** Package services that are tied to a partner hotel, newest catalogue only. */
function packageServices() {
  return (catalogue.services || []).filter(
    (service) => service.type === 'package' && service.hotelSlug
  );
}

/** Package service for a hotel slug, or null. */
function packageForHotel(slug) {
  if (!slug) return null;
  return packageServices().find((service) => service.hotelSlug === slug) || null;
}

module.exports = {
  catalogue,
  publicHotelRates,
  publicFromRate,
  packageServices,
  packageForHotel,
};
