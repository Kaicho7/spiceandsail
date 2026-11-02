// Custom Itinerary Builder - Interactive drag-and-drop scheduler for building personalized itineraries
// Phase 2: Core functionality with drag-and-drop interface and WhatsApp integration

const fs = require('fs');
const path = require('path');

// Load all data files for custom itinerary building
const loadData = () => {
  const dataDir = path.join(__dirname, '..', 'data');

  const hotelsData = JSON.parse(fs.readFileSync(path.join(dataDir, 'hotels.json'), 'utf8'));
  const toursData = JSON.parse(fs.readFileSync(path.join(dataDir, 'tours.json'), 'utf8'));
  const experiencesData = JSON.parse(fs.readFileSync(path.join(dataDir, 'experiences.json'), 'utf8'));
  const attractionsData = JSON.parse(fs.readFileSync(path.join(dataDir, 'attractions.json'), 'utf8'));
  const transfersData = JSON.parse(fs.readFileSync(path.join(dataDir, 'transfers.json'), 'utf8'));
  const packagesData = JSON.parse(fs.readFileSync(path.join(dataDir, 'packages.json'), 'utf8'));

  return {
    hotels: hotelsData,
    tours: toursData,
    experiences: experiencesData,
    attractions: attractionsData,
    transfers: transfersData,
    packages: packagesData
  };
};

// Category metadata for the custom itinerary builder
const categoryMetadata = {
  'hotels': {
    label: 'Hotels',
    icon: 'hotel',
    color: '#3B82F6',
    maxItemsPerDay: 1,
    defaultDuration: 1,
    pricingType: 'flat-rate',
    priceRange: { min: 50, max: 1000 }
  },
  'tours': {
    label: 'Tours',
    icon: 'bus',
    color: '#10B981',
    maxItemsPerDay: 2,
    defaultDuration: 4,
    pricingType: 'price-range',
    priceRange: { min: 100, max: 500 }
  },
  'experiences': {
    label: 'Experiences',
    icon: 'camera',
    color: '#F59E0B',
    maxItemsPerDay: 3,
    defaultDuration: 2,
    pricingType: 'flat-rate',
    priceRange: { min: 25, max: 150 }
  },
  'attractions': {
    label: 'Attractions',
    icon: 'map-marker',
    color: '#EF4444',
    maxItemsPerDay: 3,
    defaultDuration: 2,
    pricingType: 'free',
    priceRange: { min: 0, max: 50 }
  },
  'transfers': {
    label: 'Transfers',
    icon: 'car',
    color: '#8B5CF6',
    maxItemsPerDay: 1,
    defaultDuration: 2,
    pricingType: 'flat-rate',
    priceRange: { min: 25, max: 80 }
  },
  'packages': {
    label: 'Packages',
    icon: 'gift',
    color: '#EC4899',
    maxItemsPerDay: 1,
    defaultDuration: 3,
    pricingType: 'package',
    priceRange: { min: 200, max: 2000 }
  }
};

// Generate unique IDs for items
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// Custom itinerary item structure
function createItineraryItem(type, itemData) {
  return {
    id: generateId(),
    type: type,
    category: type,
    day: 1, // Will be set during scheduling
    startTime: '09:00',
    endTime: '12:00',
    duration: categoryMetadata[type].defaultDuration,
    status: 'planned',
    ...itemData
  };
}

// WhatsApp integration configuration
const WHATSAPP_CONFIG = {
  phoneNumber: '+255 672 450 934',
  messages: {
    itineraryInquiry: 'Hello! I need help planning my Zanzibar itinerary for {dates}.',
    bookingInquiry: 'Hi! I would like to book {package_type} for my trip on {dates}.'
  }
};

