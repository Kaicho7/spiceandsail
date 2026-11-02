// Smart Itinerary Builder - AI-powered suggestion engine
// Phase 1: Core functionality with preference-based recommendations

const fs = require('fs');
const path = require('path');

// Load all data files for intelligent recommendations
const loadData = () => {
  const dataDir = path.join(__dirname, '..', 'data');

  const hotelsData = JSON.parse(fs.readFileSync(path.join(dataDir, 'hotels.json'), 'utf8'));
  const toursData = JSON.parse(fs.readFileSync(path.join(dataDir, 'tours.json'), 'utf8'));
  const experiencesData = JSON.parse(fs.readFileSync(path.join(dataDir, 'experiences.json'), 'utf8'));
  const attractionsData = JSON.parse(fs.readFileSync(path.join(dataDir, 'attractions.json'), 'utf8'));
  const transfersData = JSON.parse(fs.readFileSync(path.join(dataDir, 'transfers.json'), 'utf8'));

  return {
    hotels: hotelsData,
    tours: toursData,
    experiences: experiencesData,
    attractions: attractionsData,
    transfers: transfersData
  };
};

// User preference profiles for intelligent matching
const preferenceProfiles = {
  'family-travel': {
    problem: 'safe beaches children turtle snorkeling spice farm kids',
    priorityZones: ['Nungwi', 'Paje', 'Jambiani'],
    preferredTiers: ['3-Star', 'Guesthouse'],
    preferredActivities: ['swimming', 'turtle', 'snorkeling', 'spice farm'],
    budgetRange: { min: 50, max: 150 }
  },
  'honeymoon-packages': {
    problem: 'romantic sunset dhow cruise private beach dinner',
    priorityZones: ['Private Island', 'Nungwi'],
    preferredTiers: ['Luxury Boutique', '5-Star'],
    preferredActivities: ['dhow', 'sunset', 'beach', 'romantic'],
    budgetRange: { min: 200, max: 1000 }
  },
  'self-drive': {
    problem: 'rental car SUV 4x4 Stone Town east coast',
    priorityZones: ['Stone Town', 'Kiwengwa', 'Pongwe'],
    preferredTiers: ['4-Star', '3-Star'],
    preferredActivities: ['cultural', 'historical', 'driving'],
    budgetRange: { min: 100, max: 300 }
  },
  'migration-calendar': {
    problem: 'turtle nesting whale watching dolphin bird migration',
    priorityZones: ['Matemwe', 'Kizimkazi', 'Fumba'],
    preferredTiers: ['Eco-Lodge', 'Lodge'],
    preferredActivities: ['turtle', 'whale', 'bird', 'migration'],
    budgetRange: { min: 150, max: 400 }
  },
  'health-safety': {
    problem: 'mosquito net repellent antimalarial safe swimming',
    priorityZones: ['Nungwi', 'Paje'],
    preferredTiers: ['4-Star', '3-Star'],
    preferredActivities: ['swimming', 'safe', 'relaxation'],
    budgetRange: { min: 80, max: 200 }
  },
  'tribes-culture': {
    problem: 'Swahili culture local tribes authentic traditions',
    priorityZones: ['Stone Town', 'Kizimkazi'],
    preferredTiers: ['4-Star', 'Boutique'],
    preferredActivities: ['cultural', 'tribes', 'traditions', 'heritage'],
    budgetRange: { min: 100, max: 250 }
  },
  'packing-guide': {
    problem: 'essential packing list seasonal what NOT to bring',
    priorityZones: ['Stone Town', 'Nungwi'],
    preferredTiers: ['4-Star', '3-Star'],
    preferredActivities: ['relaxation', 'comfort'],
    budgetRange: { min: 80, max: 200 }
  },
  'spice-farm-cultural': {
    problem: 'spice trade history cloves vanilla nutmeg cinnamon',
    priorityZones: ['Stone Town'],
    preferredTiers: ['4-Star', 'Boutique'],
    preferredActivities: ['spice', 'cultural', 'history'],
    budgetRange: { min: 100, max: 250 }
  },
  'default': {
    problem: 'zanzibar travel planning',
    priorityZones: ['Stone Town', 'Nungwi', 'Paje'],
    preferredTiers: ['4-Star', '3-Star'],
    preferredActivities: ['relaxation', 'culture', 'adventure'],
    budgetRange: { min: 100, max: 300 }
  }
};

