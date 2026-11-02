// Itinerary Builder API - Day-by-Day Planning and Optimization
// Phase 5: Implements comprehensive itinerary planning and optimization for multi-activity bookings

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Helper: add days to a date (returns new Date, doesn't mutate)
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Load itinerary data from data directory
async function loadItineraryData() {
  try {
    const dataDir = path.join(__dirname, '../data');
    const [experiences, experiencesApproval, reviews, userActivities, activities, bookings, itineraries, packages] = await Promise.all([
      fs.readFile(path.join(dataDir, 'experiences.json'), 'utf8'),
      fs.readFile(path.join(dataDir, 'experiences-approval.json'), 'utf8'),
      fs.readFile(path.join(dataDir, 'reviews.json'), 'utf8'),
      fs.readFile(path.join(dataDir, 'user-activities.json'), 'utf8'),
      fs.readFile(path.join(dataDir, 'activities.json'), 'utf8'),
      fs.readFile(path.join(dataDir, 'bookings.json'), 'utf8'),
      fs.readFile(path.join(dataDir, 'itineraries.json'), 'utf8'),
      fs.readFile(path.join(dataDir, 'packages.json'), 'utf8')
    ]);

    return {
      experiences: JSON.parse(experiences),
      experiencesApproval: JSON.parse(experiencesApproval),
      reviews: JSON.parse(reviews),
      userActivities: JSON.parse(userActivities),
      activities: JSON.parse(activities),
      bookings: JSON.parse(bookings),
      itineraries: JSON.parse(itineraries),
      packages: JSON.parse(packages)
    };
  } catch (error) {
    console.error('Failed to load itinerary data:', error);
    throw new Error('Failed to load itinerary data');
  }
}

// Create new itinerary
async function createItinerary(itineraryData, userInfo) {
  try {
    await initializeItineraryData();
    const data = await loadItineraryData();

    // Validate required fields
    const requiredFields = ['title', 'startDate', 'endDate', 'activities'];
    for (const field of requiredFields) {
      if (!itineraryData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate dates
    const startDate = new Date(itineraryData.startDate);
    const endDate = new Date(itineraryData.endDate);
    if (startDate >= endDate) {
      throw new Error('Start date must be before end date');
    }

    // Generate itinerary ID
    const itineraryId = uuidv4();

    // Calculate total days
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

    // Build day-by-day activities
    const days = buildDaySchedule(itineraryData.activities, startDate, totalDays);

    // Calculate totals
    const activityCosts = itineraryData.activities.map(activityId => {
      const activity = data.activities.find(a => a.id === activityId);
      return activity?.pricing?.basePrice || 0;
    });

    const totalCost = activityCosts.reduce((sum, cost) => sum + cost, 0);

    // Prepare itinerary object
    const itinerary = {
      id: itineraryId,
      userId: userInfo.id,
      title: itineraryData.title,
      description: itineraryData.description || '',
      startDate: itineraryData.startDate,
      endDate: itineraryData.endDate,
      totalDays: totalDays,
      days: days,
      activities: itineraryData.activities,
      status: 'active',
      totalCost: parseFloat(totalCost.toFixed(2)),
      currency: 'USD',
      groupSize: itineraryData.groupSize || 1,
      budget: itineraryData.budget || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      contactInfo: {
        name: userInfo.name,
        email: userInfo.email,
        phone: userInfo.phone
      },
      specialRequests: itineraryData.specialRequests || '',
      notes: itineraryData.notes || ''
    };

    // Add to itineraries array
    data.itineraries.push(itinerary);

    // Update user activities
    itineraryData.activities.forEach(activityId => {
      const userActivityIndex = data.userActivities.findIndex(ua =>
        ua.userId === userInfo.id &&
        ua.activityId === activityId &&
        ua.status === 'booked'
      );

      if (userActivityIndex !== -1) {
        data.userActivities[userActivityIndex].status = 'scheduled';
        data.userActivities[userActivityIndex].itineraryId = itineraryId;
      }
    });

    // Save all data
    await saveItineraryData(data);

    return {
      success: true,
      itinerary: itinerary,
      message: 'Itinerary created successfully'
    };

  } catch (error) {
    console.error('Failed to create itinerary:', error);
    throw new Error(`Failed to create itinerary: ${error.message}`);
  }
}

// Build day-by-day schedule
function buildDaySchedule(activityIds, startDate, totalDays) {
  const days = [];
  const activitiesPerDay = Math.max(1, Math.ceil(activityIds.length / totalDays));
  const activities = [...activityIds];

  for (let day = 1; day <= totalDays; day++) {
    const dayActivities = activities.splice(0, activitiesPerDay);

    const daySchedule = {
      day: day,
      date: addDays(startDate, day - 1).toISOString().split('T')[0],
      activities: []
    };

    dayActivities.forEach((activityId, index) => {
      daySchedule.activities.push({
        activityId: activityId,
        order: index + 1,
        estimatedDuration: '2 hours',
        location: '',
        notes: ''
      });
    });

    days.push(daySchedule);
  }

  return days;
}

// Get user itineraries
async function getUserItineraries(userId) {
  try {
    const data = await loadItineraryData();
    const userItineraries = data.itineraries.filter(i => i.userId === userId);

    return {
      success: true,
      itineraries: userItineraries
    };
  } catch (error) {
    console.error('Failed to get user itineraries:', error);
    throw new Error('Failed to get user itineraries');
  }
}

// Get itinerary by ID
async function getItineraryById(itineraryId, userId = null) {
  try {
    const data = await loadItineraryData();
    let itinerary = data.itineraries.find(i => i.id === itineraryId);

    // If userId is provided, ensure the itinerary belongs to the user
    if (userId && itinerary && itinerary.userId !== userId) {
      throw new Error('Access denied');
    }

    if (!itinerary) {
      throw new Error('Itinerary not found');
    }

    return {
      success: true,
      itinerary: itinerary
    };
  } catch (error) {
    console.error('Failed to get itinerary by ID:', error);
    throw new Error(`Failed to get itinerary by ID: ${error.message}`);
  }
}

// Update itinerary
async function updateItinerary(itineraryId, updateData, userId = null) {
  try {
    const data = await loadItineraryData();
    const itineraryIndex = data.itineraries.findIndex(i => i.id === itineraryId);

    if (itineraryIndex === -1) {
      throw new Error('Itinerary not found');
    }

    // If userId is provided, ensure the itinerary belongs to the user
    if (userId && data.itineraries[itineraryIndex].userId !== userId) {
      throw new Error('Access denied');
    }

    // Update itinerary
    data.itineraries[itineraryIndex].title = updateData.title || data.itineraries[itineraryIndex].title;
    data.itineraries[itineraryIndex].description = updateData.description || data.itineraries[itineraryIndex].description;
    data.itineraries[itineraryIndex].status = updateData.status || data.itineraries[itineraryIndex].status;
    data.itineraries[itineraryIndex].specialRequests = updateData.specialRequests || data.itineraries[itineraryIndex].specialRequests;
    data.itineraries[itineraryIndex].notes = updateData.notes || data.itineraries[itineraryIndex].notes;
    data.itineraries[itineraryIndex].updatedAt = new Date().toISOString();

    // Recalculate if dates or activities changed
    if (updateData.startDate || updateData.endDate || updateData.activities) {
      const startDate = new Date(updateData.startDate || data.itineraries[itineraryIndex].startDate);
      const endDate = new Date(updateData.endDate || data.itineraries[itineraryIndex].endDate);
      const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

      data.itineraries[itineraryIndex].totalDays = totalDays;
      data.itineraries[itineraryIndex].startDate = updateData.startDate || data.itineraries[itineraryIndex].startDate;
      data.itineraries[itineraryIndex].endDate = updateData.endDate || data.itineraries[itineraryIndex].endDate;

      const activities = updateData.activities || data.itineraries[itineraryIndex].activities;
      data.itineraries[itineraryIndex].days = buildDaySchedule(activities, startDate, totalDays);
      data.itineraries[itineraryIndex].activities = activities;

      // Recalculate total cost
      const activityCosts = activities.map(activityId => {
        const activity = data.activities.find(a => a.id === activityId);
        return activity?.pricing?.basePrice || 0;
      });

      const totalCost = activityCosts.reduce((sum, cost) => sum + cost, 0);
      data.itineraries[itineraryIndex].totalCost = parseFloat(totalCost.toFixed(2));
    }

    await saveItineraryData(data);

    return {
      success: true,
      itinerary: data.itineraries[itineraryIndex],
      message: 'Itinerary updated successfully'
    };
  } catch (error) {
    console.error('Failed to update itinerary:', error);
    throw new Error(`Failed to update itinerary: ${error.message}`);
  }
}

// Delete itinerary
async function deleteItinerary(itineraryId, userId = null) {
  try {
    const data = await loadItineraryData();
    const itineraryIndex = data.itineraries.findIndex(i => i.id === itineraryId);

    if (itineraryIndex === -1) {
      throw new Error('Itinerary not found');
    }

    // If userId is provided, ensure the itinerary belongs to the user
    if (userId && data.itineraries[itineraryIndex].userId !== userId) {
      throw new Error('Access denied');
    }

    const itinerary = data.itineraries[itineraryIndex];

    // Update user activities
    itinerary.activities.forEach(activityId => {
      const userActivityIndex = data.userActivities.findIndex(ua =>
        ua.userId === itinerary.userId &&
        ua.activityId === activityId &&
        ua.itineraryId === itineraryId
      );

      if (userActivityIndex !== -1) {
        data.userActivities[userActivityIndex].status = 'booked';
        data.userActivities[userActivityIndex].itineraryId = null;
      }
    });

    // Remove itinerary
    data.itineraries.splice(itineraryIndex, 1);

    await saveItineraryData(data);

    return {
      success: true,
      message: 'Itinerary deleted successfully'
    };
  } catch (error) {
    console.error('Failed to delete itinerary:', error);
    throw new Error(`Failed to delete itinerary: ${error.message}`);
  }
}

// Get activity recommendations based on preferences
async function getActivityRecommendations(userId, preferences = {}) {
  try {
    const data = await loadItineraryData();
    const user = data.users?.find(u => u.id === userId);

    let activities = data.activities.filter(a => a.metadata?.isApproved && a.metadata?.isActive);

    // Filter by category if specified
    if (preferences.categories && preferences.categories.length > 0) {
      activities = activities.filter(a => preferences.categories.includes(a.category));
    }

    // Filter by location if specified
    if (preferences.location) {
      activities = activities.filter(a =>
        a.location.area.toLowerCase().includes(preferences.location.toLowerCase()) ||
        a.location.address.toLowerCase().includes(preferences.location.toLowerCase())
      );
    }

    // Filter by price range if specified
    if (preferences.priceRange) {
      const [min, max] = preferences.priceRange.split('-').map(Number);
      activities = activities.filter(a =>
        a.pricing.basePrice >= min &&
        a.pricing.basePrice <= max
      );
    }

    // Get recommended activities (simple algorithm based on ratings and user preferences)
    activities.sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating;
      return b.metadata?.reviewCount - a.metadata?.reviewCount;
    });

    return {
      success: true,
      activities: activities.slice(0, preferences.limit || 10)
    };
  } catch (error) {
    console.error('Failed to get activity recommendations:', error);
    throw new Error('Failed to get activity recommendations');
  }
}

// Generate optimized itinerary based on preferences and constraints
async function generateOptimizedItinerary(userInfo, preferences = {}) {
  try {
    const data = await loadItineraryData();

    let candidateActivities = data.activities.filter(a =>
      a.metadata?.isApproved &&
      a.metadata?.isActive
    );

    // Apply filters
    if (preferences.categories && preferences.categories.length > 0) {
      candidateActivities = candidateActivities.filter(a => preferences.categories.includes(a.category));
    }

    if (preferences.location) {
      candidateActivities = candidateActivities.filter(a =>
        a.location.area.toLowerCase().includes(preferences.location.toLowerCase())
      );
    }

    if (preferences.priceRange) {
      const [min, max] = preferences.priceRange.split('-').map(Number);
      candidateActivities = candidateActivities.filter(a =>
        a.pricing.basePrice >= min &&
        a.pricing.basePrice <= max
      );
    }

    // Sort by rating and review count
    candidateActivities.sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating;
      return b.metadata?.reviewCount - a.metadata?.reviewCount;
    });

    // Select activities based on preferences
    const selectedActivities = candidateActivities.slice(0, preferences.activityCount || 3);

    if (selectedActivities.length === 0) {
      throw new Error('No activities found matching your preferences');
    }

    // Create optimized itinerary
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + (selectedActivities.length > 2 ? 3 : 2));

    const itineraryData = {
      title: preferences.title || 'Optimized Itinerary',
      description: preferences.description || 'Generated based on your preferences',
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      activities: selectedActivities.map(a => a.id),
      groupSize: preferences.groupSize || 1,
      budget: preferences.budget || null,
      specialRequests: preferences.specialRequests || ''
    };

    const result = await createItinerary(itineraryData, userInfo);

    return {
      success: true,
      itinerary: result.itinerary,
      message: 'Optimized itinerary generated successfully'
    };
  } catch (error) {
    console.error('Failed to generate optimized itinerary:', error);
    throw new Error(`Failed to generate optimized itinerary: ${error.message}`);
  }
}

