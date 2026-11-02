// Pricing API - Dynamic Pricing and Revenue Optimization
// Phase 6: Implements comprehensive pricing strategy engine with dynamic price adjustments and revenue optimization

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Load pricing data from data directory
async function loadPricingData() {
  try {
    const dataDir = path.join(__dirname, '../data');
    const [activities, experiences, reviews, bookings, itineraries, pricing] = await Promise.all([
      fs.readFile(path.join(dataDir, 'activities.json'), 'utf8'),
      fs.readFile(path.join(dataDir, 'experiences.json'), 'utf8'),
      fs.readFile(path.join(dataDir, 'reviews.json'), 'utf8'),
      fs.readFile(path.join(dataDir, 'bookings.json'), 'utf8'),
      fs.readFile(path.join(dataDir, 'itineraries.json'), 'utf8'),
      fs.readFile(path.join(dataDir, 'pricing.json'), 'utf8')
    ]);

    return {
      activities: JSON.parse(activities),
      experiences: JSON.parse(experiences),
      reviews: JSON.parse(reviews),
      bookings: JSON.parse(bookings),
      itineraries: JSON.parse(itineraries),
      pricing: JSON.parse(pricing)
    };
  } catch (error) {
    console.error('Failed to load pricing data:', error);
    throw new Error('Failed to load pricing data');
  }
}

// Calculate dynamic price for an activity
async function calculateDynamicPrice(activityId, context = {}) {
  try {
    await initializePricingData();
    const data = await loadPricingData();

    // Find activity
    const activity = data.activities.find(a => a.id === activityId);
    if (!activity) {
      throw new Error('Activity not found');
    }

    const basePrice = activity.pricing?.basePrice || 0;
    if (basePrice <= 0) {
      throw new Error('Activity has no base price set');
    }

    // Get pricing configuration
    const pricingConfig = data.pricing?.dynamic || {
      enabled: true,
      maxAdjustment: 30,
      seasonality: { high: 1.2, low: 0.85 },
      lastMinuteWindowDays: 3,
      lastMinuteDiscount: 10,
      bookingLeadTimeDiscount: 0.5,
      maxBookingLeadDays: 30,
      demandMultiplierMax: 1.1
    };

    let multiplier = 1.0;

    // Apply seasonality adjustment
    if (pricingConfig.seasonality) {
      const month = new Date().getMonth() + 1;
      // High season: December, January, June, July, August
      const highSeason = [12, 1, 6, 7, 8];
      const lowSeason = [4, 5, 9, 10, 11];

      if (highSeason.includes(month)) {
        multiplier *= pricingConfig.seasonality.high;
      } else if (lowSeason.includes(month)) {
        multiplier *= pricingConfig.seasonality.low;
      }
    }

    // Apply demand-based adjustment
    if (context.demand && context.demand > 2) {
      const demandMultiplier = Math.min(pricingConfig.demandMultiplierMax || 1.1, 1 + (context.demand - 2) * 0.05);
      multiplier *= demandMultiplier;
    }

    // Apply booking lead time adjustment
    if (context.leadDays) {
      if (context.leadDays <= pricingConfig.lastMinuteWindowDays) {
        // Last minute booking - apply discount to incentivize
        multiplier *= (1 - (pricingConfig.lastMinuteDiscount || 15) / 100);
      } else if (context.leadDays >= 30) {
        // Early bird booking - small discount
        multiplier *= (1 - (pricingConfig.bookingLeadTimeDiscount || 0.5) / 100);
      }
    }

    // Apply group size adjustment
    if (context.groupSize && context.groupSize > 4) {
      multiplier *= (1 - Math.min(15, (context.groupSize - 4) * 1.5) / 100);
    }

    // Apply weekend adjustment
    if (context.isWeekend) {
      const dayOfWeek = new Date(context.date).getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        multiplier *= 1.1;
      }
    }

    // Apply time-of-day adjustment
    if (context.timeOfDay) {
      if (context.timeOfDay === 'sunset') {
        multiplier *= 1.15;
      } else if (context.timeOfDay === 'morning') {
        multiplier *= 1.0;
      }
    }

    // Clamp multiplier to max adjustment
    const maxAdjustment = pricingConfig.maxAdjustment || 30;
    const minMultiplier = 1 - maxAdjustment / 100;
    const maxMultiplier = 1 + maxAdjustment / 100;
    multiplier = Math.max(minMultiplier, Math.min(maxMultiplier, multiplier));

    // Calculate dynamic price
    const dynamicPrice = Math.round(basePrice * multiplier * 100) / 100;

    return {
      success: true,
      activityId: activityId,
      basePrice: basePrice,
      dynamicPrice: dynamicPrice,
      multiplier: multiplier,
      factors: {
        seasonality: context.seasonality || 'normal',
        demand: context.demand || 'low',
        leadDays: context.leadDays || null,
        groupSize: context.groupSize || null,
        isWeekend: context.isWeekend || false,
        timeOfDay: context.timeOfDay || 'standard'
      },
      message: 'Dynamic price calculated successfully'
    };
  } catch (error) {
    console.error('Failed to calculate dynamic price:', error);
    throw new Error(`Failed to calculate dynamic price: ${error.message}`);
  }
}

