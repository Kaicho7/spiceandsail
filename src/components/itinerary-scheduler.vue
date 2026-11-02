<template>
  <div class="itinerary-scheduler">
    <div class="scheduler-header">
      <h1>Custom Itinerary Builder</h1>
      <p>Drag and drop items to create your perfect Zanzibar itinerary</p>
    </div>

    <div class="scheduler-content">
      <div class="items-panel">
        <h2>Available Items</h2>
        <div class="search-filter">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search items..."
            @input="filterItems"
          />
          <select v-model="selectedCategory" @change="filterItems">
            <option value="all">All Categories</option>
            <option v-for="(label, type) in categoryMetadata" :key="type" :value="type">
              {{ label }}
            </option>
          </select>
        </div>

        <div class="items-grid">
          <div
            v-for="item in filteredItems"
            :key="item.id"
            class="item-card"
            draggable
            @dragstart="startDrag($event, item)"
            @dragend="endDrag($event, item)"
          >
            <div class="item-icon" :style="{ backgroundColor: getCategoryColor(item.type) }">
              {{ getCategoryIcon(item.type) }}
            </div>
            <div class="item-content">
              <h3>{{ item.name || item.title }}</h3>
              <p class="item-category">{{ getCategoryLabel(item.type) }}</p>
              <p class="item-description">{{ item.description ? item.description.substring(0, 80) + '...' : '' }}</p>
              <div class="item-price">{{ item.price_display || item.price || '$0' }}</div>
              <div class="item-zone" v-if="item.zone">📍 {{ item.zone }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="scheduler-panel">
        <h2>Your Itinerary</h2>
        <div class="itinerary-days">
          <div
            v-for="day in days"
            :key="day"
            class="itinerary-day"
            @dragover.prevent
            @drop="dropOnDay($event, day)"
          >
            <div class="day-header">
              <h3>Day {{ day }}</h3>
              <button class="add-item-btn" @click="showPicker(day)">+ Add item</button>
            </div>
            <div class="day-items">
              <div
                v-for="item in getItemsForDay(day)"
                :key="item.id"
                class="scheduled-item"
                @dragover.prevent
                @drop="reorderItem($event, item, day)"
              >
                <div class="scheduled-item-icon" :style="{ backgroundColor: getCategoryColor(item.type) }">
                  {{ getCategoryIcon(item.type) }}
                </div>
                <div class="scheduled-item-info">
                  <h4>{{ item.name || item.title }}</h4>
                  <div class="scheduled-item-meta">
                    <span>{{ getCategoryLabel(item.type) }}</span>
                    <span>{{ item.startTime }} - {{ item.endTime }}</span>
                    <span>{{ item.price_display || item.price }}</span>
                  </div>
                </div>
                <div class="scheduled-item-actions">
                  <button class="remove-btn" @click="removeItem(item)">✕</button>
                </div>
              </div>
              <div v-if="getItemsForDay(day).length === 0" class="empty-day">
                Drop items here
              </div>
            </div>
          </div>
        </div>

        <div class="itinerary-summary">
          <h3>Summary</h3>
          <p>Total Days: {{ days.length }}</p>
          <p>Total Items: {{ allItems.length }}</p>
          <p>Estimated Budget: ${{ totalCost }}</p>
          <button class="whatsapp-btn" @click="shareWhatsApp">Share via WhatsApp</button>
          <button class="save-btn" @click="saveItinerary">Save Itinerary</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { categoryMetadata, createItineraryItem } from '../lib/itinerary-builder';

export default {
  name: 'ItineraryScheduler',
  data() {
    return {
      categoryMetadata,
      items: [],
      days: [1, 2, 3, 4, 5],
      searchQuery: '',
      selectedCategory: 'all',
      filteredItems: [],
      itinerary: {
        items: [],
        totalDays: 5,
        totalCost: 0
      },
      draggingItem: null
    };
  },
  computed: {
    allItems() {
      return this.itinerary.items;
    },
    totalCost() {
      return this.itinerary.items.reduce((sum, item) => sum + (item.price || 0), 0);
    }
  },
  async mounted() {
    await this.fetchItems();
  },
  methods: {
    async fetchItems() {
      try {
        const [tours, attractions, hotels, transfers, experiences] = await Promise.all([
          fetch('/data/tours.json').then(r => r.json()),
          fetch('/data/attractions.json').then(r => r.json()),
          fetch('/data/hotels.json').then(r => r.json()),
          fetch('/data/transfers.json').then(r => r.json()),
          fetch('/data/experiences.json').then(r => r.json())
        ]);

        this.items = [
          ...tours.map(t => ({ ...t, type: 'tours' })),
          ...attractions.map(a => ({ ...a, type: 'attractions' })),
          ...hotels.slice(0, 20).map(h => ({ ...h, type: 'hotels' })),
          ...transfers.map(t => ({ ...t, type: 'transfers' })),
          ...experiences.map(e => ({ ...e, type: 'experiences' }))
        ];

        this.filterItems();
      } catch (error) {
        console.error('Failed to load itinerary items:', error);
      }
    },

    filterItems() {
      let filtered = this.items;

      if (this.selectedCategory !== 'all') {
        filtered = filtered.filter(item => item.type === this.selectedCategory);
      }

      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        filtered = filtered.filter(item => {
          const name = (item.name || item.title || '').toLowerCase();
          const description = (item.description || '').toLowerCase();
          return name.includes(q) || description.includes(q);
        });
      }

      this.filteredItems = filtered;
    },

    getCategoryLabel(type) {
      return this.categoryMetadata[type] ? this.categoryMetadata[type].label : type;
    },

    getCategoryIcon(type) {
      const icons = {
        hotels: '🏨',
        tours: '🚌',
        experiences: '📸',
        attractions: '📍',
        transfers: '🚗',
        packages: '🎁'
      };
      return icons[type] || '📍';
    },

    getCategoryColor(type) {
      return this.categoryMetadata[type] ? this.categoryMetadata[type].color : '#CBD5E1';
    },

    startDrag(event, item) {
      this.draggingItem = item;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', item.id || item.slug);
    },

    endDrag() {
      this.draggingItem = null;
    },

    dropOnDay(event, day) {
      event.preventDefault();
      if (this.draggingItem) {
        this.addItemToDay(this.draggingItem, day);
      }
    },

    addItemToDay(item, day) {
      const newItem = createItineraryItem(item.type, {
        ...item,
        day
      });
      this.itinerary.items.push(newItem);
      this.itinerary.totalDays = Math.max(this.itinerary.totalDays, day);
    },

    removeItem(item) {
      this.itinerary.items = this.itinerary.items.filter(i => i.id !== item.id);
    },

    reorderItem(event, item, day) {
      if (this.draggingItem && this.draggingItem.id !== item.id) {
        this.removeItem(this.draggingItem);
        this.addItemToDay(this.draggingItem, day);
      }
    },

    getItemsForDay(day) {
      return this.itinerary.items.filter(item => item.day === day);
    },

    showPicker(day) {
      // In a full implementation, this opens a modal picker
      alert(`Add items for Day ${day} from the left panel`);
    },

    shareWhatsApp() {
      const message = this.formatForWhatsApp();
      const encoded = encodeURIComponent(message);
      const phone = '+255672450934';
      window.open(`https://wa.me/${phone}?text=${encoded}`, '_blank');
    },

    formatForWhatsApp() {
      let message = 'Hello! Here\'s my Zanzibar Itinerary:\n\n';
      for (let day = 1; day <= this.itinerary.totalDays; day++) {
        const items = this.getItemsForDay(day);
        if (items.length) {
          message += `Day ${day}:\n`;
          items.forEach(item => {
            message += `• ${item.name || item.title} (${this.getCategoryLabel(item.type)})\n`;
            if (item.price_display) message += `  Price: ${item.price_display}\n`;
          });
          message += '\n';
        }
      }
      message += `Total Cost: $${this.totalCost}\n`;
      message += '\nPlease contact me to book! 📞 +255 672 450 934';
      return message;
    },

    saveItinerary() {
      const data = {
        items: this.itinerary.items,
        totalDays: this.itinerary.totalDays,
        totalCost: this.totalCost
      };
      localStorage.setItem('custom-itinerary', JSON.stringify(data));
      alert('Itinerary saved!');
    }
  }
};
</script>

