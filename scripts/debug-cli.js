#!/usr/bin/env node

const { getItineraryForIntent } = require('../src/lib/itinerary-smart');

async function debug() {
  try {
    console.log("Loading itinerary for family-travel...")
    const result = await getItineraryForIntent('family-travel', 7, 500, 'family-travel');

    console.log("Result keys:", Object.keys(result));
    console.log("Result:", JSON.stringify(result, null, 2));

    if (result.success) {
      console.log("Data keys:", Object.keys(result.data));
      console.log("Metadata:", result.metadata);
    }
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

debug();