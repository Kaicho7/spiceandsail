# Site audit report

Site: http://localhost:8080/  
Pages crawled: 49  
Images seen: 224  
Stamp: 2026-11-04 07:11

**0 ERROR findings, 137 WARN findings.** Exit code is 0 (passed).

## Summary by check

| Severity | Check | Count |
|---|---|---|
| WARN | CANONICAL_DIFFERS | 49 |
| WARN | DESC_LENGTH | 5 |
| WARN | IMG_BIG | 66 |
| WARN | IMG_REUSE | 11 |
| WARN | PAGE_HEAVY | 1 |
| WARN | TITLE_LENGTH | 5 |

## Details (first 10 of each check; everything is in site_audit_findings.csv)

### WARN CANONICAL_DIFFERS (49)

- `http://localhost:8080/` — canonical is https://spiceandsail.com/
- `http://localhost:8080/tours/` — canonical is https://spiceandsail.com/tours/
- `http://localhost:8080/experiences/` — canonical is https://spiceandsail.com/experiences/
- `http://localhost:8080/transfers/` — canonical is https://spiceandsail.com/transfers/
- `http://localhost:8080/packages/` — canonical is https://spiceandsail.com/packages/
- `http://localhost:8080/hotels/` — canonical is https://spiceandsail.com/hotels/
- `http://localhost:8080/attractions/` — canonical is https://spiceandsail.com/attractions/
- `http://localhost:8080/areas/` — canonical is https://spiceandsail.com/areas/
- `http://localhost:8080/travel-guide/` — canonical is https://spiceandsail.com/travel-guide/
- `http://localhost:8080/about/` — canonical is https://spiceandsail.com/about/
- … and 39 more

### WARN DESC_LENGTH (5)

- `http://localhost:8080/experiences/` — 206 chars
- `http://localhost:8080/transfers/` — 212 chars
- `http://localhost:8080/hotels/` — 200 chars
- `http://localhost:8080/transfers/airport-to-nungwi/` — 179 chars
- `http://localhost:8080/safaris/mikumi-day-trip/` — 186 chars

### WARN IMG_BIG (66)

- `http://localhost:8080/` — http://localhost:8080/images/stone-town-ornate-carved-door-arch.jpg is 405 KB
- `http://localhost:8080/` — http://localhost:8080/images/safari-vehicle-lion-afar.jpg is 705 KB
- `http://localhost:8080/tours/` — http://localhost:8080/images/people-swimming-turquoise-water-steps.jpg is 447 KB
- `http://localhost:8080/hotels/` — http://localhost:8080/images/hotels/bawe-tropical-island.jpg is 1108 KB
- `http://localhost:8080/hotels/` — http://localhost:8080/images/zanzibar-hotel-room-two-beds-red-blankets.jpg is 405 KB
- `http://localhost:8080/hotels/` — http://localhost:8080/images/hotels/gold-zanzibar-beach-house-spa.jpg is 559 KB
- `http://localhost:8080/hotels/` — http://localhost:8080/images/hotels/kasha-boutique-hotel.jpg is 605 KB
- `http://localhost:8080/hotels/` — http://localhost:8080/images/hotels/kilindi-zanzibar.jpg is 445 KB
- `http://localhost:8080/hotels/` — http://localhost:8080/images/zanzibar-restaurant-patio-with-palm-trees.jpg is 600 KB
- `http://localhost:8080/hotels/` — http://localhost:8080/images/hotels/lux-marijani-zanzibar.jpg is 728 KB
- … and 56 more

### WARN IMG_REUSE (11)

- `http://localhost:8080/` — http://localhost:8080/images/stone-town-ornate-carved-door-arch.jpg used 11 times across 8 page(s)
- `http://localhost:8080/` — http://localhost:8080/images/vegetable-stall-at-outdoor-market.jpg used 6 times across 6 page(s)
- `http://localhost:8080/` — http://localhost:8080/images/aerial-beach-dhow-people-turquoise-water.jpg used 7 times across 6 page(s)
- `http://localhost:8080/` — http://localhost:8080/images/dolphins-swimming-near-boat-tour.jpg used 11 times across 10 page(s)
- `http://localhost:8080/` — http://localhost:8080/images/zanzibar-rock-house-with-tourists.jpg used 8 times across 6 page(s)
- `http://localhost:8080/tours/` — http://localhost:8080/images/dhow-sail-nungwi-beach-zanzibar.jpg used 7 times across 7 page(s)
- `http://localhost:8080/tours/` — http://localhost:8080/images/people-swimming-turquoise-water-steps.jpg used 7 times across 6 page(s)
- `http://localhost:8080/tours/` — http://localhost:8080/images/elephant-savanna-landscape-tanzania.jpg used 6 times across 5 page(s)
- `http://localhost:8080/hotels/` — http://localhost:8080/images/hotel-roofs-sea-ships-zanzibar.jpg used 7 times across 1 page(s)
- `http://localhost:8080/hotels/` — http://localhost:8080/images/zanzibar-hotel-room-orange-bed.jpg used 6 times across 1 page(s)
- … and 1 more

