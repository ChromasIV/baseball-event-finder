const fs = require('fs');
const path = require('path');

const SPORTS = [
  { id: 1, name: "Major League Baseball", label: "MLB" },
  { id: 11, name: "Triple-A", label: "Triple-A" },
  { id: 12, name: "Double-A", label: "Double-A" },
  { id: 13, name: "High-A", label: "High-A" },
  { id: 14, name: "Single-A", label: "Single-A" }
];

// Helper to format Date as YYYY-MM-DD
function formatDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function fetchSportGames(sport, startDateStr, endDateStr) {
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=${sport.id}&startDate=${startDateStr}&endDate=${endDateStr}&hydrate=venue(location)`;
  console.log(`Fetching ${sport.name} (${sport.label}) from ${startDateStr} to ${endDateStr}...`);
  
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const data = await res.json();
    
    const games = [];
    if (!data.dates) return games;
    
    for (const dateObj of data.dates) {
      if (!dateObj.games) continue;
      for (const game of dateObj.games) {
        // Skip games that are postponed or canceled, or don't have teams/venues
        if (game.status && (game.status.codedGameState === 'D' || game.status.codedGameState === 'C')) {
          continue; // Postponed or Cancelled
        }
        
        const homeTeam = game.teams?.home?.team;
        const awayTeam = game.teams?.away?.team;
        const venueObj = game.venue;
        
        if (!homeTeam || !awayTeam || !venueObj) continue;
        
        const location = venueObj.location || {};
        const coords = location.defaultCoordinates || {};
        
        games.push({
          id: game.gamePk,
          date: game.gameDate,
          sportId: sport.id,
          league: sport.label,
          home: homeTeam.name,
          away: awayTeam.name,
          homeId: homeTeam.id,
          awayId: awayTeam.id,
          venue: venueObj.name,
          city: location.city || "",
          state: location.state || location.stateAbbrev || "",
          lat: coords.latitude || null,
          lon: coords.longitude || null,
          status: game.status?.detailedState || "Scheduled",
          timeTBD: game.status?.startTimeTBD || false
        });
      }
    }
    
    console.log(`Successfully fetched ${games.length} games for ${sport.label}.`);
    return games;
  } catch (err) {
    console.error(`Failed to fetch games for ${sport.name}:`, err.message);
    return [];
  }
}

async function main() {
  const today = new Date();
  // Set start date to today
  const startDateStr = formatDate(today);
  
  // Set end date to today + 45 days
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + 45);
  const endDateStr = formatDate(endDate);
  
  let allGames = [];
  
  for (const sport of SPORTS) {
    const games = await fetchSportGames(sport, startDateStr, endDateStr);
    allGames = allGames.concat(games);
    // Add a tiny delay between requests to be polite to the API
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Sort games by date ascending
  allGames.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  const outputDir = path.join(__dirname, '../docs/data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const outputPath = path.join(outputDir, 'games.json');
  fs.writeFileSync(outputPath, JSON.stringify(allGames, null, 2));
  console.log(`\nTotal games written: ${allGames.length}`);
  console.log(`Saved output to ${outputPath}`);
}

main();
