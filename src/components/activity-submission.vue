<template>
  <div class="activity-submission-container">
    <div class="submission-header">
      <h1>Share Your Local Experience</h1>
      <p>Help others discover Zanzibar's hidden gems by sharing your unique activities</p>
    </div>

    <div class="submission-progress">
      <div class="progress-step" :class="{ active: currentStep >= 1, completed: currentStep > 1 }">
        <div class="step-number">1</div>
        <div class="step-label">Activity Details</div>
      </div>
      <div class="progress-connector"></div>
      <div class="progress-step" :class="{ active: currentStep >= 2, completed: currentStep > 2 }">
        <div class="step-number">2</div>
        <div class="step-label">Location & Pricing</div>
      </div>
      <div class="progress-connector"></div>
      <div class="progress-step" :class="{ active: currentStep >= 3, completed: currentStep > 3 }">
        <div class="step-number">3</div>
        <div class="step-label">Details & Contact</div>
      </div>
      <div class="progress-connector"></div>
      <div class="progress-step" :class="{ active: currentStep >= 4, completed: currentStep > 4 }">
        <div class="step-number">4</div>
        <div class="step-label">Review & Submit</div>
      </div>
    </div>

    <form @submit.prevent="submitActivity" class="activity-form">
      <!-- Step 1: Basic Activity Details -->
      <div class="form-step" v-show="currentStep === 1">
        <h2>Step 1: Basic Activity Details</h2>

        <div class="form-group">
          <label for="title">Activity Title *</label>
          <input type="text" id="title" v-model="activityData.title" placeholder="e.g., Beachside Cooking Class" required />
          <span class="error-message" v-if="errors.title">{{ errors.title }}</span>
        </div>

        <div class="form-group">
          <label for="category">Activity Category *</label>
          <select id="category" v-model="activityData.category" required>
            <option value="">Select a category</option>
            <option v-for="(label, key) in categoryMetadata" :key="key" :value="key">
              {{ label }} {{ categoryMetadata[key].icon }}
            </option>
          </select>
          <span class="error-message" v-if="errors.category">{{ errors.category }}</span>
        </div>

        <div class="form-group">
          <label for="description">Short Description *</label>
          <textarea id="description" v-model="activityData.description" placeholder="Describe your activity in a few words" rows="3" required></textarea>
          <span class="error-message" v-if="errors.description">{{ errors.description }}</span>
        </div>

        <div class="form-group">
          <label for="longDescription">Detailed Description</label>
          <textarea id="longDescription" v-model="activityData.longDescription" placeholder="Provide more details about your activity" rows="6"></textarea>
        </div>

        <div class="form-group">
          <label>Activity Highlights</label>
          <div class="tag-input">
            <input type="text" v-model="tagInput" placeholder="Add a highlight" @keyup.enter.prevent="addTag" />
            <button type="button" @click="addTag">Add</button>
          </div>
          <div class="tags-list">
            <span v-for="(tag, index) in activityData.highlights" :key="index" class="tag">
              {{ tag }}
              <button type="button" @click="removeTag(index)">×</button>
            </span>
          </div>
        </div>

        <div class="form-navigation">
          <button type="button" @click="nextStep" class="next-btn">Next Step →</button>
        </div>
      </div>

      <!-- Step 2: Location & Pricing -->
      <div class="form-step" v-show="currentStep === 2">
        <h2>Step 2: Location & Pricing</h2>

        <div class="form-group">
          <label for="area">Area/Region *</label>
          <select id="area" v-model="activityData.location.area" required>
            <option value="">Select area</option>
            <option>Stone Town</option>
            <option>Mnemba Island</option>
            <option>Deep Sea</option>
            <option>Mafia Island</option>
            <option>Earthquake Island</option>
            <option>Other</option>
          </select>
        </div>

        <div class="form-group">
          <label for="address">Specific Address *</label>
          <input type="text" id="address" v-model="activityData.location.address" placeholder="e.g., 123 Zanzibar Beach Road" required />
        </div>

        <div class="form-group">
          <label for="price">Base Price (USD) *</label>
          <div class="price-input">
            <span class="currency-symbol">$</span>
            <input type="number" id="price" v-model="activityData.pricing.basePrice" placeholder="25" min="0" step="1" required />
          </div>
        </div>

        <div class="form-group">
          <label for="priceUnit">Price Per *</label>
          <select id="priceUnit" v-model="activityData.pricing.priceUnit">
            <option value="per-person">Per Person</option>
            <option value="per-group">Per Group</option>
            <option value="per-day">Per Day</option>
            <option value="per-night">Per Night</option>
          </select>
        </div>

        <div class="form-group">
          <label for="discountPrice">Discount Price (Optional)</label>
          <div class="price-input">
            <span class="currency-symbol">$</span>
            <input type="number" id="discountPrice" v-model="activityData.pricing.discountPrice" placeholder="20" min="0" step="1" />
          </div>
        </div>

        <div class="form-group">
          <label for="duration">Duration</label>
          <select id="duration" v-model="activityData.duration">
            <option>30 minutes</option>
            <option>1 hour</option>
            <option>2 hours</option>
            <option>Half day</option>
            <option>Full day</option>
            <option>Custom</option>
          </select>
        </div>

        <div class="form-group">
          <label for="minimumGuests">Minimum Guests</label>
          <input type="number" id="minimumGuests" v-model="activityData.pricing.minimumGuests" min="1" max="20" />
        </div>

        <div class="form-group">
          <label for="maximumGuests">Maximum Guests</label>
          <input type="number" id="maximumGuests" v-model="activityData.pricing.maximumGuests" min="1" max="100" />
        </div>

        <div class="form-navigation">
          <button type="button" @click="previousStep" class="prev-btn">← Previous</button>
          <button type="button" @click="nextStep" class="next-btn">Next Step →</button>
        </div>
      </div>

      <!-- Step 3: Details & Contact -->
      <div class="form-step" v-show="currentStep === 3">
        <h2>Step 3: Details & Contact</h2>

        <div class="form-group">
          <label for="included">What's Included</label>
          <div class="checkbox-group">
            <label class="checkbox-label">
              <input type="checkbox" v-model="activityData.included" value="Transportation" /> Transportation
            </label>
            <label class="checkbox-label">
              <input type="checkbox" v-model="activityData.included" value="Guide" /> Guide
            </label>
            <label class="checkbox-label">
              <input type="checkbox" v-model="activityData.included" value="Equipment" /> Equipment
            </label>
            <label class="checkbox-label">
              <input type="checkbox" v-model="activityData.included" value="Meals" /> Meals
            </label>
            <label class="checkbox-label">
              <input type="checkbox" v-model="activityData.included" value="Drinks" /> Drinks
            </label>
          </div>
        </div>

        <div class="form-group">
          <label for="notIncluded">What's NOT Included</label>
          <div class="checkbox-group">
            <label class="checkbox-label">
              <input type="checkbox" v-model="activityData.notIncluded" value="Accommodation" /> Accommodation
            </label>
            <label class="checkbox-label">
              <input type="checkbox" v-model="activityData.notIncluded" value="Tips" /> Tips
            </label>
            <label class="checkbox-label">
              <input type="checkbox" v-model="activityData.notIncluded" value="Personal Expenses" /> Personal Expenses
            </label>
          </div>
        </div>

        <div class="form-group">
          <label for="languages">Languages Spoken</label>
          <div class="checkbox-group">
            <label class="checkbox-label">
              <input type="checkbox" v-model="activityData.features.languages" value="English" /> English
            </label>
            <label class="checkbox-label">
              <input type="checkbox" v-model="activityData.features.languages" value="Swahili" /> Swahili
            </label>
            <label class="checkbox-label">
              <input type="checkbox" v-model="activityData.features.languages" value="Arabic" /> Arabic
            </label>
            <label class="checkbox-label">
              <input type="checkbox" v-model="activityData.features.languages" value="French" /> French
            </label>
          </div>
        </div>

        <div class="form-group">
          <label for="hostName">Your Name *</label>
          <input type="text" id="hostName" v-model="activityData.contact.name" placeholder="Your full name" required />
        </div>

        <div class="form-group">
          <label for="hostBio">Your Experience/Bio</label>
          <textarea id="hostBio" v-model="activityData.host.bio" placeholder="Tell us about yourself and your experience" rows="3"></textarea>
        </div>

        <div class="form-group">
          <label for="contactPhone">Phone Number *</label>
          <input type="tel" id="contactPhone" v-model="activityData.contact.phone" placeholder="+255 XXX XXXX" required />
        </div>

        <div class="form-group">
          <label for="contactEmail">Email Address *</label>
          <input type="email" id="contactEmail" v-model="activityData.contact.email" placeholder="your.email@example.com" required />
        </div>

        <div class="form-navigation">
          <button type="button" @click="previousStep" class="prev-btn">← Previous</button>
          <button type="button" @click="nextStep" class="next-btn">Next Step →</button>
        </div>
      </div>

      <!-- Step 4: Review & Submit -->
      <div class="form-step" v-show="currentStep === 4">
        <h2>Step 4: Review & Submit</h2>

        <div class="review-section">
          <h3>Activity Summary</h3>

          <div class="review-item">
            <div class="review-label">Title:</div>
            <div class="review-value">{{ activityData.title }}</div>
          </div>

          <div class="review-item">
            <div class="review-label">Category:</div>
            <div class="review-value">{{ categoryMetadata[activityData.category]?.label }}</div>
          </div>

          <div class="review-item">
            <div class="review-label">Location:</div>
            <div class="review-value">{{ activityData.location.area }}, {{ activityData.location.address }}</div>
          </div>

          <div class="review-item">
            <div class="review-label">Price:</div>
            <div class="review-value">${{ activityData.pricing.basePrice }} {{ activityData.pricing.priceUnit }}</div>
          </div>

          <div class="review-item">
            <div class="review-label">Host:</div>
            <div class="review-value">{{ activityData.contact.name }}</div>
          </div>

          <div class="review-item">
            <div class="review-label">Contact:</div>
            <div class="review-value">{{ activityData.contact.email }} / {{ activityData.contact.phone }}</div>
          </div>
        </div>

        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="termsAccepted" required />
            <span>I agree to the platform's terms and conditions, including content guidelines and pricing policies</span>
          </label>
        </div>

        <div class="form-navigation">
          <button type="button" @click="previousStep" class="prev-btn">← Previous</button>
          <button type="submit" class="submit-btn" :disabled="!termsAccepted || isSubmitting">
            {{ isSubmitting ? 'Submitting...' : 'Submit Activity' }}
          </button>
        </div>
      </div>

      <div v-if="submitSuccess" class="success-message">
        <div class="success-icon">✅</div>
        <h3>Activity Submitted Successfully!</h3>
        <p>Your activity has been submitted and is pending approval. You'll be notified when it goes live.</p>
        <button type="button" @click="resetForm" class="new-activity-btn">Submit Another Activity</button>
      </div>

      <div v-if="submitError" class="error-message-box">
        <div class="error-icon">❌</div>
        <h3>Submission Failed</h3>
        <p>{{ submitError }}</p>
        <button type="button" @click="resetForm" class="retry-btn">Try Again</button>
      </div>
    </form>
  </div>
