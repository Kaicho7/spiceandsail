// Dynamic Pricing Engine for Spice & Sail Tours
// Implements seasonal pricing, promotional codes, and package discounts

const fs = require('fs').promises;
const path = require('path');

// Current season based on month (0-11)
function getCurrentSeason(month) {
  if (month >= 11 || month <= 1) return 'off'; // Dec, Jan
  if (month >= 2 && month <= 4) return 'shoulder'; // Feb-Apr
  if (month >= 5 && month <= 8) return 'peak'; // May-Aug
  return 'shoulder'; // Sep-Oct
}

// Base pricing data from existing JSON files
async function loadBasePricing() {
  try {
    const dataDir = path.join(__dirname, '../data');
    const [hotels, tours, transfers, experiences, packages] = await Promise.all([
      fs.readFile(path.join(dataDir, 'hotels.json'), 'utf8'),
      fs.readFile(path.join(dataDir, 'tours.json'), 'utf8'),
      fs.readFile(path.join(dataDir, 'transfers.json'), 'utf8'),
      fs.readFile(path.join(dataDir, 'experiences.json'), 'utf8'),
      fs.readFile(path.join(dataDir, 'packages.json'), 'utf8')
    ]);

    return {
      hotels: JSON.parse(hotels),
      tours: JSON.parse(tours),
      transfers: JSON.parse(transfers),
      experiences: JSON.parse(experiences),
      packages: JSON.parse(packages)
    };
  } catch (error) {
    console.error('Failed to load base pricing data:', error);
    // Return fallback data
    return {
      hotels: [],
      tours: [],
      transfers: [],
      experiences: [],
      packages: []
    };
  }
}

// Pricing rules configuration
const PRICING_RULES = {
  seasonalMultipliers: {
    peak: 1.3,      // High season (June-August)
    shoulder: 1.1,  // Medium season (Feb-Apr, Sep-Oct)
    off: 0.9        // Low season (Dec, Jan)
  },

  packageDiscounts: {
    threeDay: 0.05,   // 5% off for 3-day packages
    weekLong: 0.15,   // 15% off for 7-day packages
    twoWeeks: 0.20    // 20% off for 14-day packages
  },

  promotionalCodes: {
    'WELCOME10': { discount: 0.10, type: 'percentage', minAmount: 500 },
    'ZANZIBAR20': { discount: 0.20, type: 'percentage', minAmount: 1000 },
    'FAMILY15': { discount: 0.15, type: 'percentage', minAmount: 0 },
    'EARLYBIRD': { discount: 0.08, type: 'percentage', minAmount: 300 },
    'FLASH50': { discount: 50, type: 'fixed', minAmount: 1000 }
  },

  peakSurcharges: {
    weekend: 1.2,    // Friday-Sunday surcharge
    holiday: 1.25,   // Public holiday surcharge
    summer: 1.15     // Summer vacation surcharge
  }
};

// Calculate dynamic price based on base price, season, and booking details
async function calculateDynamicPrice(basePrice, bookingDetails) {
  const month = bookingDetails.month || new Date().getMonth();
  const season = getCurrentSeason(month);

  let calculatedPrice = basePrice;

  // Apply seasonal multiplier
  calculatedPrice *= PRICING_RULES.seasonalMultipliers[season];

  // Apply weekend surcharge if applicable
  if (bookingDetails.isWeekend) {
    calculatedPrice *= PRICING_RULES.peakSurcharges.weekend;
  }

  // Apply holiday surcharge if applicable
  if (bookingDetails.isHoliday) {
    calculatedPrice *= PRICING_RULES.peakSurcharges.holiday;
  }

  // Apply summer vacation surcharge if applicable (July-August)
  if (season === 'peak' && month >= 6 && month <= 7) {
    calculatedPrice *= PRICING_RULES.peakSurcharges.summer;
  }

  // Apply package discounts for multi-day bookings
  if (bookingDetails.days === 3) {
    calculatedPrice *= (1 - PRICING_RULES.packageDiscounts.threeDay);
  } else if (bookingDetails.days === 7) {
    calculatedPrice *= (1 - PRICING_RULES.packageDiscounts.weekLong);
  } else if (bookingDetails.days === 14) {
    calculatedPrice *= (1 - PRICING_RULES.packageDiscounts.twoWeeks);
  }

  return Math.round(calculatedPrice * 100) / 100; // Round to 2 decimal places
}