### WARN PAGE_HEAVY (1)

- `http://localhost:8080/hotels/` — HTML is 878 KB

### WARN TITLE_LENGTH (5)

- `http://localhost:8080/experiences/` — 89 chars: Rare Zanzibar Experiences & Bucket-List Charters | Spice & Sail | Spice and Sail Zanzibar
- `http://localhost:8080/transfers/` — 78 chars: Zanzibar Airport Transfers | VIP Flat-Rate Concierge | Spice and Sail Zanzibar
- `http://localhost:8080/hotels/` — 97 chars: Where to Stay in Zanzibar — 205 Curated Hotels & Resorts | Spice & Sail | Spice and Sail Zanzibar
- `http://localhost:8080/transfers/airport-to-nungwi/` — 90 chars: Zanzibar Airport to Nungwi Transfer | $55 Private Minivan & Taxi | Spice and Sail Zanzibar
- `http://localhost:8080/safaris/mikumi-day-trip/` — 96 chars: Mikumi Day Safari from Zanzibar | Fly-In Wildlife Day Trip ($440–$650) | Spice and Sail Zanzibar

## Numbers the site claims (compare by eye)

- `http://localhost:8080/`: 16 tours
- `http://localhost:8080/`: 205 hotels
- `http://localhost:8080/`: 60 attractions
- `http://localhost:8080/`: 205 hand-picked hotels
- `http://localhost:8080/`: 16
Tours
- `http://localhost:8080/`: 205
Partner Properties
- `http://localhost:8080/`: 60
Attractions
- `http://localhost:8080/`: 36
Zones
- `http://localhost:8080/`: 14 Areas
- `http://localhost:8080/hotels/`: 205 properties
- `http://localhost:8080/areas/`: 50 hotels
- `http://localhost:8080/areas/`: 13 attractions
- `http://localhost:8080/areas/`: 26 hotels
- `http://localhost:8080/areas/`: 9 attractions
- `http://localhost:8080/areas/`: 6 hotels
- `http://localhost:8080/areas/`: 2 attractions
- `http://localhost:8080/areas/`: 21 hotels
- `http://localhost:8080/areas/`: 7 attractions
- `http://localhost:8080/areas/`: 20 hotels
- `http://localhost:8080/areas/`: 8 hotels
- `http://localhost:8080/areas/`: 1 attraction
- `http://localhost:8080/areas/`: 10 hotels
- `http://localhost:8080/areas/`: 7 hotels
- `http://localhost:8080/areas/`: 4 hotels
- `http://localhost:8080/areas/`: 4 attractions
- `http://localhost:8080/areas/`: 31 hotels
- `http://localhost:8080/areas/`: 2 hotels
- `http://localhost:8080/areas/`: 5 attractions
- `http://localhost:8080/areas/`: 197 partner hotels
- `http://localhost:8080/areas/`: 12 zones
- `http://localhost:8080/areas/`: 8 partner hotels
- `http://localhost:8080/areas/`: 2 zones
- `http://localhost:8080/areas/nungwi/`: 26
Partner Hotels
- `http://localhost:8080/areas/nungwi/`: 7
Attractions
- `http://localhost:8080/areas/kendwa/`: 6
Partner Hotels
- `http://localhost:8080/areas/kendwa/`: 2
Attractions
- `http://localhost:8080/areas/paje/`: 21
Partner Hotels
- `http://localhost:8080/areas/paje/`: 7
Attractions
- `http://localhost:8080/areas/jambiani/`: 19
Partner Hotels
- `http://localhost:8080/areas/jambiani/`: 5
Attractions
- `http://localhost:8080/areas/stone-town/`: 43
Partner Hotels
- `http://localhost:8080/areas/stone-town/`: 13
Attractions
- `http://localhost:8080/areas/kiwengwa/`: 8
Partner Hotels
- `http://localhost:8080/areas/kiwengwa/`: 1
Attractions
- `http://localhost:8080/areas/bwejuu/`: 8
Partner Hotels
- `http://localhost:8080/areas/bwejuu/`: 1
Attractions
- `http://localhost:8080/areas/kizimkazi/`: 7
Partner Hotels
- `http://localhost:8080/areas/kizimkazi/`: 1
Attractions
- `http://localhost:8080/areas/pongwe/`: 6
Partner Hotels
- `http://localhost:8080/areas/pongwe/`: 1
Attractions
- `http://localhost:8080/areas/michamvi/`: 10
Partner Hotels
- `http://localhost:8080/areas/michamvi/`: 1
Attractions
- `http://localhost:8080/areas/fumba/`: 4
Partner Hotels
- `http://localhost:8080/areas/fumba/`: 4
Attractions
- `http://localhost:8080/areas/matemwe/`: 30
Partner Hotels
- `http://localhost:8080/areas/matemwe/`: 2
Attractions
- `http://localhost:8080/areas/chake-chake/`: 2
Partner Hotels
- `http://localhost:8080/areas/chake-chake/`: 1
Attractions
- `http://localhost:8080/areas/wambaa-gulf/`: 6
Partner Hotels
- `http://localhost:8080/areas/wambaa-gulf/`: 5
Attractions