// Format itinerary for WhatsApp sharing
function formatItineraryForWhatsApp(itinerary, dates, title = 'My Zanzibar Itinerary') {
  let message = `Hello! Here's my ${title} for ${dates}:\n\n`;

  // Group items by day
  const itemsByDay = {};
  itinerary.items.forEach(item => {
    if (!itemsByDay[item.day]) itemsByDay[item.day] = [];
    itemsByDay[item.day].push(item);
  });

  // Add each day's plan
  for (let day = 1; day <= itinerary.totalDays; day++) {
    if (itemsByDay[day]) {
      message += `Day ${day}:\n`;
      itemsByDay[day].forEach(item => {
        const category = categoryMetadata[item.type];
        const itemName = item.name || item.title || item.title;
        message += `• ${itemName} (${category.label})\n`;
        if (item.price_display) message += `  Price: ${item.price_display}\n`;
        if (item.description) {
          const shortDesc = item.description.substring(0, 60) + '...';
          message += `  ${shortDesc}\n`;
        }
      });
      message += '\n';
    }
  }

  // Add total cost
  message += `Total Cost: $${itinerary.totalCost}\n`;
  message += `\nContact me for booking! 📞 ${WHATSAPP_CONFIG.phoneNumber}`;

  return message;
}

// Calculate pricing for itinerary items
function calculateItemPrice(item) {
  switch (item.pricingType) {
    case 'flat-rate':
      return item.price.min || item.price || 50;
    case 'price-range':
      return item.price.min || (item.price && item.price.min) || 100;
    case 'free':
      return 0;
    case 'package':
      return item.price || 500;
    default:
      return item.price || 100;
  }
}

// Generate complete itinerary with day-by-day scheduling
function generateItinerary(plan, items) {
  const data = loadData();
  const scheduledItems = [];
  const itemsByDay = {};

  // Sort items by priority (relevance score, then by category)
  const sortedItems = items.sort((a, b) => {
    if (b.relevanceScore !== a.relevanceScore) {
      return b.relevanceScore - a.relevanceScore;
    }
    const aPriority = categoryMetadata[a.type].maxItemsPerDay;
    const bPriority = categoryMetadata[b.type].maxItemsPerDay;
    return bPriority - aPriority;
  });

  // Schedule items day by day
  let currentDay = 1;
  let itemsOnCurrentDay = 0;

  for (const item of sortedItems) {
    const category = categoryMetadata[item.type];
    const maxPerDay = category.maxItemsPerDay;

    // Check if we need to move to next day
    if (itemsOnCurrentDay >= maxPerDay) {
      currentDay++;
      itemsOnCurrentDay = 0;
    }

    // Create scheduled itinerary item
    const itineraryItem = createItineraryItem(item.type, {
      ...item,
      day: currentDay,
      price: calculateItemPrice(item),
      price_display: item.price_display || item.price || `$${calculateItemPrice(item)}`
    });

    scheduledItems.push(itineraryItem);
    if (!itemsByDay[currentDay]) itemsByDay[currentDay] = [];
    itemsByDay[currentDay].push(itineraryItem);
    itemsOnCurrentDay++;
  }

  // Calculate total days
  const totalDays = currentDay;

  // Calculate total cost
  const totalCost = scheduledItems.reduce((sum, item) => sum + item.price, 0);

  // Generate WhatsApp message
  const dates = plan.dates || 'dates to be specified';
  const whatsappMessage = formatItineraryForWhatsApp(
    {
      items: scheduledItems,
      totalDays,
      totalCost
    },
    dates
  );

  return {
    success: true,
    itinerary: {
      id: generateId(),
      name: plan.name || 'Custom Itinerary',
      description: plan.description || 'My custom Zanzibar itinerary',
      items: scheduledItems,
      totalDays,
      totalCost,
      currency: 'USD',
      categories: Object.keys(itemsByDay).map(day => ({
        day: parseInt(day),
        items: itemsByDay[day].map(item => ({
          id: item.id,
          type: item.type,
          name: item.name || item.title,
          time: `${item.startTime} - ${item.endTime}`,
          price: item.price_display
        }))
      })),
      whatsappMessage
    },
    metadata: {
      totalItems: scheduledItems.length,
      daysPlanned: totalDays,
      categoriesUsed: [...new Set(scheduledItems.map(item => item.type))],
      estimatedBudget: totalCost,
      optimizationApplied: true
    }
  };
}

