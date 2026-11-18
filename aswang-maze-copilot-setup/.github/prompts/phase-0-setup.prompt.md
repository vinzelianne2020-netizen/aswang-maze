---
description: "Phase 0: environment and project setup (Aswang Maze)"
agent: agent
---
# Phase 0: Environment & Setup

Skill to read first: `.github/skills/aswang-backend/SKILL.md` (Setup and Static files sections).

## Goal
A new ASP.NET Core 8 project that runs and serves a Bootstrap-styled "Aswang Maze" page.

## Tasks (from Plan.md Phase 0)
- Create the project `AswangMaze` with `dotnet new web`.
- Create `.gitignore` including `bin/`, `obj/`, `*.db`, `*.db-shm`, `*.db-wal`, `.vs/`.
- Enable static files in `Program.cs` (`UseDefaultFiles`, `UseStaticFiles`).
- Create `wwwroot/index.html` with jQuery 3.7 and Bootstrap 5.3 (CDN links), a centered title, and a button that proves jQuery works (clicking changes text).
- Create the full folder structure from Plan.md section 4 (empty placeholder files are fine, add a one-line comment in each JS file saying its purpose).

## Deliverables
1. Exact terminal commands (including checking `dotnet --version`).
2. Full contents of `Program.cs`, `index.html`, `.gitignore`, `site.css`.
3. The final folder tree.

## Verify
`dotnet run`, open the printed URL, and I see the Aswang Maze page with Bootstrap styling, and the jQuery button works. List what I should see.

## Rules for this session
- Read `Plan.md` and `.github/copilot-instructions.md` first. Follow the phase tasks exactly; do not add features from later phases.
- Work in small vertical slices. After each slice, tell me what to run and what I should see before moving on.
- Give exact file paths and complete runnable code (no "..." placeholders in code I must paste).
- Explain non-obvious math or design choices in one or two lines.
- Do NOT tick checkboxes yet. When I say the work is verified, I will run `/confirm-tasks`.
- If something in Plan.md conflicts with what the code needs, stop and ask me one short question.
