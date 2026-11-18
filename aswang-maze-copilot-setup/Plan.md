# 🔦 Aswang Maze: Full Build Plan

> A first-person horror maze with no game engine. Raycasting on HTML5 Canvas, an ASP.NET Core API, and SQLite.

**Progress Tracker:** `1 / 8 phases done` (update this after finishing each phase)

| Phase | Name | Status |
|---|---|---|
| 0 | Environment & Setup | ✅ Done |
| 1 | Backend & Database | ⬜ Not started |
| 2 | Raycaster Engine | ⬜ Not started |
| 3 | Gameplay Loop | ⬜ Not started |
| 4 | Aswang Enemy & AI | ⬜ Not started |
| 5 | UI (jQuery + Bootstrap) | ⬜ Not started |
| 6 | Horror Polish | ⬜ Not started |
| 7 | Levels, Testing & Deploy | ⬜ Not started |

Status legend: ⬜ Not started · 🟨 In progress · ✅ Done

---

## 1. Game Summary

- **Genre:** First-person horror / escape maze
- **Goal:** Find all the keys, unlock the exit, and escape the aswang.
- **Controls:** WASD to move, mouse to look (Pointer Lock), Shift to sprint, F for flashlight, Esc to pause.
- **Win:** Reach the exit with all required keys. The escape time (ms) is submitted to the leaderboard.
- **Lose:** Get caught by the aswang.
- **Replay value:** Best times, stars (1 to 3), a leaderboard per level, and unlockable levels.

---

## 2. Tech Stack & Requirements

### 2.1 Stack

| Layer | Technology | Purpose |
|---|---|---|
| Game rendering | **HTML5 Canvas 2D + Vanilla JavaScript (ES6 modules)** | Raycaster, game loop, input, AI |
| UI | **jQuery 3.x + Bootstrap 5** | Menus, modals, level select, leaderboard |
| Backend | **ASP.NET Core 8 (Minimal API), C#** | API, auth, static file hosting |
| ORM | **Entity Framework Core 8** | Database access |
| Database | **SQLite** (`aswangmaze.db`) | Players, levels, runs, progress |
| Audio | **Web Audio API / HTML5 Audio** | Heartbeat, footsteps, jumpscare |

### 2.2 Software to install