// Validate itinerary against user preferences
function validateItinerary(itinerary, userPreferences) {
  const errors = [];
  const warnings = [];

  // Check for duplicate items
  const itemIds = itinerary.items.map(item => item.id);
  const duplicates = itemIds.filter((id, index) => itemIds.indexOf(id) !== index);
  if (duplicates.length > 0) {
    errors.push('Itinerary contains duplicate items');
  }

  // Check budget constraints
  if (userPreferences.budget) {
    const budget = userPreferences.budget.min || userPreferences.budget;
    if (itinerary.totalCost > budget * 1.2) {
      warnings.push(`Itinerary exceeds budget by more than 20% ( $${itinerary.totalCost} vs $${budget})`);
    }
  }

  // Check zone conflicts
  const zones = itinerary.items.map(item => item.zone).filter(Boolean);
  if (zones.length > 10) {
    warnings.push('Itinerary covers many zones - may require extensive travel time');
  }

  // Check for activity conflicts
  const activities = itinerary.items.map(item => item.name.toLowerCase())
    .filter(name => name.includes('snorkeling') || name.includes('diving') || name.includes('swimming'));
  if (activities.length > 3) {
    warnings.push('Multiple water activities - ensure adequate safety gear');
  }

  return { errors, warnings };
}

// API endpoint handlers
const createItinerary = async (req, res) => {
  try {
    const { plan, items } = req.body;

    if (!plan || !items) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: plan and items'
      });
    }

    // Generate the custom itinerary
    const result = generateItinerary(plan, items);

    if (!result.success) {
      return res.status(500).json(result);
    }

    // Validate the itinerary
    const validation = validateItinerary(result.itinerary, plan.preferences || {});

    res.json({
      ...result,
      validation
    });
  } catch (error) {
    console.error('Error creating itinerary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create itinerary'
    });
  }
};

const getItinerary = async (req, res) => {
  try {
    const { itineraryId } = req.params;

    // In a real implementation, this would fetch from database
    res.json({
      success: true,
      error: 'Not implemented - would fetch from database'
    });
  } catch (error) {
    console.error('Error fetching itinerary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch itinerary'
    });
  }
};

const updateItinerary = async (req, res) => {
  try {
    const { itineraryId } = req.params;
    const updates = req.body;

    // In a real implementation, this would update database
    res.json({
      success: true,
      message: 'Itinerary updated successfully'
    });
  } catch (error) {
    console.error('Error updating itinerary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update itinerary'
    });
  }
};

const deleteItinerary = async (req, res) => {
  try {
    const { itineraryId } = req.params;

    // In a real implementation, this would delete from database
    res.json({
      success: true,
      message: 'Itinerary deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting itinerary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete itinerary'
    });
  }
};

const generateWhatsAppMessage = async (req, res) => {
  try {
    const { itinerary, dates, title } = req.body;

    if (!itinerary) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: itinerary'
      });
    }

    const message = formatItineraryForWhatsApp(itinerary, dates || 'trip dates', title);

    res.json({
      success: true,
      message,
      phoneNumber: WHATSAPP_CONFIG.phoneNumber
    });
  } catch (error) {
    console.error('Error generating WhatsApp message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate WhatsApp message'
    });
  }
};

module.exports = {
  loadData,
  categoryMetadata,
  createItineraryItem,
  generateItinerary,
  validateItinerary,
  formatItineraryForWhatsApp,
  WHATSAPP_CONFIG,
  createItinerary,
  getItinerary,
  updateItinerary,
  deleteItinerary,
  generateWhatsAppMessage
};