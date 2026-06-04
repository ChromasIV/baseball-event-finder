// Constants
const EARTH_RADIUS_MILES = 3958.8;
const INITIAL_BATCH_SIZE = 30;

// Application State
let games = [];
let filteredGames = [];
let userLocation = { lat: 40.7128, lon: -74.0060 }; // Default to New York City
let activeLeagues = new Set([1, 11, 12, 13, 14]); // All leagues active by default
let currentSort = 'date'; // 'date' or 'distance'
let renderedCount = 0;

// Preset City Mapping
const CITY_PRESETS = {
  "40.7128,-74.0060": { name: "New York, NY", lat: 40.7128, lon: -74.0060 },
  "34.0522,-118.2437": { name: "Los Angeles, CA", lat: 34.0522, lon: -118.2437 },
  "41.8781,-87.6298": { name: "Chicago, IL", lat: 41.8781, lon: -87.6298 },
  "39.9526,-75.1652": { name: "Philadelphia, PA", lat: 39.9526, lon: -75.1652 },
  "42.3601,-71.0589": { name: "Boston, MA", lat: 42.3601, lon: -71.0589 },
  "33.7490,-84.3880": { name: "Atlanta, GA", lat: 33.7490, lon: -84.3880 },
  "37.7749,-122.4194": { name: "San Francisco, CA", lat: 37.7749, lon: -122.4194 },
  "47.6062,-122.3321": { name: "Seattle, WA", lat: 47.6062, lon: -122.3321 },
  "38.6270,-90.1994": { name: "St. Louis, MO", lat: 38.6270, lon: -90.1994 },
  "29.7604,-95.3698": { name: "Houston, TX", lat: 29.7604, lon: -95.3698 }
};

// UI Elements
const elements = {
  presetCity: document.getElementById('preset-city'),
  btnGeolocation: document.getElementById('btn-geolocation'),
  latInput: document.getElementById('lat-input'),
  lonInput: document.getElementById('lon-input'),
  locationStatus: document.getElementById('location-status'),
  radiusInput: document.getElementById('radius-input'),
  radiusVal: document.getElementById('radius-val'),
  startDate: document.getElementById('start-date'),
  endDate: document.getElementById('end-date'),
  searchText: document.getElementById('search-text'),
  badgeToggles: document.querySelectorAll('.badge-toggle'),
  sortDate: document.getElementById('sort-date'),
  sortDistance: document.getElementById('sort-distance'),
  resultsCount: document.getElementById('results-count'),
  loading: document.getElementById('loading'),
  emptyState: document.getElementById('empty-state'),
  gamesGrid: document.getElementById('games-grid'),
  btnLoadMore: document.getElementById('btn-load-more'),
  btnResetFilters: document.getElementById('btn-reset-filters')
};

// --- GEOLOCATION & DISTANCE CALCULATIONS ---

// Haversine formula to compute distance in miles between coordinates
function haversineDistance(lat1, lon1, lat2, lon2) {
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return null;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_MILES * c;
}

// Request and set coordinates based on browser location
function getBrowserLocation() {
  elements.locationStatus.textContent = "📍 Accessing device location...";
  elements.locationStatus.className = "status-indicator";

  if (!navigator.geolocation) {
    updateLocationUI(userLocation.lat, userLocation.lon, "⚠️ Geolocation not supported. Using NYC.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      userLocation = { lat, lon };
      elements.presetCity.value = "current";
      updateLocationUI(lat, lon, "📍 Browser Location Active");
      applyFiltersAndRender();
    },
    (error) => {
      console.warn("Geolocation failed or denied:", error);
      // Fallback is NYC, check if it's already set
      updateLocationUI(userLocation.lat, userLocation.lon, "⚠️ Location blocked. Using NYC.");
      applyFiltersAndRender();
    },
    { timeout: 8000 }
  );
}

