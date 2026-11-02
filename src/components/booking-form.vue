<template>
  <div class="booking-form-container">
    <div class="booking-header">
      <h1>Reserve Your Dream Travel</h1>
      <p>Complete the form below and our team will confirm your booking within 24 hours.</p>
    </div>

    <form @submit.prevent="submitBooking" class="booking-form">
      <div class="form-section">
        <h2>Travel Details</h2>
        <div class="form-grid">
          <div class="form-group">
            <label for="checkIn">Check-in Date</label>
            <input type="date" id="checkIn" v-model="form.checkIn" required :min="today" />
          </div>
          <div class="form-group">
            <label for="checkOut">Check-out Date</label>
            <input type="date" id="checkOut" v-model="form.checkOut" required :min="checkInDate" />
          </div>
          <div class="form-group">
            <label for="guests">Adults</label>
            <select id="guests" v-model="form.guests" required>
              <option v-for="n in 6" :key="n" :value="n">{{ n }}</option>
            </select>
          </div>
          <div class="form-group">
            <label for="children">Children</label>
            <select id="children" v-model="form.children">
              <option v-for="n in 5" :key="n" :value="n">{{ n }}</option>
            </select>
          </div>
        </div>
      </div>

      <div class="form-section">
        <h2>Booking Details</h2>
        <div class="booking-type-selector">
          <div
            v-for="type in bookingTypes"
            :key="type.id"
            class="booking-type-card"
            :class="{ active: form.type === type.id }"
            @click="form.type = type.id"
          >
            <div class="type-icon">{{ type.icon }}</div>
            <div class="type-name">{{ type.label }}</div>
          </div>
        </div>

        <div class="form-group" v-if="form.type !== 'package'">
          <label for="itemSelect">Select Option</label>
          <select id="itemSelect" v-model="form.itemId" required>
            <option v-for="item in filteredItems" :key="item.id" :value="item.id">
              {{ item.name }} — ${{ item.price }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label for="specialRequests">Special Requests</label>
          <textarea id="specialRequests" v-model="form.requests" rows="3"
            placeholder="Dietary needs, room preferences, airport transfers..."></textarea>
        </div>
      </div>

      <div class="form-section" v-if="selectedItem">
        <h2>Price Summary</h2>
        <div class="price-summary">
          <div class="price-row">
            <span>Base price</span>
            <span>${{ selectedItem.price }}</span>
          </div>
          <div class="price-row">
            <span>Tax (8%)</span>
            <span>${{ (selectedItem.price * 0.08).toFixed(2) }}</span>
          </div>
          <div class="price-row">
            <span>Service fee (5%)</span>
            <span>${{ (selectedItem.price * 0.05).toFixed(2) }}</span>
          </div>
          <div class="price-row total">
            <span>Total</span>
            <span>${{ (selectedItem.price * 1.13).toFixed(2) }}</span>
          </div>
        </div>
      </div>

      <div class="form-section">
        <h2>Contact Information</h2>
        <div class="form-grid">
          <div class="form-group">
            <label for="name">Full Name</label>
            <input type="text" id="name" v-model="form.name" required />
          </div>
          <div class="form-group">
            <label for="email">Email</label>
            <input type="email" id="email" v-model="form.email" required />
          </div>
          <div class="form-group">
            <label for="phone">Phone</label>
            <input type="tel" id="phone" v-model="form.phone" placeholder="+255..." required />
          </div>
        </div>
      </div>

      <button type="submit" class="submit-btn" :disabled="submitting">
        {{ submitting ? 'Submitting...' : 'Confirm Booking' }}
      </button>

      <div v-if="message" class="form-message" :class="messageType">
        {{ message }}
      </div>
    </form>
  </div>
</template>

<script>
export default {
  name: 'BookingForm',
  data() {
    return {
      today: new Date().toISOString().split('T')[0],
      form: {
        checkIn: '',
        checkOut: '',
        guests: 2,
        children: 0,
        type: 'hotel',
        itemId: '',
        requests: '',
        name: '',
        email: '',
        phone: ''
      },
      bookingTypes: [
        { id: 'hotel', label: 'Hotel', icon: '🏨' },
        { id: 'tour', label: 'Tour', icon: '🏖️' },
        { id: 'experience', label: 'Experience', icon: '🎯' },
        { id: 'transfer', label: 'Transfer', icon: '🚐' }
      ],
      items: {
        hotel: [
          { id: 'h1', name: 'Taj Cliff Resort & Spa', price: 220 },
          { id: 'h2', name: 'Zanzibar Serena Hotel', price: 180 },
          { id: 'h3', name: 'Park Hyatt Zanzibar', price: 450 },
          { id: 'h4', name: 'MnO Beach House', price: 350 }
        ],
        tour: [
          { id: 't1', name: 'Stone Town Walking Tour', price: 35 },
          { id: 't2', name: 'Prison Island Excursion', price: 65 },
          { id: 't3', name: 'Spice Farm Tour', price: 40 },
          { id: 't4', name: 'Safari Blue Day Trip', price: 95 }
        ],
        experience: [
          { id: 'e1', name: 'Sunset Dhow Cruise', price: 50 },
          { id: 'e2', name: 'Traditional Cooking Class', price: 60 },
          { id: 'e3', name: 'Diving Discovery', price: 120 }
        ],
        transfer: [
          { id: 'x1', name: 'Airport Transfer', price: 25 },
          { id: 'x2', name: 'Hotel Transfer', price: 30 },
          { id: 'x3', name: 'Full-Day Driver', price: 150 }
        ]
      }
    };
  },
  computed: {
    checkInDate() {
      return this.form.checkIn || this.today;
    },
    filteredItems() {
      return this.items[this.form.type] || [];
    },
    selectedItem() {
      return this.filteredItems.find(i => i.id === this.form.itemId);
    }
  },
  methods: {
    async submitBooking() {
      this.submitting = true;
      try {
        // In production, POST to /api/bookings
        const booking = {
          ...this.form,
          item: this.selectedItem
        };
        console.log('Booking submitted:', booking);
        this.message = 'Thank you! Your booking request has been received. Our team will contact you within 24 hours.';
        this.messageType = 'success';
        this.resetForm();
      } catch (e) {
        this.message = 'Sorry, something went wrong. Please try again.';
        this.messageType = 'error';
      } finally {
        this.submitting = false;
      }
    },
    resetForm() {
      this.form.checkIn = '';
      this.form.checkOut = '';
      this.form.itemId = '';
      this.form.requests = '';
      this.message = '';
    }
  }
};
</script>

<style scoped>
.booking-form-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem 1rem;
}
.booking-header {
  text-align: center;
  margin-bottom: 2rem;
}
.booking-header h1 {
  font-size: 2rem;
  color: #1a5f7a;
  margin-bottom: 0.5rem;
}
.booking-form {
  background: #fff;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
}
.form-section {
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid #eee;
}
.form-section:last-of-type {
  border-bottom: none;
}
.form-section h2 {
  font-size: 1.25rem;
  color: #333;
  margin-bottom: 1rem;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}
.form-group {
  margin-bottom: 1rem;
}
.form-group label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.4rem;
  color: #444;
  font-size: 0.95rem;
}
.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.7rem 0.9rem;
  border: 1px solid #ccc;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s;
}
.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #1a5f7a;
}
.booking-type-selector {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}
.booking-type-card {
  padding: 1rem;
  text-align: center;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}
.booking-type-card:hover {
  border-color: #1a5f7a;
}
.booking-type-card.active {
  border-color: #1a5f7a;
  background: #e8f4f8;
}
.type-icon {
  font-size: 1.6rem;
  margin-bottom: 0.3rem;
}
.type-name {
  font-size: 0.9rem;
  font-weight: 600;
}
.price-summary {
  background: #f7f9fb;
  padding: 1.25rem;
  border-radius: 8px;
}
.price-row {
  display: flex;
  justify-content: space-between;
  padding: 0.35rem 0;
  color: #555;
}
.price-row.total {
  border-top: 2px solid #1a5f7a;
  margin-top: 0.5rem;
  padding-top: 0.75rem;
  font-weight: 700;
  color: #1a5f7a;
  font-size: 1.1rem;
}
.submit-btn {
  width: 100%;
  padding: 1rem;
  background: #1a5f7a;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}
.submit-btn:hover {
  background: #12465c;
}
.submit-btn:disabled {
  background: #aaa;
  cursor: not-allowed;
}
.form-message {
  margin-top: 1rem;
  padding: 0.8rem;
  border-radius: 8px;
  text-align: center;
}
.form-message.success {
  background: #e8f5e9;
  color: #2e7d32;
}
.form-message.error {
  background: #fbe9e7;
  color: #c62828;
}
</style>
