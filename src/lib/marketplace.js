// Marketplace Logic - User Generated Experiences Management
// Phase 5: Community marketplace for locally-submitted activities.
//
// This module delegates to the canonical implementation in src/api/marketplace.js
// so that lib and API stay in lockstep (one source of truth, one schema).
// It re-exports every function plus a `categoryMetadata` object and a
// `createUserActivitySubmission` alias for backward compatibility.

const api = require('../api/marketplace.js');

// Category metadata (mirrors api.getCategoryMetadata, exposed as a lookup map
// so Nunjucks templates can iterate `{% for category, metadata in categoryMetadata %}`).
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

// Alias for the community submission flow (maps to the API submission).
async function createUserActivitySubmission(activityData, userInfo) {
  return api.createMarketplaceActivity(activityData, userInfo);
}

module.exports = {
  ...api,
  categoryMetadata,
  createUserActivitySubmission
};