function updateLocationUI(lat, lon, statusText) {
  elements.latInput.value = lat.toFixed(4);
  elements.lonInput.value = lon.toFixed(4);
  elements.locationStatus.textContent = statusText;
}

// --- CALENDAR & MAPS LINKS ---

function getGoogleCalendarUrl(game) {
  const title = `${game.away} at ${game.home} (${game.league})`;
  
  // Format dates: YYYYMMDDTHHmmssZ
  const formatCalDate = (isoStr) => {
    return isoStr.replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const startCalDate = formatCalDate(game.date);
  
  // Estimate end time as 3 hours after start
  const startDate = new Date(game.date);
  const endDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000);
  const endCalDate = formatCalDate(endDate.toISOString());

  const location = `${game.venue}, ${game.city}, ${game.state}`;
  const details = `Baseball game event found via Baseball Event Finder.
Away: ${game.away}
Home: ${game.home}
League: ${game.league}
Status: ${game.status}`;

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startCalDate}/${endCalDate}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}`;
}

function getGoogleMapsUrl(game) {
  if (game.lat && game.lon) {
    return `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lon}&destination=${game.lat},${game.lon}`;
  }
  // Fallback to text search if coordinates are missing
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(game.venue + ', ' + game.city + ', ' + game.state)}`;
}

// --- FILTER & RENDER LOGIC ---

function applyFiltersAndRender() {
  const radius = parseFloat(elements.radiusInput.value) || 100;
  const start = elements.startDate.value ? new Date(elements.startDate.value + 'T00:00:00') : new Date(-8640000000000000);
  const end = elements.endDate.value ? new Date(elements.endDate.value + 'T23:59:59') : new Date(8640000000000000);
  const query = elements.searchText.value.toLowerCase().trim();

  // 1. Filter the games list
  filteredGames = games.filter(game => {
    // League check
    if (!activeLeagues.has(game.sportId)) return false;

    // Date range check
    const gameDate = new Date(game.date);
    if (gameDate < start || gameDate > end) return false;

    // Distance check
    if (game.lat !== null && game.lon !== null) {
      game.distance = haversineDistance(userLocation.lat, userLocation.lon, game.lat, game.lon);
      if (game.distance !== null && game.distance > radius) {
        return false;
      }
    } else {
      // If stadium doesn't have coordinates, let's exclude it from radius filters (or include if radius is maxed)
      game.distance = null;
      if (radius < 500) return false; 
    }

    // Text search (Home, Away, Venue, City, State)
    if (query) {
      const matchText = `${game.home} ${game.away} ${game.venue} ${game.city} ${game.state}`.toLowerCase();
      if (!matchText.includes(query)) return false;
    }

    return true;
  });

  // 2. Sort the filtered results
  if (currentSort === 'date') {
    filteredGames.sort((a, b) => new Date(a.date) - new Date(b.date));
  } else if (currentSort === 'distance') {
    filteredGames.sort((a, b) => {
      // Put games with coordinates before games without
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance;
    });
  }

  // 3. Update result counter UI
  elements.resultsCount.textContent = `Found ${filteredGames.length} ${filteredGames.length === 1 ? 'game' : 'games'} matching filters`;

  // 4. Reset rendering batch and display
  renderedCount = 0;
  elements.gamesGrid.innerHTML = '';
  
  if (filteredGames.length === 0) {
    elements.emptyState.classList.remove('hidden');
    elements.btnLoadMore.classList.add('hidden');
  } else {
    elements.emptyState.classList.add('hidden');
    renderNextBatch();
  }
}