// Scoring function for intelligent matching
function matchScore(userPrefs, item, type) {
  let score = 0;

  switch(type) {
    case 'hotel':
      // Zone match (0-30 points)
      if (userPrefs.priorityZones.includes(item.zone)) {
        score += 30;
      }

      // Tier preference match (0-20 points)
      if (userPrefs.preferredTiers.includes(item.star_rating)) {
        score += 20;
      }

      // Budget match (0-25 points)
      const hotelPrice = item.price ? parseInt(item.price.replace('$', '').split('-')[0]) : 0;
      if (hotelPrice >= userPrefs.budgetRange.min && hotelPrice <= userPrefs.budgetRange.max) {
        score += 25;
      }

      break;

    case 'tour':
      // Activity match (0-30 points)
      const tourKeywords = item.title.toLowerCase() + ' ' + item.description.toLowerCase();
      let activityScore = 0;
      for (const activity of userPrefs.preferredActivities) {
        if (tourKeywords.includes(activity.toLowerCase())) {
          activityScore += 10;
        }
      }
      score += Math.min(activityScore, 30);

      // Price range match (0-20 points)
      const tourPriceMin = item.price.min;
      const tourPriceMax = item.price.max;
      if (tourPriceMin >= userPrefs.budgetRange.min && tourPriceMin <= userPrefs.budgetRange.max) {
        score += 20;
      }

      break;

    case 'attraction':
      // Activity match (0-25 points)
      const attractionKeywords = item.name.toLowerCase() + ' ' + item.description.toLowerCase();
      let categoryScore = 0;
      for (const activity of userPrefs.preferredActivities) {
        if (attractionKeywords.includes(activity.toLowerCase())) {
          categoryScore += 10;
        }
      }
      score += Math.min(categoryScore, 25);

      // Zone match (0-20 points)
      if (userPrefs.priorityZones.includes(item.zone)) {
        score += 20;
      }

      break;

    case 'transfer':
      // Route match (0-30 points)
      for (const zone of userPrefs.priorityZones) {
        if (item.zone.toLowerCase().includes(zone.toLowerCase())) {
          score += 30;
          break;
        }
      }

      // Price match (0-20 points)
      const transferPrice = item.price.min;
      if (transferPrice >= userPrefs.budgetRange.min && transferPrice <= userPrefs.budgetRange.max) {
        score += 20;
      }

      break;
  }

  return score;
}