- [ ] **.NET 8 SDK**: https://dotnet.microsoft.com/download (check with `dotnet --version`)
- [ ] **Code editor**: Visual Studio 2022, VS Code (with C# Dev Kit), or JetBrains Rider
- [ ] **Git** (version control)
- [ ] **Modern browser**: Chrome, Edge, or Firefox (for DevTools and Pointer Lock)
- [ ] **DB Browser for SQLite** (optional, to inspect the `.db` file)
- [ ] **Postman / Thunder Client** (optional, to test the API)
- [ ] **Audacity** (optional, to edit sounds)

### 2.3 NuGet packages

```bash
dotnet add package Microsoft.EntityFrameworkCore.Sqlite --version 8.*
dotnet add package Microsoft.EntityFrameworkCore.Design --version 8.*
dotnet tool install --global dotnet-ef
```

### 2.4 Frontend libraries (CDN or local in `wwwroot/lib`)

- [ ] jQuery 3.7+
- [ ] Bootstrap 5.3 (CSS + JS bundle)
- [ ] Bootstrap Icons (optional)

### 2.5 Free assets

- Sounds: freesound.org, pixabay.com/sound-effects
- Textures and sprites: opengameart.org, itch.io (CC0 assets)
- Fonts: Google Fonts (a horror-style font for the title)

### 2.6 Skills needed

- C# basics, async/await, LINQ
- JavaScript (classes, modules, `requestAnimationFrame`)
- Basic trigonometry (sin, cos) and vectors
- SQL basics and EF Core migrations
- Grid pathfinding (BFS)

---

## 3. Architecture

```
Browser (Canvas raycaster + jQuery/Bootstrap UI)
        │  AJAX (JSON)
        ▼
ASP.NET Core 8 Minimal API  ──►  EF Core  ──►  SQLite (aswangmaze.db)
        │
        └─ also serves static files (wwwroot)
```

It is a single project. ASP.NET Core serves both the frontend and the API, so there are no CORS problems and one `dotnet run` starts everything.

---

## 4. Folder Structure

```
AswangMaze/
├─ Program.cs
├─ AswangMaze.csproj
├─ appsettings.json
├─ Data/
│  ├─ GameDb.cs
│  └─ Seed.cs
├─ Models/
│  ├─ Player.cs
│  ├─ Level.cs
│  ├─ Run.cs
│  └─ Progress.cs
├─ Dtos/
│  ├─ CreatePlayerDto.cs
│  ├─ RunDto.cs
│  └─ LeaderboardEntryDto.cs
├─ Services/
│  └─ Auth.cs
└─ wwwroot/
   ├─ index.html
   ├─ css/site.css
   ├─ assets/ (sounds, textures, sprites)
   └─ js/
      ├─ ui.js
      ├─ api.js
      └─ game/
         ├─ main.js
         ├─ input.js
         ├─ raycaster.js
         ├─ sprites.js
         ├─ player.js
         ├─ enemy.js
         ├─ level.js
         └─ audio.js
```

---

## 5. Database Design

| Table | Columns | Notes |
|---|---|---|
| **Players** | `Id`, `Username` (unique), `TokenHash`, `CreatedAt` | Guest login using a token |
| **Levels** | `Id`, `Name`, `Order`, `Width`, `Height`, `MapData`, `StartX`, `StartY`, `KeysRequired`, `EnemyCount`, `EnemySpeed`, `FogDistance`, `MinPossibleMs`, `StarTime3`, `StarTime2` | Maze layouts and settings |
| **Runs** | `Id`, `PlayerId`, `LevelId`, `TimeMs`, `KeysCollected`, `Escaped`, `CreatedAt` | Every attempt |
| **Progress** | `PlayerId`, `LevelId`, `BestTimeMs`, `Stars`, `Unlocked` | Composite key (PlayerId, LevelId) |

**MapData legend:** `1` wall · `0` floor · `2` key · `3` exit · `4` aswang spawn · `5` player start

**Indexes:** `Players.Username` (unique), `Runs(LevelId, Escaped, TimeMs)` for fast leaderboard queries.

---

## 6. API Endpoints

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/players` | ❌ | Create a player and return a token |
| GET | `/api/levels` | ✅ | List levels with unlocked status |
| GET | `/api/levels/{id}` | ✅ | Map data and settings |
| POST | `/api/runs` | ✅ | Submit a run result |
| GET | `/api/leaderboard/{levelId}?top=10` | ❌ | Top fastest escapes |
| GET | `/api/players/me/progress` | ✅ | Best times, stars, unlocks |

---

## 7. Build Phases

### Phase 0: Environment & Setup  ✅

**Goal:** A new project that runs and shows a page in the browser.

- [x] Install the .NET 8 SDK and a code editor
- [x] `dotnet new web -n AswangMaze`
- [x] Create the Git repo and `.gitignore` (include `*.db`, `bin/`, `obj/`)
- [x] Enable static files (`app.UseDefaultFiles(); app.UseStaticFiles();`)
- [x] Create `wwwroot/index.html` with jQuery and Bootstrap
- [x] Create the folder structure (section 4)
- [x] `dotnet run` works and the page loads in the browser

**Done when:** An "Aswang Maze" page with Bootstrap styling loads.

---

### Phase 1: Backend & Database  ⬜

**Goal:** A complete API and a seeded level in SQLite.

- [ ] Install the EF Core SQLite packages
- [ ] Create the models: `Player`, `Level`, `Run`, `Progress`
- [ ] Create `GameDb : DbContext` and configure keys and indexes
- [ ] Register the DbContext (`UseSqlite("Data Source=aswangmaze.db")`)
- [ ] `dotnet ef migrations add InitialCreate`
- [ ] `dotnet ef database update`
- [ ] Seed Level 1 (*Barangay Eskinita*) in `Seed.cs`
- [ ] `POST /api/players` (create player and token, store a hashed token)
- [ ] Auth helper (read `Authorization: Bearer <token>`)
- [ ] `GET /api/levels` and `GET /api/levels/{id}`
- [ ] `POST /api/runs` (validation, update Progress, unlock next level)
- [ ] `GET /api/leaderboard/{levelId}`
- [ ] `GET /api/players/me/progress`
- [ ] Test every endpoint with Postman or Thunder Client
- [ ] Basic anti-cheat: reject runs where `TimeMs < MinPossibleMs`

**Done when:** A run can be saved through the API and the leaderboard returns data.

---

### Phase 2: Raycaster Engine  ⬜  *(the most important phase)*

**Goal:** Walk around a 3D maze.

- [ ] Set up the canvas (fullscreen, resize handler)
- [ ] Game loop with `requestAnimationFrame` and **delta time**
- [ ] `input.js`: keyboard state (WASD, Shift, Esc, F)
- [ ] Pointer Lock API for mouse look
- [ ] Hard-coded test map (16x16 array)
- [ ] DDA raycasting for each screen column
- [ ] Fisheye correction (perpendicular distance)
- [ ] Draw vertical wall strips based on distance
- [ ] Shading: different color for N/S vs E/W walls
- [ ] Fog: `brightness = 1 / (1 + dist² * k)`
- [ ] Floor and ceiling gradient
- [ ] Player movement (forward, back, strafe)
- [ ] Rotation (mouse and arrow keys)
- [ ] Collision: check X and Y separately (wall sliding)
- [ ] Minimap (debug, toggle with `M`)
- [ ] FPS counter (debug)
- [ ] Optional: texture-mapped walls

**Done when:** You can walk through the maze, cannot pass through walls, fog darkens the distance, and it runs at 60 FPS.

---

### Phase 3: Gameplay Loop  ⬜

**Goal:** A real objective, a timer, and a win condition.

- [ ] `level.js`: load the map from the API (`GET /api/levels/{id}`)
- [ ] Parse the `MapData` string into a 2D array
- [ ] Render keys as sprites (billboards)
- [ ] Sprite rendering: sort by distance and use a **z-buffer**
- [ ] Pickup logic (collect a key when close)
- [ ] HUD: keys collected (`2/3`), timer, stamina bar
- [ ] Exit door locked until all keys are collected
- [ ] Win condition: reach the exit with all keys
- [ ] Stamina system for sprinting
- [ ] Flashlight: toggle on/off, limited battery
- [ ] Timer (starts on play, stops on win, lose, or pause)
- [ ] `api.js`: submit the run (`POST /api/runs`)
- [ ] Pause state (Esc)

**Done when:** You can collect a key, escape, and see your time saved in SQLite.

---

### Phase 4: Aswang Enemy & AI  ⬜

**Goal:** An enemy that hunts and catches the player.

- [ ] Aswang sprite (billboard that faces the camera)
- [ ] Spawn from the `4` tile in the map
- [ ] BFS pathfinding on the grid
- [ ] State machine:
  - [ ] **Patrol**: wander between waypoints
  - [ ] **Investigate**: move toward a noise
  - [ ] **Chase**: follow the player when seen
  - [ ] **Search**: look around the player's last known position
- [ ] Line-of-sight check (grid ray)
- [ ] Hearing system: sprinting makes noise
- [ ] Catch detection (distance < 0.5 tile)
- [ ] Game over state (jumpscare placeholder)
- [ ] Scale enemy speed using the level's `EnemySpeed`
- [ ] Recalculate paths on an interval (not every frame) to avoid lag
- [ ] Support multiple aswang (`EnemyCount`)

**Done when:** The aswang hunts you, you can evade or escape it, and getting caught ends the game.

---

### Phase 5: UI (jQuery + Bootstrap)  ⬜

**Goal:** Complete menus and screens outside the game.

- [ ] Main menu (Play, Levels, Leaderboard, Settings)
- [ ] Username modal (first time only) and save the token in `localStorage`
- [ ] Level select cards (lock icon, best time, stars)
- [ ] Pause modal (Resume / Restart / Quit)
- [ ] Game Over modal (Retry / Menu)
- [ ] Escaped modal (time, stars, Retry, Next Level, top 10)
- [ ] Leaderboard page with a tab per level
- [ ] Settings: volume, mouse sensitivity, brightness
- [ ] Loading spinner and error toasts for API failures
- [ ] Responsive layout (desktop-first, mobile not required)
- [ ] `ui.js` and `game/main.js` communicate through events or callbacks

**Done when:** You can go from the menu to a game to the leaderboard without touching the console.

---

### Phase 6: Horror Polish  ⬜

**Goal:** Make it genuinely scary and satisfying.

- [ ] Ambient loop (wind, crickets)
- [ ] Footstep sounds (faster when sprinting)
- [ ] Heartbeat that speeds up as the aswang gets closer
- [ ] Flashlight flicker when the aswang is near
- [ ] Screen vignette (Canvas radial gradient)
- [ ] Camera head-bob
- [ ] Screen shake when caught
- [ ] Jumpscare (image and sound) on game over
- [ ] Directional aswang growls and whispers (stereo pan)
- [ ] Per-level fog distance
- [ ] Wall textures (stone, wood, moss)
- [ ] Atmospheric title screen (dark with glitch text)

**Done when:** Your friends jump or keep looking over their shoulder while playtesting.

---

### Phase 7: Levels, Testing & Deploy  ⬜

**Goal:** A finished game you can share.

**Levels**
- [ ] Level 1: *Barangay Eskinita* (small, 1 aswang, 2 keys, tutorial)
- [ ] Level 2: *Lumang Balay* (3 keys)
- [ ] Level 3: *Sementeryo* (darker, faster enemy)
- [ ] Level 4: *Kagubatan* (2 aswang)
- [ ] Level 5: *Lungib sa Kapre* (boss level)
- [ ] Balance `StarTime2` and `StarTime3` for each level
- [ ] Compute `MinPossibleMs` (shortest path divided by max speed)

**Testing**
- [ ] Test every API endpoint (valid and invalid input)
- [ ] Test the game in Chrome, Edge, and Firefox
- [ ] Playtest with 3+ people and adjust difficulty
- [ ] Check performance (60 FPS, no memory leaks)
- [ ] Handle edge cases: page refresh mid-game, missing token, API offline

**Security / Anti-cheat**
- [ ] Rate limit `POST /api/runs`
- [ ] Validate `TimeMs` and `KeysCollected` on the server
- [ ] Hash tokens in the database
- [ ] Sanitize usernames (length, allowed characters)

**Deploy**
- [ ] `dotnet publish -c Release`
- [ ] Pick a host: Azure App Service, Railway, Render, or Docker on a VPS
- [ ] Persist the SQLite file (mounted volume)
- [ ] Enable HTTPS (required for Pointer Lock on some hosts)
- [ ] Back up the `.db` file (scheduled)
- [ ] Write a README (how to run, controls, screenshots)

**Done when:** The game is online and your friends can play it from a link.

---

## 8. Timeline (part-time)

| Phase | Estimate |
|---|---|
| 0. Setup | 0.5 day |
| 1. Backend & DB | 1 day |
| 2. Raycaster | 2 to 3 days |
| 3. Gameplay loop | 1 to 2 days |
| 4. Aswang AI | 2 to 3 days |
| 5. UI | 2 days |
| 6. Horror polish | 2 days |
| 7. Levels & deploy | 2 to 3 days |
| **Total** | **~2 to 3 weeks** |

---

## 9. Risks & Solutions

| Risk | Solution |
|---|---|
| Raycasting math feels hard | Start without textures and follow Lode's Raycasting Tutorial |
| BFS lags with many enemies | Recalculate every ~0.3s, not every frame |
| Pointer Lock does not work | It needs a user click first, and HTTPS in production |
| Leaderboard cheating | Server-side validation and `MinPossibleMs` |
| Scope creep | Fully finish Level 1 (Phases 0 to 5) before adding more features |

---

## 10. Definition of Done (MVP)

- [ ] Player can pick a username and save progress
- [ ] 3 playable levels
- [ ] An aswang that hunts and catches the player
- [ ] Keys, exit, timer, and stars
- [ ] A leaderboard per level
- [ ] Sounds and a basic horror atmosphere
- [ ] Deployed online

---

## 11. Progress Log

| Date | Phase | Notes |
|---|---|---|
| 2026-11-18 | Phase 0: Environment & Setup | Created and verified the ASP.NET Core project, static page, Bootstrap/jQuery setup, folder structure, and running .NET environment. |
| | | |
| | | |

---

## 12. Useful References

- Lode's Computer Graphics Tutorial: Raycasting (lodev.org/cgtutor/raycasting.html)
- MDN: Pointer Lock API, Canvas API, Web Audio API
- Microsoft Docs: ASP.NET Core Minimal APIs, EF Core with SQLite
- Red Blob Games: Pathfinding / BFS (redblobgames.com)