</template>

<script>
import { ref, reactive, computed } from 'vue';

export default {
  name: 'ActivitySubmission',
  setup() {
    const currentStep = ref(1);
    const isSubmitting = ref(false);
    const submitSuccess = ref(false);
    const submitError = ref('');
    const termsAccepted = ref(false);

    const categoryMetadata = {
      'spice-farm': { label: 'Spice Farms', icon: '🌶️' },
      'fish-market': { label: 'Fish Markets', icon: '🐟' },
      'local-cooking': { label: 'Cooking Classes', icon: '👨‍🍳' },
      'artisan-workshop': { label: 'Artisan Workshops', icon: '🎨' },
      'farm-stay': { label: 'Farm Stays', icon: '🏡' },
      'homestay': { label: 'Homestays', icon: '🏠' },
      'community-tour': { label: 'Community Tours', icon: '🚶' },
      'cultural-center': { label: 'Cultural Centers', icon: '📚' }
    };

    const activityData = reactive({
      title: '',
      category: '',
      description: '',
      longDescription: '',
      highlights: [],
      location: {
        area: '',
        address: ''
      },
      pricing: {
        basePrice: 0,
        discountPrice: null,
        priceUnit: 'per-person',
        minimumGuests: 1,
        maximumGuests: 20
      },
      included: [],
      notIncluded: [],
      duration: 'Full day',
      schedule: {
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        times: ['09:00', '10:00', '14:00', '15:00']
      },
      contact: {
        name: '',
        phone: '',
        email: ''
      },
      host: {
        bio: '',
        experience: ''
      },
      features: {
        languages: ['English', 'Swahili'],
        ageRestriction: 'all-ages'
      }
    });

    const tagInput = ref('');

    const errors = reactive({
      title: '',
      category: '',
      description: ''
    });

    const validateStep = (step) => {
      let isValid = true;

      if (step === 1) {
        if (!activityData.title.trim()) {
          errors.title = 'Title is required';
          isValid = false;
        } else {
          errors.title = '';
        }

        if (!activityData.category) {
          errors.category = 'Category is required';
          isValid = false;
        } else {
          errors.category = '';
        }

        if (!activityData.description.trim()) {
          errors.description = 'Description is required';
          isValid = false;
        } else {
          errors.description = '';
        }
      }

      if (step === 2) {
        if (!activityData.location.area) {
          isValid = false;
        }
        if (!activityData.location.address.trim()) {
          isValid = false;
        }
        if (!activityData.pricing.basePrice || activityData.pricing.basePrice <= 0) {
          isValid = false;
        }
      }

      if (step === 3) {
        if (!activityData.contact.name.trim()) {
          isValid = false;
        }
        if (!activityData.contact.email.trim() || !isValidEmail(activityData.contact.email)) {
          isValid = false;
        }
        if (!activityData.contact.phone.trim()) {
          isValid = false;
        }
      }

      return isValid;
    };

    const isValidEmail = (email) => {
      return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
    };

    const nextStep = () => {
      if (validateStep(currentStep.value)) {
        if (currentStep.value < 4) {
          currentStep.value++;
        }
      }
    };

    const previousStep = () => {
      if (currentStep.value > 1) {
        currentStep.value--;
      }
    };

    const addTag = () => {
      if (tagInput.value.trim()) {
        activityData.highlights.push(tagInput.value.trim());
        tagInput.value = '';
      }
    };

    const removeTag = (index) => {
      activityData.highlights.splice(index, 1);
    };

    const submitActivity = async () => {
      if (!termsAccepted.value) {
        submitError.value = 'You must accept the terms and conditions';
        return;
      }

      if (!validateStep(4)) {
        submitError.value = 'Please complete all required fields';
        return;
      }

      isSubmitting.value = true;
      submitError.value = '';

      try {
        // Get user info from localStorage (or auth system)
        const userInfo = JSON.parse(localStorage.getItem('user')) || {
          id: 'guest-' + Date.now(),
          name: activityData.contact.name,
          email: activityData.contact.email,
          phone: activityData.contact.phone
        };

        // Note: Marketplace API submission now uses Netlify function
        // The Vue component has been simplified for static site compatibility

        if (result.success) {
          submitSuccess.value = true;
          // Save activity to local storage for later steps
          localStorage.setItem('lastSubmittedActivity', JSON.stringify({
            ...result,
            activityData: {
              ...activityData,
              id: result.activityId
            }
          }));
        } else {
          submitError.value = result.message || 'Failed to submit activity';
        }
      } catch (error) {
        console.error('Failed to submit activity:', error);
        submitError.value = error.message || 'Failed to submit activity. Please try again.';
      } finally {
        isSubmitting.value = false;
      }
    };

    const resetForm = () => {
      currentStep.value = 1;
      submitSuccess.value = false;
      submitError.value = '';
      termsAccepted.value = false;

      // Reset form data
      Object.assign(activityData, {
        title: '',
        category: '',
        description: '',
        longDescription: '',
        highlights: [],
        location: { area: '', address: '' },
        pricing: {
          basePrice: 0,
          discountPrice: null,
          priceUnit: 'per-person',
          minimumGuests: 1,
          maximumGuests: 20
        },
        included: [],
        notIncluded: [],
        duration: 'Full day',
        schedule: {
          days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
          times: ['09:00', '10:00', '14:00', '15:00']
        },
        contact: { name: '', phone: '', email: '' },
        host: { bio: '', experience: '' },
        features: { languages: ['English', 'Swahili'], ageRestriction: 'all-ages' }
      });
    };

    return {
      currentStep,
      isSubmitting,
      submitSuccess,
      submitError,
      termsAccepted,
      activityData,
      categoryMetadata,
      tagInput,
      errors,
      nextStep,
      previousStep,
      addTag,
      removeTag,
      submitActivity,
      resetForm
    };
  }
};
</script>