## Pages

| Status | Page | Title | Images |
|---|---|---|---|
| 200 | http://localhost:8080/ | Zanzibar Tours, Transfers & Packages | Spice and Sail Zanzib | 18 |
| 200 | http://localhost:8080/tours/ | Zanzibar Tours & Day Trips | Spice and Sail Zanzibar | 16 |
| 200 | http://localhost:8080/experiences/ | Rare Zanzibar Experiences & Bucket-List Charters | Spice & S | 12 |
| 200 | http://localhost:8080/transfers/ | Zanzibar Airport Transfers | VIP Flat-Rate Concierge | Spice | 3 |
| 200 | http://localhost:8080/packages/ | Zanzibar Multi-Day Packages | Spice and Sail Zanzibar | 6 |
| 200 | http://localhost:8080/hotels/ | Where to Stay in Zanzibar — 205 Curated Hotels & Resorts | S | 200 |
| 200 | http://localhost:8080/attractions/ | Zanzibar Attractions & Activities | Spice and Sail Zanzibar | 55 |
| 200 | http://localhost:8080/areas/ | Zanzibar Areas & Beaches Guide | Spice and Sail Zanzibar | 21 |
| 200 | http://localhost:8080/travel-guide/ | Ultimate Zanzibar Travel Guide | Spice and Sail Zanzibar | 0 |
| 200 | http://localhost:8080/about/ | About Us | Spice and Sail Zanzibar | 0 |
| 200 | http://localhost:8080/family-travel/ | Zanzibar Family Travel Guide | Spice and Sail Zanzibar | 0 |
| 200 | http://localhost:8080/honeymoon-packages/ | Zanzibar Honeymoon Packages | Spice and Sail Zanzibar | 0 |
| 200 | http://localhost:8080/self-drive/ | Zanzibar Self-Drive & 4x4 Hire | Spice and Sail Zanzibar | 0 |
| 200 | http://localhost:8080/spice-farm-cultural/ | Zanzibar Spice Farm Experience | Spice and Sail Zanzibar | 0 |
| 200 | http://localhost:8080/contact/ | Contact Us | Spice and Sail Zanzibar | 0 |
| 200 | http://localhost:8080/tours/stone-town-walking-tour/ | Stone Town Walking Tour | Spice and Sail Zanzibar | 1 |
| 200 | http://localhost:8080/tours/spice-farm/ | Spice Farm Tour | Spice and Sail Zanzibar | 1 |
| 200 | http://localhost:8080/tours/village-community-tour/ | Village & Community Tour | Spice and Sail Zanzibar | 1 |
| 200 | http://localhost:8080/tours/stone-town-spice-prison-combo/ | Stone Town, Spice Farm & Prison Island | Spice and Sail Zanz | 1 |
| 200 | http://localhost:8080/tours/safari-blue/ | Safari Blue Dhow Day | Spice and Sail Zanzibar | 1 |
| 200 | http://localhost:8080/tours/mnemba-snorkeling/ | Mnemba Atoll Snorkeling | Spice and Sail Zanzibar | 1 |
| 200 | http://localhost:8080/areas/nungwi/ | Nungwi | Spice and Sail Zanzibar | 9 |
| 200 | http://localhost:8080/areas/kendwa/ | Kendwa | Spice and Sail Zanzibar | 4 |
| 200 | http://localhost:8080/areas/paje/ | Paje | Spice and Sail Zanzibar | 8 |
| 200 | http://localhost:8080/areas/jambiani/ | Jambiani | Spice and Sail Zanzibar | 7 |
| 200 | http://localhost:8080/areas/stone-town/ | Stone Town | Spice and Sail Zanzibar | 18 |
| 200 | http://localhost:8080/areas/kiwengwa/ | Kiwengwa | Spice and Sail Zanzibar | 1 |
| 200 | http://localhost:8080/packages/zanzibar-essentials-3day/ | Zanzibar Essentials 3-Day Package | Spice and Sail Zanzibar | 0 |
| 200 | http://localhost:8080/safaris/ | Mainland Safaris from Zanzibar | Spice and Sail Zanzibar | 3 |
| 200 | http://localhost:8080/tours/prison-island-nakupenda/ | Prison Island & Nakupenda | Spice and Sail Zanzibar | 1 |
| 200 | http://localhost:8080/tours/jozani-forest/ | Jozani Forest & Red Colobus | Spice and Sail Zanzibar | 1 |
| 200 | http://localhost:8080/tours/sunset-dhow-cruise/ | Sunset Dhow Cruise | Spice and Sail Zanzibar | 1 |
| 200 | http://localhost:8080/transfers/airport-to-nungwi/ | Zanzibar Airport to Nungwi Transfer | $55 Private Minivan &  | 1 |
| 200 | http://localhost:8080/safaris/mikumi-day-trip/ | Mikumi Day Safari from Zanzibar | Fly-In Wildlife Day Trip ( | 5 |
| 200 | http://localhost:8080/tours/nakupenda-sandbank/ | Nakupenda Sandbank | Spice and Sail Zanzibar | 1 |
| 200 | http://localhost:8080/tours/chumbe-island/ | Chumbe Island Coral Park | Spice and Sail Zanzibar | 1 |
| 200 | http://localhost:8080/tours/kizimkazi-dolphin-tour/ | Kizimkazi Dolphin Tour | Spice and Sail Zanzibar | 1 |
| 200 | http://localhost:8080/tours/kuza-cave-seaweed/ | Kuza Cave & Seaweed Farm | Spice and Sail Zanzibar | 1 |
| 200 | http://localhost:8080/tours/mikumi-nyerere-day-safari/ | Mikumi or Nyerere Day Safari | Spice and Sail Zanzibar | 1 |
| 200 | http://localhost:8080/tours/serengeti-3day-flyin/ | Serengeti 3-Day Fly-In Safari | Spice and Sail Zanzibar | 1 |
| 200 | http://localhost:8080/tours/zanzibar-essentials-3day/ | Zanzibar Essentials 3-Day Pass | Spice and Sail Zanzibar | 1 |
| 200 | http://localhost:8080/areas/bwejuu/ | Bwejuu & Dongwe | Spice and Sail Zanzibar | 1 |
| 200 | http://localhost:8080/areas/kizimkazi/ | Kizimkazi & Dimbani | Spice and Sail Zanzibar | 1 |
| 200 | http://localhost:8080/areas/pongwe/ | Pongwe & Michamvi | Spice and Sail Zanzibar | 1 |
| 200 | http://localhost:8080/areas/michamvi/ | Michamvi & Pingwe | Spice and Sail Zanzibar | 1 |
| 200 | http://localhost:8080/areas/fumba/ | Fumba & Mbweni | Spice and Sail Zanzibar | 4 |
| 200 | http://localhost:8080/areas/matemwe/ | Matemwe & Kigomani | Spice and Sail Zanzibar | 2 |
| 200 | http://localhost:8080/areas/chake-chake/ | Chake Chake, Pemba | Spice and Sail Zanzibar | 1 |
| 200 | http://localhost:8080/areas/wambaa-gulf/ | Wambaa Gulf, Pemba | Spice and Sail Zanzibar | 5 |