function renderNextBatch() {
  const nextBatch = filteredGames.slice(renderedCount, renderedCount + INITIAL_BATCH_SIZE);
  
  nextBatch.forEach(game => {
    const card = document.createElement('div');
    card.className = 'game-card';
    
    // Distance label
    const distText = game.distance !== null ? `${game.distance.toFixed(1)} mi away` : 'Distance unknown';
    
    // Date formatting
    const localDate = new Date(game.date);
    const dateOptions = { weekday: 'short', month: 'short', day: 'numeric' };
    const timeOptions = { hour: 'numeric', minute: '2-digit' };
    const formattedDate = localDate.toLocaleDateString(undefined, dateOptions);
    const formattedTime = game.timeTBD ? "TBD" : localDate.toLocaleTimeString(undefined, timeOptions);
    
    // Class names for styling
    const leagueClassMap = {
      'MLB': 'tag-mlb',
      'Triple-A': 'tag-triple-a',
      'Double-A': 'tag-double-a',
      'High-A': 'tag-high-a',
      'Single-A': 'tag-single-a'
    };
    const tagClass = leagueClassMap[game.league] || 'btn-secondary';

    card.innerHTML = `
      <div class="game-card-header">
        <span class="league-tag ${tagClass}">${game.league}</span>
        <span class="distance-tag"><i class="fa-solid fa-location-arrow"></i> ${distText}</span>
      </div>
      <div class="game-card-body">
        <div class="teams-display">
          <div class="team-row">
            <span class="team-role">AWAY</span>
            <span>${game.away}</span>
          </div>
          <div class="vs-divider">at</div>
          <div class="team-row">
            <span class="team-row-home team-role">HOME</span>
            <span>${game.home}</span>
          </div>
        </div>
        <div class="game-details">
          <div class="game-detail-item">
            <i class="fa-solid fa-clock"></i>
            <span>${formattedDate} &bull; ${formattedTime}</span>
          </div>
          <div class="game-detail-item">
            <i class="fa-solid fa-stadium"></i>
            <span class="venue-name">${game.venue}</span>
          </div>
          <div class="game-detail-item">
            <i class="fa-solid fa-city"></i>
            <span>${game.city}, ${game.state}</span>
          </div>
        </div>
      </div>
      <div class="game-card-actions">
        <a href="${getGoogleMapsUrl(game)}" target="_blank" rel="noopener" class="btn btn-secondary"><i class="fa-solid fa-diamond-turn-right"></i> Directions</a>
        <a href="${getGoogleCalendarUrl(game)}" target="_blank" rel="noopener" class="btn btn-outline-primary"><i class="fa-solid fa-calendar-plus"></i> Cal invite</a>
      </div>
    `;
    
    elements.gamesGrid.appendChild(card);
  });

  renderedCount += nextBatch.length;
  
  if (renderedCount < filteredGames.length) {
    elements.btnLoadMore.classList.remove('hidden');
  } else {
    elements.btnLoadMore.classList.add('hidden');
  }
}

// --- SETUP EVENT LISTENERS ---