// Validate promotional code
function validatePromotionalCode(code, cartTotal) {
  const rule = PRICING_RULES.promotionalCodes[code.toUpperCase()];

  if (!rule) {
    return {
      valid: false,
      error: 'Promotional code not found'
    };
  }

  if (cartTotal < rule.minAmount) {
    return {
      valid: false,
      error: `Minimum order amount of $${rule.minAmount} required for this code`
    };
  }

  return {
    valid: true,
    rule,
    discount: rule.type === 'fixed' ? rule.discount : Math.round(cartTotal * rule.discount * 100) / 100
  };
}

// Calculate package pricing with dynamic adjustments
async function calculatePackagePrice(packageId, guestCount, bookingDays) {
  const baseData = await loadBasePricing();
  const packageInfo = baseData.packages.find(p => p.id === packageId);

  if (!packageInfo) {
    throw new Error('Package not found');
  }

  // Calculate base price
  let totalBasePrice = 0;

  // Add hotel costs (assuming one hotel per guest per night)
  const hotelNights = bookingDays;
  const availableHotels = baseData.hotels.filter(h => h.type === 'mid-range' || h.type === 'luxury');
  const averageHotelRate = availableHotels.reduce((sum, h) => sum + (h.price_per_night || 150), 0) / Math.max(availableHotels.length, 1);
  totalBasePrice += averageHotelRate * hotelNights * Math.min(guestCount, 4); // Limit to 4 guests max

  // Add tour costs (one tour for the group)
  const avgTourPrice = availableHotels.reduce((sum, t) => sum + (t.price || 100), 0) / Math.max(availableHotels.length, 1);
  totalBasePrice += avgTourPrice * guestCount;

  // Add transfers
  const avgTransferPrice = baseData.transfers.reduce((sum, t) => sum + (t.price || 50), 0) / Math.max(baseData.transfers.length, 1);
  totalBasePrice += avgTransferPrice * guestCount;

  // Apply guest discounts for larger groups
  let groupDiscount = 0;
  if (guestCount >= 6) groupDiscount = 0.10; // 10% for 6+ guests
  else if (guestCount >= 4) groupDiscount = 0.05; // 5% for 4-5 guests

  let finalPrice = totalBasePrice * (1 - groupDiscount);

  // Round to nearest $50 for pricing tiers
  finalPrice = Math.round(finalPrice / 50) * 50;

  return {
    packageId,
    packageName: packageInfo.name,
    guestCount,
    bookingDays,
    basePrice: totalBasePrice,
    groupDiscount: groupDiscount * 100,
    finalPrice: finalPrice,
    seasonalFactor: getCurrentSeason(new Date().getMonth()),
    applicableDiscounts: ['FAMILY15', 'EARLYBIRD'].filter(code => {
      const validation = validatePromotionalCode(code, finalPrice);
      return validation.valid;
    })
  };
}