// Initialize itinerary data with default values
async function initializeItineraryData() {
  try {
    const dataDir = path.join(__dirname, '../data');

    // Check and initialize itineraries.json if not exists
    try {
      await fs.access(path.join(dataDir, 'itineraries.json'));
    } catch {
      await fs.writeFile(path.join(dataDir, 'itineraries.json'), '[]');
    }
  } catch (error) {
    console.error('Failed to initialize itinerary data:', error);
    throw new Error('Failed to initialize itinerary data');
  }
}

// Save itinerary data to file
async function saveItineraryData(data) {
  try {
    const dataDir = path.join(__dirname, '../data');

    await fs.writeFile(
      path.join(dataDir, 'itineraries.json'),
      JSON.stringify(data.itineraries, null, 2)
    );
  } catch (error) {
    console.error('Failed to save itinerary data:', error);
    throw new Error('Failed to save itinerary data');
  }
}

// Add custom day to existing itinerary
async function addDayToItinerary(itineraryId, dayData, userId = null) {
  try {
    const data = await loadItineraryData();
    const itineraryIndex = data.itineraries.findIndex(i => i.id === itineraryId);

    if (itineraryIndex === -1) {
      throw new Error('Itinerary not found');
    }

    // If userId is provided, ensure the itinerary belongs to the user
    if (userId && data.itineraries[itineraryIndex].userId !== userId) {
      throw new Error('Access denied');
    }

    const itinerary = data.itineraries[itineraryIndex];

    // Add new day
    const newDayNumber = itinerary.days.length + 1;
    const newDay = {
      day: newDayNumber,
      date: addDays(itinerary.startDate, newDayNumber - 1).toISOString().split('T')[0],
      activities: dayData.activities || []
    };

    itinerary.days.push(newDay);
    itinerary.activities.push(...(dayData.activities || []).map(a => a.activityId).filter(Boolean));
    itinerary.totalDays = itinerary.days.length;
    itinerary.updatedAt = new Date().toISOString();

    await saveItineraryData(data);

    return {
      success: true,
      itinerary: itinerary,
      message: 'Day added to itinerary successfully'
    };
  } catch (error) {
    console.error('Failed to add day to itinerary:', error);
    throw new Error(`Failed to add day to itinerary: ${error.message}`);
  }
}

// Export all functions
module.exports = {
  loadItineraryData,
  createItinerary,
  buildDaySchedule,
  getUserItineraries,
  getItineraryById,
  updateItinerary,
  deleteItinerary,
  getActivityRecommendations,
  generateOptimizedItinerary,
  initializeItineraryData,
  saveItineraryData,
  addDayToItinerary
};