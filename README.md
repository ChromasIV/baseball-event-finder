# Baseball Event Finder

A high-performance, automated web application that lists and filters Major League Baseball (MLB) and Minor League Baseball (MiLB) game events based on proximity, radius, and date ranges. 

**Theme Version:** 1.0.1  
**Status:** Ready to deploy to GitHub Pages!

---

## ⚾ Features
- **Smart Geolocation**: Automatically defaults to your current location (via browser Geolocation API) with manual coordinates override and handy preset cities.
- **Search Radius Filter**: Filter games within a sliding radius (from 10 to 500 miles) computed instantly in the browser using the **Haversine formula**.
- **League Filters**: Toggle displays for MLB, Triple-A, Double-A, High-A, and Single-A games.
- **Date Filtering**: Search for games starting today and later, up to 45 days in the future.
- **Text Search**: Filter matches in real-time by team names, stadium, city, or state.
- **Directions & Planning**: Get direct Google Maps navigation links from your current coordinates to any game venue, and generate one-click Google Calendar event invitations with pre-filled game times, locations, and details.
- **Zero-Maintenance Architecture**: Powered by a static JSON database compiled dynamically by a background GitHub Action.

---

## 🏗️ Architecture

```
                                  +-----------------------+
                                  |    GitHub Actions     |
                                  |  (Runs weekly cron)   |
                                  +-----------+-----------+
                                              |
                                              v (scripts/fetch-games.js)
                                  +-----------+-----------+
                                  |    statsapi.mlb.com   |
                                  +-----------+-----------+
                                              |
                                              v (Saves games.json)
+---------------------------------------------+----------------------------------------------+
| GitHub Repository (GitHub Pages)                                                           |
|                                                                                            |
|   /docs                                                                                    |
|     ├── data/games.json <------------- (Compressed game schedule with venue coordinates)   |
|     ├── index.html <------------------ (Premium Glassmorphic UI Dashboard)                 |
|     ├── style.css <------------------- (Responsive dark-theme styling, baseball spin animation)|
|     └── app.js <---------------------- (Client-side geolocation, Haversine filters & invite) |
|                                                                                            |
+--------------------------------------------------------------------------------------------+
```

---

## 🚀 Running Locally

### Prerequisites
- Node.js (v18 or higher is recommended)

### Setup & Run
1. Navigate to the project folder:
   ```bash
   cd baseball-event-finder
   ```
2. Fetch the latest game data manually:
   ```bash
   npm run fetch-data
   ```
   This scripts queries the public MLB StatsAPI, extracts coordinates, and creates `docs/data/games.json`.
3. Start the local web server:
   ```bash
   npm start
   ```
4. Open [http://localhost:8080](http://localhost:8080) in your browser.

---

## 🌐 Deploying to GitHub Pages

Since the web application is fully static and contained inside the `/docs` folder, hosting is completely free on GitHub Pages:

1. Push this project to your GitHub repository:
   ```bash
   git add .
   # Ignore node_modules if any exist
   git commit -m "Initialize Baseball Event Finder"
   git push origin main
   ```
2. Open your repository on GitHub.
3. Go to **Settings** > **Pages** (under the "Code and automation" section).
4. Under **Build and deployment** > **Source**, choose **Deploy from a branch**.
5. Under **Branch**, select `main` (or your default branch) and change the folder from `/ (root)` to `/docs`.
6. Click **Save**.
7. In a minute, GitHub will host your site at `https://<your-username>.github.io/baseball-event-finder/`.

### Automated Database Updates
The included GitHub Action `.github/workflows/update-schedule.yml` runs every Monday at midnight. It automatically pulls game updates, rebuilds the database, and commits changes back to your repository. This triggers an automatic rebuild of your GitHub Pages site, keeping the schedule fresh with zero manual work!