<style scoped>
.activity-submission-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.submission-header {
  text-align: center;
  margin-bottom: 2rem;
}

.submission-header h1 {
  color: #2c3e50;
  margin-bottom: 0.5rem;
}

.submission-header p {
  color: #7f8c8d;
}

.submission-progress {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 3rem;
}

.progress-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 1;
}

.progress-step.active .step-number {
  background: #4a90e2;
  color: white;
}

.progress-step.completed .step-number {
  background: #27ae60;
  color: white;
}

.step-number {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  margin-bottom: 0.5rem;
}

.step-label {
  font-size: 0.875rem;
  color: #7f8c8d;
  text-align: center;
}

.progress-connector {
  flex: 1;
  height: 2px;
  background: #e0e0e0;
  margin: 0 -1rem;
}

.activity-form {
  margin-top: 2rem;
}

.form-step {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 0; transform: translateY(0); }
}

.form-step h2 {
  color: #2c3e50;
  margin-bottom: 2rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #f0f0f0;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #2c3e50;
}

.form-group label.required::after {
  content: ' *';
  color: #e74c3c;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
  transition: border-color 0.3s;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #4a90e2;
}

.form-group .error-message {
  color: #e74c3c;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.price-input {
  position: relative;
}

.currency-symbol {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #7f8c8d;
}