// Get pricing for a group of activities
async function getPricingForActivities(activityIds, context = {}) {
  try {
    const results = [];
    for (const activityId of activityIds) {
      try {
        const priceResult = await calculateDynamicPrice(activityId, context);
        results.push(priceResult);
      } catch (error) {
        results.push({
          success: false,
          activityId: activityId,
          error: error.message
        });
      }
    }

    return {
      success: true,
      pricing: results
    };
  } catch (error) {
    console.error('Failed to get pricing for activities:', error);
    throw new Error(`Failed to get pricing for activities: ${error.message}`);
  }
}

// Calculate itinerary pricing
async function calculateItineraryPricing(itineraryId, context = {}) {
  try {
    const data = await loadPricingData();
    const itinerary = data.itineraries.find(i => i.id === itineraryId);

    if (!itinerary) {
      throw new Error('Itinerary not found');
    }

    const activityPricing = await getPricingForActivities(itinerary.activities, {
      ...context,
      groupSize: context.groupSize || itinerary.groupSize || 1
    });

    let totalCost = 0;
    const itemizedPricing = [];

    for (const pricing of activityPricing.pricing) {
      if (pricing.success && pricing.dynamicPrice) {
        totalCost += pricing.dynamicPrice;
        itemizedPricing.push({
          activityId: pricing.activityId,
          basePrice: pricing.basePrice,
          dynamicPrice: pricing.dynamicPrice,
          multiplier: pricing.multiplier
        });
      }
    }

    // Apply group discount for itineraries
    const groupSize = context.groupSize || itinerary.groupSize || 1;
    let groupDiscount = 0;
    if (groupSize >= 4) {
      groupDiscount = totalCost * 0.1; // 10% discount
    }

    // Apply package discount
    const packagingDiscount = itinerary.activities.length >= 3 ? totalCost * 0.05 : 0; // 5% for 3+ activities

    const finalTotal = totalCost - groupDiscount - packagingDiscount;

    return {
      success: true,
      itineraryId: itineraryId,
      baseCost: parseFloat(totalCost.toFixed(2)),
      groupDiscount: parseFloat(groupDiscount.toFixed(2)),
      packagingDiscount: parseFloat(packagingDiscount.toFixed(2)),
      finalCost: parseFloat(finalTotal.toFixed(2)),
      itemizedPricing: itemizedPricing,
      message: 'Itinerary pricing calculated successfully'
    };
  } catch (error) {
    console.error('Failed to calculate itinerary pricing:', error);
    throw new Error(`Failed to calculate itinerary pricing: ${error.message}`);
  }
}

