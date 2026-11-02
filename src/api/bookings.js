// Bookings API - Tour and Experience Management
// Phase 5: Implements comprehensive booking system for marketplace activities

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Load booking data from data directory
async function loadBookingData() {
  try {
    const dataDir = path.join(__dirname, '../data');
    const [experiences, experiencesApproval, reviews, userActivities, activities, bookings] = await Promise.all([
      fs.readFile(path.join(dataDir, 'experiences.json'), 'utf8'),
      fs.readFile(path.join(dataDir, 'experiences-approval.json'), 'utf8'),
      fs.readFile(path.join(dataDir, 'reviews.json'), 'utf8'),
      fs.readFile(path.join(dataDir, 'user-activities.json'), 'utf8'),
      fs.readFile(path.join(dataDir, 'activities.json'), 'utf8'),
      fs.readFile(path.join(dataDir, 'bookings.json'), 'utf8')
    ]);

    return {
      experiences: JSON.parse(experiences),
      experiencesApproval: JSON.parse(experiencesApproval),
      reviews: JSON.parse(reviews),
      userActivities: JSON.parse(userActivities),
      activities: JSON.parse(activities),
      bookings: JSON.parse(bookings)
    };
  } catch (error) {
    console.error('Failed to load booking data:', error);
    throw new Error('Failed to load booking data');
  }
}