// Main intelligent suggestion function
function suggestItinerary(intent, tripDuration, budget, userProfile) {
  const profileKey = userProfile || intent || 'default';
  const userPrefs = preferenceProfiles[profileKey] || preferenceProfiles.default;

  // Adjust budget based on user input
  if (budget) {
    userPrefs.budgetRange = { min: budget * 0.8, max: budget * 1.2 };
  }

  const data = loadData();

  // Categorize suggestions
  const suggestions = {
    hotels: [],
    tours: [],
    experiences: [],
    attractions: [],
    transfers: []
  };

  // Process hotels with intelligent scoring
  for (const hotel of data.hotels) {
    const score = matchScore(userPrefs, hotel, 'hotel');
    if (score >= 50) { // Minimum threshold for relevance
      suggestions.hotels.push({
        ...hotel,
        relevanceScore: score,
        type: 'hotel'
      });
    }
  }

  // Process tours with intelligent scoring
  for (const tour of data.tours) {
    const score = matchScore(userPrefs, tour, 'tour');
    if (score >= 40) { // Lower threshold for tours (more variety)
      suggestions.tours.push({
        ...tour,
        relevanceScore: score,
        type: 'tour'
      });
    }
  }

  // Process attractions with intelligent scoring
  for (const attraction of data.attractions) {
    const score = matchScore(userPrefs, attraction, 'attraction');
    if (score >= 45) { // Moderate threshold for attractions
      suggestions.attractions.push({
        ...attraction,
        relevanceScore: score,
        type: 'attraction'
      });
    }
  }

  // Process transfers with intelligent scoring
  for (const transfer of data.transfers) {
    const score = matchScore(userPrefs, transfer, 'transfer');
    if (score >= 40) { // Lower threshold for transfers (essential)
      suggestions.transfers.push({
        ...transfer,
        relevanceScore: score,
        type: 'transfer'
      });
    }
  }

  // Sort by relevance score (highest first)
  for (const category in suggestions) {
    suggestions[category].sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  // Generate itinerary suggestions based on trip duration
  const itinerarySuggestions = [];

  // Add hotels (top 3)
  if (suggestions.hotels.length > 0) {
    itinerarySuggestions.push(...suggestions.hotels.slice(0, 3));
  }

  // Add tours (top 4)
  if (suggestions.tours.length > 0) {
    itinerarySuggestions.push(...suggestions.tours.slice(0, 4));
  }

  // Add attractions (top 5)
  if (suggestions.attractions.length > 0) {
    itinerarySuggestions.push(...suggestions.attractions.slice(0, 5));
  }

  // Add transfers (top 2)
  if (suggestions.transfers.length > 0) {
    itinerarySuggestions.push(...suggestions.transfers.slice(0, 2));
  }

  return {
    userPreferences: userPrefs,
    suggestions: itinerarySuggestions,
    categories: {
      hotels: suggestions.hotels,
      tours: suggestions.tours,
      experiences: suggestions.experiences,
      attractions: suggestions.attractions,
      transfers: suggestions.transfers
    },
    metadata: {
      totalItems: itinerarySuggestions.length,
      categoriesFound: Object.keys(suggestions).filter(key => suggestions[key].length > 0),
      averageRelevanceScore: itinerarySuggestions.length > 0
        ? itinerarySuggestions.reduce((sum, item) => sum + item.relevanceScore, 0) / itinerarySuggestions.length
        : 0
    }
  };
}

// Get smart itinerary for a specific intent
function getItineraryForIntent(intent, tripDuration, budget, userProfile) {
  const itinerary = suggestItinerary(intent, tripDuration, budget, userProfile);

  // Generate user-friendly summary
  const summary = {
    intent: intent,
    totalRecommendations: itinerary.metadata.totalItems,
    topCategories: itinerary.metadata.categoriesFound,
    budgetRange: itinerary.userPreferences.budgetRange,
    recommendedStayDuration: tripDuration,
    keyHighlights: []
  };

  // Extract key highlights from top recommendations
  if (itinerary.suggestions.length > 0) {
    const topItems = itinerary.suggestions.slice(0, 5);

    topItems.forEach(item => {
      if (item.type === 'hotel') {
        summary.keyHighlights.push(`Stay at ${item.name} (${item.star_rating}, ${item.zone})`);
      } else if (item.type === 'tour') {
        summary.keyHighlights.push(`Experience ${item.title} - ${item.description.substring(0, 60)}...`);
      } else if (item.type === 'attraction') {
        summary.keyHighlights.push(`${item.name} - ${item.category}`);
      } else if (item.type === 'transfer') {
        summary.keyHighlights.push(`Airport transfer: ${item.title} (${item.price_display})`);
      }
    });
  }

  return {
    success: true,
    data: itinerary,
    summary: summary,
    intent: intent,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  suggestItinerary,
  getItineraryForIntent,
  preferenceProfiles
};