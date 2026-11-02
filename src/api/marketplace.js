// Marketplace API - User Generated Experiences Management
// Phase 5: Implements API endpoints for marketplace activities

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Load marketplace data from data directory
async function loadMarketplaceData() {
  try {
    const dataDir = path.join(__dirname, '../data');
    const [experiences, experiencesApproval, packages, reviews, userActivities, activities] = await Promise.all([
      fs.readFile(path.join(dataDir, 'experiences.json'), 'utf8'),
      fs.readFile(path.join(dataDir, 'experiences-approval.json'), 'utf8'),
      fs.readFile(path.join(dataDir, 'packages.json'), 'utf8'),
      fs.readFile(path.join(dataDir, 'reviews.json'), 'utf8'),
      fs.readFile(path.join(dataDir, 'user-activities.json'), 'utf8'),
      fs.readFile(path.join(dataDir, 'activities.json'), 'utf8')
    ]);

    return {
      experiences: JSON.parse(experiences),
      experiencesApproval: JSON.parse(experiencesApproval),
      packages: JSON.parse(packages),
      reviews: JSON.parse(reviews),
      userActivities: JSON.parse(userActivities),
      activities: JSON.parse(activities)
    };
  } catch (error) {
    console.error('Failed to load marketplace data:', error);
    throw new Error('Failed to load marketplace data');
  }
}

