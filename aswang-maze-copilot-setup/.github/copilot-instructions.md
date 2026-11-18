# Aswang Maze: Project Instructions

First-person horror maze game. No game engine.

## Stack
- Game: HTML5 Canvas 2D + vanilla JavaScript (ES modules) in `wwwroot/js/game/`, raycasting (DDA), no WebGL, no Three.js, no Phaser
- UI outside the canvas: jQuery 3 + Bootstrap 5 in `wwwroot/js/ui.js`
- Backend: ASP.NET Core 8 Minimal API (C#), EF Core 8, SQLite
- One project serves `wwwroot` static files and `/api/*`. No separate frontend server, no CORS setup.

## Source of truth
`Plan.md` in the repo root holds the phases (0 to 7) and checkboxes. Before starting work, read it and find the first unfinished phase. After a task is confirmed working, tick its checkbox, update the phase status emoji and the progress counter, and add a Progress Log row.

## Rules
- Work in small vertical slices that run immediately. Do not generate the whole project at once.
- Build order matters: finish phases 0 to 4 before polish (phase 6) or deploy.
- The browser owns the game loop. The server only does persistence, validation, and leaderboards.
- Never trust client-submitted results. Validate runs server-side.
- Never return EF entities from endpoints (they include `TokenHash`). Return DTOs.
- Game code uses delta time for all movement. Cap `dt` at 0.05 s.
- No allocations inside the per-frame render loop.
- jQuery only for DOM UI. Canvas code stays vanilla JS.
- Keep `ui.js` and `game/main.js` decoupled through a small event emitter.
- Prefer clear, commented code. The developer is learning, so explain non-obvious math in one or two lines.

## Skills
Use the project skills in `.github/skills/`: `aswang-maze-orchestrator` (planning and progress), `aswang-raycaster` (phases 2 and 3), `aswang-enemy-ai` (phase 4), `aswang-backend` (phases 0, 1, deploy), `aswang-horror-polish` (phase 6), `aswang-level-design` (phase 7).
