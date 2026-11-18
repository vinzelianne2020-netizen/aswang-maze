---
description: "Phase 1: backend, SQLite database, and API (Aswang Maze)"
agent: agent
---
# Phase 1: Backend & Database

Skills to read first: `.github/skills/aswang-backend/SKILL.md` and `.github/skills/aswang-level-design/SKILL.md` (MapData format and validation).

## Goal
A complete, tested API with a seeded Level 1 in SQLite.

## Tasks (from Plan.md Phase 1)
- Install EF Core SQLite and Design packages; install `dotnet-ef`.
- Models: `Player`, `Level`, `Run`, `Progress` (columns exactly as in Plan.md section 5).
- `GameDb : DbContext` with the unique username index, the composite key on `Progress`, and the `Runs(LevelId, Escaped, TimeMs)` index.
- Connection string in `appsettings.json`; register DbContext; run `Database.Migrate()` then the seeder at startup.
- Migration `InitialCreate` and `database update`.
- Seed Level 1 "Barangay Eskinita": a valid 15x15 MapData with one player start (5), one exit (3), 2 keys (2), 1 aswang spawn (4), border all walls, and at least one loop. Include a small validator method that checks reachability with BFS and throws on failure.
- `POST /api/players`: validate the username (3 to 16 chars, letters, digits, underscore), generate a random token, store only its SHA256 hash, return the raw token once, 409 on duplicate.
- Auth helper reading `Authorization: Bearer <token>`.
- `GET /api/levels`, `GET /api/levels/{id}`.
- `POST /api/runs` with: auth, level lookup, locked-level check, escaped validation (keys >= required, `TimeMs >= MinPossibleMs`), insert run, update `Progress` (best time, stars, unlock next level), and rate limiting of 10 per minute.
- `GET /api/leaderboard/{levelId}?top=10` (best escape per player), `GET /api/players/me/progress`.
- Use DTOs only. Never return `TokenHash`.
- Create `api.http` (REST Client / Visual Studio format) with a request for every endpoint, including invalid cases.

## Deliverables
Every file in full: models, DbContext, Seed, Dtos, Auth, Program.cs, and `api.http`.

## Verify
Walk me through the `api.http` requests in order and the exact response I should get for each (success and error cases), then show how to inspect the `.db` file.

## Rules for this session
- Read `Plan.md` and `.github/copilot-instructions.md` first. Follow the phase tasks exactly; do not add features from later phases.
- Work in small vertical slices. After each slice, tell me what to run and what I should see before moving on.
- Give exact file paths and complete runnable code (no "..." placeholders in code I must paste).
- Explain non-obvious math or design choices in one or two lines.
- Do NOT tick checkboxes yet. When I say the work is verified, I will run `/confirm-tasks`.
- If something in Plan.md conflicts with what the code needs, stop and ask me one short question.