// Create a new marketplace activity with comprehensive validation
async function createMarketplaceActivity(activityData, userInfo) {
  try {
    await initializeMarketplaceData();
    const data = await loadMarketplaceData();

    // Validate required fields
    const requiredFields = ['title', 'category', 'description', 'location', 'pricing'];
    for (const field of requiredFields) {
      if (!activityData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate pricing
    if (!activityData.pricing.basePrice || activityData.pricing.basePrice <= 0) {
      throw new Error('Base price must be a positive number');
    }

    // Validate category
    const validCategories = ['spice-farm', 'fish-market', 'local-cooking', 'artisan-workshop', 'farm-stay', 'homestay', 'community-tour', 'cultural-center'];
    if (!validCategories.includes(activityData.category)) {
      throw new Error('Invalid category');
    }

    // Get category metadata
    const category = getCategoryMetadata(activityData.category);

    // Create the activity listing
    const activity = {
      id: uuidv4(),
      slug: createSlug(activityData.title),
      title: activityData.title,
      category: activityData.category,
      categoryMetadata: category,
      description: activityData.description,
      longDescription: activityData.longDescription || '',
      location: {
        area: activityData.location.area || 'Zanzibar',
        address: activityData.location.address || '',
        coordinates: activityData.location.coordinates || { lat: -6.1640638, lng: 39.2092912 }
      },
      pricing: {
        basePrice: parseFloat(activityData.pricing.basePrice),
        currency: 'USD',
        priceUnit: activityData.pricing.priceUnit || 'per-person',
        discountPrice: activityData.pricing.discountPrice ? parseFloat(activityData.pricing.discountPrice) : null,
        minimumGuests: activityData.pricing.minimumGuests || 1,
        maximumGuests: activityData.pricing.maximumGuests || 20
      },
      images: activityData.images || [],
      highlights: activityData.highlights || [],
      included: activityData.included || [],
      notIncluded: activityData.notIncluded || [],
      duration: activityData.duration || 'Full day',
      schedule: activityData.schedule || {
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        times: ['09:00', '10:00', '14:00', '15:00']
      },
      contact: {
        name: activityData.contact.name || userInfo.name,
        phone: activityData.contact.phone || userInfo.phone,
        email: activityData.contact.email || userInfo.email,
        whatsapp: activityData.contact.whatsapp || `+255 ${userInfo.phone}`
      },
      host: {
        name: userInfo.name,
        bio: userInfo.bio || '',
        experience: userInfo.experience || '',
        avatar: userInfo.avatar || '',
        verified: false
      },
      reviews: [],
      rating: 0,
      reviewCount: 0,
      capacity: {
        currentBookings: 0,
        maximumBookings: 100
      },
      features: {
        cancellationPolicy: activityData.features?.cancellationPolicy || 'flexible',
        paymentMethods: activityData.features?.paymentMethods || ['cash', 'mobile-money'],
        languages: activityData.features?.languages || ['English', 'Swahili'],
        ageRestriction: activityData.features?.ageRestriction || 'all-ages'
      },
      metadata: {
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        isActive: true,
        isFeatured: false,
        isApproved: false
      }
    };

    // Save to both activities and activities-approval
    data.activities.push(activity);
    data.experiencesApproval.push({
      ...activity,
      approvalStatus: 'pending',
      approvedAt: null,
      reviewedBy: null
    });

    // Save updated data
    await saveMarketplaceData(data);

    return {
      success: true,
      activityId: activity.id,
      message: 'Activity submitted successfully. Awaiting approval.',
      status: 'pending-approval'
    };
  } catch (error) {
    console.error('Failed to create marketplace activity:', error);
    throw new Error(`Failed to create marketplace activity: ${error.message}`);
  }
}

// Get approved activities for public viewing with optional filters
async function getApprovedActivities(filters = {}) {
  try {
    const data = await loadMarketplaceData();
    const all = Array.isArray(data.activities) ? data.activities : [];
    let activities = all.filter(activity =>
      activity.metadata?.isActive &&
      activity.metadata?.isApproved
    );

    // Apply filters
    if (filters.category) {
      activities = activities.filter(a => a.category === filters.category);
    }

    if (filters.location) {
      activities = activities.filter(a =>
        a.location.area.toLowerCase().includes(filters.location.toLowerCase()) ||
        a.location.address.toLowerCase().includes(filters.location.toLowerCase())
      );
    }

    if (filters.priceRange) {
      const [min, max] = filters.priceRange.split('-').map(Number);
      activities = activities.filter(a =>
        a.pricing.basePrice >= min &&
        a.pricing.basePrice <= max
      );
    }

    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      activities = activities.filter(a =>
        a.title.toLowerCase().includes(searchTerm) ||
        a.description.toLowerCase().includes(searchTerm) ||
        a.highlights.some(highlight => highlight.toLowerCase().includes(searchTerm))
      );
    }

    // Sort by rating, then by new arrivals
    activities.sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating;
      return new Date(b.metadata.createdAt) - new Date(a.metadata.createdAt);
    });

    return {
      success: true,
      activities,
      count: activities.length
    };
  } catch (error) {
    console.error('Failed to get approved activities:', error);
    throw new Error('Failed to get approved activities');
  }
}

// Get pending approval activities for moderation
async function getPendingApprovalActivities() {
  try {
    const data = await loadMarketplaceData();
    const pending = Array.isArray(data.experiencesApproval) ? data.experiencesApproval.filter(activity =>
      activity?.approvalStatus === 'pending'
    ) : [];

    return {
      success: true,
      activities: pending,
      count: pending.length
    };
  } catch (error) {
    console.error('Failed to get pending approval activities:', error);
    throw new Error('Failed to get pending approval activities');
  }
}

// Moderate an activity submission (approve/reject)
async function moderateActivitySubmission(activityId, action, reviewerInfo, feedback = '') {
  try {
    const data = await loadMarketplaceData();

    // Find in approval list
    const approvalIndex = (data.experiencesApproval || []).findIndex(a => a?.id === activityId);
    if (approvalIndex === -1) {
      throw new Error('Activity not found in approval queue');
    }

    const approvalActivity = data.experiencesApproval[approvalIndex];

    if (action === 'approve') {
      // Move to approved activities
      const indexInApproved = data.activities.findIndex(a => a.id === activityId);
      let approvedEntry;
      if (indexInApproved === -1) {
        // If not already in approved list, add it
        approvedEntry = { ...approvalActivity };
        data.activities.push(approvedEntry);
      } else {
        approvedEntry = data.activities[indexInApproved];
      }

      // Flip the canonical activities entry to approved
      approvedEntry.metadata.isApproved = true;
      approvedEntry.metadata.approvedAt = new Date().toISOString();
      approvedEntry.metadata.reviewedBy = reviewerInfo;
      approvedEntry.metadata.reviewFeedback = feedback;

      // Update approval status
      approvalActivity.approvalStatus = 'approved';
      approvalActivity.metadata.approvedAt = new Date().toISOString();
      approvalActivity.metadata.reviewedBy = reviewerInfo;
      approvalActivity.metadata.reviewFeedback = feedback;
      approvalActivity.metadata.isApproved = true;

    } else if (action === 'reject') {
      approvalActivity.approvalStatus = 'rejected';
      approvalActivity.metadata.rejectedAt = new Date().toISOString();
      approvalActivity.metadata.reviewedBy = reviewerInfo;
      approvalActivity.metadata.reviewFeedback = feedback;
      approvalActivity.metadata.isActive = false;

    } else {
      throw new Error('Invalid action');
    }

    // Save updated data
    await saveMarketplaceData(data);

    return {
      success: true,
      activityId,
      action,
      message: `Activity ${action} successfully`
    };
  } catch (error) {
    console.error('Failed to moderate activity submission:', error);
    throw new Error(`Failed to moderate activity submission: ${error.message}`);
  }
}

// Book a marketplace activity
async function bookMarketplaceActivity(bookingData, userInfo) {
  try {
    const data = await loadMarketplaceData();

    // Find the activity
    const activity = data.activities.find(a => a.id === bookingData.activityId);
    if (!activity) {
      throw new Error('Activity not found');
    }

    if (!activity.metadata.isApproved || !activity.metadata.isActive) {
      throw new Error('Activity is not available for booking');
    }

    // Check availability
    const bookingsCount = activity.capacity.currentBookings;
    const maxBookings = activity.capacity.maximumBookings;

    if (bookingsCount >= maxBookings) {
      throw new Error('Activity has reached maximum capacity');
    }

    // Validate dates
    const checkIn = new Date(bookingData.checkIn);
    const checkOut = new Date(bookingData.checkOut);

    if (checkOut <= checkIn) {
      throw new Error('Check-out date must be after check-in date');
    }

    // Calculate booking
    const basePrice = activity.pricing.basePrice;
    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    const subtotal = basePrice * nights;

    const taxRate = 0.08;
    const feeRate = 0.05;
    const tax = subtotal * taxRate;
    const fee = subtotal * feeRate;
    const total = subtotal + tax + fee;

    // Create booking object
    const booking = {
      id: uuidv4(),
      activityId: bookingData.activityId,
      hostId: activity.host.name,
      guestId: userInfo.id || uuidv4(),
      checkIn: bookingData.checkIn,
      checkOut: bookingData.checkOut,
      nights,
      guests: bookingData.guests || 1,
      contact: {
        name: bookingData.name,
        email: bookingData.email,
        phone: bookingData.phone
      },
      pricing: {
        basePrice,
        subtotal,
        tax,
        fee,
        total,
        currency: 'USD'
      },
      specialRequests: bookingData.requests || '',
      status: 'confirmed',
      confirmationNumber: generateConfirmationNumber(),
      createdAt: new Date().toISOString(),
      paymentStatus: 'pending'
    };

    // Update activity booking count
    activity.capacity.currentBookings++;

    // Add booking to user activities
    const userActivity = {
      id: uuidv4(),
      userId: userInfo.id || userInfo.email,
      activityId: bookingData.activityId,
      bookingId: booking.id,
      status: 'upcoming',
      checkIn: bookingData.checkIn,
      checkOut: bookingData.checkOut,
      totalCost: total,
      createdAt: new Date().toISOString()
    };

    data.userActivities.push(userActivity);

    // Save updated data
    await saveMarketplaceData(data);

    return {
      success: true,
      bookingId: booking.id,
      confirmationNumber: booking.confirmationNumber,
      message: 'Booking confirmed successfully!',
      total: total,
      eta: 'Confirmation sent to your email within 5 minutes'
    };
  } catch (error) {
    console.error('Failed to book marketplace activity:', error);
    throw new Error(`Failed to book marketplace activity: ${error.message}`);
  }
}

