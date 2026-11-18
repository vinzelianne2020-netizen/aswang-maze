---
description: "Phase 2: raycaster engine, walk around a 3D maze (Aswang Maze)"
agent: agent
---
# Phase 2: Raycaster Engine

Skill to read first: `.github/skills/aswang-raycaster/SKILL.md`. Follow its build order and do not skip steps.

## Goal
Walk through a 3D maze at 60 FPS using only Canvas 2D and vanilla JS. This is the hardest phase; go in slices and make me verify each slice visually before the next.

## Tasks (from Plan.md Phase 2)
Slice 1: fullscreen canvas with resize handling, internal resolution 640x360 scaled with `image-rendering: pixelated`, and the game loop with delta time (capped at 0.05).
Slice 2: `input.js` with keyboard state (WASD, Shift, Esc, F, M) and Pointer Lock for mouse look (request lock on click).
Slice 3: hard-coded 16x16 test map, DDA raycasting per column with perpendicular distance, flat colored walls, N/S vs E/W shading.
Slice 4: distance fog `1 / (1 + dist² * k)`, floor and ceiling gradients, z-buffer in a `Float32Array`.
Slice 5: `player.js` movement (forward, back, strafe, normalized diagonals), rotation with mouse and arrow keys, axis-separated collision with a 0.2 radius.
Slice 6: debug minimap (toggle with M) and FPS counter.
Slice 7 (optional, only if I ask): wall textures using `drawImage` 1px strips.

## File layout
`wwwroot/js/game/main.js`, `input.js`, `raycaster.js`, `player.js`, plus a `wwwroot/game-test.html` that loads the game with the test map (no API needed yet).

## Verify
For each slice give me a short "you should see" checklist and a debug table of likely symptoms and causes (curved walls, flicker, stuck in walls). Final check: 60 FPS, no wall clipping, fog darkens the distance.

## Rules for this session
- Read `Plan.md` and `.github/copilot-instructions.md` first. Follow the phase tasks exactly; do not add features from later phases.
- Work in small vertical slices. After each slice, tell me what to run and what I should see before moving on.
- Give exact file paths and complete runnable code (no "..." placeholders in code I must paste).
- Explain non-obvious math or design choices in one or two lines.
- Do NOT tick checkboxes yet. When I say the work is verified, I will run `/confirm-tasks`.
- If something in Plan.md conflicts with what the code needs, stop and ask me one short question.