<style scoped>
.itinerary-scheduler {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  font-family: -apple-system, system-ui, sans-serif;
}

.scheduler-header {
  text-align: center;
  padding: 2rem;
  background: linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%);
  color: white;
}

.scheduler-header h1 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.scheduler-content {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 1rem;
  padding: 1rem;
  flex: 1;
}

.items-panel,
.scheduler-panel {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.items-panel h2,
.scheduler-panel h2 {
  font-size: 1.25rem;
  margin-bottom: 1rem;
  color: #1F2937;
}

.search-filter {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.search-filter input,
.search-filter select {
  padding: 0.5rem;
  border: 1px solid #D1D5DB;
  border-radius: 4px;
  font-size: 0.9rem;
}

.search-filter input {
  flex: 1;
}

.items-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  max-height: 60vh;
  overflow-y: auto;
}

.item-card {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem;
  border: 1px solid #E5E7EB;
  border-radius: 6px;
  cursor: grab;
  transition: box-shadow 0.2s, border-color 0.2s;
}

.item-card:hover {
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  border-color: #3B82F6;
}

.item-card:active {
  cursor: grabbing;
}

.item-icon,
.scheduled-item-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.item-content h3 {
  font-size: 0.95rem;
  margin-bottom: 0.25rem;
  color: #111827;
}

.item-category {
  font-size: 0.8rem;
  color: #6B7280;
  margin-bottom: 0.25rem;
}

.item-description {
  font-size: 0.8rem;
  color: #6B7280;
  line-height: 1.3;
}

.item-price {
  font-weight: 600;
  color: #059669;
  margin-top: 0.25rem;
}

.item-zone {
  font-size: 0.8rem;
  color: #9CA3AF;
}

.itinerary-days {
  max-height: 55vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.itinerary-day {
  border: 2px dashed #E5E7EB;
  border-radius: 6px;
  padding: 0.75rem;
  min-height: 80px;
}

.day-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.day-header h3 {
  font-size: 0.95rem;
  color: #374151;
}

.add-item-btn {
  background: #3B82F6;
  color: white;
  border: none;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
}

.scheduled-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  background: #F9FAFB;
  border-radius: 6px;
  margin-bottom: 0.5rem;
  border: 1px solid #E5E7EB;
}

.scheduled-item-info {
  flex: 1;
}

.scheduled-item-info h4 {
  font-size: 0.9rem;
  color: #111827;
}

.scheduled-item-meta {
  display: flex;
  gap: 0.75rem;
  font-size: 0.8rem;
  color: #6B7280;
}

.remove-btn {
  background: #EF4444;
  color: white;
  border: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
}

.empty-day {
  color: #9CA3AF;
  text-align: center;
  padding: 1rem;
  font-size: 0.9rem;
}

.itinerary-summary {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #E5E7EB;
}

.itinerary-summary p {
  margin-bottom: 0.25rem;
  color: #374151;
}

.whatsapp-btn,
.save-btn {
  margin-top: 0.75rem;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  margin-right: 0.5rem;
}

.whatsapp-btn {
  background: #25D366;
  color: white;
}

.save-btn {
  background: #1F2937;
  color: white;
}

@media (max-width: 768px) {
  .scheduler-content {
    grid-template-columns: 1fr;
  }

  .items-grid {
    grid-template-columns: 1fr;
  }
}
</style>