// Set price for an activity
async function setActivityPrice(activityId, priceData, userId = null) {
  try {
    const data = await loadPricingData();
    const activityIndex = data.activities.findIndex(a => a.id === activityId);

    if (activityIndex === -1) {
      throw new Error('Activity not found');
    }

    // Validate price data
    if (!priceData.basePrice || priceData.basePrice <= 0) {
      throw new Error('Base price must be a positive number');
    }

    // Update activity pricing
    data.activities[activityIndex].pricing = {
      ...data.activities[activityIndex].pricing,
      basePrice: parseFloat(priceData.basePrice),
      priceUnit: priceData.priceUnit || data.activities[activityIndex].pricing?.priceUnit || 'per-person',
      discountPrice: priceData.discountPrice ? parseFloat(priceData.discountPrice) : null,
      currency: priceData.currency || 'USD',
      minimumGuests: priceData.minimumGuests || data.activities[activityIndex].pricing?.minimumGuests || 1,
      maximumGuests: priceData.maximumGuests || data.activities[activityIndex].pricing?.maximumGuests || 10
    };

    // Record pricing change
    if (!data.pricing.changes) {
      data.pricing.changes = [];
    }

    data.pricing.changes.push({
      id: uuidv4(),
      activityId: activityId,
      activityTitle: data.activities[activityIndex].title,
      oldPrice: data.activities[activityIndex].pricing?.basePrice,
      newPrice: parseFloat(priceData.basePrice),
      reason: priceData.reason || 'manager-update',
      changedBy: userId || 'system',
      changedAt: new Date().toISOString()
    });

    // Save data
    await savePricingData(data);

    return {
      success: true,
      activity: data.activities[activityIndex],
      message: 'Activity price updated successfully'
    };
  } catch (error) {
    console.error('Failed to set activity price:', error);
    throw new Error(`Failed to set activity price: ${error.message}`);
  }
}

// Get pricing analytics
async function getPricingAnalytics() {
  try {
    const data = await loadPricingData();

    // Calculate pricing analytics
    const activities = data.activities.filter(a =>
      a.metadata?.isApproved &&
      a.metadata?.isActive
    );

    // Price range analysis
    const minPrice = activities.length > 0 ? Math.min(...activities.map(a => a.pricing?.basePrice || 0)) : 0;
    const maxPrice = activities.length > 0 ? Math.max(...activities.map(a => a.pricing?.basePrice || 0)) : 0;
    const avgPrice = activities.length > 0
      ? activities.reduce((sum, a) => sum + (a.pricing?.basePrice || 0), 0) / activities.length
      : 0;

    // Booking value analysis
    const bookings = data.bookings || [];
    const totalRevenue = bookings.reduce((sum, b) => sum + b.totalPrice, 0);
    const avgBookingValue = bookings.length > 0 ? totalRevenue / bookings.length : 0;

    // Most popular price points
    const pricePoints = {};
    activities.forEach(activity => {
      const price = activity.pricing?.basePrice || 0;
      const range = Math.floor(price / 10) * 10;
      if (!pricePoints[range]) {
        pricePoints[range] = 0;
      }
      pricePoints[range]++;
    });

    // Category pricing
    const categoryPricing = {};
    activities.forEach(activity => {
      const category = activity.category;
      if (!categoryPricing[category]) {
        categoryPricing[category] = {
          count: 0,
          totalPrice: 0,
          minPrice: Infinity,
          maxPrice: 0
        };
      }

      const price = activity.pricing?.basePrice || 0;
      categoryPricing[category].count++;
      categoryPricing[category].totalPrice += price;
      categoryPricing[category].minPrice = Math.min(categoryPricing[category].minPrice, price);
      categoryPricing[category].maxPrice = Math.max(categoryPricing[category].maxPrice, price);
    });

    Object.values(categoryPricing).forEach(cat => {
      cat.avgPrice = cat.totalPrice / cat.count;
      delete cat.totalPrice;
    });

    // Pricing changes history
    const changes = data.pricing?.changes || [];

    return {
      success: true,
      analytics: {
        activityCount: activities.length,
        minPrice: parseFloat(minPrice.toFixed(2)),
        maxPrice: parseFloat(maxPrice.toFixed(2)),
        avgPrice: parseFloat(avgPrice.toFixed(2)),
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        avgBookingValue: parseFloat(avgBookingValue.toFixed(2)),
        pricePoints,
        categoryPricing,
        recentChanges: changes.slice(-10)
      }
    };
  } catch (error) {
    console.error('Failed to get pricing analytics:', error);
    throw new Error('Failed to get pricing analytics');
  }
}

