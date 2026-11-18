---
description: "Phase 6: audio, flashlight, vignette, jumpscare, atmosphere (Aswang Maze)"
agent: agent
---
# Phase 6: Horror Polish

Skill to read first: `.github/skills/aswang-horror-polish/SKILL.md`.

## Goal
Make it genuinely scary without hurting performance or accessibility.

## Tasks (from Plan.md Phase 6)
- `audio.js`: one AudioContext unlocked on first click, buses (master, sfx, ambient, heartbeat), buffer preloading, volume from Settings.
- Tension meter (0 to 1) computed from nearest enemy path distance and CHASE state, smoothed over time; every effect reads from it.
- Ambient loop, footsteps with 3 to 4 variants and random pitch, faster when sprinting.
- Dynamic heartbeat: tempo and volume follow tension, silent when calm.
- Stereo-panned, distance-attenuated, low-pass-filtered enemy growls and whispers.
- Vignette using a precomputed radial gradient; flashlight cone using `destination-out`; flicker and short blackouts when tension is high.
- Head bob (under 6 px at internal resolution) and a setting to disable it.
- Fog constant that tightens with tension.
- Screen shake and the full jumpscare sequence (zoom, cut, scream, fade to Game Over).
- "Reduce flashing and sudden loud sounds" setting that replaces the jumpscare with a fade to red.
- Atmospheric title screen styling (dark, glitch text).
- Wall textures if Phase 2 slice 7 was skipped.
- A Credits entry listing every sound and texture source and license.

Use only free assets (freesound.org, pixabay.com, opengameart.org) and tell me exactly where to put each file under `wwwroot/assets/`. Provide procedural fallbacks (oscillator heartbeat, noise footsteps) so the game works before I download assets.

## Verify
A checklist: audio unlocks without console warnings, heartbeat follows tension smoothly, left/right enemy audio is correct with headphones, reduce-effects works, and 60 FPS holds with all effects on.

## Rules for this session
- Read `Plan.md` and `.github/copilot-instructions.md` first. Follow the phase tasks exactly; do not add features from later phases.
- Work in small vertical slices. After each slice, tell me what to run and what I should see before moving on.
- Give exact file paths and complete runnable code (no "..." placeholders in code I must paste).
- Explain non-obvious math or design choices in one or two lines.
- Do NOT tick checkboxes yet. When I say the work is verified, I will run `/confirm-tasks`.
- If something in Plan.md conflicts with what the code needs, stop and ask me one short question.
