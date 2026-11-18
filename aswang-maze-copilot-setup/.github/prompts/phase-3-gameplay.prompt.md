---
description: "Phase 3: keys, exit, timer, win condition, submit run (Aswang Maze)"
agent: agent
---
# Phase 3: Gameplay Loop

Skills to read first: `.github/skills/aswang-raycaster/SKILL.md` (sprites and z-buffer) and `.github/skills/aswang-backend/SKILL.md` (run submission).

## Goal
A real objective: collect keys, unlock the exit, escape, and save the time to SQLite.

## Tasks (from Plan.md Phase 3)
- `level.js`: load a level from `GET /api/levels/{id}`, parse `MapData` into a collision grid (keys, spawns, exit stored as entities, tiles rewritten to 0).
- `api.js`: small fetch wrapper that adds the bearer token and handles errors; `submitRun()` posting to `/api/runs`.
- `sprites.js`: billboard sprites sorted far to near, per-column z-buffer test, fog applied. Draw keys as simple procedural shapes (no image assets required).
- Pickup logic (distance < 0.5) with a pickup sound hook (stub function for now).
- HUD drawn on canvas: keys `n/N`, timer in mm:ss.ms, stamina bar.
- Exit door: locked until all required keys are collected, with a visible locked/unlocked state.
- Win condition and timer (starts on first movement or play, stops on win or lose or pause).
- Sprint with Shift using stamina (drain, regen delay, cannot sprint at 0).
- Flashlight toggle (F) with a limited battery that drains while on.
- Pause on Esc.
- On win: call `submitRun` and log the response; a temporary on-screen "ESCAPED" overlay is enough (real modals come in Phase 5).
- Temporary player login for testing: a dev-only prompt that calls `POST /api/players` and stores the token in `localStorage` under `am_token`.

## Verify
Steps for me to: log in, pick up both keys, reach the exit, see the run in SQLite and in `GET /api/leaderboard/1`. Include what happens when I try to exit without keys.

## Rules for this session
- Read `Plan.md` and `.github/copilot-instructions.md` first. Follow the phase tasks exactly; do not add features from later phases.
- Work in small vertical slices. After each slice, tell me what to run and what I should see before moving on.
- Give exact file paths and complete runnable code (no "..." placeholders in code I must paste).
- Explain non-obvious math or design choices in one or two lines.
- Do NOT tick checkboxes yet. When I say the work is verified, I will run `/confirm-tasks`.
- If something in Plan.md conflicts with what the code needs, stop and ask me one short question.
