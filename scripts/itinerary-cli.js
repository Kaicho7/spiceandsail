#!/usr/bin/env node

const { getItineraryForIntent } = require('../src/lib/itinerary-smart');

async function main() {
  const args = process.argv.slice(2);
  const [intent, days, budget, profile] = args;

  try {
    const result = await getItineraryForIntent(
      intent || 'default',
      parseInt(days) || 7,
      parseInt(budget) || 300,
      profile || intent || 'default'
    );

    console.log('=== SMART ITINERARY RECOMMENDER ===');
    console.log(`Intent: ${result.intent}`);
    console.log(`Total Recommendations: ${result.metadata.totalItems}`);
    console.log(`Budget Range: $${result.summary.budgetRange.min}-$${result.summary.budgetRange.max}/day`);
    console.log(`Average Relevance Score: ${result.metadata.averageRelevanceScore.toFixed(1)}/100`);
    console.log('\n=== TOP RECOMMENDATIONS ===');
    result.data.suggestions.forEach((item, index) => {
      console.log(`${index + 1}. [${item.type.toUpperCase()}] ${item.name || item.title}
   Score: ${item.relevanceScore}/100
   ${item.description || item.description}
   Price: ${item.price || item.price_display || 'N/A'}
   Zone: ${item.zone || item.from || 'N/A'}
   `);
    });

    console.log('\n=== KEY HIGHLIGHTS ===');
    result.summary.keyHighlights.forEach((highlight, index) => {
      console.log(`${index + 1}. ${highlight}`);
    });

    console.log('\n=== AVAILABLE CATEGORIES ===');
    console.log(`Hotels: ${result.data.hotels.length}
Tours: ${result.data.tours.length}
Experiences: ${result.data.experiences.length}
Attractions: ${result.data.attractions.length}
Transfers: ${result.data.transfers.length}
`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };