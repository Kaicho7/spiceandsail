// Computed stats — always in sync with actual data files
module.exports = () => {
  const hotels = require("./hotels.json");
  const attractions = require("./attractions.json");
  const tours = require("./tours.json");

  const hotelList = Array.isArray(hotels) ? hotels : (hotels.hotels || []);
  const attractionList = Array.isArray(attractions) ? attractions : (attractions.attractions || []);
  const tourList = Array.isArray(tours) ? tours : (tours.tours || []);

  return {
    total_hotels: hotelList.length,
    total_attractions: attractionList.length,
    total_tours: tourList.length,
  };
};