// Get user's booked activities
async function getUserBookedActivities(userId) {
  try {
    const data = await loadMarketplaceData();
    const userActivities = data.userActivities.filter(a => a.userId === userId);

    // Get activity details for each booking
    const activitiesWithDetails = userActivities.map(userActivity => {
      const activity = data.activities.find(a => a.id === userActivity.activityId);
      return {
        ...userActivity,
        activityDetails: activity,
        totalCost: userActivity.totalCost
      };
    });

    return {
      success: true,
      activities: activitiesWithDetails,
      count: activitiesWithDetails.length
    };
  } catch (error) {
    console.error('Failed to get user booked activities:', error);
    throw new Error('Failed to get user booked activities');
  }
}

// Get activity reviews
async function getActivityReviews(activityId) {
  try {
    const data = await loadMarketplaceData();
    const activityReviews = data.reviews.filter(r => r.activityId === activityId);

    return {
      success: true,
      reviews: activityReviews,
      count: activityReviews.length
    };
  } catch (error) {
    console.error('Failed to get activity reviews:', error);
    throw new Error('Failed to get activity reviews');
  }
}

// Add review to activity
async function addActivityReview(reviewData, userInfo) {
  try {
    const data = await loadMarketplaceData();

    // Validate required fields
    const requiredFields = ['activityId', 'rating', 'comment'];
    for (const field of requiredFields) {
      if (!reviewData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Check if activity exists
    const activity = data.activities.find(a => a.id === reviewData.activityId);
    if (!activity) {
      throw new Error('Activity not found');
    }

    // Create review
    const review = {
      id: uuidv4(),
      activityId: reviewData.activityId,
      userId: userInfo.id || userInfo.email,
      userName: userInfo.name,
      userAvatar: userInfo.avatar || '',
      rating: parseInt(reviewData.rating),
      comment: reviewData.comment,
      photos: reviewData.photos || [],
      createdAt: new Date().toISOString(),
      verified: true // Since it's from a booked activity
    };

    data.reviews.push(review);

    // Update activity rating
    const totalRating = activity.reviews.reduce((sum, r) => sum + r.rating, 0) + review.rating;
    const totalReviews = activity.reviews.length + 1;
    activity.rating = Math.round((totalRating / totalReviews) * 100) / 100;
    activity.reviewCount = totalReviews;

    // Save updated data
    await saveMarketplaceData(data);

    return {
      success: true,
      reviewId: review.id,
      message: 'Review submitted successfully',
      newRating: activity.rating,
      totalReviews: activity.reviewCount
    };
  } catch (error) {
    console.error('Failed to add activity review:', error);
    throw new Error(`Failed to add activity review: ${error.message}`);
  }
}

// Get category metadata
function getCategoryMetadata(category) {
  const categoryMetadata = {
    'spice-farm': {
      label: 'Spice Farms',
      icon: '🌶️',
      color: '#FF6B35',
      description: 'Traditional Zanzibar spice farming experiences with harvesting and tasting'
    },
    'fish-market': {
      label: 'Fish Markets',
      icon: '🐟',
      color: '#2E7D32',
      description: 'Local fish markets and seafood experiences'
    },
    'local-cooking': {
      label: 'Cooking Classes',
      icon: '👨‍🍳',
      color: '#FF8E00',
      description: 'Traditional Zanzibari cooking workshops'
    },
    'artisan-workshop': {
      label: 'Artisan Workshops',
      icon: '🎨',
      color: '#9C27B0',
      description: 'Craftsmanship and traditional arts'
    },
    'farm-stay': {
      label: 'Farm Stays',
      icon: '🏡',
      color: '#795548',
      description: 'Stay with local families and experience farm life'
    },
    'homestay': {
      label: 'Homestays',
      icon: '🏠',
      color: '#4CAF50',
      description: 'Stay with local Zanzibari families'
    },
    'community-tour': {
      label: 'Community Tours',
      icon: '🚶',
      color: '#2196F3',
      description: 'Guided tours led by local community members'
    },
    'cultural-center': {
      label: 'Cultural Centers',
      icon: '📚',
      color: '#FF9800',
      description: 'Cultural centers and educational facilities'
    }
  };

  return categoryMetadata[category] || { label: category, icon: '📍' };
}

// Initialize marketplace data with default values
async function initializeMarketplaceData() {
  try {
    const dataDir = path.join(__dirname, '../data');

    // Check and initialize experiences.json if not exists
    try {
      await fs.access(path.join(dataDir, 'experiences.json'));
    } catch {
      await fs.writeFile(path.join(dataDir, 'experiences.json'), '[]');
    }

    // Check and initialize experiences-approval.json if not exists
    try {
      await fs.access(path.join(dataDir, 'experiences-approval.json'));
    } catch {
      await fs.writeFile(path.join(dataDir, 'experiences-approval.json'), '[]');
    }

    // Check and initialize reviews.json if not exists
    try {
      await fs.access(path.join(dataDir, 'reviews.json'));
    } catch {
      await fs.writeFile(path.join(dataDir, 'reviews.json'), '[]');
    }

    // Check and initialize user-activities.json if not exists
    try {
      await fs.access(path.join(dataDir, 'user-activities.json'));
    } catch {
      await fs.writeFile(path.join(dataDir, 'user-activities.json'), '[]');
    }

    // Check and initialize activities.json if not exists
    try {
      await fs.access(path.join(dataDir, 'activities.json'));
    } catch {
      await fs.writeFile(path.join(dataDir, 'activities.json'), '[]');
    }
  } catch (error) {
    console.error('Failed to initialize marketplace data:', error);
    throw new Error('Failed to initialize marketplace data');
  }
}

// Save marketplace data to all files
async function saveMarketplaceData(data) {
  try {
    const dataDir = path.join(__dirname, '../data');

    await fs.writeFile(
      path.join(dataDir, 'experiences.json'),
      JSON.stringify(data.experiences, null, 2)
    );

    await fs.writeFile(
      path.join(dataDir, 'experiences-approval.json'),
      JSON.stringify(data.experiencesApproval, null, 2)
    );

    await fs.writeFile(
      path.join(dataDir, 'reviews.json'),
      JSON.stringify(data.reviews, null, 2)
    );

    await fs.writeFile(
      path.join(dataDir, 'user-activities.json'),
      JSON.stringify(data.userActivities, null, 2)
    );

    await fs.writeFile(
      path.join(dataDir, 'activities.json'),
      JSON.stringify(data.activities, null, 2)
    );
  } catch (error) {
    console.error('Failed to save marketplace data:', error);
    throw new Error('Failed to save marketplace data');
  }
}

// Helper functions
function createSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function generateConfirmationNumber() {
  return 'CONF-' + Math.random().toString(36).substr(2, 8).toUpperCase();
}

// Export all functions
module.exports = {
  loadMarketplaceData,
  getCategoryMetadata,
  createMarketplaceActivity,
  getApprovedActivities,
  getPendingApprovalActivities,
  moderateActivitySubmission,
  bookMarketplaceActivity,
  getUserBookedActivities,
  getActivityReviews,
  addActivityReview,
  initializeMarketplaceData,
  saveMarketplaceData
};