// Apply bulk pricing update
async function applyBulkPricingUpdate(updateData, userId = null) {
  try {
    const data = await loadPricingData();

    const { category, priceChangeType, priceChangeValue } = updateData;

    if (!category) {
      throw new Error('Category is required');
    }

    const targetActivities = data.activities.filter(a =>
      a.category === category &&
      a.metadata?.isApproved
    );

    if (targetActivities.length === 0) {
      throw new Error(`No activities found in category: ${category}`);
    }

    const updatedActivities = [];
    for (const activity of targetActivities) {
      const oldPrice = activity.pricing?.basePrice || 0;

      if (priceChangeType === 'percentage') {
        const change = oldPrice * (priceChangeValue / 100);
        activity.pricing.basePrice = Math.round((oldPrice + change) * 100) / 100;
      } else if (priceChangeType === 'fixed') {
        activity.pricing.basePrice = Math.round((oldPrice + priceChangeValue) * 100) / 100;
      } else if (priceChangeType === 'set') {
        activity.pricing.basePrice = priceChangeValue;
      }

      // Record change
      data.pricing.changes.push({
        id: uuidv4(),
        activityId: activity.id,
        activityTitle: activity.title,
        oldPrice: oldPrice,
        newPrice: activity.pricing.basePrice,
        reason: `bulk-${priceChangeType}`,
        changedBy: userId || 'system',
        changedAt: new Date().toISOString()
      });

      updatedActivities.push(activity);
    }

    await savePricingData(data);

    return {
      success: true,
      updatedCount: updatedActivities.length,
      updatedActivities: updatedActivities.map(a => ({
        id: a.id,
        title: a.title,
        price: a.pricing.basePrice
      })),
      message: `Updated ${updatedActivities.length} activities`
    };
  } catch (error) {
    console.error('Failed to apply bulk pricing update:', error);
    throw new Error(`Failed to apply bulk pricing update: ${error.message}`);
  }
}

// Initialize pricing data
async function initializePricingData() {
  try {
    const dataDir = path.join(__dirname, '../data');

    // Check and initialize pricing.json if not exists
    try {
      await fs.access(path.join(dataDir, 'pricing.json'));
    } catch {
      const defaultPricing = {
        dynamic: {
          enabled: true,
          maxAdjustment: 30,
          seasonality: {
            high: 1.2,
            low: 0.85
          },
          lastMinuteWindowDays: 3,
          lastMinuteDiscount: 10,
          bookingLeadTimeDiscount: 0.5,
          maxBookingLeadDays: 30,
          demandMultiplierMax: 1.1
        },
        changes: []
      };

      await fs.writeFile(
        path.join(dataDir, 'pricing.json'),
        JSON.stringify(defaultPricing, null, 2)
      );
    }
  } catch (error) {
    console.error('Failed to initialize pricing data:', error);
    throw new Error('Failed to initialize pricing data');
  }
}

// Save pricing data
async function savePricingData(data) {
  try {
    const dataDir = path.join(__dirname, '../data');

    await fs.writeFile(
      path.join(dataDir, 'pricing.json'),
      JSON.stringify(data.pricing, null, 2)
    );

    await fs.writeFile(
      path.join(dataDir, 'activities.json'),
      JSON.stringify(data.activities, null, 2)
    );
  } catch (error) {
    console.error('Failed to save pricing data:', error);
    throw new Error('Failed to save pricing data');
  }
}

// Export all functions
module.exports = {
  loadPricingData,
  calculateDynamicPrice,
  getPricingForActivities,
  calculateItineraryPricing,
  setActivityPrice,
  getPricingAnalytics,
  applyBulkPricingUpdate,
  initializePricingData,
  savePricingData
};