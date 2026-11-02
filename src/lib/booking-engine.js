// Enhanced Booking Integration Engine
// Manages real-time availability, bookings, payments, and confirmations

const fs = require('fs').promises;
const path = require('path');

// Load booking data and availability information
async function loadBookingData() {
  try {
    const dataDir = path.join(__dirname, '../data');
    const [hotels, tours, transfers, experiences] = await Promise.all([
      fs.readFile(path.join(dataDir, 'hotels.json'), 'utf8'),
      fs.readFile(path.join(dataDir, 'tours.json'), 'utf8'),
      fs.readFile(path.join(dataDir, 'transfers.json'), 'utf8'),
      fs.readFile(path.join(dataDir, 'experiences.json'), 'utf8')
    ]);

    return {
      hotels: JSON.parse(hotels),
      tours: JSON.parse(tours),
      transfers: JSON.parse(transfers),
      experiences: JSON.parse(experiences)
    };
  } catch (error) {
    console.error('Failed to load booking data:', error);
    throw new Error('Failed to load booking data');
  }
}

// Availability checker with real-time status
async function checkAvailability(checkIn, checkOut, partySize, type, preferences = {}) {
  try {
    const data = await loadBookingData();

    // Calculate nights
    const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));

    // Get available options based on type
    let options = [];
    switch (type) {
      case 'hotel':
        options = data.hotels.filter(hotel => !hotel.isBooked || hotel.bookingEnd < checkIn);
        break;
      case 'tour':
        options = data.tours.filter(tour => !tour.isBooked || tour.bookingEnd < checkIn);
        break;
      case 'transfer':
        options = data.transfers.filter(transfer => !transfer.isBooked || transfer.bookingEnd < checkIn);
        break;
      case 'experience':
        options = data.experiences.filter(experience => !experience.isBooked || experience.bookingEnd < checkIn);
        break;
      default:
        throw new Error('Invalid booking type');
    }

    // Apply preferences filtering
    if (preferences.minPrice) {
      options = options.filter(option => {
        const p = extractPrice(option);
        return p !== null && p >= preferences.minPrice;
      });
    }
    if (preferences.maxPrice) {
      options = options.filter(option => {
        const p = extractPrice(option);
        return p !== null && p <= preferences.maxPrice;
      });
    }
    if (preferences.location) {
      options = options.filter(option => option.location === preferences.location);
    }

    return {
      available: options,
      count: options.length,
      nights: nights
    };
  } catch (error) {
    console.error('Availability check failed:', error);
    throw new Error('Failed to check availability');
  }
}

// Create a new booking
async function createBooking(bookingData) {
  try {
    const data = await loadBookingData();
    const booking = {
      id: generateBookingId(),
      ...bookingData,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
      paymentStatus: 'pending'
    };

    // Update the booked item's status
    const item = getBookedItem(bookingData.type, bookingData.itemId, data);
    if (item) {
      item.isBooked = true;
      item.bookingId = booking.id;
      item.bookingStart = bookingData.checkIn;
      item.bookingEnd = bookingData.checkOut;
    }

    // Save updated data (in real implementation, would use database)
    await saveBookingData(data);

    return {
      success: true,
      bookingId: booking.id,
      confirmationNumber: generateConfirmationNumber(),
      estimatedTotal: calculateTotal(bookingData)
    };
  } catch (error) {
    console.error('Booking creation failed:', error);
    throw new Error('Failed to create booking');
  }
}

// Get booked item from data
function getBookedItem(type, itemId, dataRef) {
  const dataMap = {
    hotel: dataRef.hotels,
    tour: dataRef.tours,
    transfer: dataRef.transfers,
    experience: dataRef.experiences
  };
  const items = dataMap[type];
  return items ? items.find(item => item.id === itemId) : null;
}

// Extract numeric price from various price representations
function extractPrice(item) {
  const price = item.price !== undefined ? item.price : item.price_range;
  if (typeof price === 'number') return price;
  if (price && typeof price === 'object') {
    if (price.min !== undefined) return typeof price.min === 'number' ? price.min : parseInt(price.min);
    if (price.display) {
      const match = price.display.match(/\$(\d+)/);
      if (match) return parseInt(match[1]);
    }
  }
  if (typeof price === 'string') {
    const match = price.match(/\$(\d+)/);
    if (match) return parseInt(match[1]);
    return parseFloat(price.replace(/[^0-9.]/g, '')) || null;
  }
  return null;
}

// Calculate total cost including taxes and fees
function calculateTotal(bookingData) {
  const baseCost = bookingData.price || bookingData.basePrice || 0;
  const taxRate = 0.08; // 8% tax
  const feeRate = 0.05; // 5% booking fee

  const tax = baseCost * taxRate;
  const fee = baseCost * feeRate;
  const total = baseCost + tax + fee;

  return {
    subtotal: baseCost,
    tax: tax,
    fee: fee,
    total: total,
    currency: 'USD'
  };
}

// Generate unique booking ID
function generateBookingId() {
  return 'BK' + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase();
}

// Generate confirmation number
function generateConfirmationNumber() {
  return 'CONF' + Math.random().toString(36).substr(2, 8).toUpperCase();
}

// Save booking data (would use database in production)
async function saveBookingData(data) {
  const dataDir = path.join(__dirname, '../data');
  await Promise.all([
    fs.writeFile(path.join(dataDir, 'hotels.json'), JSON.stringify(data.hotels, null, 2)),
    fs.writeFile(path.join(dataDir, 'tours.json'), JSON.stringify(data.tours, null, 2)),
    fs.writeFile(path.join(dataDir, 'transfers.json'), JSON.stringify(data.transfers, null, 2)),
    fs.writeFile(path.join(dataDir, 'experiences.json'), JSON.stringify(data.experiences, null, 2))
  ]);
}

module.exports = {
  checkAvailability,
  createBooking,
  calculateTotal,
  loadBookingData,
  extractPrice,
  getBookedItem
};