// Generate pricing recommendation based on itinerary
async function generatePricingRecommendation(itinerary) {
  const baseData = await loadBasePricing();
  const month = new Date().getMonth();
  const season = getCurrentSeason(month);

  const recommendations = {
    itinerary: itinerary,
    baseAnalysis: {
      currentSeason: season,
      seasonMultiplier: PRICING_RULES.seasonalMultipliers[season],
      estimatedTotal: 0,
      recommendedBookingWindow: season === 'peak' ? '3-4 weeks ahead' : '4-6 weeks ahead'
    },
    pricingFactors: [],
    potentialDiscounts: [],
    suggestedPackages: [],
    recommendations: []
  };

  // Analyze each item in itinerary
  let estimatedTotal = 0;
  const analyzedItems = [];

  itinerary.items.forEach(item => {
    const basePrice = item.price || 0;
    const calculatedPrice = calculateDynamicPrice(basePrice, {
      month,
      isWeekend: false, // Would need to implement actual calendar logic
      isHoliday: false   // Would need to implement actual holiday logic
    });

    estimatedTotal += calculatedPrice;

    analyzedItems.push({
      ...item,
      basePrice,
      calculatedPrice,
      seasonalMultiplier: PRICING_RULES.seasonalMultipliers[season]
    });
  });

  recommendations.baseAnalysis.estimatedTotal = estimatedTotal;
  recommendations.baseAnalysis.totalItems = itinerary.items.length;
  recommendations.baseAnalysis.averageItemPrice = estimatedTotal / Math.max(itinerary.items.length, 1);

  // Identify potential discounts
  const totalDiscounts = [];
  if (estimatedTotal > 500) totalDiscounts.push('FAMILY15');
  if (estimatedTotal > 1000) totalDiscounts.push('ZANZIBAR20');
  if (estimatedTotal > 300) totalDiscounts.push('EARLYBIRD');

  recommendations.potentialDiscounts = totalDiscounts;

  // Find related packages
  const relatedPackages = baseData.packages.filter(p => p.type === itinerary.type);
  if (relatedPackages.length > 0) {
    recommendations.suggestedPackages = relatedPackages.slice(0, 3);
  }

  // Generate recommendations
  const recs = [];
  if (season === 'peak') {
    recs.push('Book soon! Peak season pricing is high but availability is limited');
  } else {
    recs.push('Good timing for booking - off-season rates are favorable');
  }

  if (itinerary.items.length >= 3) {
    recs.push('Consider booking as a package for additional discounts');
  }

  if (estimatedTotal > 2000) {
    recs.push('This is a premium experience - consider our all-inclusive packages');
  }

  recommendations.recommendations = recs;

  return recommendations;
}

// Get current promotional offers
function getCurrentPromotionalOffers() {
  const currentDate = new Date();
  const month = currentDate.getMonth();

  const offers = [];

  Object.entries(PRICING_RULES.promotionalCodes).forEach(([code, rule]) => {
    const offer = {
      code,
      discount: rule.discount,
      type: rule.type,
      minAmount: rule.minAmount,
      description: getOfferDescription(code),
      validUntil: calculateOfferExpiry(code, month)
    };

    offers.push(offer);
  });

  // Add seasonal special offers
  const season = getCurrentSeason(month);
  if (season === 'peak') {
    offers.push({
      code: 'SUMMER2024',
      discount: 0.12,
      type: 'percentage',
      minAmount: 800,
      description: '12% off Summer Special',
      validUntil: new Date('2024-08-31')
    });
  }

  return offers;
}

// Helper functions
function getOfferDescription(code) {
  const descriptions = {
    'WELCOME10': 'Welcome new customers - 10% off your first booking',
    'ZANZIBAR20': 'Special Zanzibar promotion - 20% off bookings over $1000',
    'FAMILY15': 'Family travel - 15% off for groups of 4+',
    'EARLYBIRD': 'Early bird special - 8% off for bookings 30+ days ahead',
    'FLASH50': 'Flash sale - $50 off bookings over $1000'
  };
  return descriptions[code] || 'Special promotional offer';
}

function calculateOfferExpiry(code, currentMonth) {
  const expiryDates = {
    'WELCOME10': new Date('2024-12-31'),
    'ZANZIBAR20': new Date('2024-12-31'),
    'FAMILY15': new Date('2024-11-30'),
    'EARLYBIRD': new Date('2024-10-31'),
    'FLASH50': new Date('2024-09-30')
  };
  return expiryDates[code] || new Date('2024-12-31');
}

// Export all functions
module.exports = {
  calculateDynamicPrice,
  validatePromotionalCode,
  calculatePackagePrice,
  generatePricingRecommendation,
  getCurrentPromotionalOffers,
  getCurrentSeason,
  PRICING_RULES
};