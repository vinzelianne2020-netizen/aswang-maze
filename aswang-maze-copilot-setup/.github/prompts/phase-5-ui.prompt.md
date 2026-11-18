---
description: "Phase 5: jQuery and Bootstrap menus, modals, leaderboard (Aswang Maze)"
agent: agent
---
# Phase 5: UI (jQuery + Bootstrap)

Skills to read first: `.github/skills/aswang-maze-orchestrator/SKILL.md` (UI rules for Phase 5) and `.github/skills/aswang-backend/SKILL.md` (API shapes).

## Goal
Play from the menu to the game to the leaderboard with no console commands.

## Tasks (from Plan.md Phase 5)
- A tiny event emitter (`events.js`) so `ui.js` and `game/main.js` communicate without shared globals (`level:start`, `game:paused`, `game:escaped`, `game:over`).
- Main menu: Play, Levels, Leaderboard, Settings.
- First-time username modal with validation errors from the API; save the token in `localStorage` under `am_token`.
- Level select cards: lock icon, best time, stars, from `GET /api/levels` and `GET /api/players/me/progress`.
- Pause modal: Resume, Restart, Quit.
- Game Over modal: Retry, Menu.
- Escaped modal: time, stars, Retry, Next Level, and the top 10 for that level.
- Leaderboard page with one Bootstrap tab per level.
- Settings modal: volume, mouse sensitivity, brightness, reduce effects, saved in `localStorage`.
- Loading spinner and Bootstrap toast errors for API failures.
- Pointer lock rules: exit lock and pause the timer when any modal opens; require a click to re-lock when it closes.
- Remove the Phase 3 dev-only login prompt and temporary overlays.
- Dark horror theme in `site.css` (Bootstrap dark mode plus a custom accent).

## Verify
A click-through script: new user, play level 1, die, retry, escape, see the leaderboard, check that level 2 unlocks, reload the page and stay logged in.

## Rules for this session
- Read `Plan.md` and `.github/copilot-instructions.md` first. Follow the phase tasks exactly; do not add features from later phases.
- Work in small vertical slices. After each slice, tell me what to run and what I should see before moving on.
- Give exact file paths and complete runnable code (no "..." placeholders in code I must paste).
- Explain non-obvious math or design choices in one or two lines.
- Do NOT tick checkboxes yet. When I say the work is verified, I will run `/confirm-tasks`.
- If something in Plan.md conflicts with what the code needs, stop and ask me one short question.
  