// Create new booking with validation and package handling
async function createBooking(bookingData, userInfo) {
  try {
    await initializeBookingData();
    const data = await loadBookingData();

    // Validate required fields
    const requiredFields = ['activityId', 'date', 'guests', 'packageType'];
    for (const field of requiredFields) {
      if (!bookingData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Find the activity
    const activity = data.activities.find(a => a.id === bookingData.activityId);
    if (!activity) {
      throw new Error('Activity not found');
    }

    // Validate activity availability
    if (!activity.metadata?.isApproved || !activity.metadata?.isActive) {
      throw new Error('Activity is not available for booking');
    }

    // Validate guests count
    if (bookingData.guests < activity.pricing?.minimumGuests || bookingData.guests > activity.pricing?.maximumGuests) {
      throw new Error(`Guest count must be between ${activity.pricing.minimumGuests} and ${activity.pricing.maximumGuests}`);
    }

    // Generate booking ID and confirmation number
    const bookingId = uuidv4();
    const confirmationNumber = generateConfirmationNumber();

    // Calculate pricing based on package type and guests
    let basePrice = activity.pricing?.basePrice || 0;
    let totalPrice = basePrice * bookingData.guests;
    let packageDiscount = 0;

    switch (bookingData.packageType) {
      case 'single':
        packageDiscount = 0;
        break;
      case 'couple':
        packageDiscount = basePrice * 0.1; // 10% discount
        break;
      case 'family':
        packageDiscount = basePrice * 0.2; // 20% discount
        break;
      default:
        packageDiscount = 0;
    }

    totalPrice = totalPrice - packageDiscount;

    // Prepare booking object
    const booking = {
      id: bookingId,
      activityId: bookingData.activityId,
      userId: userInfo.id,
      confirmationNumber: confirmationNumber,
      packageType: bookingData.packageType,
      guests: bookingData.guests,
      date: bookingData.date,
      status: 'confirmed',
      totalPrice: parseFloat(totalPrice.toFixed(2)),
      discount: parseFloat(packageDiscount.toFixed(2)),
      currency: 'USD',
      specialRequests: bookingData.specialRequests || '',
      contactInfo: {
        name: userInfo.name,
        email: userInfo.email,
        phone: userInfo.phone
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      paymentStatus: 'pending',
      paymentMethod: null,
      paymentDetails: {}
    };

    // Add booking to bookings array
    data.bookings.push(booking);

    // Update user activity record
    const userActivityIndex = data.userActivities.findIndex(ua =>
      ua.userId === userInfo.id &&
      ua.activityId === bookingData.activityId &&
      ua.status === 'created'
    );

    if (userActivityIndex !== -1) {
      data.userActivities[userActivityIndex].status = 'booked';
      data.userActivities[userActivityIndex].bookingId = bookingId;
    }

    // Save all data
    await saveBookingData(data);

    return {
      success: true,
      booking: booking,
      message: 'Booking created successfully'
    };

  } catch (error) {
    console.error('Failed to create booking:', error);
    throw new Error(`Failed to create booking: ${error.message}`);
  }
}

// Get user bookings
async function getUserBookings(userId) {
  try {
    const data = await loadBookingData();
    const userBookings = data.bookings.filter(b => b.userId === userId);

    // Include activity details with each booking
    const bookingsWithActivity = userBookings.map(booking => {
      const activity = data.activities.find(a => a.id === booking.activityId);
      return {
        ...booking,
        activity: activity
      };
    });

    return {
      success: true,
      bookings: bookingsWithActivity
    };
  } catch (error) {
    console.error('Failed to get user bookings:', error);
    throw new Error('Failed to get user bookings');
  }
}

// Get booking by ID
async function getBookingById(bookingId, userId = null) {
  try {
    const data = await loadBookingData();
    let booking = data.bookings.find(b => b.id === bookingId);

    // If userId is provided, ensure the booking belongs to the user
    if (userId && booking && booking.userId !== userId) {
      throw new Error('Access denied');
    }

    if (!booking) {
      throw new Error('Booking not found');
    }

    // Include activity details
    const activity = data.activities.find(a => a.id === booking.activityId);
    booking.activity = activity;

    return {
      success: true,
      booking: booking
    };
  } catch (error) {
    console.error('Failed to get booking by ID:', error);
    throw new Error(`Failed to get booking by ID: ${error.message}`);
  }
}

// Update booking status
async function updateBookingStatus(bookingId, statusData, userId = null) {
  try {
    const data = await loadBookingData();
    const bookingIndex = data.bookings.findIndex(b => b.id === bookingId);

    if (bookingIndex === -1) {
      throw new Error('Booking not found');
    }

    // If userId is provided, ensure the booking belongs to the user
    if (userId && data.bookings[bookingIndex].userId !== userId) {
      throw new Error('Access denied');
    }

    // Update allowed status transitions
    const allowedStatuses = ['pending', 'confirmed', 'cancelled', 'completed', 'refunded', 'no-show'];
    if (!allowedStatuses.includes(statusData.status)) {
      throw new Error(`Invalid booking status: ${statusData.status}`);
    }

    data.bookings[bookingIndex].status = statusData.status;
    data.bookings[bookingIndex].updatedAt = new Date().toISOString();

    if (statusData.paymentStatus) {
      data.bookings[bookingIndex].paymentStatus = statusData.paymentStatus;
    }

    if (statusData.notes) {
      data.bookings[bookingIndex].notes = statusData.notes;
    }

    await saveBookingData(data);

    return {
      success: true,
      booking: data.bookings[bookingIndex],
      message: 'Booking updated successfully'
    };
  } catch (error) {
    console.error('Failed to update booking status:', error);
    throw new Error(`Failed to update booking status: ${error.message}`);
  }
}

// Cancel booking
async function cancelBooking(bookingId, userId = null, reason = '') {
  try {
    const data = await loadBookingData();
    const bookingIndex = data.bookings.findIndex(b => b.id === bookingId);

    if (bookingIndex === -1) {
      throw new Error('Booking not found');
    }

    // If userId is provided, ensure the booking belongs to the user
    if (userId && data.bookings[bookingIndex].userId !== userId) {
      throw new Error('Access denied');
    }

    // Update booking status
    data.bookings[bookingIndex].status = 'cancelled';
    data.bookings[bookingIndex].updatedAt = new Date().toISOString();
    data.bookings[bookingIndex].cancellationReason = reason;
    data.bookings[bookingIndex].refundAmount = data.bookings[bookingIndex].totalPrice; // Full refund for now

    // Update user activity
    const userActivityIndex = data.userActivities.findIndex(ua => ua.bookingId === bookingId);
    if (userActivityIndex !== -1) {
      data.userActivities[userActivityIndex].status = 'cancelled';
    }

    await saveBookingData(data);

    return {
      success: true,
      booking: data.bookings[bookingIndex],
      message: 'Booking cancelled successfully'
    };
  } catch (error) {
    console.error('Failed to cancel booking:', error);
    throw new Error(`Failed to cancel booking: ${error.message}`);
  }
}

// Get booking history for an activity
async function getActivityBookingHistory(activityId) {
  try {
    const data = await loadBookingData();
    const activityBookings = data.bookings.filter(b => b.activityId === activityId);

    // Group by user
    const userBookingsMap = {};
    activityBookings.forEach(booking => {
      if (!userBookingsMap[booking.userId]) {
        userBookingsMap[booking.userId] = {
          userId: booking.userId,
          bookings: [],
          totalGuests: 0,
          totalRevenue: 0
        };
      }

      userBookingsMap[booking.userId].bookings.push(booking);
      userBookingsMap[booking.userId].totalGuests += booking.guests;
      userBookingsMap[booking.userId].totalRevenue += booking.totalPrice;
    });

    return {
      success: true,
      bookings: activityBookings,
      userStats: Object.values(userBookingsMap)
    };
  } catch (error) {
    console.error('Failed to get activity booking history:', error);
    throw new Error('Failed to get activity booking history');
  }
}

// Process payment for booking
async function processPayment(bookingId, paymentData) {
  try {
    const data = await loadBookingData();
    const bookingIndex = data.bookings.findIndex(b => b.id === bookingId);

    if (bookingIndex === -1) {
      throw new Error('Booking not found');
    }

    const booking = data.bookings[bookingIndex];

    // Validate payment data
    if (!paymentData.method) {
      throw new Error('Payment method is required');
    }

    // Process payment (simplified - just update status for now)
    booking.paymentStatus = 'completed';
    booking.paymentMethod = paymentData.method;
    booking.paymentDetails = paymentData;
    booking.paidAt = new Date().toISOString();
    booking.updatedAt = new Date().toISOString();

    await saveBookingData(data);

    return {
      success: true,
      booking: booking,
      message: 'Payment processed successfully'
    };
  } catch (error) {
    console.error('Failed to process payment:', error);
    throw new Error(`Failed to process payment: ${error.message}`);
  }
}

// Get booking analytics
async function getBookingAnalytics() {
  try {
    const data = await loadBookingData();

    // Calculate analytics
    const totalBookings = data.bookings.length;
    const confirmedBookings = data.bookings.filter(b => b.status === 'confirmed').length;
    const cancelledBookings = data.bookings.filter(b => b.status === 'cancelled').length;
    const completedBookings = data.bookings.filter(b => b.status === 'completed').length;

    const totalRevenue = data.bookings.reduce((sum, b) => sum + b.totalPrice, 0);
    const cancelledRevenue = data.bookings
      .filter(b => b.status === 'cancelled')
      .reduce((sum, b) => sum + b.totalPrice, 0);

    const averageBookingValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;

    // Booking status distribution
    const statusDistribution = {
      pending: data.bookings.filter(b => b.status === 'pending').length,
      confirmed: confirmedBookings,
      cancelled: cancelledBookings,
      completed: completedBookings,
      refunded: data.bookings.filter(b => b.status === 'refunded').length,
      'no-show': data.bookings.filter(b => b.status === 'no-show').length
    };

    // Recent bookings (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentBookings = data.bookings.filter(b =>
      new Date(b.createdAt) >= thirtyDaysAgo
    );

    // Most booked activities
    const activityBookingsCount = {};
    data.bookings.forEach(booking => {
      if (!activityBookingsCount[booking.activityId]) {
        activityBookingsCount[booking.activityId] = 0;
      }
      activityBookingsCount[booking.activityId]++;
    });

    const mostBookedActivities = Object.entries(activityBookingsCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([activityId, count]) => {
        const activity = data.activities.find(a => a.id === activityId);
        return {
          activityId,
          activityName: activity?.title || 'Unknown',
          bookings: count
        };
      });

    return {
      success: true,
      analytics: {
        totalBookings,
        confirmedBookings,
        cancelledBookings,
        completedBookings,
        totalRevenue,
        cancelledRevenue,
        averageBookingValue,
        statusDistribution,
        recentBookings: recentBookings.length,
        mostBookedActivities
      }
    };
  } catch (error) {
    console.error('Failed to get booking analytics:', error);
    throw new Error('Failed to get booking analytics');
  }
}

// Initialize booking data with default values
async function initializeBookingData() {
  try {
    const dataDir = path.join(__dirname, '../data');

    // Check and initialize bookings.json if not exists
    try {
      await fs.access(path.join(dataDir, 'bookings.json'));
    } catch {
      await fs.writeFile(path.join(dataDir, 'bookings.json'), '[]');
    }
  } catch (error) {
    console.error('Failed to initialize booking data:', error);
    throw new Error('Failed to initialize booking data');
  }
}

// Save booking data to file
async function saveBookingData(data) {
  try {
    const dataDir = path.join(__dirname, '../data');

    await fs.writeFile(
      path.join(dataDir, 'bookings.json'),
      JSON.stringify(data.bookings, null, 2)
    );
  } catch (error) {
    console.error('Failed to save booking data:', error);
    throw new Error('Failed to save booking data');
  }
}

// Generate confirmation number
function generateConfirmationNumber() {
  return 'BK-' + Date.now().toString().slice(-8) + Math.random().toString(36).substr(2, 4).toUpperCase();
}

// Generate unique ID
function generateId() {
  return uuidv4();
}

// Export all functions
module.exports = {
  loadBookingData,
  createBooking,
  getUserBookings,
  getBookingById,
  updateBookingStatus,
  cancelBooking,
  getActivityBookingHistory,
  processPayment,
  getBookingAnalytics,
  initializeBookingData,
  saveBookingData,
  generateConfirmationNumber,
  generateId
};