.price-input input {
  padding-left: 2rem;
}

.tag-input {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.tag-input input {
  flex: 1;
}

.tag-input button {
  padding: 0.5rem 1rem;
  background: #4a90e2;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.3s;
}

.tag-input button:hover {
  background: #357abd;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.tag {
  background: #e3f2fd;
  color: #1976d2;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.tag button {
  background: none;
  border: none;
  color: #1976d2;
  cursor: pointer;
  font-size: 1.2rem;
  line-height: 1;
}

.checkbox-group {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.checkbox-label input[type='checkbox'] {
  width: 1.2rem;
  height: 1.2rem;
  cursor: pointer;
}

.form-navigation {
  display: flex;
  justify-content: space-between;
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid #f0f0f0;
}

.prev-btn, .next-btn, .submit-btn {
  padding: 0.75rem 2rem;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s;
}

.prev-btn {
  background: #ecf0f1;
  color: #2c3e50;
}

.prev-btn:hover {
  background: #d5d8dc;
}

.next-btn, .submit-btn {
  background: #4a90e2;
  color: white;
}

.next-btn:hover, .submit-btn:hover {
  background: #357abd;
}

.next-btn:disabled, .submit-btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

.submit-btn {
  font-weight: bold;
}

.review-section {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 2rem;
}

.review-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #e9ecef;
}

.review-label {
  font-weight: 500;
  color: #495057;
}

.review-value {
  color: #6c757d;
}

.success-message, .error-message-box {
  text-align: center;
  padding: 3rem;
  border-radius: 8px;
  margin-top: 2rem;
}

.success-message {
  background: #d4edda;
  color: #155724;
}

.error-message-box {
  background: #f8d7da;
  color: #721c24;
}

.success-icon, .error-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.new-activity-btn, .retry-btn {
  padding: 0.75rem 2rem;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  margin-top: 1rem;
  transition: background 0.3s;
}

.retry-btn {
  background: #dc3545;
}

.new-activity-btn:hover {
  background: #218838;
}

.retry-btn:hover {
  background: #c82333;
}

@media (max-width: 768px) {
  .activity-submission-container {
    padding: 1rem;
  }

  .submission-progress {
    flex-direction: column;
    gap: 1rem;
  }

  .progress-connector {
    display: none;
  }

  .checkbox-group {
    grid-template-columns: 1fr;
  }

  .form-navigation {
    flex-direction: column;
    gap: 1rem;
  }

  .prev-btn, .next-btn, .submit-btn {
    width: 100%;
  }
}
</style>
</script>
<style>
  @media (max-width: 768px) {
    .activity-submission-container {
      margin: 1rem;
      padding: 1rem;
    }
  }
</style>