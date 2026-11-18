---
description: "Phase 4: aswang enemy with BFS pathfinding and a state machine (Aswang Maze)"
agent: agent
---
# Phase 4: Aswang Enemy & AI

Skill to read first: `.github/skills/aswang-enemy-ai/SKILL.md`. Also `.github/skills/aswang-raycaster/SKILL.md` for sprite rendering.

## Goal
An enemy that patrols, investigates noise, chases on sight, searches, and catches the player, while staying fair.

## Tasks (from Plan.md Phase 4)
- `enemy.js` class with position, facing, speed, `state`, `stateTime`, and one `setState()` for transitions and entry actions.
- Aswang billboard sprite (procedural placeholder is fine) spawned from the `4` tile.
- BFS pathfinding in a reusable `pathfinding.js` using an index pointer queue (no `shift()`).
- States: PATROL, INVESTIGATE, CHASE, SEARCH with the speed multipliers from the skill.
- Line of sight via grid DDA, with view distance (scaled by the level `FogDistance`) and a view cone.
- Hearing: a noise event system (`noise(x, y, radius)`); sprinting, walking, key pickup, and flashlight click emit noise; use path length, not straight distance.
- Path recalculation on a timer (0.3 s) with a random per-enemy offset.
- Movement along the path with the same collision as the player; small separation between enemies.
- 5 second grace period at level start.
- Catch detection at 0.5 tiles, 0.3 s slow-motion grab, then a game over state (placeholder overlay).
- Support `EnemyCount` and `EnemySpeed` from level data.
- Debug overlay (toggle with N) showing each enemy state, path, and view cone on the minimap.

## Verify
A test script of behaviors I should observe: patrol, noise reaction, chase, loss of sight, search, catch. Include the testing checklist from the skill and tell me how to test 3 enemies for performance.

## Rules for this session
- Read `Plan.md` and `.github/copilot-instructions.md` first. Follow the phase tasks exactly; do not add features from later phases.
- Work in small vertical slices. After each slice, tell me what to run and what I should see before moving on.
- Give exact file paths and complete runnable code (no "..." placeholders in code I must paste).
- Explain non-obvious math or design choices in one or two lines.
- Do NOT tick checkboxes yet. When I say the work is verified, I will run `/confirm-tasks`.
- If something in Plan.md conflicts with what the code needs, stop and ask me one short question.
