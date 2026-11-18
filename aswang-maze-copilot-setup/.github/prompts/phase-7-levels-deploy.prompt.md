---
description: "Phase 7: five levels, testing, anti-cheat, and deploy (Aswang Maze)"
agent: agent
---
# Phase 7: Levels, Testing & Deploy

Skills to read first: `.github/skills/aswang-level-design/SKILL.md` and `.github/skills/aswang-backend/SKILL.md` (anti-cheat and deployment).

## Goal
A finished, balanced, deployed game I can share by link.

## Tasks (from Plan.md Phase 7)
Levels
- Create a node script `tools/level-tool.js` (or a C# console tool) that generates a draft maze, places start, keys, exit, and spawns by the placement rules, runs the validator, and computes `MinPossibleMs`, `StarTime3`, and `StarTime2` with BFS.
- Produce levels 2 to 5 (Lumang Balay, Sementeryo, Kagubatan, Lungib sa Kapre) following the difficulty table, with the generated `MapData` ready to paste into `Seed.cs`.
- Seed by `Order` so balance changes update existing rows; add a `Version` column and migration if needed, and explain how old leaderboard times are handled.

Testing
- Integration tests for the API (xUnit with `WebApplicationFactory`): create player, duplicate username, locked level, suspicious time, valid run, leaderboard order.
- A manual QA checklist for browsers (Chrome, Edge, Firefox) and edge cases (refresh mid-game, missing token, API offline).
- Performance check steps (frame time, memory over 10 minutes).

Security
- Server-issued `runId` at level start and elapsed-time cross-check on submit; rate limiting; username sanitizing; token hashing review.
- Be honest in the README about the limits of client-side anti-cheat.

Deploy
- Multi-stage Dockerfile, `.dockerignore`, and the connection string env var pointing at a mounted volume (`/data/aswangmaze.db`).
- Step-by-step for one host I choose (ask me: Railway, Render, Azure App Service, or a VPS), HTTPS notes for Pointer Lock, WAL mode, and a scheduled backup using `VACUUM INTO`.
- README with how to run, controls, screenshots placeholders, credits, and license notes.

## Verify
I can open the live URL, create a user, play all unlocked levels, submit times, see the leaderboard, and a redeploy does not wipe the database.

## Rules for this session
- Read `Plan.md` and `.github/copilot-instructions.md` first. Follow the phase tasks exactly; do not add features from later phases.
- Work in small vertical slices. After each slice, tell me what to run and what I should see before moving on.
- Give exact file paths and complete runnable code (no "..." placeholders in code I must paste).
- Explain non-obvious math or design choices in one or two lines.
- Do NOT tick checkboxes yet. When I say the work is verified, I will run `/confirm-tasks`.
- If something in Plan.md conflicts with what the code needs, stop and ask me one short question.