function setupEventListeners() {
  // Preset City Dropdown
  elements.presetCity.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'current') {
      getBrowserLocation();
    } else if (CITY_PRESETS[val]) {
      const city = CITY_PRESETS[val];
      userLocation = { lat: city.lat, lon: city.lon };
      updateLocationUI(city.lat, city.lon, `🔍 Using preset: ${city.name}`);
      applyFiltersAndRender();
    }
  });

  // Manual Geolocation Click
  elements.btnGeolocation.addEventListener('click', () => {
    getBrowserLocation();
  });

  // Manual Lat/Lon Inputs
  const handleLatLonInput = () => {
    const lat = parseFloat(elements.latInput.value);
    const lon = parseFloat(elements.lonInput.value);
    if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      userLocation = { lat, lon };
      elements.presetCity.value = ""; // Clear preset select
      elements.locationStatus.textContent = "🔍 Manual coordinates entered";
      applyFiltersAndRender();
    }
  };
  elements.latInput.addEventListener('input', handleLatLonInput);
  elements.lonInput.addEventListener('input', handleLatLonInput);

  // Radius Slider
  elements.radiusInput.addEventListener('input', (e) => {
    const val = e.target.value;
    elements.radiusVal.textContent = `${val} miles`;
    applyFiltersAndRender();
  });

  // Date Filters
  elements.startDate.addEventListener('change', applyFiltersAndRender);
  elements.endDate.addEventListener('change', applyFiltersAndRender);

  // Text Search Input
  let searchTimeout = null;
  elements.searchText.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(applyFiltersAndRender, 250); // Debounce search input
  });

  // League Badges Toggle
  elements.badgeToggles.forEach(badge => {
    badge.addEventListener('click', () => {
      const sportId = parseInt(badge.getAttribute('data-sport'));
      if (activeLeagues.has(sportId)) {
        // Don't turn off if it's the last one active
        if (activeLeagues.size > 1) {
          activeLeagues.delete(sportId);
          badge.classList.remove('active');
        }
      } else {
        activeLeagues.add(sportId);
        badge.classList.add('active');
      }
      applyFiltersAndRender();
    });
  });

  // Sort Buttons
  elements.sortDate.addEventListener('click', () => {
    if (currentSort !== 'date') {
      currentSort = 'date';
      elements.sortDate.classList.add('active');
      elements.sortDistance.classList.remove('active');
      applyFiltersAndRender();
    }
  });

  elements.sortDistance.addEventListener('click', () => {
    if (currentSort !== 'distance') {
      currentSort = 'distance';
      elements.sortDistance.classList.add('active');
      elements.sortDate.classList.remove('active');
      applyFiltersAndRender();
    }
  });

  // Load More Button
  elements.btnLoadMore.addEventListener('click', renderNextBatch);

  // Reset Filters Button
  const resetFilters = () => {
    elements.radiusInput.value = "100";
    elements.radiusVal.textContent = "100 miles";
    elements.searchText.value = "";
    
    // Reset dates to default (Today and +45 days)
    const today = new Date();
    elements.startDate.value = formatDateString(today);
    
    const endLimit = new Date();
    endLimit.setDate(today.getDate() + 45);
    elements.endDate.value = formatDateString(endLimit);

    // Reset active leagues to all
    activeLeagues = new Set([1, 11, 12, 13, 14]);
    elements.badgeToggles.forEach(badge => badge.classList.add('active'));

    // Reset sorting
    currentSort = 'date';
    elements.sortDate.classList.add('active');
    elements.sortDistance.classList.remove('active');

    // Trigger update
    applyFiltersAndRender();
  };
  
  elements.btnResetFilters.addEventListener('click', resetFilters);
}

// Helper to format Date object into YYYY-MM-DD local string
function formatDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// --- INITIALIZATION ---

async function init() {
  // Set default dates
  const today = new Date();
  elements.startDate.value = formatDateString(today);
  
  const endLimit = new Date();
  endLimit.setDate(today.getDate() + 45);
  elements.endDate.value = formatDateString(endLimit);

  // Setup UI event listeners
  setupEventListeners();

  // Try to load user browser location right away
  getBrowserLocation();

  // Fetch games database
  try {
    elements.loading.classList.remove('hidden');
    elements.emptyState.classList.add('hidden');
    
    const res = await fetch('data/games.json');
    if (!res.ok) {
      throw new Error(`Failed to load database. Code ${res.status}`);
    }
    
    games = await res.json();
    console.log(`Loaded ${games.length} games from static DB.`);
    
    elements.loading.classList.add('hidden');
    applyFiltersAndRender();
  } catch (err) {
    console.error("Initialization failed:", err);
    elements.loading.classList.add('hidden');
    elements.resultsCount.textContent = "Error loading game schedules.";
    elements.emptyState.querySelector('h3').textContent = "Database Error";
    elements.emptyState.querySelector('p').textContent = "Failed to load the static baseball database. Please verify docs/data/games.json exists.";
    elements.emptyState.classList.remove('hidden');
  }
}

// Run app
document.addEventListener('DOMContentLoaded', init);
